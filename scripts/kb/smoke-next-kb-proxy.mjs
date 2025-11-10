#!/usr/bin/env node
/**
 * Smoke test for Next /api/kb/search proxy/fallback behavior.
 *
 * Usage:
 *   node scripts/kb/smoke-next-kb-proxy.mjs          # read-only check (no restart)
 *   node scripts/kb/smoke-next-kb-proxy.mjs --toggle # restart next-app to force proxy on/off (requires PM2)
 */
import http from 'node:http';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

const NEXT_HOST = process.env.NEXT_HOST || '127.0.0.1';
const NEXT_PORT = Number(process.env.NEXT_PORT || 3030);
const KB_PORT = Number(process.env.KB_API_PORT || 4040);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const options = {
      hostname: NEXT_HOST,
      port: NEXT_PORT,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}),
      },
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: raw });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function checkOnce(label) {
  const q = encodeURIComponent('テスト');
  const r = await req('GET', `/api/kb/search?q=${q}&topK=1`);
  const hdr = (r.headers['x-kb-proxy'] || '').toString();
  console.log(`[${label}] status=${r.status}, X-KB-Proxy=${hdr || '(none)'}:`);
  if (r.status !== 200) {
    console.log(r.body);
  }
  return hdr;
}

async function pm2RestartWithEnv(vars) {
  const envStr = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(' ');
  const cmd = `${envStr} npx -y pm2 restart next-app --update-env`;
  console.log('[pm2]', cmd);
  await exec(cmd);
  await delay(2000);
}

(async () => {
  const toggle = process.argv.includes('--toggle');

  console.log('[smoke:next-kb] Checking current behavior...');
  const before = await checkOnce('before');

  if (!toggle) {
    console.log('[smoke:next-kb] Done (read-only). Use --toggle to force proxy/fallback and verify both paths.');
    process.exit(0);
  }

  console.log('[smoke:next-kb] Forcing proxy on...');
  await pm2RestartWithEnv({ KB_API_PROXY: 1, KB_API_URL: `http://127.0.0.1:${KB_PORT}` });
  const proxied = await checkOnce('proxy-on');

  console.log('[smoke:next-kb] Reverting proxy env...');
  await pm2RestartWithEnv({ KB_API_PROXY: '', KB_API_URL: '' });
  const after = await checkOnce('after');

  // Expect X-KB-Proxy to be 'kb-api' when proxy is on
  if (proxied !== 'kb-api') {
    console.error('[smoke:next-kb] Expected X-KB-Proxy=kb-api on proxy-on step, got', proxied);
    process.exit(1);
  }

  console.log('[smoke:next-kb] Success.');
})();
