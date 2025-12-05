#!/usr/bin/env node
/**
 * Test suite for Search MCP Server
 *
 * Tests:
 * 1. search_concepts (keyword search)
 * 2. search_notes (fulltext search)
 * 3. search_by_cluster (cluster navigation)
 * 4. list_clusters (graph overview)
 * 5. get_concept (concept details)
 * 6. find_similar (semantic search)
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
  console.log('🧪 Search MCP Test Suite\n');

  // Start MCP server
  const server = spawn('node', [path.join(__dirname, 'search.mjs')], {
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

      if (response.result.serverInfo.name !== 'cortex-search') {
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
        'search_concepts',
        'search_notes',
        'search_by_cluster',
        'list_clusters',
        'get_concept',
        'find_similar',
      ];

      for (const tool of expectedTools) {
        if (!toolNames.includes(tool)) {
          throw new Error(`Missing tool: ${tool}`);
        }
      }
    });

    // Test 3: search_concepts
    await runTest('search_concepts', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_concepts',
          arguments: {
            query: 'mcp',
            limit: 5,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.total === 0) {
        throw new Error('No concepts found for "mcp"');
      }

      if (!result.results[0].label) {
        throw new Error('Result missing label field');
      }
    });

    // Test 4: search_notes
    await runTest('search_notes', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'search_notes',
          arguments: {
            query: 'cortex',
            limit: 5,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.total === 0) {
        throw new Error('No notes found for "cortex"');
      }

      if (!result.results[0].preview) {
        throw new Error('Result missing preview field');
      }
    });

    // Test 5: list_clusters
    await runTest('list_clusters', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_clusters',
          arguments: {},
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.total === 0) {
        throw new Error('No clusters found');
      }

      if (!result.clusters[0].label) {
        throw new Error('Cluster missing label field');
      }
    });

    // Test 6: search_by_cluster
    await runTest('search_by_cluster', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'search_by_cluster',
          arguments: {
            clusterId: 'cluster-0',
            limit: 10,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.total === 0) {
        throw new Error('No concepts found in cluster-0');
      }

      if (!result.concepts[0].label) {
        throw new Error('Concept missing label field');
      }
    });

    // Test 7: get_concept
    await runTest('get_concept', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_concept',
          arguments: {
            conceptId: 'mcp',
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.id !== 'mcp') {
        throw new Error('Wrong concept returned');
      }

      if (!result.sourceNotes || result.sourceNotes.length === 0) {
        throw new Error('Concept missing sourceNotes');
      }
    });

    // Test 8: find_similar
    await runTest('find_similar', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'find_similar',
          arguments: {
            conceptId: 'mcp',
            limit: 5,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = JSON.parse(response.result.content[0].text);
      if (result.results.length === 0) {
        throw new Error('No similar concepts found');
      }

      if (!result.results[0].similarity) {
        throw new Error('Result missing similarity score');
      }
    });

    // Test 9: Error handling - invalid cluster
    await runTest('Error handling: invalid cluster', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'search_by_cluster',
          arguments: {
            clusterId: 'cluster-999',
          },
        },
      });

      if (!response.error || !response.error.message.includes('not found')) {
        throw new Error('Should return error for invalid cluster');
      }
    });

    // Test 10: Error handling - invalid concept
    await runTest('Error handling: invalid concept', async () => {
      const response = await sendRequest(server, {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'get_concept',
          arguments: {
            conceptId: 'nonexistent-concept-xyz',
          },
        },
      });

      if (!response.error || !response.error.message.includes('not found')) {
        throw new Error('Should return error for invalid concept');
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
