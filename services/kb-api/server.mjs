#!/usr/bin/env node
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import os from 'node:os';

const PORT = Number(process.env.PORT || process.env.KB_API_PORT || 4040);
const KB_INDEX_PATH = process.env.KB_INDEX_PATH || path.join(process.cwd(), '..', '..', 'kb', 'index', 'embeddings.json');
const KB_EMBED_MODE = (process.env.KB_EMBED_MODE || 'openai').toLowerCase(); // 'openai' | 'hash' | 'mock'
const KB_EMBED_DIM = Number(process.env.KB_EMBED_DIM || 256);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const KB_API_MOCK = (process.env.KB_API_MOCK || '0') === '1';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ORIGIN_ENFORCE = ALLOWED_ORIGINS.length > 0; // Origin があり未許可なら 403

// Auth config (either Bearer token or BASIC via ADMIN_BASIC_USERS)
const KB_API_TOKEN = process.env.KB_API_TOKEN || '';
const KB_API_BASIC = (process.env.KB_API_BASIC || '0') === '1';
function parseBasicUsers(raw) {
  const map = new Map();
  const s = (raw || process.env.ADMIN_BASIC_USERS || '').trim();
  if (!s) return map;
  for (const pair of s.split(';')) {
    const [u, p] = pair.split(':');
    if (u && p) map.set(u, p);
  }
  return map;
}
const BASIC_USERS = parseBasicUsers(process.env.ADMIN_BASIC_USERS);

/** Simple in-memory cache */
let kbCache = null; // { items: Array<{embedding:number[], text:string, source?:string}> }

function log(...args) { console.log('[kb-api]', ...args); }
function warn(...args) { console.warn('[kb-api]', ...args); }

// Safety guard: KB_API_MOCK must NOT be enabled in production
if (process.env.NODE_ENV === 'production' && KB_API_MOCK) {
  console.error('[kb-api] FATAL: KB_API_MOCK=1 is not allowed in production. Unset KB_API_MOCK and restart.');
  process.exit(1);
}

// In-memory metrics
const startedAt = Date.now();
const metrics = {
  startedAt,
  host: os.hostname(),
  totalRequests: 0,
  totalErrors: 0,
  routes: Object.create(null), // key -> { count, errorCount, totalMs }
};

function rec(route, status, ms) {
  metrics.totalRequests += 1;
  if (status >= 400) metrics.totalErrors += 1;
  const r = (metrics.routes[route] ||= { count: 0, errorCount: 0, totalMs: 0 });
  r.count += 1; if (status >= 400) r.errorCount += 1; r.totalMs += ms;
}

let reqIdSeq = 0;
function rid() { return `${(++reqIdSeq).toString(36)}-${Date.now().toString(36)}`; }

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y; na += x * x; nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

async function loadKB() {
  if (!fs.existsSync(KB_INDEX_PATH)) {
    throw new Error(`KB index not found at ${KB_INDEX_PATH}`);
  }
  const raw = await readFile(KB_INDEX_PATH, 'utf8');
  const data = JSON.parse(raw);
  // Support various shapes: [ ... ], { items: [...] }, or { data: [...] }
  const arr = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.data)
        ? data.data
        : [];
  const items = arr.map((it) => {
    const embedding = it.embedding || it.vector || it.values || [];
    const text = it.text || it.content || it.chunk || '';
    const source = it.source || it.path || it.file || '';
    return { embedding, text, source };
  }).filter((it) => Array.isArray(it.embedding) && it.embedding.length && (it.text || it.source));
  kbCache = { items };
  log(`Loaded KB index: ${items.length} items from ${KB_INDEX_PATH}`);
}

const EMBED_TIMEOUT_MS = Number(process.env.KB_API_EMBED_TIMEOUT_MS || 10000);
const EMBED_RETRIES = Number(process.env.KB_API_EMBED_RETRIES || 1);

async function embedQuery(text) {
  if (KB_API_MOCK) {
    // Mock embedding for smoke tests: single-dimension vector
    return [1];
  }
  if (KB_EMBED_MODE === 'hash') {
    return hashEmbed(text, KB_EMBED_DIM);
  }
  // default: openai
  if (!OPENAI_API_KEY) throw new Error('missing OPENAI_API_KEY');
  const body = { model: 'text-embedding-3-small', input: text };
  let lastErr;
  for (let attempt = 0; attempt <= EMBED_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
    try {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`embed failed: ${resp.status} ${t}`);
      }
      const json = await resp.json();
      return json.data?.[0]?.embedding || [];
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < EMBED_RETRIES) {
        warn('embed retry', attempt + 1, '/', EMBED_RETRIES, String(e?.message || e));
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error('embed failed');
}

// --- Local embedding utilities (must match builder) ---
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function hashEmbed(text, dim = 256) {
  const v = new Float32Array(dim);
  const toks = tokenize(text);
  if (toks.length === 0) return Array.from(v);
  const tf = new Map();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [t, f] of tf.entries()) {
    const h = fnv1a(t);
    const idx = h % dim;
    const w = 1 + Math.log(1 + f);
    v[idx] += w;
  }
  let norm = 0; for (let i = 0; i < dim; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1; for (let i = 0; i < dim; i++) v[i] = v[i] / norm;
  return Array.from(v);
}

