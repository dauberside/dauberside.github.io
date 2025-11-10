#!/usr/bin/env node
import http from 'node:http';
import url from 'node:url';
import os from 'node:os';
import { Buffer } from 'node:buffer';

const PORT = Number(process.env.PORT || process.env.MCP_PORT || 5050);
const KB_API_URL = (process.env.KB_API_URL || '').trim();
const KB_API_PORT = Number(process.env.KB_API_PORT || 4040);
const KB_API_BASE = KB_API_URL || `http://127.0.0.1:${KB_API_PORT}`;
const KB_API_TOKEN = (process.env.KB_API_TOKEN || '').trim();

// CORS / Auth toggles
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ORIGIN_ENFORCE = ALLOWED_ORIGINS.length > 0;
const MCP_API_TOKEN = (process.env.MCP_API_TOKEN || '').trim();
const MCP_API_BASIC = (process.env.MCP_API_BASIC || '0') === '1';
function parseBasicUsers(raw) {
  const map = new Map();
  const s = (raw || process.env.ADMIN_BASIC_USERS || '').trim();
  if (!s) return map;
  // ';' 区切り or ',' 区切りの両対応
  const pairs = s.includes(';') ? s.split(';') : s.split(',');
  for (const pair of pairs) {
    const [u, p] = pair.split(':');
    if (u && p) map.set(u, p);
  }
  return map;
}
const BASIC_USERS = parseBasicUsers();
function corsHeaders(origin) {
  const headers = {};
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
    headers['Vary'] = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';
  }
  return headers;
}
function unauthorized(res, headers, type = 'unauthorized') {
  const h = { ...headers };
  if (MCP_API_BASIC && BASIC_USERS.size > 0) {
    h['WWW-Authenticate'] = 'Basic realm="mcp"';
  }
  res.writeHead(type === 'forbidden' ? 403 : 401, h);
  res.end(JSON.stringify({ error: type }));
}
function isAuthorized(req) {
  const tokenEnabled = !!MCP_API_TOKEN;
  const basicEnabled = MCP_API_BASIC && BASIC_USERS.size > 0;
  if (!tokenEnabled && !basicEnabled) return true;
  const auth = req.headers['authorization'] || '';
  if (tokenEnabled) {
    const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    const apiKey = req.headers['x-api-key'];
    if (bearer === MCP_API_TOKEN || apiKey === MCP_API_TOKEN) return true;
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

function log(...args) { console.log('[mcp]', ...args); }

// Simple metrics
const startedAt = Date.now();
const metrics = {
  startedAt,
  host: os.hostname(),
  totalRequests: 0,
  totalErrors: 0,
  routes: Object.create(null),
};
function rec(route, status, ms) {
  metrics.totalRequests += 1;
  if (status >= 400) metrics.totalErrors += 1;
  const r = (metrics.routes[route] ||= { count: 0, errorCount: 0, totalMs: 0 });
  r.count += 1; if (status >= 400) r.errorCount += 1; r.totalMs += ms;
}

const server = http.createServer((req, res) => {
  const t0 = process.hrtime.bigint();
  const u = new url.URL(req.url, `http://localhost:${PORT}`);
  const origin = req.headers['origin'];
  // CORS preflight
  if (req.method === 'OPTIONS') {
    const ph = { ...corsHeaders(origin), 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' };
    res.writeHead(204, ph); res.end();
    const t1 = process.hrtime.bigint(); rec('OPTIONS', 204, Number(t1 - t0) / 1e6); return;
  }
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };
  // Enforce origin allowlist (when configured)
  if (origin && ORIGIN_ENFORCE && !ALLOWED_ORIGINS.includes(origin)) {
    unauthorized(res, headers, 'forbidden');
    const t1 = process.hrtime.bigint(); rec('FORBIDDEN', 403, Number(t1 - t0) / 1e6); return;
  }
  if (u.pathname === '/healthz') {
    res.writeHead(200, headers); res.end(JSON.stringify({ ok: true }));
    const t1 = process.hrtime.bigint(); rec('/healthz', 200, Number(t1 - t0) / 1e6); return;
  }
  if (u.pathname === '/') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      name: 'mcp-server',
      version: '0.0.1',
      ok: true,
      endpoints: {
        healthz: '/healthz',
        info: '/info',
        metrics: '/metrics',
        kb_search: '/kb/search'
      }
    }));
    const t1 = process.hrtime.bigint(); rec('/', 200, Number(t1 - t0) / 1e6); return;
  }
  if (u.pathname === '/info') {
    res.writeHead(200, headers); res.end(JSON.stringify({
      name: 'mcp-server',
      version: '0.0.1',
      features: {
        kbSearch: {
          getQueryKeys: ['q', 'topK'],
          postBodyKeys: ['query', 'q', 'topK']
        }
      }
    }));
    const t1 = process.hrtime.bigint(); rec('/info', 200, Number(t1 - t0) / 1e6); return;
  }
  if (u.pathname === '/metrics') {
    const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, uptimeSec, startedAt, host: metrics.host, totalRequests: metrics.totalRequests, totalErrors: metrics.totalErrors, routes: metrics.routes }));
    const t1 = process.hrtime.bigint(); rec('/metrics', 200, Number(t1 - t0) / 1e6); return;
  }
  if (u.pathname === '/kb/search') {
    if (!isAuthorized(req)) { unauthorized(res, headers, 'unauthorized'); const t1 = process.hrtime.bigint(); rec('/kb/search', 401, Number(t1 - t0) / 1e6); return; }
    // Proxy to kb-api GET/POST
    const topK = u.searchParams.get('topK');
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    const method = req.method || 'GET';
    const outHeaders = { 'Accept': 'application/json' };
    if (KB_API_TOKEN) {
      outHeaders['X-API-Key'] = KB_API_TOKEN;
    }
    const done = (code, bodyObj) => {
      res.writeHead(code, headers);
      res.end(JSON.stringify(bodyObj));
      const t1 = process.hrtime.bigint(); rec('/kb/search', code, Number(t1 - t0) / 1e6);
    };
    if (method === 'POST') {
      // read body
      const chunks = [];
      let size = 0;
      const limit = 1024 * 1024;
      req.on('data', (c) => {
        size += c.length; if (size > limit) { try { req.destroy(); } catch {} }
        else chunks.push(c);
      });
      req.on('end', async () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const body = raw ? JSON.parse(raw) : {};
          const bodyQuery = body.query || body.q || '';
          const bodyTopK = body.topK ?? (topK ? Number(topK) : undefined);
          const resp = await fetch(`${KB_API_BASE}/search`, {
            method: 'POST',
            headers: { ...outHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: bodyQuery || q || '', topK: bodyTopK }),
          });
          const text = await resp.text();
          if (!resp.ok) return done(resp.status, { error: 'kb_api_error', body: text });
          return done(200, JSON.parse(text));
        } catch (e) {
          return done(500, { error: 'proxy_error', message: String(e?.message || e) });
        }
      });
      return;
    }
    // default GET
    (async () => {
      try {
        const base = new url.URL(`${KB_API_BASE}/search`);
        if (q) base.searchParams.set('q', q);
        if (topK) base.searchParams.set('topK', topK);
        const resp = await fetch(base.toString(), { method: 'GET', headers: outHeaders });
        const text = await resp.text();
        if (!resp.ok) return done(resp.status, { error: 'kb_api_error', body: text });
        return done(200, JSON.parse(text));
      } catch (e) {
        return done(500, { error: 'proxy_error', message: String(e?.message || e) });
      }
    })();
    return;
  }
  res.writeHead(404, headers); res.end(JSON.stringify({ error: 'not_found' }));
  const t1 = process.hrtime.bigint(); rec('404', 404, Number(t1 - t0) / 1e6);
});

server.listen(PORT, () => log(`MCP skeleton listening on :${PORT}`));
