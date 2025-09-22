#!/usr/bin/env node
// Simple connectivity check for OpenAI API credentials with retry/backoff on 429

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set. Export it before running this check.");
  process.exit(1);
}

const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const MAX_ATTEMPTS = Math.max(1, Number(process.env.OPENAI_CHECK_RETRIES || 3));
const BASE_DELAY_MS = Math.max(1000, Number(process.env.OPENAI_CHECK_BASE_DELAY_MS || 1500));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryOnce() {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a ping responder." },
        { role: "user", content: "返事は１単語`pong`だけ。" },
      ],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  return resp;
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await tryOnce();

      if (!resp.ok) {
        const status = resp.status;
        const text = await resp.text().catch(() => "");

        // Handle 429 with Retry-After or exponential backoff
        if (status === 429 && attempt < MAX_ATTEMPTS) {
          const retryAfterHeader = resp.headers.get("retry-after");
          const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const backoffMs = Number.isFinite(retryAfterSec)
            ? Math.max(1000, retryAfterSec * 1000)
            : BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `429 Too Many Requests (attempt ${attempt}/${MAX_ATTEMPTS}). ` +
              `Backing off for ${Math.ceil(backoffMs)}ms...`,
          );
          await sleep(backoffMs);
          continue;
        }

        console.error(`OpenAI API request failed (${status}): ${text.slice(0, 200)}`);
        process.exit(1);
      }

      const json = await resp.json();
      const reply = json?.choices?.[0]?.message?.content?.trim();
      console.log("OpenAI API reachable. Sample reply:", reply || "<no content>");
      return;
    } catch (error) {
      // Network or other transient errors: backoff and retry if attempts remain
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `Connectivity test error on attempt ${attempt}/${MAX_ATTEMPTS}: ${
            error instanceof Error ? error.message : String(error)
          }. Retrying in ${backoffMs}ms...`,
        );
        await sleep(backoffMs);
        continue;
      }
      console.error(
        "OpenAI API connectivity test failed:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  }
}

main();
