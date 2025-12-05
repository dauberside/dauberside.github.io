#!/usr/bin/env node
/**
 * Cortex OS Search MCP Server
 *
 * MCP stdio server for searching Cortex OS knowledge:
 * - Concept search (Knowledge Graph based)
 * - Note search (fulltext + semantic)
 * - Cluster search (find concepts by cluster)
 *
 * Security:
 * - Read-only access to graph and KB index
 * - No file system write operations
 *
 * Usage:
 *   node services/mcp/search.mjs
 *
 * Protocol: JSON-RPC 2.0 over stdio
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Paths to knowledge base
const GRAPH_PATH = path.join(ROOT_DIR, 'cortex/graph/graph-v1.json');
const EMBEDDINGS_PATH = path.join(ROOT_DIR, 'cortex/graph/concept-embeddings.json');
const KB_INDEX_PATH = path.join(ROOT_DIR, 'kb/index/embeddings.json');
const CLUSTERS_PATH = path.join(ROOT_DIR, 'cortex/graph/clusters-v1.md');

// Cache for loaded data
let graphCache = null;
let embeddingsCache = null;
let kbIndexCache = null;

/**
 * Load Knowledge Graph
 */
async function loadGraph() {
  if (!graphCache) {
    const data = await fs.readFile(GRAPH_PATH, 'utf-8');
    graphCache = JSON.parse(data);
  }
  return graphCache;
}

/**
 * Load Concept Embeddings
 */
async function loadEmbeddings() {
  if (!embeddingsCache) {
    const data = await fs.readFile(EMBEDDINGS_PATH, 'utf-8');
    embeddingsCache = JSON.parse(data);
  }
  return embeddingsCache;
}

/**
 * Load KB Index
 */
