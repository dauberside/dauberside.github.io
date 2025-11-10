export const ChatConfig = {
  // Switch to n8n-backed agent bridge
  endpoint: "/api/agent/chat",
  // mock は開発時のみ有効（UIからのトグルは維持）
  enableMockInProd: false,
  // n8n のテストURL（/webhook-test/）にルーティングする開発用フラグ
  // クライアントから参照するため NEXT_PUBLIC_ を使用
  useTestWebhook: process.env.NEXT_PUBLIC_N8N_CHAT_TEST === "1",
} as const;

export function buildEndpointUrl(mock?: boolean, test?: boolean) {
  const base = ChatConfig.endpoint;
  const isDev = process.env.NODE_ENV !== "production";
  const params = new URLSearchParams();
  if (mock && isDev) params.set("mock", "1");
  if (test && base.includes("/api/agent/chat")) params.set("test", "1");
  const suffix = params.toString();
  return suffix ? `${base}?${suffix}` : base;
}
