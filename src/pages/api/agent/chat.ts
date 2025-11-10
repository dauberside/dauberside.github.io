import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = decodeURIComponent(p.slice(idx + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}

// Bridge API: host chat -> n8n (Webhook: mcp-agent-chat)
// Env:
// - N8N_AGENT_URL (optional) default http://localhost:5678/webhook/mcp-agent-chat
// - N8N_BASIC_AUTH_ACTIVE, N8N_BASIC_AUTH_USER, N8N_BASIC_AUTH_PASSWORD

export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Friendly GET/OPTIONS for diagnostics
  if (req.method === "GET") {
    res.setHeader("Allow", "POST, GET, OPTIONS");
    const prodUrl =
      process.env.N8N_AGENT_URL ||
      "http://localhost:5678/webhook/mcp-agent-chat";
    const testUrl =
      process.env.N8N_AGENT_TEST_URL ||
      prodUrl.replace("/webhook/", "/webhook-test/");
    const cookies = parseCookies(req.headers.cookie);
    const existingSid = cookies["dauber_sid"];
    return res.status(200).json({
      ok: true,
      endpoint: "/api/agent/chat",
      expected: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: {
          message: "こんにちは",
          sessionId: "<optional>",
          user: "<optional>",
          meta: { any: "optional" },
        },
      },
      upstream: {
        production: prodUrl,
        test: testUrl,
      },
      session: {
        cookie: existingSid || null,
        header: req.headers["x-session-id"] || null,
      },
      notes: [
        "This is a bridge to n8n Webhook (POST only). Browser address bar GET will show this info.",
        "If n8n uses Basic auth, set N8N_BASIC_AUTH_* in .env.local. If Header auth, set N8N_API_TOKEN.",
        'To hit the n8n Test URL (when workflow shows "Waiting for trigger event"), call /api/agent/chat?test=1',
        "Memory tips: AI Agent > Simple Memory に会話IDが必要です。サイトは dauber_sid クッキー/ヘッダで sessionId を供給します。",
      ],
    });
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, GET, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET, OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    const isMultipart = contentType.includes("multipart/form-data");

    // Ensure a stable session id for n8n Simple Memory
    const cookies = parseCookies(req.headers.cookie);
    let sessionId = cookies["dauber_sid"] || randomUUID();
    if (!cookies["dauber_sid"]) {
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      const cookie = `dauber_sid=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
      res.setHeader("Set-Cookie", cookie);
    }

    const prodUrl =
      process.env.N8N_AGENT_URL ||
      "http://localhost:5678/webhook/mcp-agent-chat";
    const testUrl =
      process.env.N8N_AGENT_TEST_URL ||
      prodUrl.replace("/webhook/", "/webhook-test/");
    const useTest =
      req.query?.test === "1" || req.headers["x-n8n-test"] === "1";
    const url = useTest ? testUrl : prodUrl;

    let upstream: Response;
    if (isMultipart) {
      // Stream multipart/form-data as-is to n8n, enriching headers
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": String(req.headers["content-type"] || ""), // preserve boundary
        "X-Session-Id": sessionId,
      };
      if (process.env.N8N_API_TOKEN)
        headers["X-N8N-API-KEY"] = process.env.N8N_API_TOKEN;
      if (process.env.N8N_BASIC_AUTH_ACTIVE === "1") {
        const u = process.env.N8N_BASIC_AUTH_USER || "";
        const p = process.env.N8N_BASIC_AUTH_PASSWORD || "";
        const b64 = Buffer.from(`${u}:${p}`).toString("base64");
        headers["Authorization"] = `Basic ${b64}`;
      }
      // Buffer once to allow minimal retry on test URL 404
      const chunks: Buffer[] = [];
      for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const bodyBuf = Buffer.concat(chunks);
      const doPost = (target: string) =>
        fetch(target, { method: "POST", headers, body: bodyBuf });
      upstream = await doPost(url);
      if (upstream.status === 404 && useTest) {
        await new Promise((r) => setTimeout(r, 800));
        upstream = await doPost(url);
      }
    } else {
      // JSON (or text) body path — read the stream and parse
      const chunks: Buffer[] = [];
      for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString("utf8");

      let parsed: any = undefined;
      const isJson =
        contentType.includes("application/json") ||
        rawBody.trim().startsWith("{") ||
        rawBody.trim().startsWith("[");
      if (isJson && rawBody) {
        try {
          parsed = JSON.parse(rawBody);
        } catch (e) {
          return res.status(400).json({
            error: "invalid_json",
            message: "Request body is not valid JSON",
          });
        }
      }

      // Accept aliases for message to reduce client friction
      const bodyObj = parsed ?? {};
      const message: unknown =
        bodyObj.message ??
        bodyObj.text ??
        bodyObj.input ??
        bodyObj.prompt ??
        rawBody;
      const bodySid: unknown =
        bodyObj.sessionId ?? bodyObj.sessionID ?? bodyObj.sid;
      const user: unknown = bodyObj.user;
      const meta: unknown = bodyObj.meta;

      if (typeof bodySid === "string" && bodySid) sessionId = bodySid; // body overrides cookie

      if (typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "missing_message" });
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Session-Id": sessionId,
      };
      if (process.env.N8N_API_TOKEN)
        headers["X-N8N-API-KEY"] = process.env.N8N_API_TOKEN;
      if (process.env.N8N_BASIC_AUTH_ACTIVE === "1") {
        const u = process.env.N8N_BASIC_AUTH_USER || "";
        const p = process.env.N8N_BASIC_AUTH_PASSWORD || "";
        const b64 = Buffer.from(`${u}:${p}`).toString("base64");
        headers["Authorization"] = `Basic ${b64}`;
      }
      const payload = { message, sessionId, user, meta } as any;
      const doPost = () =>
        fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      upstream = await doPost();
      if (upstream.status === 404 && useTest) {
        await new Promise((r) => setTimeout(r, 800));
        upstream = await doPost();
      }
    }
    const text = await upstream.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    // Helpful hints when webhook isn't active or wrong method is used upstream
    if (upstream.status === 404) {
      json = {
        error: "n8n_webhook_not_found",
        message:
          "The requested n8n webhook is not registered (is the workflow Active?).",
        tried: url,
        tip: useTest
          ? "Keep the n8n canvas in test mode and POST to the Test URL."
          : "Activate the workflow in n8n or call this API with ?test=1 to hit the Test URL.",
      };
    } else if (upstream.status === 405) {
      json = {
        error: "n8n_method_not_allowed",
        message: "Upstream webhook rejected the method. Ensure POST is used.",
        tried: url,
      };
    } else if (upstream.status >= 500) {
      json = {
        error: "n8n_workflow_error",
        message: (json && (json.message || json.error)) || "Error in workflow",
        tried: url,
        tip: "Open n8n > Executions to see the failed run; common causes: missing OpenAI credentials on AI Agent, or MCP tool misconfiguration. Try replacing the Agent with a Respond to Webhook node to isolate.",
        raw: text,
      };
    }
    return res.status(upstream.status).json(json);
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "agent_proxy_error", message: e?.message || String(e) });
  }
}