async function loadKBIndex() {
  if (!kbIndexCache) {
    const rawData = await fs.readFile(KB_INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(rawData);
    // KB index structure: { header: {...}, data: [...] }
    kbIndexCache = {
      header: parsed.header,
      chunks: Array.isArray(parsed.data) ? parsed.data : Object.values(parsed.data),
    };
  }
  return kbIndexCache;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Simple string similarity (Jaccard index)
 */
function stringSimilarity(str1, str2) {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * MCP Tools
 */
const tools = {
  /**
   * Search concepts in Knowledge Graph
   */
  async search_concepts({ query, limit = 10 }) {
    if (!query) {
      throw new Error('query parameter is required');
    }

    const graph = await loadGraph();
    const queryLower = query.toLowerCase();

    // Search across all clusters
    const results = [];
    for (const cluster of graph.clusters) {
      for (const node of cluster.nodes) {
        // Match by label or ID
        const labelMatch = node.label.toLowerCase().includes(queryLower);
        const idMatch = node.id.toLowerCase().includes(queryLower);
        
        if (labelMatch || idMatch) {
          results.push({
            id: node.id,
            label: node.label,
            frequency: node.frequency,
            types: node.types,
            sourceNotes: node.sourceNotes.slice(0, 3), // Top 3 notes
            cluster: {
              id: cluster.id,
              label: cluster.label,
            },
          });
        }
      }
    }

    // Sort by frequency (descending)
    results.sort((a, b) => b.frequency - a.frequency);

    return {
      query,
      total: results.length,
      results: results.slice(0, limit),
    };
  },

  /**
   * Search notes in KB index
   */
  async search_notes({ query, limit = 10 }) {
    if (!query) {
      throw new Error('query parameter is required');
    }

    const kbIndex = await loadKBIndex();
    const queryLower = query.toLowerCase();

    // Fulltext search across chunks
    const results = [];
    const chunks = kbIndex.chunks || [];
    
    for (const chunk of chunks) {
      if (!chunk || !chunk.text) continue;
      
      const contentMatch = chunk.text.toLowerCase().includes(queryLower);
      const sourceMatch = chunk.source?.toLowerCase().includes(queryLower);
      
      if (contentMatch || sourceMatch) {
        // Calculate match score (simple keyword count)
        const keywords = queryLower.split(/\s+/);
        let score = 0;
        for (const keyword of keywords) {
          if (chunk.text.toLowerCase().includes(keyword)) {
            score++;
          }
        }

        results.push({
          id: chunk.id,
          source: chunk.source || 'Unknown',
          chunk_index: chunk.chunk_index,
          preview: chunk.text.substring(0, 150) + '...',
          score,
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return {
      query,
      total: results.length,
      results: results.slice(0, limit),
    };
  },

  /**
   * Find concepts by cluster
   */
  async search_by_cluster({ clusterId, limit = 20 }) {
    if (!clusterId) {
      throw new Error('clusterId parameter is required');
    }

    const graph = await loadGraph();
    const cluster = graph.clusters.find(c => c.id === clusterId);

    if (!cluster) {
      throw new Error(`Cluster not found: ${clusterId}`);
    }

    // Sort nodes by frequency
    const sortedNodes = [...cluster.nodes].sort((a, b) => b.frequency - a.frequency);

    return {
      cluster: {
        id: cluster.id,
        label: cluster.label,
        size: cluster.size,
        coreConcept: cluster.coreConcept,
      },
      total: sortedNodes.length,
      concepts: sortedNodes.slice(0, limit).map(node => ({
        id: node.id,
        label: node.label,
        frequency: node.frequency,
        types: node.types,
        sourceNotes: node.sourceNotes.slice(0, 3),
      })),
    };
  },

  /**
   * List all clusters
   */
  async list_clusters() {
    const graph = await loadGraph();

    return {
      total: graph.clusters.length,
      clusters: graph.clusters.map(cluster => ({
        id: cluster.id,
        label: cluster.label,
        size: cluster.size,
        coreConcept: cluster.coreConcept,
        totalFrequency: cluster.totalFrequency,
      })),
    };
  },

  /**
   * Get concept details
   */
  async get_concept({ conceptId }) {
    if (!conceptId) {
      throw new Error('conceptId parameter is required');
    }

    const graph = await loadGraph();
    
    // Find concept across all clusters
    for (const cluster of graph.clusters) {
      const node = cluster.nodes.find(n => n.id === conceptId);
      if (node) {
        return {
          id: node.id,
          label: node.label,
          frequency: node.frequency,
          types: node.types,
          sourceNotes: node.sourceNotes,
          cluster: {
            id: cluster.id,
            label: cluster.label,
          },
        };
      }
    }

    throw new Error(`Concept not found: ${conceptId}`);
  },

  /**
   * Find similar concepts (semantic search)
   */
  async find_similar({ conceptId, limit = 10 }) {
    if (!conceptId) {
      throw new Error('conceptId parameter is required');
    }

    const embeddings = await loadEmbeddings();
    const graph = await loadGraph();

    // Find source embedding
    const sourceNode = embeddings.nodes.find(n => n.id === conceptId);
    if (!sourceNode) {
      throw new Error(`Concept not found: ${conceptId}`);
    }

    const sourceEmbedding = sourceNode.embedding;

    // Calculate similarity with all other concepts
    const similarities = [];
    for (const node of embeddings.nodes) {
      if (node.id === conceptId) continue;

      const similarity = cosineSimilarity(sourceEmbedding, node.embedding);
      if (similarity > 0.5) { // Threshold for relevance
        similarities.push({
          id: node.id,
          label: node.label,
          similarity,
        });
      }
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Enrich with cluster information
    const results = similarities.slice(0, limit).map(item => {
      for (const cluster of graph.clusters) {
        const node = cluster.nodes.find(n => n.id === item.id);
        if (node) {
          return {
            ...item,
            frequency: node.frequency,
            sourceNotes: node.sourceNotes.slice(0, 2),
            cluster: {
              id: cluster.id,
              label: cluster.label,
            },
          };
        }
      }
      return item;
    });

    return {
      query: conceptId,
      total: similarities.length,
      results,
    };
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
            name: 'cortex-search',
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
              name: 'search_concepts',
              description: 'Search concepts in Knowledge Graph by keyword',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  limit: { type: 'number', description: 'Max results (default: 10)' },
                },
                required: ['query'],
              },
            },
            {
              name: 'search_notes',
              description: 'Search notes in KB index by keyword (fulltext)',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  limit: { type: 'number', description: 'Max results (default: 10)' },
                },
                required: ['query'],
              },
            },
            {
              name: 'search_by_cluster',
              description: 'Find concepts by cluster ID',
              inputSchema: {
                type: 'object',
                properties: {
                  clusterId: { type: 'string', description: 'Cluster ID (e.g., cluster-0)' },
                  limit: { type: 'number', description: 'Max results (default: 20)' },
                },
                required: ['clusterId'],
              },
            },
            {
              name: 'list_clusters',
              description: 'List all clusters in Knowledge Graph',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'get_concept',
              description: 'Get detailed information about a specific concept',
              inputSchema: {
                type: 'object',
                properties: {
                  conceptId: { type: 'string', description: 'Concept ID' },
                },
                required: ['conceptId'],
              },
            },
            {
              name: 'find_similar',
              description: 'Find similar concepts using semantic similarity (embeddings)',
              inputSchema: {
                type: 'object',
                properties: {
                  conceptId: { type: 'string', description: 'Source concept ID' },
                  limit: { type: 'number', description: 'Max results (default: 10)' },
                },
                required: ['conceptId'],
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
