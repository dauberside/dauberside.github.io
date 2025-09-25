// Debug endpoint: fetch recent datetimepicker awaiting events (set/missing/clear)
// Optional token protection via DIAGNOSTICS_TOKEN (re-use same token as diagnostics)
import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@/lib/kv';

export const config = { runtime: 'edge' } as any; // edge-friendly (read-only small ops)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const expected = process.env.DIAGNOSTICS_TOKEN?.trim();
  if (expected) {
    const qToken = String(req.query.token || '').trim();
    const headerToken = String(req.headers['x-diag-token'] || '').trim();
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const provided = [qToken, headerToken, auth].find(Boolean) || '';
    if (provided !== expected) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  try {
    const arr: string[] = await (kv as any).lrange('debug:dtpicker:events', 0, 100);
    const out = (arr || []).map((s) => {
      try { return JSON.parse(s); } catch { return { raw: s }; }
    });
    return res.status(200).json({ count: out.length, events: out });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'kv-error' });
  }
}
