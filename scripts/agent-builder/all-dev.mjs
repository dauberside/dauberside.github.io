#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const out = {};
  const a = [...argv];
  while (a.length) {
    const tok = a.shift();
    if (!tok.startsWith('-')) continue;
    const [k, vRaw] = tok.includes('=') ? tok.split('=') : [tok, undefined];
    const key = k.replace(/^--?/, '');
    let v = vRaw;
    if (v === undefined && a[0] && !a[0].startsWith('-')) v = a.shift();
    if (v === undefined) v = 'true';
    out[key] = v;
  }
  return out;
}

async function run(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function execPipeline() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || args.p || 3030);
  const token = String(args.token || args.t || process.env.INTERNAL_API_TOKEN || 'devtoken');
  const input = String(args.input || args.i || 'say hello');
  const mockFlag = args.mock === 'false' || args['no-mock'] ? false : true; // default true
  const timeoutSec = Number(args['health-timeout'] || args.w || 30);
  const host = String(args.host || 'localhost');

  // 1) validate → generate → build
  await run('pnpm', ['-s', 'agent:builder:validate']);
  await run('pnpm', ['-s', 'agent:builder:generate']);
  await run('pnpm', ['-s', 'build']);

  // 2) start dev on :port with INTERNAL_API_TOKEN
  const env = { ...process.env, INTERNAL_API_TOKEN: token };
  console.log(`[all-dev] starting dev on :${port} with INTERNAL_API_TOKEN=${token}`);
  const dev = spawn('pnpm', ['-s', 'next', 'dev', '-p', String(port)], { env, stdio: 'inherit' });

  const stop = () => { try { dev.kill('SIGINT'); } catch {} };
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });

  // 3) wait for /healthz
  const base = `http://${host}:${port}`;
  const health = `${base}/api/healthz`;
  let ready = false;
  for (let i = 0; i < timeoutSec; i++) {
    try {
      const res = await fetch(health);
      if (res.ok) { ready = true; break; }
    } catch {}
    await sleep(1000);
  }
  if (!ready) console.error(`[all-dev] healthz did not become ready within ${timeoutSec}s`);
  else console.log('[all-dev] healthz OK');

  // 4) smoke: POST /api/agent/run (mock optional)
  const qs = mockFlag ? '?mock=1' : '';
  try {
    const res = await fetch(`${base}/api/agent/run${qs}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify({ input }),
    });
    const text = await res.text();
    console.log('[all-dev] run status', res.status);
    console.log('[all-dev] run body  ', text);
  } catch (e) {
    console.error('[all-dev] run failed:', e.message);
  }

  console.log(`\n[all-dev] Dev server is running on ${base}. Press Ctrl+C to stop.`);
  await new Promise(() => {});
}

execPipeline().catch((e) => {
  console.error('[all-dev] pipeline failed:', e.message);
  process.exit(1);
});
