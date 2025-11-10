import type { NextApiRequest, NextApiResponse } from 'next';
import { getNote } from '@/lib/obsidian';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathParam = String((req.query.path as string) || '').trim();
  if (!pathParam) return res.status(400).json({ ok: false, error: 'missing_path' });

  // 期待するのは URL エンコード済みのパス（スペースやスラッシュを含むため）
  // 未エンコードらしき場合は最小限のエンコードを試みる
  const encoded = /%[0-9A-Fa-f]{2}/.test(pathParam) ? pathParam : encodeURIComponent(pathParam).replace(/%2F/g, '/');

  try {
    const note = await getNote(encoded);
    res.status(200).json({ ok: true, path: encoded, note });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const isAuth = /Missing OBSIDIAN_API_KEY|Unauthorized|401/i.test(msg);
    res.status(isAuth ? 401 : 500).json({ ok: false, error: msg });
  }
}
