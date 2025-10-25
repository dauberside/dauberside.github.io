#!/usr/bin/env node
/*
  Minimal KB index builder (files -> chunks -> OpenAI embeddings -> JSON index)
  - Input: Markdown files under docs/ by default (extend via KB_SOURCES, e.g., Obsidian Vault)
  - Output: kb/index/embeddings.json (stored on your SSD alongside this repo)

  Requirements:
  - Node 20+
  - env OPENAI_API_KEY

  Usage:
    pnpm kb:build

  Notes:
  - This is a simple filesystem JSON index for demo/small scale use.
  - For large scale, prefer a proper vector DB (Qdrant/pgvector) and streaming ingestion.
*/

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment from .env.local first (if present), then .env
const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, '.env.local');
const ENV_FILE = path.join(ROOT, '.env');
// Try dotenv config first
if (fsSync.existsSync(ENV_LOCAL)) dotenv.config({ path: ENV_LOCAL, override: false });
if (fsSync.existsSync(ENV_FILE)) dotenv.config({ path: ENV_FILE, override: false });

// Fallback: manually parse and merge if keys still missing
function mergeEnv(p) {
  try {
    const buf = fsSync.readFileSync(p);
    const parsed = dotenv.parse(buf);
    for (const [k, v] of Object.entries(parsed)) {
      // Allow overriding empty values; especially for OPENAI_API_KEY which must be non-empty
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
    }
  } catch {}
}
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_LOCAL)) mergeEnv(ENV_LOCAL);
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_FILE)) mergeEnv(ENV_FILE);

// Last resort: minimal manual extraction for OPENAI_API_KEY to handle exotic .env formatting
function extractKey(p, name) {
  try {
    const txt = fsSync.readFileSync(p, 'utf8');
    const lines = txt.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.replace(/[\uFEFF\u200B]/g, '').trim();
      if (!line || line.startsWith('#')) continue;
      const clean = line.startsWith('export ') ? line.slice(7).trim() : line;
      const idx = clean.indexOf('=');
      if (idx === -1) continue;
      const k = clean.slice(0, idx).trim();
      if (k !== name) continue;
      let v = clean.slice(idx + 1).trim();
      // strip surrounding quotes if present
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[name] === undefined && v) process.env[name] = v;
      break;
    }
  } catch {}
}
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_LOCAL)) extractKey(ENV_LOCAL, 'OPENAI_API_KEY');
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_FILE)) extractKey(ENV_FILE, 'OPENAI_API_KEY');

// Force-set as last attempt (override even empty/non-empty) for this one critical key
function forceExtractKey(p, name) {
  try {
    const txt = fsSync.readFileSync(p, 'utf8');
    const m = txt.replace(/[\uFEFF\u200B]/g, '').match(new RegExp(`(?:^|\\n)\s*(?:export\\s+)?${name}\\s*=\\s*(.+)`, 'm'));
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v) process.env[name] = v;
    }
  } catch {}
}
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_LOCAL)) forceExtractKey(ENV_LOCAL, 'OPENAI_API_KEY');
if (!process.env.OPENAI_API_KEY && fsSync.existsSync(ENV_FILE)) forceExtractKey(ENV_FILE, 'OPENAI_API_KEY');

const MODEL = process.env.KB_EMBEDDING_MODEL || 'text-embedding-3-small';
const SOURCES = (process.env.KB_SOURCES || 'docs').split(',').map(s => s.trim());
const INCLUDE_CANVAS = /^(1|true)$/i.test(process.env.KB_INCLUDE_CANVAS || '0');
const INCLUDE_BASE = /^(1|true)$/i.test(process.env.KB_INCLUDE_BASE || '0');
const OUT_DIR = path.join(ROOT, 'kb', 'index');
const OUT_FILE = process.env.KB_INDEX_PATH || path.join(OUT_DIR, 'embeddings.json');

if (!process.env.OPENAI_API_KEY) {
  const tried = [];
  tried.push(`${ENV_LOCAL}:${fsSync.existsSync(ENV_LOCAL) ? 'exists' : 'missing'}`);
  tried.push(`${ENV_FILE}:${fsSync.existsSync(ENV_FILE) ? 'exists' : 'missing'}`);
  console.error(
    `missing OPENAI_API_KEY (set in .env.local and re-run)\n` +
    `cwd=${ROOT}\n` +
    `checked env files: ${tried.join(', ')}`
  );
  process.exit(1);
}

