#!/usr/bin/env node
// Simple connectivity check for OpenAI API credentials

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set. Export it before running this check.");
  process.exit(1);
}

const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

async function main() {
  try {
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

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error(`OpenAI API request failed (${resp.status}): ${text.slice(0, 200)}`);
      process.exit(1);
    }

    const json = await resp.json();
    const reply = json?.choices?.[0]?.message?.content?.trim();
    console.log("OpenAI API reachable. Sample reply:", reply || "<no content>");
  } catch (error) {
    console.error("OpenAI API connectivity test failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
