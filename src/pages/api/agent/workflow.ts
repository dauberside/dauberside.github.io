import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import {
  TextWorkflowInputSchema,
  TextWorkflowOutputSchema,
} from "@/lib/agent/workflows/schemas";
import { runWorkflow } from "@/lib/agent/workflows/text-workflow";

// very small in-memory rate limiter keyed by token (single-process best-effort)
const LAST_HIT_BY_TOKEN = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 500; // allow ~2 req/sec per token

function normalize(v: unknown) {
  return (typeof v === "string" ? v : "").trim().replace(/^['"]|['"]$/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const rid = (req.headers["x-request-id"] as string) || randomUUID();

  if (req.method === "GET") {
    res.setHeader("Allow", "POST");
    return res.status(200).json({
      ok: true,
      endpoint: "/api/agent/workflow",
      expected: {
        method: "POST",
        headers: {
          "x-internal-token": "<INTERNAL_API_TOKEN>",
          "content-type": "application/json",
        },
        body: { input_as_text: "say hello" },
      },
      notes: [
        "This endpoint requires x-internal-token (or Authorization: Bearer) to match INTERNAL_API_TOKEN.",
        "In production, mock mode is disabled; set OPENAI_API_KEY to execute real runs.",
        "Optional x-request-id header is logged for tracing.",
      ],
      schemas: {
        input: "TextWorkflowInput: { input_as_text: string(min:1,max:2000) }",
        output: "TextWorkflowOutput: { output_text: string }",
      },
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // Auth
  const tokenHeader = req.headers["x-internal-token"];
  const headerToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  let token = headerToken;
  if (!token) {
    const authHeader = (req.headers["authorization"] ||
      (req.headers as any)["Authorization"]) as string | undefined;
    if (typeof authHeader === "string") {
      const v = authHeader.trim();
      const lower = v.toLowerCase();
      if (lower.startsWith("bearer ")) token = v.slice(7);
      else if (lower.startsWith("token ")) token = v.slice(6);
    }
  }

  const envTokenRaw = process.env.INTERNAL_API_TOKEN;
  if (!envTokenRaw || normalize(envTokenRaw) === "") {
    console.error(
      `[api/agent/workflow] rid=${rid} missing INTERNAL_API_TOKEN on server`,
    );
    return res.status(500).json({ error: "server_misconfig" });
  }
  const envToken = normalize(envTokenRaw);
  const reqToken = normalize(token);
  if (reqToken !== envToken) {
    const reason = reqToken === "" ? "missing_token" : "mismatch";
    console.warn(
      `[api/agent/workflow] rid=${rid} unauthorized reason=${reason}`,
    );
    res.setHeader(
      "WWW-Authenticate",
      'Bearer realm="internal", error="invalid_token"',
    );
    return res.status(401).json({ error: "unauthorized", reason });
  }

  // rate limit
  const now = Date.now();
  const last = LAST_HIT_BY_TOKEN.get(reqToken || "");
  if (typeof last === "number" && now - last < RATE_LIMIT_WINDOW_MS) {
    console.warn(
      `[api/agent/workflow] rid=${rid} rate_limited wait=${RATE_LIMIT_WINDOW_MS - (now - last)}ms`,
    );
    return res.status(429).json({ error: "rate_limited" });
  }
  LAST_HIT_BY_TOKEN.set(reqToken || "", now);

  // validate input via Zod
  const contentType = (req.headers["content-type"] || "")
    .toString()
    .toLowerCase();
  if (!contentType.includes("application/json")) {
    return res.status(415).json({ error: "invalid_content_type" });
  }

  const parse = TextWorkflowInputSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "invalid_input", details: parse.error.flatten() });
  }
  const { input_as_text } = parse.data;

  // mock handling same policy as /api/agent/run
  const mockRequested =
    process.env.AGENT_MOCK_MODE === "1" ||
    String((req.query as any)?.mock) === "1";
  const isProd = process.env.NODE_ENV === "production";
  const mockEnabled = !isProd && mockRequested;
  if (mockEnabled) {
    console.info(
      `[api/agent/workflow] rid=${rid} mock=1 inputLen=${input_as_text.length}`,
    );
    const mock = { output_text: `mock:${input_as_text}` };
    // validate output too (defensive)
    const outParse = TextWorkflowOutputSchema.safeParse(mock);
    if (!outParse.success)
      return res.status(500).json({ error: "mock_output_invalid" });
    return res.status(200).json(mock);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error(`[api/agent/workflow] rid=${rid} missing OPENAI_API_KEY`);
    return res.status(500).json({
      error: "missing_OPENAI_API_KEY (set in .env.local and restart server)",
    });
  }

  try {
    console.info(
      `[api/agent/workflow] rid=${rid} exec inputLen=${input_as_text.length}`,
    );
    const result = await runWorkflow({ input_as_text });
    // Validate output schema before returning
    const out = TextWorkflowOutputSchema.parse(result);
    console.info(`[api/agent/workflow] rid=${rid} done`);
    return res.status(200).json(out);
  } catch (err: any) {
    console.error(`[api/agent/workflow] rid=${rid} error`, err);
    return res.status(500).json({ error: err?.message ?? "internal error" });
  }
}
