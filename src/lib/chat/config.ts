export const ChatConfig = {
  endpoint: "/api/agent/workflow-proxy",
  // mock は開発時のみ有効（UIからのトグルは維持）
  enableMockInProd: false,
} as const;

export function buildEndpointUrl(mock?: boolean) {
  const base = ChatConfig.endpoint;
  if (mock && (process.env.NODE_ENV !== "production")) return `${base}?mock=1`;
  return base;
}
