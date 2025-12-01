#!/usr/bin/env node
/**
 * generate-daily-digest.mjs
 *
 * Automatically generate daily digest file from template and TODO.md
 *
 * Usage:
 *   node cortex/scripts/generate-daily-digest.mjs [date]
 *
 * Examples:
 *   node cortex/scripts/generate-daily-digest.mjs              # Today's digest
 *   node cortex/scripts/generate-daily-digest.mjs 2025-11-29   # Specific date
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '../..');

// Parse command line arguments
const targetDate = process.argv[2] || getYesterdayInJST();

const TEMPLATE_PATH = path.join(ROOT, 'cortex/templates/daily-digest-template.md');
const TODO_PATH = path.join(ROOT, 'TODO.md');
const OUTPUT_DIR = path.join(ROOT, 'cortex/daily');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `${targetDate}-digest.md`);

/**
 * Format date as YYYY-MM-DD in JST
 */
function formatDate(date = new Date()) {
  // Explicitly format in JST to avoid timezone issues
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Get yesterday's date in JST
 * This is the default behavior for digest generation
 */
function getYesterdayInJST() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return formatDate(now);
}

/**
 * Extract tasks from TODO.md based on tags
 */
function extractTasks(todoContent) {
  const lines = todoContent.split('\n');

  const highPriority = [];
  const regular = [];
  const noTag = [];

  let inTodaySection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "Today" section
    if (trimmed.match(/^##\s+Today/i)) {
      inTodaySection = true;
      continue;
    }

    // Stop at next section
    if (trimmed.startsWith('##') && !trimmed.match(/^##\s+Today/i)) {
      inTodaySection = false;
      continue;
    }

    // Extract tasks from Today section
    if (inTodaySection && trimmed.startsWith('- [ ]')) {
      // Check for tags
      const hasUrgent = trimmed.includes('#urgent') || trimmed.includes('#deepwork');
      const hasBlocked = trimmed.includes('#blocked') || trimmed.includes('#waiting');
      const hasReview = trimmed.includes('#review');
      const hasTag = trimmed.includes('#');

      // Clean up task text (remove HTML comments)
      let taskText = trimmed.replace(/<!--.*?-->/g, '').trim();

      if (hasUrgent || hasBlocked) {
        highPriority.push(taskText);
      } else if (hasReview || hasTag) {
        regular.push(taskText);
      } else {
        noTag.push(taskText);
      }
    }
  }

  return { highPriority, regular, noTag };
}

/**
 * Validate generated digest file
 */
async function validateOutput() {
  const stats = await fs.stat(OUTPUT_PATH);
  const MIN_SIZE = 100; // Minimum 100 bytes
  
  if (stats.size < MIN_SIZE) {
    throw new Error(`Generated file is too small (${stats.size} bytes)`);
  }
  
  // Check for required sections and ensure template placeholders are replaced
  const content = await fs.readFile(OUTPUT_PATH, 'utf8');
  
  if (!content.includes("## Today's Focus") || content.includes('{{DATE}}')) {
    throw new Error('Generated file is missing required sections or still contains template placeholders');
  }
  
  console.log('✅ Validation passed');
  console.log(`   File size: ${stats.size} bytes`);
  console.log(`   Required sections: present`);
  console.log(`   Template placeholders: replaced`);
}

/**
 * Generate digest content from template
 */
async function generateDigest() {
  console.log('📝 Generating daily digest...\n');

  // 1. Read template
  console.log(`📖 Reading template: ${TEMPLATE_PATH}`);
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');

  // 2. Read TODO.md
  console.log(`📖 Reading TODO.md: ${TODO_PATH}`);
  const todoContent = await fs.readFile(TODO_PATH, 'utf8');

  // 3. Extract tasks
  console.log('🔄 Extracting tasks from TODO.md...');
  const { highPriority, regular, noTag } = extractTasks(todoContent);

  console.log(`   ✓ High Priority: ${highPriority.length} tasks`);
  console.log(`   ✓ Regular: ${regular.length} tasks`);
  console.log(`   ✓ No Tags: ${noTag.length} tasks\n`);

  // 4. Format task lists
  const formatTasks = (tasks) => {
    if (tasks.length === 0) return '（タスクなし）';
    return tasks.join('\n');
  };

  // 5. Replace template placeholders
  let content = template
    .replace('{{DATE}}', targetDate)
    .replace('{{HIGH_PRIORITY_TASKS}}', formatTasks(highPriority))
    .replace('{{REGULAR_TASKS}}', formatTasks(regular))
    .replace('{{NO_TAG_TASKS}}', formatTasks(noTag))
    .replace('{{TIMESTAMP}}', new Date().toISOString());

  // 6. Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // 7. Write digest file
  console.log(`💾 Writing digest: ${OUTPUT_PATH}`);
  await fs.writeFile(OUTPUT_PATH, content, 'utf8');

  console.log(`✅ Daily digest generated successfully!`);
  console.log(`   File: ${OUTPUT_PATH}`);
  console.log(`   Size: ${content.length} bytes`);
  console.log(`   Tasks: ${highPriority.length + regular.length + noTag.length} total`);
  
  // Validate the generated file
  await validateOutput();
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if file already exists
    try {
      await fs.access(OUTPUT_PATH);
      console.log(`⚠️  File already exists: ${OUTPUT_PATH}`);
      console.log('   Overwriting...\n');
    } catch {
      // File doesn't exist, proceed
    }

    await generateDigest();
  } catch (error) {
    console.error('❌ Error generating digest:', error.message);
    process.exit(1);
  }
}

main();
