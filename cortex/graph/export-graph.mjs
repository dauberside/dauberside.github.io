#!/usr/bin/env node
/**
 * export-graph.mjs
 *
 * Export knowledge graph to human-readable format.
 *
 * Input:
 * - cortex/graph/concept-embeddings.json
 * - cortex/graph/concept-clusters.json
 *
 * Output:
 * - cortex/graph/graph-v1.json (structured data for AI/apps)
 * - cortex/graph/clusters-v1.md (human-readable "brain map")
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMBEDDINGS_PATH = path.join(__dirname, 'concept-embeddings.json');
const CLUSTERS_PATH = path.join(__dirname, 'concept-clusters.json');
const JSON_OUTPUT = path.join(__dirname, 'graph-v1.json');
const MD_OUTPUT = path.join(__dirname, 'clusters-v1.md');

/**
 * Main export pipeline
 */
async function main() {
  console.log('🔧 Exporting knowledge graph...\n');

  // 1. Read inputs
  console.log('📖 Reading embeddings and clusters...');
  const embeddings = JSON.parse(await fs.readFile(EMBEDDINGS_PATH, 'utf8'));
  const clusters = JSON.parse(await fs.readFile(CLUSTERS_PATH, 'utf8'));

  const nodes = embeddings.nodes;
  const clusterList = clusters.clusters;

  console.log(`✓ Loaded ${nodes.length} nodes, ${clusterList.length} clusters\n`);

  // 2. Build node lookup
  const nodeById = new Map();
  nodes.forEach(node => {
    nodeById.set(node.id, node);
  });

  // 3. Build graph-v1.json
  console.log('🔄 Building graph-v1.json...');
  const graphData = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    metadata: {
      totalConcepts: nodes.length,
      totalClusters: clusterList.length,
      embeddingModel: embeddings.embeddingModel,
      clusteringMethod: clusters.method,
      similarityThreshold: clusters.threshold,
    },
    clusters: clusterList.map(cluster => {
      const clusterNodes = cluster.nodeIds.map(id => nodeById.get(id));
      const coreNode = nodeById.get(cluster.coreConcept);

      return {
        id: cluster.id,
        label: coreNode.label,
        size: cluster.size,
        coreConcept: cluster.coreConcept,
        totalFrequency: cluster.totalFrequency,
        nodes: clusterNodes.map(n => ({
          id: n.id,
          label: n.label,
          frequency: n.frequency,
          types: n.types,
          sourceNotes: n.sourceNotes.slice(0, 3), // Top 3 notes only
        })),
      };
    }),
  };

  console.log('✓ graph-v1.json built\n');

  // 4. Build clusters-v1.md
  console.log('🔄 Building clusters-v1.md...');
  const mdLines = [];

  mdLines.push('# Knowledge Clusters v1\n');
  mdLines.push(`**Generated**: ${new Date().toISOString()}`);
  mdLines.push(`**Concepts**: ${nodes.length} | **Clusters**: ${clusterList.length} | **Method**: ${clusters.method}`);
  mdLines.push(`**Threshold**: ${clusters.threshold} | **Edges**: ${clusters.numEdges}\n`);
  mdLines.push('---\n');

  for (let i = 0; i < clusterList.length; i++) {
    const cluster = clusterList[i];
    const clusterNodes = cluster.nodeIds.map(id => nodeById.get(id));
    const coreNode = nodeById.get(cluster.coreConcept);

    mdLines.push(`## Cluster ${i + 1}: ${coreNode.label}\n`);
    mdLines.push(`**ID**: \`${cluster.id}\``);
    mdLines.push(`**Size**: ${cluster.size} concepts`);
    mdLines.push(`**Total Frequency**: ${cluster.totalFrequency}\n`);

    // Core concepts (top 10 by frequency)
    const topConcepts = clusterNodes
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    mdLines.push('**Core Concepts**:');
    topConcepts.forEach(node => {
      mdLines.push(`- **${node.label}** (${node.frequency}×) - ${node.types.join(', ')}`);
    });
    mdLines.push('');

    // Representative notes (from core concept)
    const representativeNotes = coreNode.sourceNotes.slice(0, 5);
    mdLines.push('**Representative Notes**:');
    representativeNotes.forEach(note => {
      mdLines.push(`- [[${note}]]`);
    });
    mdLines.push('');

    // All concepts (collapsed)
    if (cluster.size > 10) {
      const remaining = clusterNodes
        .sort((a, b) => b.frequency - a.frequency)
        .slice(10);

      mdLines.push(`<details>`);
      mdLines.push(`<summary>Other concepts (${remaining.length})</summary>\n`);

      remaining.forEach(node => {
        mdLines.push(`- ${node.label} (${node.frequency}×)`);
      });

      mdLines.push(`</details>\n`);
    }

    mdLines.push('---\n');
  }

  // Summary
  mdLines.push('## Summary\n');
  mdLines.push('**Cluster Distribution**:\n');
  clusterList.forEach((cluster, i) => {
    const coreNode = nodeById.get(cluster.coreConcept);
    const pct = ((cluster.size / nodes.length) * 100).toFixed(1);
    mdLines.push(`${i + 1}. **${coreNode.label}**: ${cluster.size} concepts (${pct}%)`);
  });

  const mdContent = mdLines.join('\n');
  console.log('✓ clusters-v1.md built\n');

  // 5. Write outputs
  console.log(`💾 Writing ${JSON_OUTPUT}`);
  await fs.writeFile(JSON_OUTPUT, JSON.stringify(graphData, null, 2), 'utf8');

  console.log(`💾 Writing ${MD_OUTPUT}`);
  await fs.writeFile(MD_OUTPUT, mdContent, 'utf8');

  console.log('\n✅ Knowledge graph exported:');
  console.log(`   - ${JSON_OUTPUT}`);
  console.log(`   - ${MD_OUTPUT}`);
  console.log(`\n💡 Open ${MD_OUTPUT} in Obsidian to view your brain map!`);
}

main().catch((err) => {
  console.error('❌ export failed:', err);
  process.exit(1);
});