function isIgnored(p) {
  // ignore VCS/build caches, node_modules, our own kb output, and Obsidian config dir
  return (
    /(^|\/)\.(git|next|cache)\//.test(p) ||
    /(^|\/)\.obsidian(\/|$)/.test(p) ||
    /node_modules\//.test(p) ||
    /(^|\/)kb\//.test(p)
  );
}

async function listSourceFiles(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      const rel = path.relative(ROOT, p);
      if (isIgnored(rel)) continue;
      if (ent.isDirectory()) {
        await walk(p);
      } else if (ent.isFile()) {
        const name = ent.name.toLowerCase();
        if (/\.(md|mdx)$/i.test(name)) out.push(p);
        else if (INCLUDE_CANVAS && name.endsWith('.canvas')) out.push(p);
        else if (INCLUDE_BASE && name.endsWith('.base')) out.push(p);
      }
    }
  }
  await walk(dir);
  return out;
}

function flattenStrings(obj, acc = []) {
  if (obj == null) return acc;
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s) acc.push(s);
    return acc;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) flattenStrings(v, acc);
    return acc;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) flattenStrings(obj[k], acc);
    return acc;
  }
  return acc;
}

async function readAsText(file) {
  const lower = file.toLowerCase();
  if (/(\.md|\.mdx)$/i.test(lower)) {
    return fs.readFile(file, 'utf8');
  }
  if (lower.endsWith('.canvas')) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const json = JSON.parse(raw);
      const parts = [];
      const nodes = Array.isArray(json.nodes) ? json.nodes : [];
      for (const n of nodes) {
        const t = (n && typeof n === 'object' && typeof n.text === 'string') ? n.text : null;
        if (t && t.trim()) parts.push(t.trim());
        // Some canvas nodes reference files; capture filename as context
        if (n && typeof n.file === 'string') parts.push(`File: ${n.file}`);
      }
      const edges = Array.isArray(json.edges) ? json.edges : [];
      for (const e of edges) {
        if (e && typeof e.label === 'string' && e.label.trim()) parts.push(`Edge: ${e.label.trim()}`);
      }
      const text = parts.join('\n\n');
      return text || raw; // fallback to raw JSON if nothing extracted
    } catch {
      // fallback: index as plain text
      return fs.readFile(file, 'utf8');
    }
  }
  if (lower.endsWith('.base')) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const json = JSON.parse(raw);
      const parts = flattenStrings(json, []);
      const text = parts.join('\n\n');
      return text || raw;
    } catch {
      return fs.readFile(file, 'utf8');
    }
  }
  // default
  return fs.readFile(file, 'utf8');
}

function chunkText(text, size = 1200, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    const slice = text.slice(i, end);
    chunks.push(slice);
    if (end === text.length) break;
    i += size - overlap;
  }
  return chunks;
}

async function embedBatch(inputs) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Embeddings failed: HTTP ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.data.map(d => d.embedding);
}

async function main() {
  const files = [];
  for (const src of SOURCES) {
    const dir = path.join(ROOT, src);
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) {
        const list = await listSourceFiles(dir);
        files.push(...list);
      }
    } catch {
      // ignore missing dirs
    }
  }

  files.sort();
  console.log(`Found ${files.length} source files under: ${SOURCES.join(', ')}${INCLUDE_CANVAS ? ' [+canvas]' : ''}${INCLUDE_BASE ? ' [+base]' : ''}`);
  const all = [];
  let globalChunkId = 0;

  for (const file of files) {
  const rel = path.relative(ROOT, file);
  const raw = await readAsText(file);
    const chunks = chunkText(raw);

    // embed in small batches to avoid very large payloads
    const batchSize = 32;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      const embs = await embedBatch(slice);
      for (let j = 0; j < slice.length; j++) {
        all.push({
          id: globalChunkId++,
          source: rel,
          chunk_index: i + j,
          text: slice[j],
          embedding: embs[j],
        });
      }
    }
    console.log(`Indexed: ${rel} (${chunks.length} chunks)`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const out = {
    model: MODEL,
    created_at: new Date().toISOString(),
    root: ROOT,
    files: files.length,
    chunks: all.length,
    data: all,
  };
  await fs.writeFile(OUT_FILE, JSON.stringify(out));
  console.log(`Wrote index: ${path.relative(ROOT, OUT_FILE)} (chunks=${all.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
