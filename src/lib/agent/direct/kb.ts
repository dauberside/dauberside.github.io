export function mcpBaseUrl() {
  const base = (process.env.MCP_BASE_URL || `http://127.0.0.1:${process.env.MCP_PORT || 5050}`).toString().trim();
  return base.replace(/\/$/, '');
}

export async function kbSearch(query: string, topK = 5): Promise<{ used: boolean; block?: string }>{
  if (!query) return { used: false };
  try {
    const url = `${mcpBaseUrl()}/kb/search`;
    const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    const token = process.env.MCP_API_TOKEN?.trim();
    if (token) headers['X-API-Key'] = token;
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, topK }) });
    if (!resp.ok) return { used: false };
    const data: any = await resp.json();
    const items = Array.isArray(data?.results) ? data.results : [];
    if (!items.length) return { used: false };
    const lines = items.slice(0, topK).map((r: any, i: number) => `(${i+1}) ${r.title || r.id || 'snippet'}\n${(r.snippet || r.text || '').toString().slice(0, 400)}`);
    return { used: true, block: lines.join('\n\n') };
  } catch {
    return { used: false };
  }
}
