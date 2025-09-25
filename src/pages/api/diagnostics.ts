// Lightweight diagnostics endpoint for datetimepicker reliability metrics.
// Returns JSON with present/success/missing counters and derived successRate & missingRate.
// NOTE: This intentionally has no auth; restrict via Vercel protection or add a token check if needed.
import type { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@/lib/kv';

async function readCounter(key: string): Promise<number> {
  try {
    const v = await (kv as any).get(key);
    if (v == null) return 0;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Optional simple token protection (security-through-obscurity, not auth)
  const expected = process.env.DIAGNOSTICS_TOKEN?.trim();
  if (expected) {
    const qToken = String(req.query.token || '').trim();
    const headerToken = String(req.headers['x-diag-token'] || '').trim();
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const provided = [qToken, headerToken, auth].find((v) => !!v) || '';
    if (!provided || provided !== expected) {
      // Deliberately minimal info to avoid oracle
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const present = await readCounter('stats:dtpicker:present');
  const success = await readCounter('stats:dtpicker:success');
  const missing = await readCounter('stats:dtpicker:missing');
  const total = present; // present should represent total attempts shown
  const successRate = total > 0 ? success / total : 0;
  const missingRate = total > 0 ? missing / total : 0;

  return res.status(200).json({
    present,
    success,
    missing,
    successRate,
    missingRate,
    timestamp: Date.now(),
    protected: Boolean(expected),
  });
}
