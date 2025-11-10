#!/usr/bin/env node
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || args.p || 3030);
  const token = String(args.token || args.t || process.env.INTERNAL_API_TOKEN || 'devtoken');
  const input = String(args.input || args.i || 'say hello');
  const mockFlag = args.mock === 'false' || args['no-mock'] ? false : true; // default true
  const timeoutSec = Number(args['health-timeout'] || args.w || 30);
  const host = String(args.host || 'localhost');
  const base = args.base ? String(args.base) : `http://${host}:${port}`;
  const health = `${base}/api/healthz`;

  let ready = false;
  for (let i = 0; i < timeoutSec; i++) {
    try {
      const res = await fetch(health);
      if (res.ok) { ready = true; break; }
    } catch {}
    await sleep(1000);
  }
  if (!ready) {
    console.error(`[smoke] healthz did not become ready within ${timeoutSec}s`);
  } else {
    console.log('[smoke] healthz OK');
  }

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
    console.log('[smoke] run status', res.status);
    console.log('[smoke] run body  ', text);
  } catch (e) {
    console.error('[smoke] run failed:', e.message);
  }
}

main().catch((e) => {
  console.error('[smoke] failed:', e.message);
  process.exit(1);
});
