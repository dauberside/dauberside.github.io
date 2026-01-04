// src/pages/api/healthz.ts
import fs from "node:fs/promises";

import type { NextApiRequest, NextApiResponse } from "next";

const KB_INDEX_PATH = "kb/index/embeddings.json";
const OBSIDIAN_API_URL = process.env.OBSIDIAN_API_URL; // 例: http://localhost:8443/vault

type Status = "healthy" | "degraded" | "unavailable" | "not_configured";

type KbCheck = {
  status: Status;
  message: string;
  details?: {
    path: string;
    size: number;
  };
};

type ObsidianCheck = {
  status: Status;
  message: string;
  details?: {
    url: string;
  };
};

type HealthzResponse = {
  ok: boolean;
  uptime: number;
  now: string;
  checks: {
    kb: KbCheck;
    obsidian: ObsidianCheck;
  };
};

async function checkKb(): Promise<KbCheck> {
  try {
    // ファイル存在チェック
    await fs.access(KB_INDEX_PATH);

    const stat = await fs.stat(KB_INDEX_PATH);
    if (!stat.isFile()) {
      return {
        status: "degraded",
        message: "KB index path exists but is not a file",
        details: { path: KB_INDEX_PATH, size: 0 },
      };
    }

    if (stat.size === 0) {
      return {
        status: "degraded",
        message: "KB index file is empty",
        details: { path: KB_INDEX_PATH, size: 0 },
      };
    }

    // 簡易 JSON パースチェック
    try {
      const raw = await fs.readFile(KB_INDEX_PATH, "utf8");
      JSON.parse(raw);
    } catch {
      return {
        status: "degraded",
        message: "KB index exists but is not valid JSON",
        details: { path: KB_INDEX_PATH, size: stat.size },
      };
    }

    return {
      status: "healthy",
      message: "KB index is present and valid",
      details: { path: KB_INDEX_PATH, size: stat.size },
    };
  } catch {
    return {
      status: "unavailable",
      message: "KB index file not found",
      details: { path: KB_INDEX_PATH, size: 0 },
    };
  }
}

async function checkObsidian(): Promise<ObsidianCheck> {
  if (!OBSIDIAN_API_URL) {
    return {
      status: "not_configured",
      message: "OBSIDIAN_API_URL is not set",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(OBSIDIAN_API_URL, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        status: "degraded",
        message: `Obsidian REST responded with HTTP ${res.status}`,
        details: { url: OBSIDIAN_API_URL },
      };
    }

    return {
      status: "healthy",
      message: "Obsidian REST responded successfully",
      details: { url: OBSIDIAN_API_URL },
    };
  } catch (e: any) {
    clearTimeout(timeoutId);
    const msg =
      e?.name === "AbortError"
        ? "request timeout"
        : (e?.message ?? "request failed");
    return {
      status: "unavailable",
      message: `Failed to reach Obsidian REST (${msg})`,
      details: { url: OBSIDIAN_API_URL },
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthzResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const [kb, obsidian] = await Promise.all([checkKb(), checkObsidian()]);

  // クリティカル判定ルール：
  // - KB が unavailable のときはシステムとして 503（検索/RAG 前提だから）
  // - Obsidian は not_configured の場合はクリティカル扱いしない
  const kbCriticalOk = kb.status !== "unavailable";
  const obsidianCriticalOk =
    obsidian.status === "healthy" ||
    obsidian.status === "degraded" ||
    obsidian.status === "not_configured";

  const criticalOk = kbCriticalOk && obsidianCriticalOk;

  const body: HealthzResponse = {
    ok: criticalOk,
    uptime: process.uptime(),
    now: new Date().toISOString(),
    checks: {
      kb,
      obsidian,
    },
  };

  const statusCode = criticalOk ? 200 : 503;

  return res.status(statusCode).json(body);
}
