#!/usr/bin/env node
/**
 * Test script for Cortex OS Terminal MCP Server
 *
 * Tests the MCP protocol implementation for terminal command execution.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_SERVER_PATH = path.join(__dirname, 'terminal.mjs');

let requestId = 0;

function nextId() {
  return ++requestId;
}

function sendRequest(proc, method, params = {}) {
  const id = nextId();
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  return new Promise((resolve, reject) => {
    let responseData = '';
    let timeoutHandle;

    const onData = (chunk) => {
      responseData += chunk.toString();

      // Check if we have a complete line (response)
      const lines = responseData.split('\n');
      if (lines.length > 1) {
        const responseLine = lines[0];
        try {
          const response = JSON.parse(responseLine);
          if (response.id === id) {
            clearTimeout(timeoutHandle);
            proc.stdout.off('data', onData);
            resolve(response);
          }
        } catch (e) {
          // Not a complete JSON yet, continue
        }
      }
    };

    proc.stdout.on('data', onData);

    // Timeout after 60 seconds (commands may take time)
    timeoutHandle = setTimeout(() => {
      proc.stdout.off('data', onData);
      reject(new Error(`Request timeout: ${method}`));
    }, 60000);

    // Send request
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function runTests() {
  console.log('🚀 Starting Cortex OS Terminal MCP tests...\n');

  const proc = spawn('node', [MCP_SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_DEBUG: '1' },
  });

  proc.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  const tests = [
    {
      name: 'Initialize MCP server',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        if (!response.result?.serverInfo?.name) {
          throw new Error('Missing serverInfo in response');
        }
        console.log(`✓ Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
      },
    },
    {
      name: 'List available tools',
      method: 'tools/list',
      params: {},
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const tools = response.result?.tools || [];
        if (tools.length === 0) {
          throw new Error('No tools available');
        }
        console.log(`✓ Tools available: ${tools.map(t => t.name).join(', ')}`);
      },
    },
    {
      name: 'List Cortex tasks',
      method: 'tools/call',
      params: {
        name: 'list_cortex_tasks',
        arguments: {},
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        if (!content) {
          throw new Error('No content returned');
        }
        const data = JSON.parse(content);
        if (!data.tasks || data.tasks.length === 0) {
          throw new Error('No tasks available');
        }
        console.log(`✓ Available tasks: ${data.tasks.length}`);
        data.tasks.forEach(task => {
          console.log(`  - ${task.taskId}: ${task.description} (${task.steps.length} steps)`);
        });
      },
    },
    {
      name: 'Dry-run: quick-refresh',
      method: 'tools/call',
      params: {
        name: 'run_cortex_task',
        arguments: {
          taskId: 'quick-refresh',
          dryRun: true,
        },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);
        if (!data.dryRun) {
          throw new Error('Expected dryRun mode');
        }
        console.log(`✓ Dry-run validated: ${data.taskId}`);
        console.log(`  Steps: ${data.steps.length}`);
      },
    },
    {
      name: 'Execute: quick-refresh (llms-input + llms.txt)',
      method: 'tools/call',
      params: {
        name: 'run_cortex_task',
        arguments: {
          taskId: 'quick-refresh',
          dryRun: false,
        },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);

        if (!data.success) {
          console.error('Task failed:');
          console.error(JSON.stringify(data, null, 2));
          throw new Error(`Task failed at step: ${data.failedStep?.cmd} ${data.failedStep?.args.join(' ')}`);
        }

        console.log(`✓ Task executed successfully: ${data.taskId}`);
        console.log(`  Started: ${data.startedAt}`);
        console.log(`  Finished: ${data.finishedAt}`);
        console.log(`  Steps completed: ${data.steps.length}`);

        data.steps.forEach((step, i) => {
          const duration = (step.duration / 1000).toFixed(2);
          console.log(`    ${i + 1}. ${step.cmd} ${step.args.join(' ')} (${duration}s)`);
          if (step.exitCode !== 0) {
            console.log(`       Exit code: ${step.exitCode}`);
            if (step.stderr) {
              console.log(`       Error: ${step.stderr.slice(0, 200)}`);
            }
          }
        });
      },
    },
    {
      name: 'Security test - invalid task ID',
      method: 'tools/call',
      params: {
        name: 'run_cortex_task',
        arguments: {
          taskId: 'malicious-task',
        },
      },
      validate: (response) => {
        if (!response.error) {
          throw new Error('Security failure: invalid task should be rejected');
        }
        if (!response.error.message.includes('Unknown taskId')) {
          throw new Error('Wrong error message for invalid task');
        }
        console.log('✓ Security: invalid task ID correctly rejected');
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🧪 Test: ${test.name}`);
      const response = await sendRequest(proc, test.method, test.params);
      await test.validate(response);
      passed++;
    } catch (error) {
      console.error(`✗ Test failed: ${error.message}`);
      failed++;
    }
  }

  // Clean up
  proc.stdin.end();
  proc.kill();

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tests passed: ${passed}/${tests.length}`);
  console.log(`❌ Tests failed: ${failed}/${tests.length}`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
