#!/usr/bin/env node
/**
 * cortex-query-tool.mjs
 *
 * MCP tool implementation for cortex_query.
 * Can be imported into cortex-mcp-server or run standalone.
 *
 * Usage (standalone):
 *   node cortex-query-tool.mjs "How do I debug MCP?"
 *
 * Usage (as module):
 *   import { cortexQueryTool, handleCortexQuery } from './cortex-query-tool.mjs';
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  classifyQuery, 
  buildMemoryContext, 
  formatAsPrompt 
} from './classify-query.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use WORKSPACE_ROOT if available (container/CI), fallback to relative path
const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname;

const GRAPH_PATH = path.join(GRAPH_DIR, 'graph-v1.json');
const SUMMARIES_PATH = path.join(GRAPH_DIR, 'cluster-summaries.json');

/**
 * MCP Tool Definition
 */
export const cortexQueryTool = {
  name: 'cortex_query',
  description: 'Query Cortex OS knowledge graph with automatic memory priming. Returns relevant cluster summaries and related concepts to provide context for answering questions about MCP implementation, daily work, roadmap, architecture decisions, and achievements.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The question or topic to query the knowledge graph about'
      },
      maxClusters: {
        type: 'integer',
        description: 'Maximum number of clusters to load (default: 2)',
        default: 2,
        minimum: 1,
        maximum: 5
      },
      includeRelatedConcepts: {
        type: 'boolean',
        description: 'Whether to include related concept details (default: true)',
        default: true
      },
      maxTokens: {
        type: 'integer',
        description: 'Maximum tokens to return in priming context (default: 800)',
        default: 800,
        minimum: 200,
        maximum: 2000
      }
    },
    required: ['query']
  }
};

/**
 * Get related concepts from graph data for given cluster
 */
async function getRelatedConcepts(clusterIds, maxConcepts = 5) {
  const graphData = JSON.parse(await fs.readFile(GRAPH_PATH, 'utf8'));
  const relatedConcepts = [];

  for (const clusterId of clusterIds) {
    const cluster = graphData.clusters.find(c => c.id === clusterId);
    if (!cluster) continue;

    // Get top concepts by frequency
    const topConcepts = cluster.nodes
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, maxConcepts)
      .map(node => ({
        label: node.label,
        frequency: node.frequency,
        types: node.types || []
      }));

    relatedConcepts.push(...topConcepts);
  }

  return relatedConcepts;
}

/**
 * Get key documents from cluster summaries
 */
async function getKeyDocuments(clusterIds) {
  const summariesData = JSON.parse(await fs.readFile(SUMMARIES_PATH, 'utf8'));
  const keyDocuments = [];

  for (const clusterId of clusterIds) {
    const summary = summariesData.summaries.find(s => s.id === clusterId);
    if (summary && summary.keyDocuments) {
      keyDocuments.push(...summary.keyDocuments.slice(0, 3));
    }
  }

  // Remove duplicates
  return [...new Set(keyDocuments)];
}

/**
 * Handle cortex_query tool invocation
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.query - The query string
 * @param {number} [args.maxClusters=2] - Max clusters to load
 * @param {boolean} [args.includeRelatedConcepts=true] - Include concept details
 * @param {number} [args.maxTokens=800] - Max tokens in priming
 * @returns {Object} - Tool response with priming context
 */
export async function handleCortexQuery(args) {
  const startTime = Date.now();

  const {
    query,
    maxClusters = 2,
    includeRelatedConcepts = true,
    maxTokens = 800
  } = args;

  // 1. Classify query and build memory context
  const memoryContext = await buildMemoryContext(query);

  // Limit to maxClusters
  const selectedClusters = memoryContext.selectedClusters.slice(0, maxClusters);
  memoryContext.selectedClusters = selectedClusters;

  // 2. Format as priming prompt
  let priming = formatAsPrompt(memoryContext);

  // 3. Truncate if exceeds maxTokens (rough estimate: 4 chars ≈ 1 token)
  const estimatedTokens = priming.length / 4;
  if (estimatedTokens > maxTokens) {
    const targetLength = maxTokens * 4;
    priming = priming.slice(0, targetLength) + '\n\n[Context truncated to fit token limit]';
  }

  // 4. Get related concepts and key documents
  const relatedConcepts = includeRelatedConcepts
    ? await getRelatedConcepts(selectedClusters, 5)
    : [];

  const keyDocuments = await getKeyDocuments(selectedClusters);

  // 5. Build response
  const classificationTime = Date.now() - startTime;

  const summariesData = JSON.parse(await fs.readFile(SUMMARIES_PATH, 'utf8'));
  const totalConcepts = selectedClusters.reduce((sum, clusterId) => {
    const summary = summariesData.summaries.find(s => s.id === clusterId);
    return sum + (summary?.size || 0);
  }, 0);

  const clusterCoverage = selectedClusters.map(clusterId => {
    const summary = summariesData.summaries.find(s => s.id === clusterId);
    return summary?.coverage || '0%';
  }).join(' + ');

  return {
    query,
    selectedClusters,
    priming,
    relatedConcepts,
    keyDocuments,
    metadata: {
      totalConcepts,
      clusterCoverage,
      classificationTime: `${classificationTime}ms`
    }
  };
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node cortex-query-tool.mjs "<query>" [--json]');
    console.error('\nExample:');
    console.error('  node cortex-query-tool.mjs "How do I debug MCP stdio connections?"');
    console.error('  node cortex-query-tool.mjs "What did I accomplish this week?" --json');
    process.exit(1);
  }

  const jsonOutput = args.includes('--json');
  const query = args.filter(a => a !== '--json').join(' ');

  console.log('🔍 Processing cortex_query...\n');

  const result = await handleCortexQuery({ query });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('✅ Query processed\n');
    console.log(`📊 Selected clusters: ${result.selectedClusters.join(', ')}`);
    console.log(`📚 Total concepts: ${result.metadata.totalConcepts}`);
    console.log(`⏱️  Classification time: ${result.metadata.classificationTime}\n`);
    
    console.log('📄 Memory Priming Context:');
    console.log('─'.repeat(80));
    console.log(result.priming);
    console.log('─'.repeat(80));
    
    if (result.relatedConcepts.length > 0) {
      console.log('\n🔗 Related Concepts:');
      result.relatedConcepts.forEach(concept => {
        console.log(`  - ${concept.label} (${concept.frequency}×) [${concept.types.join(', ')}]`);
      });
    }

    if (result.keyDocuments.length > 0) {
      console.log('\n📚 Key Documents:');
      result.keyDocuments.forEach(doc => {
        console.log(`  - ${doc}`);
      });
    }
  }
}

// Run if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('❌ cortex_query failed:', err);
    process.exit(1);
  });
}
