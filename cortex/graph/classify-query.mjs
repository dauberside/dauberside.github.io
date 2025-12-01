#!/usr/bin/env node
/**
 * classify-query.mjs
 *
 * Classify user queries to determine which cluster(s) to load for LLM memory priming.
 *
 * Input: User question (string)
 * Output: Array of cluster IDs to load (e.g., ["cluster-0", "cluster-1"])
 *
 * Algorithm:
 * - Keyword-based classification (fast, deterministic)
 * - Can be upgraded to embedding-based similarity later
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use WORKSPACE_ROOT if available (container/CI), fallback to relative path
const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname;

const SUMMARIES_PATH = path.join(GRAPH_DIR, 'cluster-summaries.json');

/**
 * Cluster classification rules
 * 
 * Each rule maps keywords/patterns to cluster IDs
 */
const CLASSIFICATION_RULES = {
  'cluster-0': { // MCP Technical Core
    keywords: [
      'mcp', 'protocol', 'stdio', 'jsonrpc', 'primitive', 'resource', 'prompt',
      'tool', 'sampling', 'root', 'transport', 'server', 'client', 'bridge',
      'obsidian integration', 'kb', 'embedding', 'agent', 'llm integration',
      'adr-0003', 'adr-0004', 'adr-0005', 'adr-0006',
      'troubleshoot', 'debug', 'connection', 'setup guide', 'recipe',
      'security', 'token', 'deployment', '.mcp.json', 'architecture'
    ],
    patterns: [
      /mcp/i,
      /stdio/i,
      /jsonrpc/i,
      /primitive/i,
      /obsidian.*integration/i,
      /embedding.*pipeline/i,
      /agent.*sdk/i
    ]
  },

  'cluster-1': { // Daily Practice & Reflection
    keywords: [
      'daily', 'today', 'yesterday', 'plan', 'task', 'reflection', 'retrospect',
      'digest', 'summary', 'learning', 'insight', 'note', 'commit',
      'progress', 'continuity', 'workflow', 'organize', 'prioritize'
    ],
    patterns: [
      /today.*plan/i,
      /yesterday.*summary/i,
      /daily.*digest/i,
      /key.*learning/i,
      /task.*track/i,
      /reflection/i
    ]
  },

  'cluster-2': { // Strategic Context & Versioning
    keywords: [
      'roadmap', 'version', 'v1.1', 'v1.2', 'milestone', 'strategic', 'vision',
      'pillar', 'schedule', 'timeline', 'backlog', 'enhancement',
      'scope', 'priority', 'where are we', 'big picture',
      'infrastructure', 'secrets', 'credentials', 'api key'
    ],
    patterns: [
      /v\d\.\d/i,
      /roadmap/i,
      /strategic/i,
      /milestone/i,
      /where.*headed/i,
      /big.*picture/i
    ]
  },

  'cluster-3': { // Architecture Decision Records
    keywords: [
      'adr', 'decision', 'rationale', 'alternative', 'consequence',
      'why did we', 'architecture decision', 'follow-up', 'impact',
      'context', 'background', 'justif', 'choice', 'option',
      'trade-off', 'decision history'
    ],
    patterns: [
      /adr[-\s]?\d+/i,
      /why.*did.*we/i,
      /architecture.*decision/i,
      /alternative/i,
      /rationale/i,
      /consequence/i
    ]
  },

  'cluster-4': { // Achievements & Momentum
    keywords: [
      'weekly', 'highlight', 'achievement', 'win', 'accomplish', 'done',
      'challenge', 'obstacle', 'retrospective', 'w47', 'w48',
      'next week', 'momentum', 'progress report', 'release', 'milestone',
      'success', 'completed'
    ],
    patterns: [
      /w\d+/i,
      /weekly.*summary/i,
      /highlight/i,
      /achievement/i,
      /what.*accomplished/i,
      /progress.*report/i
    ]
  }
};

