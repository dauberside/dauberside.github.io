import { buildEndpointUrl, ChatConfig } from "./config";

export interface SendOptions {
  mock?: boolean;
  test?: boolean; // n8n テストURLに送る場合は true（UI から指定 or 環境変数）
  kbSnippets?: Array<{ source: string; text: string; score?: number }>;
  file?: File | null;
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
  // n8n テストURLの自動ルーティング（開発用途）
  const isChatBridge = (ChatConfig.endpoint || '').includes('/api/agent/chat');
  const useTest = !!options.test || (isChatBridge && ChatConfig.useTestWebhook);
  const url = buildEndpointUrl(options.mock, isChatBridge && useTest);
  const hasFile = options.file instanceof File;

  let res: Response;
  if (hasFile) {
    const fd = new FormData();
    if (isChatBridge) {
      // n8n ブリッジ（/api/agent/chat）へは multipart で直接転送（サーバ側でそのまま webhook へストリーム転送）
      fd.append('message', text);
      if (options.kbSnippets) fd.append('kb_snippets', JSON.stringify(options.kbSnippets));
      if (options.file) fd.append('file', options.file, options.file.name);
    } else {
      // 既存のワークフロープロキシ（OpenAI Agents SDK 経路）
      fd.append('input_as_text', text);
      if (options.kbSnippets) fd.append('kb_snippets', JSON.stringify(options.kbSnippets));
      if (options.file) fd.append('file', options.file, options.file.name);
    }
    res = await fetch(url, {
      method: 'POST',
      body: fd,
    });
  } else {
    // JSON 経路（/api/agent/chat では {message, meta} にマップ）
    const payload = isChatBridge
      ? { message: text, meta: { kbSnippets: options.kbSnippets, attachment: hasFile && options.file ? { name: options.file.name, type: options.file.type, size: options.file.size } : undefined } }
      : { input_as_text: text, kb_snippets: options.kbSnippets };
    const doPost = () => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    res = await doPost();
    // n8n test URL は「待機状態の直後」に 404 になりがちなので 1 回だけリトライ
    if (res.status === 404 && isChatBridge && useTest) {
      await new Promise((r) => setTimeout(r, 800));
      res = await doPost();
    }
  }
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
