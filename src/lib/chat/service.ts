import { buildEndpointUrl } from "./config";

export interface SendOptions {
  mock?: boolean;
  kbSnippets?: Array<{ source: string; text: string; score?: number }>;
}

export interface SendResult {
  status: number;
  output_text: string;
  raw: any;
}

/**
 * ChatService: UI からの送信処理を抽象化。
 * 将来のストリーミング/SSE や別API差し替えは、ここを書き換えるだけで対応。
 */
export async function sendToAgent(text: string, options: SendOptions = {}): Promise<SendResult> {
  const url = buildEndpointUrl(options.mock);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_as_text: text, kb_snippets: options.kbSnippets }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) {
    // Surface Zod errors (400) nicely when available
    let msg = json?.error || `HTTP ${res.status}`;
    if (res.status === 400 && json?.details) {
      try {
        const d = json.details;
        const fieldErrors = d?.fieldErrors || {};
        const firstField = Object.keys(fieldErrors)[0];
        const firstMsg = firstField ? String((fieldErrors as any)[firstField]?.[0] || '') : '';
        if (firstMsg) msg = `invalid_input: ${firstField}: ${firstMsg}`;
      } catch {}
    }
    throw Object.assign(new Error(String(msg)), { status: res.status, raw: json });
  }
  const output = json?.output_text ?? json?.output ?? json?.data ?? "";
  return { status: res.status, output_text: typeof output === "string" ? output : JSON.stringify(json), raw: json };
}
