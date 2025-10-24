import type { NextApiRequest, NextApiResponse } from "next";
import pkg from "../../../package.json";
import { kvAvailable } from "@/lib/kv";
import { callCfChat, isCfAiConfigured } from "@/lib/ai";

type Json = Record<string, unknown>;

const mask = (v?: string, visible = 4) => {
  const s = String(v || "");
  if (!s) return "(none)";
  if (s.length <= visible) return "*".repeat(Math.max(1, s.length));
  return s.slice(0, visible) + "...";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Never cache diagnostics
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const now = new Date();
  const vercelEnv = process.env.VERCEL_ENV || "local";
  const region = process.env.VERCEL_REGION || "(n/a)";
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "(n/a)";

  // Env presence (no secrets)
  const env: Json = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: vercelEnv,
    VERCEL_REGION: region,
    VERCEL_GIT_COMMIT_SHA: commit,
    OPENAI_API_KEY: isCfAiConfigured() ? "set" : "(none)",
    OPENAI_MODEL: (process.env.OPENAI_MODEL || "gpt-4o-mini").replace(/^['"]|['"]$/g, ""),
    OPENAI_BASE_URL: (() => {
      const u = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
      try {
        return new URL(u).host;
      } catch {
        return u || "(n/a)";
      }
    })(),
    KV_URL: process.env.KV_URL ? "set" : "(none)",
    KV_REST_API_URL: (() => {
      const u = process.env.KV_REST_API_URL || "";
      if (!u) return "(none)";
      try {
        return new URL(u).host;
      } catch {
        return mask(u, 0);
      }
    })(),
    CHANNEL_ACCESS_TOKEN: process.env.CHANNEL_ACCESS_TOKEN ? "set" : "(none)",
    CHANNEL_SECRET: process.env.CHANNEL_SECRET ? "set" : "(none)",
    GC_CLIENT_ID: mask(process.env.GC_CLIENT_ID),
    GC_CLIENT_SECRET: process.env.GC_CLIENT_SECRET ? "set" : "(none)",
    GC_REDIRECT_URI: process.env.GC_REDIRECT_URI ? "set" : "(none)",
    GC_REFRESH_TOKEN: process.env.GC_REFRESH_TOKEN ? "set" : "(none)",
  };

  // KV status
  const kvStatus: Json = {
    available: await kvAvailable(),
  };

  // Optional connectivity checks (only when requested)
  const doConnectivity = String(req.query.connectivity || "0") === "1";
  const openai: Json = {
    configured: isCfAiConfigured(),
    model: env.OPENAI_MODEL,
    baseUrlHost: env.OPENAI_BASE_URL,
    connectivity: "skipped",
  };
  if (doConnectivity && isCfAiConfigured()) {
    try {
      const sys = "日本語で、pong だけを返してください。";
      const out = await Promise.race([
        callCfChat("ping", sys),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 6000),
        ) as Promise<string>,
      ]);
      (openai as any).connectivity = out.trim() === "pong" ? "ok" : `ok:${out.slice(0, 32)}`;
    } catch (e: any) {
      (openai as any).connectivity = `error:${String(e?.message || e).slice(0, 120)}`;
    }
  }

  const report: Json = {
    app: {
      name: pkg.name,
      version: pkg.version,
    },
    runtime: {
      node: process.version,
      time: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "(n/a)",
      env: vercelEnv,
      region,
      commit,
    },
    links: {
      repository:
        (pkg as any)?.repository?.url || "https://github.com/dauberside/dauberside.github.io",
      reportEndpoint: "/api/diagnostics",
      docs: "/README.md",
    },
    env,
    kv: kvStatus,
    openai,
    warnings: collectWarnings(env, kvStatus, openai),
  };

  return res.status(200).json(report);
}

function collectWarnings(env: Json, kv: Json, openai: Json): string[] {
  const w: string[] = [];
  if (env.OPENAI_API_KEY === "(none)") w.push("OPENAI_API_KEY is not set");
  if (env.CHANNEL_ACCESS_TOKEN === "(none)") w.push("LINE CHANNEL_ACCESS_TOKEN is not set");
  if (env.CHANNEL_SECRET === "(none)") w.push("LINE CHANNEL_SECRET is not set");
  if (env.GC_CLIENT_ID === "(none)" || env.GC_CLIENT_SECRET === "(none)" || env.GC_REFRESH_TOKEN === "(none)") {
    w.push("Google Calendar credentials are incomplete");
  }
  if (kv.available === false) w.push("Vercel KV not configured");
  if (openai.configured && openai.connectivity && String(openai.connectivity).startsWith("error:")) {
    w.push("OpenAI connectivity error");
  }
  return w;
}
