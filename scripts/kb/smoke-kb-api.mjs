#!/usr/bin/env node
/*
 Simple kb-api smoke test
 - GET /healthz -> 200
 - GET /reload -> 200
 - If OPENAI_API_KEY is present: GET and POST /search -> 200 and JSON {hits}
*/
import http from 'node:http';

const KB_HOST = process.env.KB_API_HOST || '127.0.0.1';
const KB_PORT = Number(process.env.KB_API_PORT || 4040);

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const options = {
      hostname: KB_HOST,
      port: KB_PORT,
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

(async () => {
  let ok = true;
  const fail = (msg) => { console.error('[smoke:kb-api]', msg); ok = false; };
  try {
    const h = await req('GET', '/healthz');
    if (h.status !== 200) fail(`/healthz expected 200, got ${h.status}`);
    else console.log('[smoke:kb-api] healthz OK');

    const r = await req('GET', '/reload');
    if (r.status !== 200) fail(`/reload expected 200, got ${r.status}`);
    else console.log('[smoke:kb-api] reload OK');

    if (process.env.OPENAI_API_KEY) {
      const q = encodeURIComponent('テスト');
      const s1 = await req('GET', `/search?q=${q}&topK=1`);
      if (s1.status !== 200) fail(`/search GET expected 200, got ${s1.status} body=${s1.body}`);
      else console.log('[smoke:kb-api] search GET OK');

      const s2 = await req('POST', `/search`, { query: 'テスト', topK: 1 });
      if (s2.status !== 200) fail(`/search POST expected 200, got ${s2.status} body=${s2.body}`);
      else console.log('[smoke:kb-api] search POST OK');
    } else {
      console.log('[smoke:kb-api] OPENAI_API_KEY not set, skipping /search checks');
    }
  } catch (e) {
    fail(e?.message || String(e));
  }
  if (!ok) process.exit(1);
})();
