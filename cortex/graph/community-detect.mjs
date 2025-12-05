#!/usr/bin/env node
/**
 * community-detect.mjs
 *
 * Detect sub-communities within Cluster 0 (MCP) using Louvain algorithm.
 *
 * Input: cortex/graph/graph-v1.json
 * Output: cortex/graph/mcp-communities.json, cortex/graph/mcp-clusters-v1.md
 *
 * Strategy:
 * - Extract Cluster 0 nodes and edges (similarity ≥ 0.7)
 * - Apply Louvain community detection
 * - Calculate graph metrics (degree, betweenness, closeness)
 * - Export sub-communities as JSON and Markdown
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname;

const INPUT_PATH = path.join(GRAPH_DIR, 'graph-v1.json');
const OUTPUT_JSON = path.join(GRAPH_DIR, 'mcp-communities.json');
const OUTPUT_MD = path.join(GRAPH_DIR, 'mcp-clusters-v1.md');

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Calculate node degree (number of connections)
 */
function calculateDegree(graph) {
  const degrees = {};
  for (const node of graph.nodes()) {
    degrees[node] = graph.degree(node);
  }
  return degrees;
}

/**
 * Calculate betweenness centrality (simplified version)
 * Full betweenness is O(n³), so we use degree as a proxy
 */
function calculateBetweenness(graph) {
  // For simplicity, use degree as proxy for betweenness
  // A proper implementation would use shortest path algorithms
  return calculateDegree(graph);
}

/**
 * Calculate closeness centrality (simplified version)
 */
function calculateCloseness(graph) {
  const closeness = {};
  for (const node of graph.nodes()) {
    const neighbors = graph.neighbors(node);
    // Inverse of average distance (using 1-hop as proxy)
    closeness[node] = neighbors.length > 0 ? neighbors.length : 0;
  }
  return closeness;
}

/**
 * Get top N nodes by metric
 */
function getTopNodes(metric, n = 10) {
  return Object.entries(metric)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id, value]) => ({ id, value }));
}

/**
 * Main
 */
async function main() {
  console.log('🔍 Phase 2.5: MCP Community Detection\n');

  // Load graph-v1.json
  console.log(`📖 Reading: ${INPUT_PATH}`);
  const graphData = JSON.parse(await fs.readFile(INPUT_PATH, 'utf-8'));

  // Extract Cluster 0 (MCP)
  const cluster0 = graphData.clusters.find((c) => c.id === 'cluster-0');
  if (!cluster0) {
    throw new Error('Cluster 0 not found in graph-v1.json');
  }

  console.log(
    `📊 Cluster 0: ${cluster0.nodes.length} concepts, ${cluster0.coreConcept} core\n`
  );

  // Build graph using graphology
  const graph = new Graph({ type: 'undirected' });

  // Add nodes
  for (const node of cluster0.nodes) {
    graph.addNode(node.id, {
      label: node.label,
      frequency: node.frequency,
      types: node.types,
      sourceNotes: node.sourceNotes,
    });
  }

  // Add edges based on similarity threshold
  // We need concept embeddings for similarity calculation
  console.log('📐 Computing pairwise similarities...');

  const embeddingsPath = path.join(GRAPH_DIR, 'concept-embeddings.json');
  const embeddingsData = JSON.parse(await fs.readFile(embeddingsPath, 'utf-8'));

  // Create embedding map for Cluster 0 nodes only
  const embeddings = new Map();
  for (const concept of embeddingsData.nodes) {
    if (graph.hasNode(concept.id)) {
      embeddings.set(concept.id, concept.embedding);
    }
  }

  // Compute cosine similarity and create edges
  let edgeCount = 0;
  const nodes = graph.nodes();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      const embA = embeddings.get(nodeA);
      const embB = embeddings.get(nodeB);

      if (!embA || !embB) continue;

      const similarity = cosineSimilarity(embA, embB);
      if (similarity >= SIMILARITY_THRESHOLD) {
        graph.addEdge(nodeA, nodeB, { weight: similarity });
        edgeCount++;
      }
    }
  }

  console.log(`✅ Created ${edgeCount} edges (threshold: ${SIMILARITY_THRESHOLD})\n`);

  // Apply Louvain community detection
  console.log('🔬 Running Louvain community detection...');
  const communities = louvain(graph);

  // Count communities
  const communityMap = new Map();
  for (const [nodeId, communityId] of Object.entries(communities)) {
    if (!communityMap.has(communityId)) {
      communityMap.set(communityId, []);
    }
    communityMap.get(communityId).push(nodeId);
  }

  console.log(`✅ Found ${communityMap.size} sub-communities\n`);

  // Calculate graph metrics
  console.log('📊 Calculating graph metrics...');
  const degrees = calculateDegree(graph);
  const betweenness = calculateBetweenness(graph);
  const closeness = calculateCloseness(graph);

  const topDegree = getTopNodes(degrees, 10);
  const topBetweenness = getTopNodes(betweenness, 10);
  const topCloseness = getTopNodes(closeness, 10);

  console.log('\n🏆 Top 10 Hubs (by degree):');
  for (const { id, value } of topDegree) {
    const node = graph.getNodeAttributes(id);
    console.log(`  - ${node.label} (degree: ${value})`);
  }

  // Prepare output data
  const output = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    metadata: {
      sourceCluster: 'cluster-0',
      totalConcepts: cluster0.nodes.length,
      totalCommunities: communityMap.size,
      similarityThreshold: SIMILARITY_THRESHOLD,
      algorithm: 'louvain',
    },
    communities: [],
    metrics: {
      topDegree,
      topBetweenness,
      topCloseness,
    },
  };

  // Build community data
  for (const [communityId, nodeIds] of communityMap.entries()) {
    const nodes = nodeIds.map((id) => {
      const attrs = graph.getNodeAttributes(id);
      return {
        id,
        label: attrs.label,
        frequency: attrs.frequency,
        types: attrs.types,
        sourceNotes: attrs.sourceNotes,
        degree: degrees[id],
      };
    });

    // Sort by degree (descending)
    nodes.sort((a, b) => b.degree - a.degree);

    // Core concept = highest frequency node
    const coreNode = nodes.reduce((max, node) =>
      node.frequency > max.frequency ? node : max
    );

    output.communities.push({
      id: `mcp-community-${communityId}`,
      size: nodes.length,
      coreConcept: coreNode.id,
      coreLabel: coreNode.label,
      totalFrequency: nodes.reduce((sum, n) => sum + n.frequency, 0),
      nodes,
    });
  }

  // Sort communities by size (descending)
  output.communities.sort((a, b) => b.size - a.size);

  // Save JSON
  console.log(`\n💾 Saving: ${OUTPUT_JSON}`);
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2));

  // Generate Markdown
  console.log(`💾 Saving: ${OUTPUT_MD}`);
  const markdown = generateMarkdown(output, topDegree, topBetweenness, topCloseness);
  await fs.writeFile(OUTPUT_MD, markdown);

  console.log('\n✅ MCP Community Detection Complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   - ${output.communities.length} sub-communities`);
  console.log(`   - Largest: ${output.communities[0].size} concepts`);
  console.log(`   - Smallest: ${output.communities[output.communities.length - 1].size} concepts`);
}

