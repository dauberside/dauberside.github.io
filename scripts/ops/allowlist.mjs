#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const SERVICES_ENV = path.join(ROOT, 'services', '.env');

function usage() {
  console.log(`Usage:
  pnpm ops:allowlist:list
  pnpm ops:allowlist:add <ip>
  pnpm ops:allowlist:remove <ip>

Notes:
  - Edits services/.env ADMIN_IP_ALLOWLIST (CSV) and reloads PM2 next-app with --update-env.
  - Set OPS_ALLOWLIST_NO_RELOAD=1 to skip PM2 reload.
`);
}

function parseCsv(val) {
  return (val || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stringifyCsv(arr) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).join(',');
}

function isLikelyIp(ip) {
  // Allow IPv4, IPv6, and simple hostnames; keep validation loose to not block tailnet hostnames
  const ipv4 = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;
  const ipv6 = /:/; // heuristic
  const hostname = /^[a-zA-Z0-9.-]+$/;
  return ipv4.test(ip) || ipv6.test(ip) || hostname.test(ip);
}

async function readEnvText() {
  if (!fs.existsSync(SERVICES_ENV)) return '';
  return await fsp.readFile(SERVICES_ENV, 'utf8');
}

function getCurrentAllowlistFromText(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (key === 'ADMIN_IP_ALLOWLIST') {
      return trimmed.slice(idx + 1).trim();
    }
  }
  return '';
}

function setAllowlistInText(text, newCsv) {
  const lines = text.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const raw = line;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return raw;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return raw;
    const key = trimmed.slice(0, idx).trim();
    if (key === 'ADMIN_IP_ALLOWLIST') {
      found = true;
      return `ADMIN_IP_ALLOWLIST=${newCsv}`;
    }
    return raw;
  });
  if (!found) {
    out.push(`ADMIN_IP_ALLOWLIST=${newCsv}`);
  }
  return out.join('\n');
}

async function reloadPm2() {
  if (process.env.OPS_ALLOWLIST_NO_RELOAD === '1') {
    console.log('[allowlist] Skipping PM2 reload due to OPS_ALLOWLIST_NO_RELOAD=1');
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
  if (ok) console.log('[allowlist] PM2 reload next-app --update-env done');
  else console.warn('[allowlist] PM2 reload failed or not available; apply manually if needed');
}

async function main() {
  const [,, cmd, arg] = process.argv;
  if (!cmd || !['list', 'add', 'remove'].includes(cmd)) {
    usage();
    process.exit(cmd ? 1 : 0);
  }
  const text = await readEnvText();
  const currentCsv = getCurrentAllowlistFromText(text);
  const current = parseCsv(currentCsv);

  if (cmd === 'list') {
    console.log('ADMIN_IP_ALLOWLIST:', current.join(',') || '(empty)');
    return;
  }

  if (!arg) {
    console.error(`Missing <ip> argument for ${cmd}`);
    usage();
    process.exit(1);
  }
  const ip = arg.trim();
  if (!isLikelyIp(ip)) {
    console.error(`Invalid ip/host: ${ip}`);
    process.exit(1);
  }

  if (cmd === 'add') {
    if (current.includes(ip)) {
      console.log(`[allowlist] Already present: ${ip}`);
    } else {
      current.push(ip);
    }
  } else if (cmd === 'remove') {
    const before = current.length;
    const filtered = current.filter((x) => x !== ip);
    if (filtered.length === before) {
      console.log(`[allowlist] Not found: ${ip}`);
    }
    current.splice(0, current.length, ...filtered);
  }

  const newCsv = stringifyCsv(current);
  const newText = setAllowlistInText(text, newCsv);
  await fsp.mkdir(path.dirname(SERVICES_ENV), { recursive: true });
  await fsp.writeFile(SERVICES_ENV, newText, 'utf8');
  console.log(`[allowlist] Updated services/.env ADMIN_IP_ALLOWLIST=${newCsv || '(empty)'}`);

  await reloadPm2();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
