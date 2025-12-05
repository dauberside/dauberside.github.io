#!/usr/bin/env node
/**
 * Cortex OS Text Editor MCP Server
 *
 * MCP stdio server for editing Cortex OS files:
 * - TODO.md (task management)
 * - cortex/graph/clusters-v1.md (knowledge graph annotations)
 * - cortex/daily/*.md (daily notes)
 * - cortex/weekly/*.md (weekly summaries)
 *
 * Security:
 * - Whitelist-based write access
 * - Atomic writes (write to temp + rename)
 * - Backup on modification
 *
 * Usage:
 *   node services/mcp/text-editor.mjs
 *
 * Protocol: JSON-RPC 2.0 over stdio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Allowed write paths (security boundary)
const ALLOWED_WRITE_PATHS = [
  'TODO.md',
  'cortex/graph/clusters-v1.md',
  'cortex/daily',
  'cortex/weekly',
  'cortex/state',
];

/**
 * Check if a file path is within allowed write boundaries
 */
function isAllowedWritePath(requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^\/+/, '');

  return ALLOWED_WRITE_PATHS.some(allowed => {
    // Direct file match
    if (normalized === allowed) return true;

    // Directory prefix match (for writing files within allowed directories)
    if (!allowed.includes('.') || allowed.endsWith('/')) {
      return normalized.startsWith(allowed + '/');
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
 * Create backup of file before modification
 */
async function createBackup(filePath) {
  const backupPath = `${filePath}.backup`;
  try {
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
    // File doesn't exist, no backup needed
    return null;
  }
}

/**
 * Atomic write (write to temp + rename)
 */
async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * MCP Tools
 */
const tools = {
  /**
   * Write file contents (replace entire file)
   */
  async write_file({ path: filePath, content }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }
    if (content === undefined) {
      throw new Error('content parameter is required');
    }

    if (!isAllowedWritePath(filePath)) {
      throw new Error(`Write access denied: ${filePath} is not in allowed write paths`);
    }

    const fullPath = resolvePath(filePath);

    // Create backup
    const backupPath = await createBackup(fullPath);

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Atomic write
      await atomicWrite(fullPath, content);

      return {
        path: filePath,
        size: Buffer.byteLength(content, 'utf-8'),
        backup: backupPath,
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  },

  /**
   * Append content to file
   */
  async append_to_file({ path: filePath, content }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }
    if (content === undefined) {
      throw new Error('content parameter is required');
    }

    if (!isAllowedWritePath(filePath)) {
      throw new Error(`Write access denied: ${filePath} is not in allowed write paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      // Read existing content
      let existingContent = '';
      try {
        existingContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // File doesn't exist, will be created
      }

      // Append new content
      const newContent = existingContent + content;

      // Create backup
      const backupPath = await createBackup(fullPath);

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Atomic write
      await atomicWrite(fullPath, newContent);

      return {
        path: filePath,
        size: Buffer.byteLength(newContent, 'utf-8'),
        appended: Buffer.byteLength(content, 'utf-8'),
        backup: backupPath,
      };
    } catch (error) {
      throw new Error(`Failed to append to file: ${error.message}`);
    }
  },

  /**
   * Insert content at specific line number
   */
  async insert_at_line({ path: filePath, line, content }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }
    if (line === undefined) {
      throw new Error('line parameter is required');
    }
    if (content === undefined) {
      throw new Error('content parameter is required');
    }

    if (!isAllowedWritePath(filePath)) {
      throw new Error(`Write access denied: ${filePath} is not in allowed write paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      // Read existing content
      const existingContent = await fs.readFile(fullPath, 'utf-8');
      const lines = existingContent.split('\n');

      // Validate line number
      if (line < 0 || line > lines.length) {
        throw new Error(`Invalid line number: ${line} (file has ${lines.length} lines)`);
      }

      // Insert content
      lines.splice(line, 0, content);
      const newContent = lines.join('\n');

      // Create backup
      const backupPath = await createBackup(fullPath);

      // Atomic write
      await atomicWrite(fullPath, newContent);

      return {
        path: filePath,
        line,
        size: Buffer.byteLength(newContent, 'utf-8'),
        backup: backupPath,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to insert at line: ${error.message}`);
    }
  },

  /**
   * Replace specific lines in file
   */
  async replace_lines({ path: filePath, start, end, content }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }
    if (start === undefined) {
      throw new Error('start parameter is required');
    }
    if (end === undefined) {
      throw new Error('end parameter is required');
    }
    if (content === undefined) {
      throw new Error('content parameter is required');
    }

    if (!isAllowedWritePath(filePath)) {
      throw new Error(`Write access denied: ${filePath} is not in allowed write paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      // Read existing content
      const existingContent = await fs.readFile(fullPath, 'utf-8');
      const lines = existingContent.split('\n');

      // Validate line numbers
      if (start < 0 || start >= lines.length) {
        throw new Error(`Invalid start line: ${start} (file has ${lines.length} lines)`);
      }
      if (end < start || end >= lines.length) {
        throw new Error(`Invalid end line: ${end} (must be >= ${start} and < ${lines.length})`);
      }

      // Replace lines
      const newLines = content.split('\n');
      lines.splice(start, end - start + 1, ...newLines);
      const newContent = lines.join('\n');

      // Create backup
      const backupPath = await createBackup(fullPath);

      // Atomic write
      await atomicWrite(fullPath, newContent);

      return {
        path: filePath,
        start,
        end,
        replacedLines: end - start + 1,
        newLines: newLines.length,
        size: Buffer.byteLength(newContent, 'utf-8'),
        backup: backupPath,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to replace lines: ${error.message}`);
    }
  },

  /**
   * Search and replace text in file
   */
  async search_replace({ path: filePath, search, replace, all = false }) {
    if (!filePath) {
      throw new Error('path parameter is required');
    }
    if (search === undefined) {
      throw new Error('search parameter is required');
    }
    if (replace === undefined) {
      throw new Error('replace parameter is required');
    }

    if (!isAllowedWritePath(filePath)) {
      throw new Error(`Write access denied: ${filePath} is not in allowed write paths`);
    }

    const fullPath = resolvePath(filePath);

    try {
      // Read existing content
      const existingContent = await fs.readFile(fullPath, 'utf-8');

      // Perform search and replace
      let newContent;
      let replacements = 0;

      if (all) {
        // Replace all occurrences
        const regex = new RegExp(search, 'g');
        newContent = existingContent.replace(regex, (match) => {
          replacements++;
          return replace;
        });
      } else {
        // Replace first occurrence only
        const index = existingContent.indexOf(search);
        if (index !== -1) {
          newContent = existingContent.substring(0, index) + replace + existingContent.substring(index + search.length);
          replacements = 1;
        } else {
          newContent = existingContent;
        }
      }

      if (replacements === 0) {
        return {
          path: filePath,
          replacements: 0,
          message: 'No matches found',
        };
      }

      // Create backup
      const backupPath = await createBackup(fullPath);

      // Atomic write
      await atomicWrite(fullPath, newContent);

      return {
        path: filePath,
        replacements,
        size: Buffer.byteLength(newContent, 'utf-8'),
        backup: backupPath,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to search and replace: ${error.message}`);
    }
  },
};

/**
 * JSON-RPC 2.0 handler
 */
async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'cortex-text-editor',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'write_file',
              description: 'Write content to a file (replaces entire file)',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to project root' },
                  content: { type: 'string', description: 'Content to write' },
                },
                required: ['path', 'content'],
              },
            },
            {
              name: 'append_to_file',
              description: 'Append content to the end of a file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to project root' },
                  content: { type: 'string', description: 'Content to append' },
                },
                required: ['path', 'content'],
              },
            },
            {
              name: 'insert_at_line',
              description: 'Insert content at a specific line number',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to project root' },
                  line: { type: 'number', description: 'Line number (0-indexed)' },
                  content: { type: 'string', description: 'Content to insert' },
                },
                required: ['path', 'line', 'content'],
              },
            },
            {
              name: 'replace_lines',
              description: 'Replace specific lines in a file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to project root' },
                  start: { type: 'number', description: 'Start line number (0-indexed, inclusive)' },
                  end: { type: 'number', description: 'End line number (0-indexed, inclusive)' },
                  content: { type: 'string', description: 'New content' },
                },
                required: ['path', 'start', 'end', 'content'],
              },
            },
            {
              name: 'search_replace',
              description: 'Search and replace text in a file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path relative to project root' },
                  search: { type: 'string', description: 'Text to search for' },
                  replace: { type: 'string', description: 'Replacement text' },
                  all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
                },
                required: ['path', 'search', 'replace'],
              },
            },
          ],
        },
      };
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      if (!tools[name]) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const result = await tools[name](args);

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

    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message,
      },
    };
  }
}

/**
 * Main: stdio server loop
 */
async function main() {
  const readline = (await import('readline')).default;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.error(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      }));
    }
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
