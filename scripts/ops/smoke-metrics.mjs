#!/usr/bin/env node
/**
 * CI/Local smoke for service metrics endpoints.
 * - Checks kb-api and mcp-server /metrics return 200 and valid JSON
 * - Triggers /healthz and verifies totalRequests increments
 *
 * Env:
 *  KB_API_HOST (default 127.0.0.1)
 *  KB_API_PORT (default 4040)
 *  MCP_HOST (default 127.0.0.1)
 *  MCP_PORT (default 5050)
 */

const KB_HOST = process.env.KB_API_HOST || '127.0.0.1';
const KB_PORT = Number(process.env.KB_API_PORT || 4040);
const MCP_HOST = process.env.MCP_HOST || '127.0.0.1';
const MCP_PORT = Number(process.env.MCP_PORT || 5050);

async function getJSON(u) {
  const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

async function checkService(label, baseUrl) {
  let ok = true;
  const fail = (msg) => { console.error(`[metrics:${label}]`, msg); ok = false; };

  const m1 = await getJSON(`${baseUrl}/metrics`);
  if (m1.status !== 200) fail(`/metrics expected 200, got ${m1.status}`);
  if (!m1.json || typeof m1.json !== 'object') fail(`/metrics invalid JSON: ${m1.text}`);
  if (m1.json && m1.json.ok !== true) fail(`/metrics ok!=true`);
  if (m1.json && typeof m1.json.totalRequests !== 'number') fail(`/metrics missing totalRequests`);

  const h = await fetch(`${baseUrl}/healthz`);
  if (h.status !== 200) fail(`/healthz expected 200, got ${h.status}`);

  const m2 = await getJSON(`${baseUrl}/metrics`);
  if (m2.status !== 200) fail(`/metrics(2) expected 200, got ${m2.status}`);
  if (!m2.json || typeof m2.json !== 'object') fail(`/metrics(2) invalid JSON: ${m2.text}`);
  if (m2.json && typeof m2.json.totalRequests !== 'number') fail(`/metrics(2) missing totalRequests`);
  if (m1.json && m2.json && !(m2.json.totalRequests >= m1.json.totalRequests + 1)) {
    fail(`/metrics totalRequests did not increment: before=${m1.json.totalRequests} after=${m2.json.totalRequests}`);
  }

  if (ok) console.log(`[metrics:${label}] OK`);
  return ok;
}

(async () => {
  const ok1 = await checkService('kb-api', `http://${KB_HOST}:${KB_PORT}`);
  const ok2 = await checkService('mcp', `http://${MCP_HOST}:${MCP_PORT}`);
  if (!ok1 || !ok2) process.exit(1);
})();
