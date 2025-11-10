import type { NextApiRequest, NextApiResponse } from "next";

import { ping } from "@/lib/obsidian";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const r = await ping();
    res.status(200).json(r);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
