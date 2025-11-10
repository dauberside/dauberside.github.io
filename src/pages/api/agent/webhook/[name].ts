import { run } from "@openai/agents";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { agent } from "../../../../lib/agent/agent";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const rid = (req.headers["x-request-id"] as string) || randomUUID();
  try {
    const name = String(req.query.name ?? "unknown");
    const payload = JSON.stringify(req.body ?? {});
    const prompt = `Handle webhook "${name}" with payload: ${payload}`;
    console.info(
      `[api/agent/webhook] rid=${rid} name=${name} payloadLen=${payload.length}`,
    );
    const result = await run(agent, prompt);
    console.info(`[api/agent/webhook] rid=${rid} done`);
    return res.status(200).json({ ok: true, output: result.finalOutput });
  } catch (err: any) {
    console.error("[api/agent/webhook] error", err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message ?? "internal error" });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};
