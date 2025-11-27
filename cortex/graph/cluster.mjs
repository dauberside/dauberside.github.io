#!/usr/bin/env node
/**
 * cluster.mjs
 *
 * Cluster concept nodes using Connected Components algorithm.
 *
 * Input: cortex/graph/concept-embeddings.json
 * Output: cortex/graph/concept-clusters.json
 *
 * Algorithm:
 * - Compute pairwise cosine similarity for all concept embeddings
 * - Create edges between concepts with similarity ≥ threshold (default: 0.7)
 * - Find connected components (clusters) using Union-Find
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.join(__dirname, 'concept-embeddings.json');
const OUTPUT_PATH = path.join(__dirname, 'concept-clusters.json');

const SIMILARITY_THRESHOLD = 0.7;

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

/**
 * Union-Find data structure for connected components
 */
class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x) {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    // Union by rank
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }

  getComponents() {
    const components = new Map();

    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      if (!components.has(root)) {
        components.set(root, []);
      }
      components.get(root).push(i);
    }

    return Array.from(components.values());
  }
}

/**
 * Main clustering pipeline
 */
async function main() {
  console.log('🔧 Clustering concept nodes...\n');

  // 1. Read concept embeddings
  console.log(`📖 Reading ${INPUT_PATH}`);
  const data = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'));
  const nodes = data.nodes;

  if (!nodes || nodes.length === 0) {
    throw new Error('No nodes found in concept-embeddings.json');
  }

  console.log(`✓ Loaded ${nodes.length} nodes (dim: ${data.dimension})\n`);

  // 2. Compute similarity graph
  console.log(`🔄 Computing pairwise similarities (threshold: ${SIMILARITY_THRESHOLD})...`);
  const uf = new UnionFind(nodes.length);
  let edgeCount = 0;
  let comparisons = 0;
  const totalComparisons = (nodes.length * (nodes.length - 1)) / 2;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sim = cosineSimilarity(nodes[i].embedding, nodes[j].embedding);

      if (sim >= SIMILARITY_THRESHOLD) {
        uf.union(i, j);
        edgeCount++;
      }

      comparisons++;
      if (comparisons % 1000 === 0 || comparisons === totalComparisons) {
        process.stdout.write(`\r  Compared ${comparisons}/${totalComparisons} pairs (${edgeCount} edges)`);
      }
    }
  }

  console.log('\n✓ Similarity graph computed\n');

  // 3. Extract connected components
  console.log('🔄 Finding connected components...');
  const components = uf.getComponents();

  // Sort components by size (descending)
  components.sort((a, b) => b.length - a.length);

  console.log(`✓ Found ${components.length} clusters\n`);

  // 4. Build cluster metadata
  console.log('🔄 Building cluster metadata...');
  const clusters = [];

  for (let clusterId = 0; clusterId < components.length; clusterId++) {
    const nodeIndices = components[clusterId];
    const clusterNodes = nodeIndices.map(i => nodes[i]);

    // Find core concept (highest frequency)
    const coreNode = clusterNodes.reduce((max, node) =>
      node.frequency > max.frequency ? node : max
    );

    clusters.push({
      id: `cluster-${clusterId}`,
      nodeIds: clusterNodes.map(n => n.id),
      size: clusterNodes.length,
      coreConcept: coreNode.id,
      totalFrequency: clusterNodes.reduce((sum, n) => sum + n.frequency, 0),
    });
  }

  console.log('✓ Cluster metadata built\n');

  // 5. Build output
  const output = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    method: 'connected-components',
    threshold: SIMILARITY_THRESHOLD,
    numClusters: clusters.length,
    numNodes: nodes.length,
    numEdges: edgeCount,
    sourceEmbeddings: INPUT_PATH,
    clusters,
    // Also store node-to-cluster mapping for easy lookup
    nodeMapping: nodes.map((node, i) => ({
      id: node.id,
      clusterId: `cluster-${components.findIndex(comp => comp.includes(i))}`,
    })),
  };

  // 6. Write output
  console.log(`💾 Writing ${OUTPUT_PATH}`);
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ ${clusters.length} clusters → ${OUTPUT_PATH}`);
  console.log(`   Nodes: ${nodes.length}`);
  console.log(`   Edges: ${edgeCount}`);
  console.log(`   Avg cluster size: ${(nodes.length / clusters.length).toFixed(1)}`);

  // Display top 10 largest clusters
  console.log('\n📊 Top 10 largest clusters:');
  clusters.slice(0, 10).forEach((cluster, i) => {
    console.log(`   ${i + 1}. ${cluster.id}: ${cluster.size} nodes (core: ${cluster.coreConcept})`);
  });
}

main().catch((err) => {
  console.error('❌ clustering failed:', err);
  process.exit(1);
});
