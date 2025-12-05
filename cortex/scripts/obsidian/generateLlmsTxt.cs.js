/**
 * Generate llms.txt from llms-input.json (Obsidian Codescript)
 * 
 * Converts structured JSON data into a human-readable text format
 * optimized for LLM context windows.
 * 
 * Input: cortex/tmp/llms-input.json
 * Output: llms.txt
 * 
 * Usage: Run via Obsidian Codescript plugin
 */

async function generateLlmsTxt() {
  // Path configuration
  const inputPath = 'cortex/tmp/llms-input.json';
  const outputPath = 'llms.txt';
  
  // Load llms-input.json
  const inputFile = app.vault.getAbstractFileByPath(inputPath);
  if (!inputFile) {
    console.error(`Error: ${inputPath} not found`);
    return;
  }
  
  const inputContent = await app.vault.read(inputFile);
  const input = JSON.parse(inputContent);
  
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
  
  // Combine
  const output = sections.join('\n\n---\n\n');
  
  // Write to vault root
  const outputFile = app.vault.getAbstractFileByPath(outputPath);
  if (outputFile) {
    await app.vault.modify(outputFile, output);
  } else {
    await app.vault.create(outputPath, output);
  }
  
  console.log(`✅ llms.txt generated at ${outputPath}`);
  
  // Stats
  const lines = output.split('\n').length;
  const size = new Blob([output]).size;
  console.log(`📊 Summary: ${(size / 1024).toFixed(2)} KB, ${lines} lines, ${input.clusters.length} clusters`);
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

  if (highlights.recentHighImpactNotes && highlights.recentHighImpactNotes.length > 0) {
    output += `\n\n### High-Impact Notes\n\n${highlights.recentHighImpactNotes.map(note => {
      const noteName = typeof note === 'string' ? note : (note.label || note);
      return `- ${noteName}`;
    }).join('\n')}`;
  }

  if (highlights.recentlyUpdatedNotes && highlights.recentlyUpdatedNotes.length > 0) {
    output += `\n\n### Recently Updated Notes\n\n${highlights.recentlyUpdatedNotes.map(note => {
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

**Generated by**: Cortex OS llms.txt generation pipeline (Obsidian Codescript)
**Source Data**: llms-input.json v${input.version}
**Generation Time**: ${new Date().toISOString()}`;
}

// Run
await generateLlmsTxt();
