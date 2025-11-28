#!/usr/bin/env node
// cortex/scripts/llms/generate-llms-txt.mjs
// llms-input.json から docs/llms.txt を生成する

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..');
const INPUT_PATH = path.join(ROOT, 'tmp', 'llms-input.json');
const OUTPUT_PATH = path.join(ROOT, '..', 'docs', 'llms.txt');

async function main() {
  console.log('🚀 Generating docs/llms.txt from llms-input.json...\n');
  const raw = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'));

  const lines = [];

  renderMeta(raw, lines);
  renderHighlights(raw.highlights, lines);
  renderClusters(raw.clusters, lines);

  const content = lines.join('\n') + '\n';
  await ensureFolder(path.dirname(OUTPUT_PATH));
  await fs.writeFile(OUTPUT_PATH, content, 'utf8');

  console.log(`✅ Wrote llms.txt → ${OUTPUT_PATH}\n`);
  console.log('📊 Content summary:');
  console.log(`   - Total lines: ${lines.length}`);
  console.log(`   - Clusters: ${raw.clusters.length}`);
  console.log(`   - TODO items: ${raw.highlights.todoContext?.topItems?.length ?? 0}`);
}

function renderMeta(input, lines) {
  lines.push('# Cortex OS / llms.txt');
  lines.push('# Auto-generated from cortex/tmp/llms-input.json');
  lines.push('');
  lines.push('[Meta]');
  lines.push(`Project: ${input.project}`);
  lines.push(`Total Concepts: ${input.knowledgeGraph.totalConcepts}`);
  lines.push(`Total Clusters: ${input.knowledgeGraph.totalClusters}`);
  lines.push(
    `Graph Method: ${input.knowledgeGraph.method} (threshold=${input.knowledgeGraph.similarityThreshold})`
  );
  lines.push('');
}

function renderHighlights(highlights, lines) {
  if (!highlights) return;
  lines.push('[Global Highlights]');
  lines.push(`Today: ${highlights.todoContext?.today ?? ''}`);

  const topItems = highlights.todoContext?.topItems ?? [];
  if (topItems.length > 0) {
    lines.push('Top TODO Items:');
    for (const item of topItems) {
      lines.push(`- ${item}`);
    }
  }

  const recentHigh = highlights.recentHighImpactNotes ?? [];
  if (recentHigh.length > 0) {
    lines.push('Recent High Impact Notes:');
    for (const n of recentHigh) {
      lines.push(`- ${n}`);
    }
  }

  const recentUpdated = highlights.recentlyUpdatedNotes ?? [];
  if (recentUpdated.length > 0) {
    lines.push('Recently Updated Notes:');
    for (const n of recentUpdated) {
      lines.push(`- ${n}`);
    }
  }

  lines.push('');
}

function renderClusters(clusters, lines) {
  if (!Array.isArray(clusters)) return;
  for (const cluster of clusters) {
    lines.push(`[Cluster: ${cluster.shortName || cluster.name}]`);
    lines.push(
      `Size: ${cluster.size} concepts (frequency: ${cluster.frequencySum})`
    );
    if (cluster.purpose) {
      lines.push(`Purpose: ${cluster.purpose}`);
    }
    if (cluster.outputs?.length) {
      lines.push(`Outputs: ${cluster.outputs.join(' / ')}`);
    }
    lines.push('');
    if (cluster.description) {
      lines.push('Description:');
      lines.push(cluster.description);
      lines.push('');
    }

    if (cluster.coreConcepts?.length) {
      lines.push('Top Concepts:');
      for (const c of cluster.coreConcepts) {
        lines.push(`- ${c.label} (${c.frequency})`);
      }
      lines.push('');
    }

    if (cluster.representativeNotes?.length) {
      lines.push('Representative Notes:');
      for (const note of cluster.representativeNotes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }

    lines.push(''); // クラスタ間の空行
  }
}

async function ensureFolder(folderPath) {
  await fs.mkdir(folderPath, { recursive: true });
}

main().catch((err) => {
  console.error('❌ Failed to generate llms.txt', err);
  process.exit(1);
});
