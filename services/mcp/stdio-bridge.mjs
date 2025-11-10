#!/usr/bin/env node
/**
 * MCP stdio Bridge
 *
 * Claude Desktop の MCP client は stdio（標準入出力）で JSON-RPC を送信します。
 * このブリッジは stdio で受信し、Next.js API に HTTP リクエストを転送します。
 *
 * 対応ツール:
 * - kb.search: KB 検索（Next.js /api/kb/search）
 * - obsidian.get: Obsidian ファイル取得（Obsidian Local REST API）
 * - obsidian.search: Obsidian 検索（Obsidian Local REST API）
 */

import { createInterface } from 'node:readline';
import https from 'node:https';

// 環境変数
const NEXT_API_URL = process.env.NEXT_API_URL || 'http://localhost:3001';
const OBSIDIAN_API_URL = process.env.OBSIDIAN_API_URL || 'https://127.0.0.1:8445';
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

// 自己署名証明書を許可（Obsidian Local REST API 用）
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ログ出力（stderr に出力して stdout を汚染しない）
function log(...args) {
  console.error('[mcp-stdio-bridge]', ...args);
}

// JSON-RPC レスポンス送信
function sendResponse(id, result) {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result,
  });
  console.log(response);
}

// JSON-RPC エラーレスポンス送信
function sendError(id, code, message, data = undefined) {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  });
  console.log(response);
}

// KB 検索ツール
async function kbSearch(params) {
  const { query, topK = 5 } = params;
  const url = new URL('/api/kb/search', NEXT_API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('topK', String(topK));

  const headers = {};
  if (INTERNAL_API_TOKEN) {
    headers['X-API-Key'] = INTERNAL_API_TOKEN;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`KB search failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// Obsidian ファイル取得ツール
async function obsidianGet(params) {
  const { path } = params;
  const url = new URL(`/vault/${encodeURIComponent(path)}`, OBSIDIAN_API_URL);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
    },
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`Obsidian get failed: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

// Obsidian 検索ツール
async function obsidianSearch(params) {
  const { query, contextLength = 100 } = params;
  const url = new URL('/search/simple/', OBSIDIAN_API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('contextLength', String(contextLength));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
    },
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`Obsidian search failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// JSON-RPC リクエスト処理
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    // initialize リクエスト
    if (method === 'initialize') {
      return sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'dauberside-mcp-bridge',
          version: '1.0.0',
        },
      });
    }

    // tools/list リクエスト
    if (method === 'tools/list') {
      return sendResponse(id, {
        tools: [
          {
            name: 'kb_search',
            description: 'Search the knowledge base for relevant documentation',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                topK: { type: 'number', description: 'Number of results to return', default: 5 },
              },
              required: ['query'],
            },
          },
          {
            name: 'obsidian_get',
            description: 'Get content of a file from Obsidian vault',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path relative to vault root' },
              },
              required: ['path'],
            },
          },
          {
            name: 'obsidian_search',
            description: 'Search for text in Obsidian vault',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                contextLength: { type: 'number', description: 'Context length around matches', default: 100 },
              },
              required: ['query'],
            },
          },
        ],
      });
    }

    // tools/call リクエスト
    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      let result;
      switch (name) {
        case 'kb_search':
          result = await kbSearch(args);
          break;
        case 'obsidian_get':
          result = await obsidianGet(args);
          break;
        case 'obsidian_search':
          result = await obsidianSearch(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return sendResponse(id, {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      });
    }

    // ping リクエスト
    if (method === 'ping') {
      return sendResponse(id, {});
    }

    // 未対応のメソッド
    return sendError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    log('Error handling request:', error);
    return sendError(id, -32603, error.message, { stack: error.stack });
  }
}

// メイン処理
async function main() {
  log('Starting MCP stdio bridge...');
  log(`Next.js API: ${NEXT_API_URL}`);
  log(`Obsidian API: ${OBSIDIAN_API_URL}`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      log('Received request:', request.method);
      await handleRequest(request);
    } catch (error) {
      log('Error parsing request:', error);
      sendError(null, -32700, 'Parse error', { error: error.message });
    }
  });

  rl.on('close', () => {
    log('Stdin closed, exiting...');
    process.exit(0);
  });
}

main().catch((error) => {
  log('Fatal error:', error);
  process.exit(1);
});
