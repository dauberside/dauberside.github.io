#!/usr/bin/env node
/**
 * Generate llms.txt from llms-input.json
 * 
 * Converts structured JSON data into a human-readable text format
 * optimized for LLM context windows.
 * 
 * Input: cortex/tmp/llms-input.json
 * Output: llms.txt
 * 
 * Usage:
 *   node scripts/generate-llms-txt.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(PROJECT_ROOT, 'cortex/tmp/llms-input.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'llms.txt');

/**
 * Main generation pipeline
 */
async function main() {
  console.log('🚀 Starting llms.txt generation...\n');

  // Load llms-input.json
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`❌ Error: ${INPUT_PATH} not found`);
    console.error('   Run: node cortex/scripts/generate-llms-input.mjs');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  console.log('✅ Loaded llms-input.json');

  // Generate sections
  const sections = [
    generateHeader(input),
    generateProjectContext(input),
    generateMcpLayer(input),
    generateKnowledgeGraph(input),
    generateTaskContext(input),
    generateRecentUpdates(input),
    generateFooter(input),
  ];

  // Combine and write
  const output = sections.join('\n\n---\n\n');
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');

  console.log(`✅ llms.txt generated at ${OUTPUT_PATH}\n`);

  // Stats
  const stats = fs.statSync(OUTPUT_PATH);
  const lines = output.split('\n').length;
  console.log('📊 Summary:');
  console.log(`   - File Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   - Lines: ${lines}`);
  console.log(`   - Clusters: ${input.clusters.length}`);
  console.log(`   - Total Concepts: ${input.knowledgeGraph.totalConcepts}`);
}

/**
 * Generate header section
 */
function generateHeader(input) {
  const now = new Date().toISOString();
  return `# Cortex OS - Context File

**Generated**: ${now}
**Version**: ${input.version}
**Project**: ${input.project}

This file provides structured context about Cortex OS for LLM interactions.
It contains project metadata, MCP layer information, knowledge graph structure,
and current task context.`;
}

/**
 * Generate project context section
 */
function generateProjectContext(input) {
  const { knowledgeGraph } = input;
  
  return `## 📋 Project Context

**Cortex OS** is a self-operating personal knowledge and task management system.

### Knowledge Graph Statistics
- **Total Concepts**: ${knowledgeGraph.totalConcepts}
- **Total Clusters**: ${knowledgeGraph.totalClusters}
- **Clustering Method**: ${knowledgeGraph.method}
- **Similarity Threshold**: ${knowledgeGraph.similarityThreshold}

### System Architecture
- **Daily Loop**: Automated digest generation and TODO sync
- **Weekly Loop**: Weekly summary and reflection
- **Knowledge Base**: Indexed notes with embeddings
- **Automation**: n8n workflows for Recipe execution`;
}

/**
 * Generate MCP Layer section
 */
function generateMcpLayer(input) {
  const { mcpLayer } = input;
  
  if (!mcpLayer || !mcpLayer.enabled) {
    return `## 🔌 MCP Layer

MCP Layer is not enabled.`;
  }

  let output = `## 🔌 MCP Layer

**Status**: ${mcpLayer.enabled ? 'Enabled' : 'Disabled'}
**Version**: ${mcpLayer.version}
**Completion Date**: ${mcpLayer.completionDate}

### MCP Servers

${mcpLayer.servers.map(server => {
  const toolsList = server.tools.length <= 3 
    ? server.tools.join(', ')
    : `${server.tools.slice(0, 3).join(', ')}, +${server.tools.length - 3} more`;
  
  return `**${server.name}** (${server.priority})
- Status: ${server.status}
- Tools: ${toolsList}`;
}).join('\n\n')}`;

  return output;
}

/**
 * Generate Knowledge Graph section
 */
function generateKnowledgeGraph(input) {
  const { clusters } = input;
  
  let output = `## 🧠 Knowledge Graph

### Clusters Overview

${clusters.map((cluster, idx) => {
  const num = idx + 1;
  return `**${num}. ${cluster.name}** (${cluster.size} concepts)

**Description**: ${cluster.description}

**Purpose**: ${cluster.purpose}

**Core Concepts** (top 5):
${cluster.coreConcepts.slice(0, 5).map(c => `- ${c.label} (${c.frequency})`).join('\n')}

**Outputs**:
${cluster.outputs.map(o => `- ${o}`).join('\n')}`;
}).join('\n\n')}`;

  return output;
}

/**
 * Generate Task Context section
 */
function generateTaskContext(input) {
  const { highlights } = input;
  
  if (!highlights || !highlights.todoContext) {
    return `## 📝 Task Context

No task context available.`;
  }

  const { todoContext } = highlights;
  const today = todoContext.today || todoContext.date || 'N/A';
  const topTasks = todoContext.topItems || todoContext.topTasks || [];

  let output = `## 📝 Task Context

**Today**: ${today}

### Top Priority Tasks

${topTasks.length > 0 ? topTasks.map((task, idx) => {
  const num = idx + 1;
  // Handle both string and object formats
  const taskText = typeof task === 'string' ? task : (task.text || task);
  const category = typeof task === 'object' ? (task.category || '') : '';
  const emoji = typeof task === 'object' ? (task.emoji || '') : '';
  const tags = typeof task === 'object' && task.tags ? task.tags.join(', ') : '';
  
  let line = `${num}. ${taskText}`;
  if (category) line += `\n   - Category: ${category}`;
  if (emoji) line += `\n   - Emoji: ${emoji}`;
  if (tags) line += `\n   - Tags: ${tags}`;
  
  return line;
}).join('\n\n') : 'No tasks defined.'}`;

  return output;
}

/**
 * Generate Recent Updates section
 */
function generateRecentUpdates(input) {
  const { highlights } = input;
  
  if (!highlights) {
    return `## 📰 Recent Updates

No recent updates available.`;
  }

  let output = `## 📰 Recent Updates`;

  // Recent high-impact notes
  if (highlights.recentHighImpactNotes && highlights.recentHighImpactNotes.length > 0) {
    output += `\n\n### High-Impact Notes\n\n${highlights.recentHighImpactNotes.map(note => {
      // Handle both string and object formats
      const noteName = typeof note === 'string' ? note : (note.label || note);
      return `- ${noteName}`;
    }).join('\n')}`;
  }

  // Recently updated notes
  if (highlights.recentlyUpdatedNotes && highlights.recentlyUpdatedNotes.length > 0) {
    output += `\n\n### Recently Updated Notes\n\n${highlights.recentlyUpdatedNotes.map(note => {
      // Handle both string and object formats
      const noteName = typeof note === 'string' ? note : (note.label || note);
      return `- ${noteName}`;
    }).join('\n')}`;
  }

  return output;
}

/**
 * Generate footer section
 */
function generateFooter(input) {
  return `## 🔗 Related Resources

- **Knowledge Graph**: \`cortex/graph/clusters-v1.md\`
- **TODO Management**: \`TODO.md\`
- **KB Index**: \`kb/index/embeddings.json\`
- **Daily Digests**: \`cortex/daily/\`
- **Weekly Summaries**: \`cortex/weekly/\`

---

**Generated by**: Cortex OS llms.txt generation pipeline
**Source Data**: llms-input.json v${input.version}
**Generation Time**: ${new Date().toISOString()}`;
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