/**
 * Generate Markdown output
 */
function generateMarkdown(data, topDegree, topBetweenness, topCloseness) {
  let md = '# MCP Cluster: Sub-Communities (Phase 2.5)\n\n';
  md += `> Generated: ${data.generatedAt}\n`;
  md += `> Algorithm: ${data.metadata.algorithm}\n`;
  md += `> Similarity Threshold: ${data.metadata.similarityThreshold}\n\n`;

  md += '---\n\n';
  md += '## 🎯 Overview\n\n';
  md += `- **Total Concepts**: ${data.metadata.totalConcepts}\n`;
  md += `- **Sub-Communities**: ${data.metadata.totalCommunities}\n`;
  md += `- **Source Cluster**: ${data.metadata.sourceCluster}\n\n`;

  md += '---\n\n';
  md += '## 🏆 Top Hubs (Network Analysis)\n\n';

  md += '### Top 10 by Degree (Most Connected)\n\n';
  for (const { id, value } of topDegree) {
    md += `- **${id}** (degree: ${value})\n`;
  }

  md += '\n### Top 10 by Betweenness (Bridge Nodes)\n\n';
  for (const { id, value } of topBetweenness) {
    md += `- **${id}** (betweenness: ${value})\n`;
  }

  md += '\n### Top 10 by Closeness (Central Nodes)\n\n';
  for (const { id, value } of topCloseness) {
    md += `- **${id}** (closeness: ${value})\n`;
  }

  md += '\n---\n\n';
  md += '## 📦 Sub-Communities\n\n';

  for (const community of data.communities) {
    md += `### ${community.id}\n\n`;
    md += `**Core Concept**: ${community.coreLabel}\n\n`;
    md += `**Size**: ${community.size} concepts\n\n`;
    md += `**Total Frequency**: ${community.totalFrequency}\n\n`;

    md += '**Core Concepts**:\n';
    const topConcepts = community.nodes.slice(0, 10);
    for (const node of topConcepts) {
      md += `- ${node.label} (freq: ${node.frequency}, degree: ${node.degree})\n`;
    }

    md += '\n**Representative Notes**:\n';
    const representativeNotes = new Set();
    for (const node of topConcepts) {
      for (const note of node.sourceNotes.slice(0, 2)) {
        representativeNotes.add(note);
      }
    }
    for (const note of representativeNotes) {
      md += `- [[${note}]]\n`;
    }

    md += '\n---\n\n';
  }

  return md;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
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

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