function corsHeaders(origin) {
  const headers = {};
  if (origin && (ALLOWED_ORIGINS.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Vary'] = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';
  }
  return headers;
}

function unauthorized(res, headers, type = 'unauthorized') {
  const h = { ...headers };
  if (KB_API_BASIC && BASIC_USERS.size > 0) {
    h['WWW-Authenticate'] = 'Basic realm="kb-api"';
  }
  res.writeHead(type === 'forbidden' ? 403 : 401, h);
  res.end(JSON.stringify({ error: type }));
}

function isAuthorized(req) {
  // If neither token nor basic configured, allow
  const tokenEnabled = !!KB_API_TOKEN;
  const basicEnabled = KB_API_BASIC && BASIC_USERS.size > 0;
  if (!tokenEnabled && !basicEnabled) return true;

  const auth = req.headers['authorization'] || '';
  if (tokenEnabled) {
    const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    const apiKey = req.headers['x-api-key'];
    if (bearer === KB_API_TOKEN || apiKey === KB_API_TOKEN) return true;
  }
  if (basicEnabled && auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice('Basic '.length), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx > 0) {
        const u = decoded.slice(0, idx);
        const p = decoded.slice(idx + 1);
        if (BASIC_USERS.get(u) === p) return true;
      }
    } catch {}
  }
  return false;
}

async function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', (e) => reject(e));
  });
}

async function handleSearch(req, res, urlObj, bodyObj) {
  try {
    const q = (bodyObj?.query ?? bodyObj?.q ?? urlObj.searchParams.get('q') ?? urlObj.searchParams.get('query') ?? '').toString();
    const topKNum = bodyObj?.topK ?? urlObj.searchParams.get('topK');
    const topK = Math.max(1, Math.min(20, Number(topKNum ?? '5')));
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing query' }));
      return;
    }
    if (!kbCache) await loadKB();
    const qvec = await embedQuery(q);
    const scored = kbCache.items.map((it) => ({
      score: cosine(qvec, it.embedding),
      text: it.text,
      source: it.source,
    })).sort((a, b) => b.score - a.score).slice(0, topK);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hits: scored }));
  } catch (e) {
    warn('search error', e?.message || e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error', message: String(e?.message || e) }));
  }
}

const server = http.createServer(async (req, res) => {
  const id = rid();
  const t0 = process.hrtime.bigint();
  const origin = req.headers['origin'];
  const urlObj = new url.URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    const headers = {
      ...corsHeaders(origin),
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json',
    };
    res.writeHead(204, headers);
    res.end();
    const t1 = process.hrtime.bigint();
    rec('OPTIONS', 204, Number(t1 - t0) / 1e6);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  };

  // Enforce Origin allowlist if configured and Origin header exists
  if (origin && ORIGIN_ENFORCE && !ALLOWED_ORIGINS.includes(origin)) {
    unauthorized(res, headers, 'forbidden');
    return;
  }

  if (urlObj.pathname === '/healthz') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true }));
    const t1 = process.hrtime.bigint();
    rec('/healthz', 200, Number(t1 - t0) / 1e6);
    return;
  }
  if (urlObj.pathname === '/metrics') {
    const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      ok: true,
      uptimeSec,
      startedAt,
      host: metrics.host,
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      routes: metrics.routes,
    }));
    const t1 = process.hrtime.bigint();
    rec('/metrics', 200, Number(t1 - t0) / 1e6);
    return;
  }
  if (urlObj.pathname === '/reload') {
    if (!isAuthorized(req)) return unauthorized(res, headers, 'unauthorized');
    try {
      kbCache = null; await loadKB();
      res.writeHead(200, headers);
      res.end(JSON.stringify({ reloaded: true }));
      const t1 = process.hrtime.bigint();
      rec('/reload', 200, Number(t1 - t0) / 1e6);
    } catch (e) {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ reloaded: false, error: String(e?.message || e) }));
      const t1 = process.hrtime.bigint();
      rec('/reload', 500, Number(t1 - t0) / 1e6);
    }
    return;
  }
  if (urlObj.pathname === '/search') {
    if (!isAuthorized(req)) return unauthorized(res, headers, 'unauthorized');
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        await handleSearch(req, res, urlObj, body);
        const t1 = process.hrtime.bigint();
        rec('POST /search', 200, Number(t1 - t0) / 1e6);
      } catch (e) {
        const code = String(e?.message || '').includes('payload_too_large') ? 413 : 400;
        res.writeHead(code, headers);
        res.end(JSON.stringify({ error: String(e?.message || e) }));
        const t1 = process.hrtime.bigint();
        rec('POST /search', code, Number(t1 - t0) / 1e6);
      }
      return;
    }
    // default GET
    await handleSearch(req, res, urlObj, null);
    const t1 = process.hrtime.bigint();
    rec('GET /search', 200, Number(t1 - t0) / 1e6);
    return;
  }
  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: 'not_found' }));
  const t1 = process.hrtime.bigint();
  rec('404', 404, Number(t1 - t0) / 1e6);
});

server.listen(PORT, () => {
  log(`KB API listening on :${PORT} (KB_INDEX_PATH=${KB_INDEX_PATH})`);
});
