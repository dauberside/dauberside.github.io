#!/usr/bin/env node
/**
 * Cortex OS Filesystem MCP Server
 *
 * MCP stdio server for reading Cortex OS knowledge files:
 * - llms.txt (long-term memory)
 * - TODO.md (task state)
 * - clusters-v1.md (knowledge graph)
 * - graph-v1.json (graph structure)
 * - llms-input.json (brain API)
 *
 * Implements OpenAI MCP spec for stdio communication.
 *
 * Usage:
 *   node services/mcp/filesystem.mjs
 *
 * Protocol: JSON-RPC 2.0 over stdio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Allowed read paths (security boundary)
const ALLOWED_PATHS = [
  'docs/llms.txt',
  'TODO.md',
  'cortex/graph/clusters-v1.md',
  'cortex/graph/graph-v1.json',
  'cortex/tmp/llms-input.json',
  'cortex/state/tomorrow.json',
  'cortex/weekly',
  'docs/decisions',
  'docs/requirements',
  'docs/operations',
];

/**
 * Check if a file path is within allowed read boundaries
 */
function isAllowedPath(requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^\/+/, '');

  return ALLOWED_PATHS.some(allowed => {
    // Direct file match
    if (normalized === allowed) return true;

    // Directory prefix match (for reading files within allowed directories)
    if (allowed.endsWith('/') || !allowed.includes('.')) {
      return normalized.startsWith(allowed + '/') || normalized.startsWith(allowed);
    }

    return false;
  });
}

/**
 * Resolve path relative to project root
 */
function resolvePath(requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^\/+/, '');
  return path.join(ROOT_DIR, normalized);
}

/**
 * MCP Tools
 */
const tools = {
  /**
   * Read file contents
   */
  async read_file({ path: filePath }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }

    if (!isAllowedPath(filePath)) {
      throw new Error(`Access denied: ${filePath} is not in allowed read paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        path: filePath,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  },

  /**
   * List files in directory
   */
  async list_files({ path: dirPath = '' }) {
    const normalized = dirPath ? path.normalize(dirPath).replace(/^\/+/, '') : '';

    if (normalized && !isAllowedPath(normalized)) {
      throw new Error(`Access denied: ${normalized} is not in allowed read paths`);
    }

    const fullPath = normalized ? resolvePath(normalized) : ROOT_DIR;

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        const relativePath = normalized
          ? path.join(normalized, entry.name)
          : entry.name;

        // Only include if within allowed paths
        if (isAllowedPath(relativePath) || entry.isDirectory()) {
          files.push({
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? 'directory' : 'file',
          });
        }
      }

      return { files };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      throw error;
    }
  },

  /**
   * Get file metadata
   */
  async file_info({ path: filePath }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }

    if (!isAllowedPath(filePath)) {
      throw new Error(`Access denied: ${filePath} is not in allowed read paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      const stats = await fs.stat(fullPath);
      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  },

  /**
   * Read multiple files at once (batch operation)
   */
  async read_files({ paths }) {
    if (!Array.isArray(paths)) {
      throw new Error('paths parameter must be an array');
    }

    const results = await Promise.all(
      paths.map(async (filePath) => {
        try {
          return await tools.read_file({ path: filePath });
        } catch (error) {
          return {
            path: filePath,
            error: error.message,
          };
        }
      })
    );

    return { files: results };
  },
};

/**
 * Tool definitions for MCP protocol
 */
const toolDefinitions = [
  {
    name: 'read_file',
    description: 'Read contents of a single file from Cortex OS knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to file (e.g., "docs/llms.txt", "TODO.md")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory within allowed Cortex OS paths',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to directory (optional, defaults to project root)',
        },
      },
    },
  },
  {
    name: 'file_info',
    description: 'Get metadata about a file (size, modified time, type)',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_files',
    description: 'Read multiple files at once (batch operation for efficiency)',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of relative file paths',
        },
      },
      required: ['paths'],
    },
  },
];

/**
 * JSON-RPC 2.0 handler
 */
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'cortex-os-filesystem',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolDefinitions,
          },
        };

      case 'tools/call': {
        const { name, arguments: args } = params;

        if (!tools[name]) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await tools[name](args || {});

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
    };
  }
}

/**
 * stdio communication loop
 */
async function main() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Write to stderr for logging (stdout is reserved for protocol)
  const log = (...args) => {
    if (process.env.MCP_DEBUG === '1') {
      console.error('[mcp-filesystem]', ...args);
    }
  };

  log('Cortex OS Filesystem MCP Server started');
  log('ROOT_DIR:', ROOT_DIR);
  log('ALLOWED_PATHS:', ALLOWED_PATHS);

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);
      log('Request:', request.method, request.params?.name || '');

      const response = await handleRequest(request);

      // Write response to stdout (protocol channel)
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      log('Error processing request:', error);

      // Send error response
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });

  rl.on('close', () => {
    log('Connection closed');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[mcp-filesystem] Fatal error:', error);
  process.exit(1);
});
