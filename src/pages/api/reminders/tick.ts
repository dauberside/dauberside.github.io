/*
 Scans due reminders (<= now) and dispatches LINE push texts.
 Idempotency: claimReminder removes from ZSET before push to avoid duplicates.
 Rate: processes up to 100 per invocation.
*/
import type { NextApiRequest, NextApiResponse } from "next";

import { claimReminder, kvAvailable, listDueReminders } from "@/lib/kv";
import { pushText } from "@/lib/line";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }

  // Simple auth: Authorization: Bearer <REMINDER_TICK_TOKEN> or ?token=
  const token = process.env.REMINDER_TICK_TOKEN || "";
  const auth = (req.headers["authorization"] as string) || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const q = (req.query?.token as string) || "";
  if (token) {
    const provided = bearer || q;
    if (!provided || provided !== token) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }

  if (!(await kvAvailable())) {
    res.status(200).json({ ok: true, skipped: true, reason: "kv unavailable" });
    return;
  }

  const now = Date.now();
  const due = await listDueReminders(now, 100);
  let sent = 0;
  for (const item of due) {
    // Try to claim before sending to avoid dup sends if overlapping runs
    const claimed = await claimReminder(item);
    if (!claimed) continue;
    const to = item.userId || item.groupId;
    if (!to) continue;
    const when = new Date(item.start).toLocaleString("ja-JP", {
      hour12: false,
      timeZone: "Asia/Tokyo",
    });
    try {
      await pushText(to, `⏰ 30分後に予定です: ${item.summary}\n開始: ${when}`);
      sent++;
    } catch {
      // If push fails, we don't re-enqueue; it's already claimed. Optionally log.
      // noop
    }
  }

  res.status(200).json({ ok: true, due: due.length, sent });
}
