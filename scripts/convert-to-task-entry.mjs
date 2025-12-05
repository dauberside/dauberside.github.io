#!/usr/bin/env node
/**
 * Daily Digest → task-entry.json Converter
 * 
 * Converts Daily Digest Markdown files to task-entry.json format.
 * 
 * Usage:
 *   node scripts/convert-to-task-entry.mjs <date>
 * 
 * Examples:
 *   node scripts/convert-to-task-entry.mjs 2025-12-05
 *   node scripts/convert-to-task-entry.mjs 2025-12-05 --output custom.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse task line from Markdown
 * 
 * Examples:
 *   - [x] Recipe 10 完了 <!-- #milestone,#done -->
 *   - [ ] llms-input.json 実装 <!-- #urgent -->
 *   - [Cortex] ⚡ KB rebuild <!-- #urgent,#deepwork -->
 */
function parseTaskLine(line) {
  // Extract checkbox status
  const checkboxMatch = line.match(/^- \[([ x])\]/);
  if (!checkboxMatch) {
    return null; // Not a task line
  }

  const isCompleted = checkboxMatch[1] === 'x';
  let content = line.replace(/^- \[([ x])\]\s*/, '');

  // Extract tags from HTML comment
  const tagsMatch = content.match(/<!--\s*#([^>]+)\s*-->/);
  let tags = [];
  if (tagsMatch) {
    tags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t.length > 0);
    content = content.replace(/<!--\s*#[^>]+\s*-->/, '').trim();
  }

  // Extract emoji
  const emojiMatch = content.match(/^([⚡🚧⏳🎯👁️🎉])\s+/);
  let emoji = '';
  if (emojiMatch) {
    emoji = emojiMatch[1];
    content = content.replace(/^[⚡🚧⏳🎯👁️🎉]\s+/, '');
  }

  // Extract category
  const categoryMatch = content.match(/^\[([^\]]+)\]\s+/);
  let category = '';
  if (categoryMatch) {
    category = categoryMatch[1];
    content = content.replace(/^\[[^\]]+\]\s+/, '');
  }

  // Determine estimate based on tags
  let estimate = 1.0;
  if (tags.includes('urgent')) {
    estimate = 1.5;
  } else if (tags.includes('deepwork')) {
    estimate = 2.0;
  }

  return {
    content,
    status: isCompleted ? 'completed' : 'pending',
    tags,
    emoji,
    category,
    estimate
  };
}

/**
 * Parse Daily Digest Markdown
 */
function parseDigest(markdown, date) {
  const lines = markdown.split('\n');
  const tasks = [];
  const completed = [];
  let reflection = '';
  let inReflection = false;
  let inTasks = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Section headers
    if (line.startsWith('## Tasks') || line.startsWith('## Today\'s Focus')) {
      inTasks = true;
      inReflection = false;
      continue;
    } else if (line.startsWith('## Reflection')) {
      inReflection = true;
      inTasks = false;
      continue;
    } else if (line.startsWith('##') || line.startsWith('---')) {
      inTasks = false;
      inReflection = false;
      continue;
    }

    // Parse tasks
    if (inTasks && line.startsWith('- [')) {
      const task = parseTaskLine(line);
      if (task) {
        if (task.status === 'completed') {
          completed.push(task);
        } else {
          tasks.push(task);
        }
      }
    }

    // Parse reflection
    if (inReflection && line.length > 0) {
      reflection += (reflection.length > 0 ? '\n' : '') + line;
    }
  }

  return {
    date,
    tasks,
    completed,
    carryover: [],
    reflection: reflection.trim(),
    tomorrow_candidates: [],
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'daily-digest',
      version: '1.0.0'
    }
  };
}

/**
 * Convert Daily Digest to task-entry.json
 */
function convertDigest(date, outputPath = null) {
  const digestPath = path.resolve(__dirname, `../cortex/daily/${date}-digest.md`);

  if (!fs.existsSync(digestPath)) {
    console.error(`Error: Daily Digest not found at ${digestPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(digestPath, 'utf-8');
  const taskEntry = parseDigest(markdown, date);

  // Determine output path
  const defaultOutput = path.resolve(__dirname, `../cortex/state/task-entry-${date}.json`);
  const finalOutput = outputPath ? path.resolve(outputPath) : defaultOutput;

  // Ensure directory exists
  const outputDir = path.dirname(finalOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(finalOutput, JSON.stringify(taskEntry, null, 2), 'utf-8');

  console.log(`✅ Converted: ${digestPath}`);
  console.log(`📄 Output: ${finalOutput}`);
  console.log(`\nSummary:`);
  console.log(`  - Date: ${taskEntry.date}`);
  console.log(`  - Tasks: ${taskEntry.tasks.length}`);
  console.log(`  - Completed: ${taskEntry.completed.length}`);
  console.log(`  - Reflection: ${taskEntry.reflection.length > 0 ? 'Yes' : 'No'}`);

  return finalOutput;
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/convert-to-task-entry.mjs <date> [--output <path>]');
    console.error('\nExamples:');
    console.error('  node scripts/convert-to-task-entry.mjs 2025-12-05');
    console.error('  node scripts/convert-to-task-entry.mjs 2025-12-05 --output custom.json');
    process.exit(1);
  }

  const date = args[0];
  let outputPath = null;

  // Parse --output flag
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputPath = args[outputIndex + 1];
  }

  convertDigest(date, outputPath);
}

main();
