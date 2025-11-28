#!/usr/bin/env node
/**
 * Test script for Cortex OS Filesystem MCP Server
 *
 * Tests the MCP protocol implementation by sending JSON-RPC requests
 * and validating responses.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_SERVER_PATH = path.join(__dirname, 'filesystem.mjs');

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

    // Timeout after 5 seconds
    timeoutHandle = setTimeout(() => {
      proc.stdout.off('data', onData);
      reject(new Error(`Request timeout: ${method}`));
    }, 5000);

    // Send request
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function runTests() {
  console.log('🚀 Starting Cortex OS Filesystem MCP tests...\n');

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
      name: 'Read llms.txt',
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: 'docs/llms.txt' },
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
        if (!data.content || !data.path) {
          throw new Error('Invalid response format');
        }
        console.log(`✓ Read llms.txt: ${data.size} bytes`);
        console.log(`  First line: ${data.content.split('\n')[0]}`);
      },
    },
    {
      name: 'Read TODO.md',
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: 'TODO.md' },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);
        console.log(`✓ Read TODO.md: ${data.size} bytes`);
      },
    },
    {
      name: 'Read clusters-v1.md',
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: 'cortex/graph/clusters-v1.md' },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);
        console.log(`✓ Read clusters-v1.md: ${data.size} bytes`);
      },
    },
    {
      name: 'Batch read multiple files',
      method: 'tools/call',
      params: {
        name: 'read_files',
        arguments: {
          paths: ['docs/llms.txt', 'TODO.md', 'cortex/tmp/llms-input.json'],
        },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);
        if (!data.files || data.files.length !== 3) {
          throw new Error('Expected 3 files in batch read');
        }
        const successful = data.files.filter(f => !f.error).length;
        console.log(`✓ Batch read: ${successful}/3 files successful`);
      },
    },
    {
      name: 'Get file info',
      method: 'tools/call',
      params: {
        name: 'file_info',
        arguments: { path: 'docs/llms.txt' },
      },
      validate: (response) => {
        if (response.error) {
          throw new Error(`Error: ${response.error.message}`);
        }
        const content = response.result?.content?.[0]?.text;
        const data = JSON.parse(content);
        if (!data.size || !data.modified) {
          throw new Error('Missing file info fields');
        }
        console.log(`✓ File info: ${data.size} bytes, modified ${data.modified}`);
      },
    },
    {
      name: 'Security test - reject unauthorized path',
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: '/etc/passwd' },
      },
      validate: (response) => {
        if (!response.error) {
          throw new Error('Security failure: unauthorized path should be rejected');
        }
        if (!response.error.message.includes('Access denied')) {
          throw new Error('Wrong error message for unauthorized access');
        }
        console.log('✓ Security: unauthorized path correctly rejected');
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
