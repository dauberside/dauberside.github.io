#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const SERVICES_ENV = path.join(ROOT, 'services', '.env');

function usage() {
  console.log(`Usage:
  pnpm ops:basic:list
  pnpm ops:basic:add <user> <pass>
  pnpm ops:basic:remove <user>
  pnpm ops:basic:set-single <user> <pass>

Notes:
  - ADMIN_BASIC_USERS is a CSV of user:pass pairs.
  - ADMIN_BASIC_USER/ADMIN_BASIC_PASS represents a single legacy pair (middleware supports both).
  - Set OPS_BASIC_NO_RELOAD=1 to skip PM2 reload.
`);
}

async function readEnvText() {
  if (!fs.existsSync(SERVICES_ENV)) return '';
  return await fsp.readFile(SERVICES_ENV, 'utf8');
}

function parseEnv(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    map.set(key, val);
  }
  return map;
}

function serializeEnv(text, updates) {
  const lines = text.split(/\r?\n/);
  const keys = new Set(Object.keys(updates));
  const out = lines.map((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return raw;
    const idx = line.indexOf('=');
    if (idx === -1) return raw;
    const key = line.slice(0, idx).trim();
    if (keys.has(key)) {
      const val = updates[key];
      keys.delete(key);
      return `${key}=${val}`;
    }
    return raw;
  });
  for (const key of keys) {
    out.push(`${key}=${updates[key]}`);
  }
  return out.join('\n');
}

function parseUsers(csv) {
  return (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx <= 0) return null;
      return [pair.slice(0, idx), pair.slice(idx + 1)];
    })
    .filter(Boolean);
}

function stringifyUsers(pairs) {
  const uniq = new Map();
  for (const [u, p] of pairs) {
    if (!u) continue;
    uniq.set(u, p ?? '');
  }
  return Array.from(uniq.entries())
    .map(([u, p]) => `${u}:${p}`)
    .join(',');
}

async function reloadPm2() {
  if (process.env.OPS_BASIC_NO_RELOAD === '1') {
    console.log('[basic] Skipping PM2 reload due to OPS_BASIC_NO_RELOAD=1');
    return;
  }
  const tryRun = (cmd, args) =>
    new Promise((resolve) => {
      const ps = spawn(cmd, args, { stdio: 'inherit' });
      ps.on('error', () => resolve(false));
      ps.on('close', (code) => resolve(code === 0));
    });
  let ok = await tryRun('pm2', ['reload', 'next-app', '--update-env']);
  if (!ok) ok = await tryRun('npx', ['pm2', 'reload', 'next-app', '--update-env']);
  if (ok) console.log('[basic] PM2 reload next-app --update-env done');
  else console.warn('[basic] PM2 reload failed or not available; apply manually if needed');
}

async function main() {
  const [,, cmd, a1, a2] = process.argv;
  if (!cmd || !['list', 'add', 'remove', 'set-single'].includes(cmd)) {
    usage();
    process.exit(cmd ? 1 : 0);
  }
  const text = await readEnvText();
  const env = parseEnv(text);
  const usersCsv = env.get('ADMIN_BASIC_USERS') || '';
  const pairs = parseUsers(usersCsv);

  if (cmd === 'list') {
    const singleU = env.get('ADMIN_BASIC_USER');
    const singleP = env.get('ADMIN_BASIC_PASS');
    console.log('ADMIN_BASIC_USERS:', pairs.map(([u]) => u).join(',') || '(empty)');
    if (singleU || singleP) {
      console.log('ADMIN_BASIC_USER/PASS:', singleU ? `${singleU}:(hidden)` : '(unset)');
    }
    return;
  }

  if (cmd === 'add') {
    if (!a1 || !a2) {
      console.error('Usage: pnpm ops:basic:add <user> <pass>');
      process.exit(1);
    }
    const i = pairs.findIndex(([u]) => u === a1);
    if (i >= 0) pairs[i][1] = a2;
    else pairs.push([a1, a2]);
    const newCsv = stringifyUsers(pairs);
    const newText = serializeEnv(text, { ADMIN_BASIC_USERS: newCsv });
    await fsp.writeFile(SERVICES_ENV, newText, 'utf8');
    console.log(`[basic] Updated ADMIN_BASIC_USERS=${pairs.map(([u]) => u).join(',')}`);
    await reloadPm2();
    return;
  }

  if (cmd === 'remove') {
    if (!a1) {
      console.error('Usage: pnpm ops:basic:remove <user>');
      process.exit(1);
    }
    const filtered = pairs.filter(([u]) => u !== a1);
    const newCsv = stringifyUsers(filtered);
    const newText = serializeEnv(text, { ADMIN_BASIC_USERS: newCsv });
    await fsp.writeFile(SERVICES_ENV, newText, 'utf8');
    console.log(`[basic] Updated ADMIN_BASIC_USERS=${filtered.map(([u]) => u).join(',') || '(empty)'}`);
    await reloadPm2();
    return;
  }

  if (cmd === 'set-single') {
    if (!a1 || !a2) {
      console.error('Usage: pnpm ops:basic:set-single <user> <pass>');
      process.exit(1);
    }
    const newText = serializeEnv(text, {
      ADMIN_BASIC_USER: a1,
      ADMIN_BASIC_PASS: a2,
    });
    await fsp.writeFile(SERVICES_ENV, newText, 'utf8');
    console.log('[basic] Updated ADMIN_BASIC_USER/PASS');
    await reloadPm2();
    return;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