/**
 * Classify a query to one or more clusters
 * 
 * @param {string} query - User's question or prompt
 * @returns {string[]} - Array of cluster IDs to load (sorted by relevance)
 */
function classifyQuery(query) {
  const lowerQuery = query.toLowerCase();
  const scores = {};

  // Initialize scores
  Object.keys(CLASSIFICATION_RULES).forEach(clusterId => {
    scores[clusterId] = 0;
  });

  // Score each cluster based on keyword matches
  for (const [clusterId, rules] of Object.entries(CLASSIFICATION_RULES)) {
    // Keyword matching
    for (const keyword of rules.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        scores[clusterId] += 1;
      }
    }

    // Pattern matching (weighted higher)
    for (const pattern of rules.patterns) {
      if (pattern.test(query)) {
        scores[clusterId] += 2;
      }
    }
  }

  // Sort clusters by score (descending)
  const rankedClusters = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([clusterId]) => clusterId);

  // If no matches, default to MCP Technical Core (most likely)
  if (rankedClusters.length === 0) {
    return ['cluster-0'];
  }

  // Return top 2 clusters (avoid loading too much context)
  return rankedClusters.slice(0, 2);
}

/**
 * Get cluster summary for a given cluster ID
 */
async function getClusterSummary(clusterId) {
  const data = JSON.parse(await fs.readFile(SUMMARIES_PATH, 'utf8'));
  return data.summaries.find(s => s.id === clusterId);
}

/**
 * Build LLM memory priming context from query
 */
async function buildMemoryContext(query) {
  const clusterIds = classifyQuery(query);
  const summaries = await Promise.all(
    clusterIds.map(id => getClusterSummary(id))
  );

  return {
    query,
    selectedClusters: clusterIds,
    context: summaries.map(s => ({
      cluster: s.name,
      shortName: s.shortName,
      coverage: s.coverage,
      summary: s.summary,
      coreConcepts: s.coreConcepts.slice(0, 5), // Top 5 only
      keyDocuments: s.keyDocuments.slice(0, 3)  // Top 3 only
    }))
  };
}

/**
 * Format memory context as a compact prompt
 */
function formatAsPrompt(memoryContext) {
  const lines = [];

  lines.push('# Cortex OS - Memory Context\n');
  lines.push(`Query: "${memoryContext.query}"\n`);
  lines.push(`Relevant knowledge clusters: ${memoryContext.selectedClusters.join(', ')}\n`);
  lines.push('---\n');

  for (const ctx of memoryContext.context) {
    lines.push(`## ${ctx.cluster} (${ctx.coverage})\n`);
    lines.push(`${ctx.summary}\n`);
    lines.push('**Core concepts**:');
    ctx.coreConcepts.forEach(concept => {
      lines.push(`- ${concept}`);
    });
    lines.push('\n**Key documents**:');
    ctx.keyDocuments.forEach(doc => {
      lines.push(`- ${doc}`);
    });
    lines.push('\n---\n');
  }

  return lines.join('\n');
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node classify-query.mjs "<query>"');
    console.error('\nExample:');
    console.error('  node classify-query.mjs "How do I debug MCP stdio connections?"');
    console.error('  node classify-query.mjs "What did I accomplish this week?"');
    process.exit(1);
  }

  const query = args.join(' ');

  console.log('🔍 Classifying query...\n');

  const memoryContext = await buildMemoryContext(query);

  console.log('✅ Classification complete\n');
  console.log(`Selected clusters: ${memoryContext.selectedClusters.join(', ')}\n`);

  console.log('📄 Memory priming context:\n');
  console.log('─'.repeat(80));
  console.log(formatAsPrompt(memoryContext));
  console.log('─'.repeat(80));

  // Also output JSON for programmatic use
  if (args.includes('--json')) {
    console.log('\n📦 JSON output:\n');
    console.log(JSON.stringify(memoryContext, null, 2));
  }
}

// Run if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('❌ Classification failed:', err);
    process.exit(1);
  });
}

// Export for use as module
export { classifyQuery, buildMemoryContext, formatAsPrompt };
