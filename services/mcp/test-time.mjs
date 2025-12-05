#!/usr/bin/env node
/**
 * Test suite for Time MCP Server
 *
 * Tests:
 * 1. get_current_time
 * 2. add_time (days, weeks, months)
 * 3. format_date
 * 4. get_week_range
 * 5. get_month_range
 * 6. date_diff
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  console.log('🧪 Time MCP Test Suite\n');

  // Start MCP server
  const server = spawn('node', [path.join(__dirname, 'time.mjs')], {
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

      if (response.result.serverInfo.name !== 'cortex-time') {
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
      const expectedTools = [
        'get_current_time',
        'add_time',
        'format_date',
        'get_week_range',
        'get_month_range',
        'date_diff',
      ];

      for (const tool of expectedTools) {
        if (!toolNames.includes(tool)) {
          throw new Error(`Missing tool: ${tool}`);
        }
      }
    });

    // Test 3: get_current_time
    await runTest('get_current_time', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_current_time',
          arguments: {
            timezone: 'Asia/Tokyo',
            format: 'date',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (!result.formatted || !result.iso) {
        throw new Error('Missing required fields');
      }

      // Check date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result.formatted)) {
        throw new Error('Invalid date format');
      }
    });

    // Test 4: add_time (add days)
    await runTest('add_time (days)', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'add_time',
          arguments: {
            date: '2025-12-01T00:00:00.000Z',
            amount: 7,
            unit: 'days',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (!result.result.includes('2025-12-08')) {
        throw new Error(`Expected 2025-12-08, got ${result.result}`);
      }
    });

    // Test 5: add_time (subtract days)
    await runTest('add_time (subtract days)', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'add_time',
          arguments: {
            date: '2025-12-10T00:00:00.000Z',
            amount: -3,
            unit: 'days',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (!result.result.includes('2025-12-07')) {
        throw new Error(`Expected 2025-12-07, got ${result.result}`);
      }
    });

    // Test 6: format_date
    await runTest('format_date', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'format_date',
          arguments: {
            date: '2025-12-05T12:30:45.000Z',
            format: 'YYYY-MM-DD HH:mm',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (!result.formatted.startsWith('2025-12-05')) {
        throw new Error('Date not formatted correctly');
      }
    });

    // Test 7: get_week_range
    await runTest('get_week_range', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_week_range',
          arguments: {
            date: '2025-12-05T00:00:00.000Z', // Thursday
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      
      // Week should start on Monday (2025-12-01) and end on Sunday (2025-12-07)
      if (!result.monday || !result.sunday) {
        throw new Error('Missing week range fields');
      }

      if (!result.isoWeek || !result.isoWeek.startsWith('2025-W')) {
        throw new Error('Invalid ISO week format');
      }
    });

    // Test 8: get_month_range
    await runTest('get_month_range', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'get_month_range',
          arguments: {
            date: '2025-12-15T00:00:00.000Z',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      
      // December 2025: 1st to 31st
      if (!result.firstDay.includes('2025-12-01')) {
        throw new Error('Incorrect first day of month');
      }
      if (!result.lastDay.includes('2025-12-31')) {
        throw new Error('Incorrect last day of month');
      }
      if (result.totalDays !== 31) {
        throw new Error('Incorrect total days');
      }
    });

    // Test 9: date_diff
    await runTest('date_diff', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'date_diff',
          arguments: {
            start: '2025-12-01T00:00:00.000Z',
            end: '2025-12-08T00:00:00.000Z',
            unit: 'days',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.difference !== 7) {
        throw new Error(`Expected 7 days, got ${result.difference}`);
      }
    });

    // Test 10: Error handling - invalid date
    await runTest('Error handling: invalid date', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'add_time',
          arguments: {
            date: 'invalid-date',
            amount: 1,
            unit: 'days',
          },
        },
      });

      if (!response.error || !response.error.message.includes('Invalid date')) {
        throw new Error('Should return error for invalid date');
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
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
