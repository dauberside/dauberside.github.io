#!/usr/bin/env node
/**
 * Cortex OS Terminal MCP Server
 *
 * MCP stdio server for executing Cortex OS knowledge pipeline tasks.
 * Implements secure, whitelisted command execution for:
 * - Knowledge Graph regeneration
 * - llms-input.json generation
 * - llms.txt generation
 *
 * Implements OpenAI MCP spec for stdio communication.
 *
 * Usage:
 *   node services/mcp/terminal.mjs
 *
 * Protocol: JSON-RPC 2.0 over stdio
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

/**
 * Whitelisted Cortex OS tasks
 * Security: Only these predefined tasks can be executed
 */
const TASKS = {
  'rebuild-knowledge-graph': {
    description: 'Rebuild knowledge graph: build-embeddings → cluster → export-graph',
    steps: [
      { cmd: 'node', args: ['cortex/graph/build-embeddings.mjs'] },
      { cmd: 'node', args: ['cortex/graph/cluster.mjs'] },
      { cmd: 'node', args: ['cortex/graph/export-graph.mjs'] },
    ],
  },
  'regenerate-llms-input': {
    description: 'Regenerate llms-input.json from clusters-v1.md',
    steps: [{ cmd: 'node', args: ['cortex/scripts/generate-llms-input.mjs'] }],
  },
  'regenerate-llms-txt': {
    description: 'Regenerate docs/llms.txt from llms-input.json',
    steps: [{ cmd: 'node', args: ['cortex/scripts/llms/generate-llms-txt.mjs'] }],
  },
  'full-refresh': {
    description: 'Full pipeline: Knowledge Graph + llms-input + llms.txt',
    steps: [
      { cmd: 'node', args: ['cortex/graph/build-embeddings.mjs'] },
      { cmd: 'node', args: ['cortex/graph/cluster.mjs'] },
      { cmd: 'node', args: ['cortex/graph/export-graph.mjs'] },
      { cmd: 'node', args: ['cortex/scripts/generate-llms-input.mjs'] },
      { cmd: 'node', args: ['cortex/scripts/llms/generate-llms-txt.mjs'] },
    ],
  },
  'quick-refresh': {
    description: 'Quick refresh: llms-input + llms.txt only (skip graph rebuild)',
    steps: [
      { cmd: 'node', args: ['cortex/scripts/generate-llms-input.mjs'] },
      { cmd: 'node', args: ['cortex/scripts/llms/generate-llms-txt.mjs'] },
    ],
  },
};

/**
 * Execute a single command
 */
function runCommand(cmd, args, cwd = ROOT_DIR) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (exitCode) => {
      const duration = Date.now() - startTime;
      resolve({
        cmd,
        args,
        exitCode: exitCode ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
      });
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        cmd,
        args,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        duration,
      });
    });
  });
}

/**
 * Execute a whitelisted task
 */
async function executeTask(taskId, dryRun = false) {
  const task = TASKS[taskId];
  if (!task) {
    throw new Error(`Unknown taskId: ${taskId}`);
  }

  if (dryRun) {
    return {
      dryRun: true,
      taskId,
      description: task.description,
      steps: task.steps.map((step) => ({
        cmd: step.cmd,
        args: step.args,
      })),
    };
  }

  const startedAt = new Date().toISOString();
  const results = [];

  for (const step of task.steps) {
    const result = await runCommand(step.cmd, step.args);
    results.push(result);

    if (result.exitCode !== 0) {
      // Stop on first failure
      const finishedAt = new Date().toISOString();
      return {
        taskId,
        description: task.description,
        startedAt,
        finishedAt,
        success: false,
        failedStep: {
          cmd: step.cmd,
          args: step.args,
        },
        steps: results,
      };
    }
  }

  const finishedAt = new Date().toISOString();
  return {
    taskId,
    description: task.description,
    startedAt,
    finishedAt,
    success: true,
    steps: results,
  };
}

/**
 * MCP Tools
 */
const tools = {
  /**
   * List available Cortex tasks
   */
  async list_cortex_tasks() {
    return {
      tasks: Object.entries(TASKS).map(([taskId, def]) => ({
        taskId,
        description: def.description,
        steps: def.steps.map((step) => ({
          cmd: step.cmd,
          args: step.args,
        })),
      })),
    };
  },

  /**
   * Run a whitelisted Cortex task
   */
  async run_cortex_task({ taskId, dryRun = false }) {
    if (!taskId) {
      throw new Error('taskId parameter is required');
    }

    return await executeTask(taskId, dryRun);
  },
};

/**
 * Tool definitions for MCP protocol
 */
const toolDefinitions = [
  {
    name: 'list_cortex_tasks',
    description: 'List all available Cortex OS pipeline tasks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_cortex_task',
    description: 'Execute a whitelisted Cortex OS pipeline task (secure command execution)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (e.g., "full-refresh", "quick-refresh", "rebuild-knowledge-graph")',
          enum: Object.keys(TASKS),
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only return what would be executed without running commands',
          default: false,
        },
      },
      required: ['taskId'],
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
              name: 'cortex-os-terminal',
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
      console.error('[mcp-terminal]', ...args);
    }
  };

  log('Cortex OS Terminal MCP Server started');
  log('ROOT_DIR:', ROOT_DIR);
  log('Available tasks:', Object.keys(TASKS).join(', '));

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
  console.error('[mcp-terminal] Fatal error:', error);
  process.exit(1);
});
