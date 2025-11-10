import type { NextApiRequest, NextApiResponse } from "next";

import { listRoot } from "@/lib/obsidian";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const data = await listRoot();
    res.status(200).json({ ok: true, data });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const isAuth = /Missing OBSIDIAN_API_KEY|Unauthorized|401/i.test(msg);
    res.status(isAuth ? 401 : 500).json({ ok: false, error: msg });
  }
}
