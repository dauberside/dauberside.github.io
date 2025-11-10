import type { NextApiRequest, NextApiResponse } from "next";

import { searchNotes } from "@/lib/obsidian";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const q = String((req.query.q as string) || "").trim();
  const limit = Number(req.query.limit ?? 10) || 10;
  if (!q) return res.status(400).json({ ok: false, error: "missing_query" });
  try {
    const results = await searchNotes(q, limit);
    res.status(200).json({ ok: true, q, results });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const isAuth = /Missing OBSIDIAN_API_KEY|Unauthorized|401/i.test(msg);
    res.status(isAuth ? 401 : 500).json({ ok: false, error: msg });
  }
}
