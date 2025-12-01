#!/usr/bin/env node
/**
 * cortex-query-stdio.mjs
 *
 * MCP stdio server wrapper for cortex_query tool.
 * Converts the HTTP endpoint into a proper MCP tool that Claude Desktop can call.
 *
 * Architecture:
 * - Implements MCP stdio protocol
 * - Exposes cortex_query as a native MCP tool
 * - Directly imports handleCortexQuery (no HTTP overhead)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORTEX_ROOT = path.resolve(__dirname, '../../cortex');

// Dynamic import of cortex-query-tool
let handleCortexQuery = null;
try {
  const module = await import(`${CORTEX_ROOT}/graph/cortex-query-tool.mjs`);
  handleCortexQuery = module.handleCortexQuery;
} catch (e) {
  console.error('Failed to load cortex-query-tool:', e.message);
  process.exit(1);
}

const server = new Server(
  {
    name: 'cortex-query',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'cortex_query',
        description:
          'Query Cortex OS knowledge graph with automatic memory priming. ' +
          'Returns relevant cluster summaries and concepts to provide context for ' +
          'answering questions about MCP implementation, daily work, roadmap, ' +
          'architecture decisions, and achievements. ' +
          'Use this tool FIRST before answering questions about Cortex OS to load relevant context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The question or topic to query the knowledge graph about',
            },
            maxClusters: {
              type: 'number',
              description: 'Maximum number of knowledge clusters to load (default: 2, max: 5)',
              default: 2,
            },
            includeRelatedConcepts: {
              type: 'boolean',
              description: 'Whether to include detailed concept information (default: true)',
              default: true,
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens in priming context (default: 800)',
              default: 800,
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'cortex_query') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments || {};
  
  try {
    const result = await handleCortexQuery({
      query: args.query || '',
      maxClusters: args.maxClusters ?? 2,
      includeRelatedConcepts: args.includeRelatedConcepts ?? true,
      maxTokens: args.maxTokens ?? 800,
    });

    // Format response for LLM consumption
    const response = [
      `# Cortex OS Knowledge Graph Query Result\n`,
      `**Query**: ${result.query}`,
      `**Selected Clusters**: ${result.selectedClusters.join(', ')}`,
      `**Classification Time**: ${result.metadata.classificationTime}`,
      `**Total Concepts**: ${result.metadata.totalConcepts}`,
      `**Coverage**: ${result.metadata.clusterCoverage}\n`,
      `---\n`,
      `## Memory Priming Context\n`,
      result.priming,
      `\n---\n`,
    ];

    if (result.relatedConcepts && result.relatedConcepts.length > 0) {
      response.push(`\n## Related Concepts\n`);
      result.relatedConcepts.slice(0, 5).forEach(concept => {
        response.push(`- **${concept.label}** (${concept.frequency}×) - ${concept.types.join(', ')}`);
      });
    }

    if (result.keyDocuments && result.keyDocuments.length > 0) {
      response.push(`\n\n## Key Documents\n`);
      result.keyDocuments.slice(0, 3).forEach(doc => {
        response.push(`- ${doc}`);
      });
    }

    response.push(`\n\n---\n`);
    response.push(`**Usage**: Use the Memory Priming Context above to answer questions about Cortex OS with accurate, context-aware responses.`);

    return {
      content: [
        {
          type: 'text',
          text: response.join('\n'),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error querying Cortex OS knowledge graph: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cortex Query MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
