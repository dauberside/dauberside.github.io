#!/usr/bin/env node
/**
 * Test suite for Text Editor MCP Server
 *
 * Tests:
 * 1. write_file (full replace)
 * 2. append_to_file
 * 3. insert_at_line
 * 4. replace_lines
 * 5. search_replace
 * 6. Security (write access control)
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const TEST_FILE = 'cortex/state/test-editor.md';
const TEST_FILE_FULL = path.join(ROOT_DIR, TEST_FILE);

let testsPassed = 0;
let testsFailed = 0;

/**
 * Send JSON-RPC request to MCP server
 */
function sendRequest(server, request) {
  return new Promise((resolve, reject) => {
    let responseData = '';
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        reject(new Error('Request timeout'));
      }
    }, 5000);

    server.stdout.once('data', (data) => {
      responseData += data.toString();
      clearTimeout(timeout);
      isResolved = true;

      try {
        const response = JSON.parse(responseData);
        resolve(response);
      } catch (error) {
        reject(new Error(`Failed to parse response: ${responseData}`));
      }
    });

    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

/**
 * Test runner
 */
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Main test suite
 */
async function main() {
  console.log('🧪 Text Editor MCP Test Suite\n');

  // Clean up test file
  try {
    await fs.unlink(TEST_FILE_FULL);
  } catch (error) {
    // File doesn't exist, ignore
  }

  // Start MCP server
  const server = spawn('node', [path.join(__dirname, 'text-editor.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  server.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });

  try {
    // Test 1: Initialize
    await runTest('Initialize', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      });

      if (response.result.serverInfo.name !== 'cortex-text-editor') {
        throw new Error('Unexpected server name');
      }
    });

    // Test 2: List tools
    await runTest('List tools', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      const toolNames = response.result.tools.map(t => t.name);
      const expectedTools = ['write_file', 'append_to_file', 'insert_at_line', 'replace_lines', 'search_replace'];

      for (const tool of expectedTools) {
        if (!toolNames.includes(tool)) {
          throw new Error(`Missing tool: ${tool}`);
        }
      }
    });

    // Test 3: write_file
    await runTest('write_file', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: TEST_FILE,
            content: 'Line 1\nLine 2\nLine 3\n',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      if (content !== 'Line 1\nLine 2\nLine 3\n') {
        throw new Error('Content mismatch after write_file');
      }
    });

    // Test 4: append_to_file
    await runTest('append_to_file', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'append_to_file',
          arguments: {
            path: TEST_FILE,
            content: 'Line 4\n',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      if (!content.includes('Line 4')) {
        throw new Error('Content not appended');
      }
    });

    // Test 5: insert_at_line
    await runTest('insert_at_line', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'insert_at_line',
          arguments: {
            path: TEST_FILE,
            line: 1,
            content: 'Inserted Line',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      const lines = content.split('\n');
      if (lines[1] !== 'Inserted Line') {
        throw new Error('Line not inserted correctly');
      }
    });

    // Test 6: replace_lines
    await runTest('replace_lines', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'replace_lines',
          arguments: {
            path: TEST_FILE,
            start: 0,
            end: 1,
            content: 'Replaced Lines',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      const lines = content.split('\n');
      if (lines[0] !== 'Replaced Lines') {
        throw new Error('Lines not replaced correctly');
      }
    });

    // Test 7: search_replace (first occurrence)
    await runTest('search_replace (first)', async () => {
      await fs.writeFile(TEST_FILE_FULL, 'foo bar foo baz\n');

      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'search_replace',
          arguments: {
            path: TEST_FILE,
            search: 'foo',
            replace: 'qux',
            all: false,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      if (content !== 'qux bar foo baz\n') {
        throw new Error('Search and replace (first) failed');
      }
    });

    // Test 8: search_replace (all occurrences)
    await runTest('search_replace (all)', async () => {
      await fs.writeFile(TEST_FILE_FULL, 'foo bar foo baz\n');

      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'search_replace',
          arguments: {
            path: TEST_FILE,
            search: 'foo',
            replace: 'qux',
            all: true,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      if (content !== 'qux bar qux baz\n') {
        throw new Error('Search and replace (all) failed');
      }
    });

    // Test 9: search_replace with regex special characters (bug fix verification)
    await runTest('search_replace with regex metacharacters', async () => {
      await fs.writeFile(TEST_FILE_FULL, 'file.txt is here and file-txt is not\n');

      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'search_replace',
          arguments: {
            path: TEST_FILE,
            search: 'file.txt',
            replace: 'document.pdf',
            all: true,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const content = await fs.readFile(TEST_FILE_FULL, 'utf-8');
      // Should replace literal "file.txt" but NOT "file-txt"
      if (content !== 'document.pdf is here and file-txt is not\n') {
        throw new Error(`Regex escaping failed. Got: ${content}`);
      }
    });

    // Test 10: Security - deny write to non-allowed path
    await runTest('Security: deny non-allowed path', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: 'package.json',
            content: 'malicious content',
          },
        },
      });

      if (!response.error || !response.error.message.includes('Write access denied')) {
        throw new Error('Security check failed: should deny write to package.json');
      }
    });

    // Test 11: Backup creation
    await runTest('Backup creation', async () => {
      await fs.writeFile(TEST_FILE_FULL, 'Original content\n');

      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'write_file',
          arguments: {
            path: TEST_FILE,
            content: 'New content\n',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (!result.backup) {
        throw new Error('Backup not created');
      }

      const backupExists = await fs.access(result.backup).then(() => true).catch(() => false);
      if (!backupExists) {
        throw new Error('Backup file does not exist');
      }
    });

    console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);

    if (testsFailed === 0) {
      console.log('✅ All tests passed!\n');
    } else {
      console.log('❌ Some tests failed\n');
    }

  } finally {
    // Clean up
    server.kill();
    try {
      await fs.unlink(TEST_FILE_FULL);
      await fs.unlink(TEST_FILE_FULL + '.backup');
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
