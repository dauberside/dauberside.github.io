import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { searchKB } from '@/lib/kb/index';

function shouldProxyToKbApi() {
  return (
    process.env.KB_API_URL?.trim() ||
    (process.env.KB_API_PROXY === '1')
  );
}

function getKbApiBase(): string {
  const explicit = process.env.KB_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.KB_API_PORT || '4040';
  return `http://127.0.0.1:${port}`;
}

async function proxySearchGET(q: string, topK?: number) {
  const base = getKbApiBase();
  const u = new URL(base + '/search');
  u.searchParams.set('q', q);
  if (topK) u.searchParams.set('topK', String(topK));
  const resp = await fetch(u.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error(`kb-api GET failed: ${resp.status}`);
  const json = await resp.json();
  return json?.hits ?? [];
}

async function proxySearchPOST(query: string, topK?: number) {
  const base = getKbApiBase();
  const resp = await fetch(base + '/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, topK }),
  });
  if (!resp.ok) throw new Error(`kb-api POST failed: ${resp.status}`);
  const json = await resp.json();
  return json?.hits ?? [];
}

const QuerySchema = z.object({
  q: z.string().min(1, 'q is required'),
  topK: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(50).optional()),
});

const BodySchema = z.object({
  query: z.string().min(1, 'query is required'),
  topK: z.number().int().min(1).max(50).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const OBS = process.env.NEXT_OBSERVABILITY === '1';
  const hiRes = typeof (process as any).hrtime?.bigint === 'function';
  const t0: any = hiRes ? (process as any).hrtime.bigint() : Date.now();
  const done = (status: number, meta?: Record<string, any>) => {
    if (!OBS) return;
    try {
      const t1: any = hiRes ? (process as any).hrtime.bigint() : Date.now();
      const ms = hiRes ? Number((t1 as bigint) - (t0 as bigint)) / 1e6 : (t1 as number) - (t0 as number);
      const info = { method: req.method, status, ms: Math.max(0, ms).toFixed(1), ...(meta || {}) } as any;
      // Avoid logging large payloads; only meta
      console.log('[obs]/api/kb/search', info);
    } catch {}
  };
  try {
    if (req.method === 'GET') {
      const parsed = QuerySchema.safeParse(req.query);
      if (!parsed.success) { done(400, { phase: 'validate', path: 'GET' }); return res.status(400).json({ error: parsed.error.flatten() }); }
      const { q, topK } = parsed.data as { q: string; topK?: number };
      // Prefer kb-api when configured; fallback to local
      if (shouldProxyToKbApi()) {
        try {
          const hits = await proxySearchGET(q, topK);
          res.setHeader('X-KB-Proxy', 'kb-api');
          done(200, { path: 'GET', proxy: 'kb-api', topK });
          return res.status(200).json({ hits });
        } catch (e) {
          // fall through to local
          res.setHeader('X-KB-Proxy', 'fallback-local');
        }
      }
      const hits = await searchKB(q, { topK });
      done(200, { path: 'GET', proxy: res.getHeader('X-KB-Proxy') || 'local', topK });
      return res.status(200).json({ hits });
    }
    if (req.method === 'POST') {
      const parsed = BodySchema.safeParse(req.body);
      if (!parsed.success) { done(400, { phase: 'validate', path: 'POST' }); return res.status(400).json({ error: parsed.error.flatten() }); }
      const { query, topK } = parsed.data;
      if (shouldProxyToKbApi()) {
        try {
          const hits = await proxySearchPOST(query, topK);
          res.setHeader('X-KB-Proxy', 'kb-api');
          done(200, { path: 'POST', proxy: 'kb-api', topK });
          return res.status(200).json({ hits });
        } catch (e) {
          res.setHeader('X-KB-Proxy', 'fallback-local');
        }
      }
      const hits = await searchKB(query, { topK });
      done(200, { path: 'POST', proxy: res.getHeader('X-KB-Proxy') || 'local', topK });
      return res.status(200).json({ hits });
    }
    res.setHeader('Allow', ['GET', 'POST']);
    done(405, { phase: 'method' });
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    const msg = err?.message || 'Internal Error';
    done(500, { phase: 'catch', error: msg });
    return res.status(500).json({ error: msg });
  }
}
