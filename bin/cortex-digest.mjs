#!/usr/bin/env node
/**
 * cortex-digest.mjs - Enhanced Daily Digest Generator
 *
 * Automatically generate daily digest from TODO.md + Git activity
 *
 * Features:
 *   - Extracts both completed [x] and pending [ ] tasks
 *   - Supports dated sections (## Today — YYYY-MM-DD)
 *   - Includes Git commit summary
 *   - Generates structured markdown with placeholders for manual enrichment
 *
 * Usage:
 *   node bin/cortex-digest.mjs [date]
 *
 * Examples:
 *   node bin/cortex-digest.mjs              # Yesterday's digest (default)
 *   node bin/cortex-digest.mjs 2025-12-01   # Specific date
 *
 * Environment:
 *   WORKSPACE_ROOT - Project root directory
 *   OBSIDIAN_VAULT_PATH - Obsidian vault location (optional, for output)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..');

// Parse command line arguments
const targetDate = process.argv[2] || getYesterdayInJST();

const TODO_PATH = path.join(ROOT, 'TODO.md');

// Determine output directory
// If OBSIDIAN_VAULT_PATH is set, use it directly (already points to vault root)
// Otherwise, use workspace cortex/daily
const OUTPUT_DIR = process.env.OBSIDIAN_VAULT_PATH 
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'cortex', 'daily')
  : path.join(ROOT, 'cortex', 'daily');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `${targetDate}-digest.md`);

/**
 * Get yesterday's date in JST (UTC+9)
 */
function getYesterdayInJST() {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const yesterday = new Date(now.getTime() + jstOffset * 60 * 1000 - 24 * 60 * 60 * 1000);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Extract tasks from TODO.md (both completed and pending)
 */
function extractTasks(todoContent) {
  const lines = todoContent.split('\n');
  
  const completed = [];
  const pending = [];
  const highPriority = [];
  
  let inTodaySection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect "Today" section (with or without date)
    // Matches: ## Today, ## 🎯 Today, ## Today — 2025-11-28
    if (trimmed.match(/^##\s*[🎯]?\s*Today/i)) {
      inTodaySection = true;
      continue;
    }
    
    // Stop at next section
    if (trimmed.startsWith('##') && !trimmed.match(/^##\s*[🎯]?\s*Today/i)) {
      inTodaySection = false;
      continue;
    }
    
    if (!inTodaySection) continue;
    
    // Extract both completed [x] and pending [ ] tasks
    const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
    const isPending = trimmed.startsWith('- [ ]');
    
    if (isCompleted || isPending) {
      // Clean up task text (remove HTML comments)
      let taskText = trimmed.replace(/<!--.*?-->/g, '').trim();
      
      // Check for priority tags
      const hasUrgent = taskText.includes('#urgent') || taskText.includes('#deepwork');
      const hasBlocked = taskText.includes('#blocked') || taskText.includes('#waiting');
      
      if (hasUrgent || hasBlocked) {
        highPriority.push(taskText);
      } else if (isCompleted) {
        completed.push(taskText);
      } else {
        pending.push(taskText);
      }
    }
  }
  
  return { completed, pending, highPriority };
}

/**
 * Get Git activity summary for the target date
 */
function getGitActivity(date) {
  try {
    // Get commits for the date (JST day = UTC day + possible next day)
    const startDate = new Date(date + 'T00:00:00+09:00');
    const endDate = new Date(date + 'T23:59:59+09:00');
    
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    
    const commits = execSync(
      `git log --since="${startISO}" --until="${endISO}" --pretty=format:"%h %s" --no-merges`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    
    if (!commits) {
      // Try to get today's commits if target date matches
      const todayCommits = execSync(
        `git log --since="midnight" --pretty=format:"%h %s" --no-merges`,
        { cwd: ROOT, encoding: 'utf8' }
      ).trim();
      
      if (!todayCommits) return null;
      
      const commitLines = todayCommits.split('\n').filter(l => l);
      const byType = {
        feat: commitLines.filter(l => l.match(/feat[:(]/i)).length,
        fix: commitLines.filter(l => l.match(/fix[:(]/i)).length,
        docs: commitLines.filter(l => l.match(/docs[:(]/i)).length,
        other: commitLines.filter(
          l => !l.match(/feat[:(]|fix[:(]|docs[:(]/i)
        ).length
      };
      
      // Get file statistics for today
      const stats = execSync(
        `git diff --shortstat HEAD~${commitLines.length} HEAD 2>/dev/null || echo ""`,
        { cwd: ROOT, encoding: 'utf8' }
      ).trim();
      
      return {
        commits: commitLines,
        stats: stats || 'Changes statistics unavailable',
        byType,
        totalCommits: commitLines.length
      };
    }
    
    // Count commits by type
    const commitLines = commits.split('\n').filter(l => l);
    const byType = {
      feat: commitLines.filter(l => l.match(/feat[:(]/i)).length,
      fix: commitLines.filter(l => l.match(/fix[:(]/i)).length,
      docs: commitLines.filter(l => l.match(/docs[:(]/i)).length,
      other: commitLines.filter(
        l => !l.match(/feat[:(]|fix[:(]|docs[:(]/i)
      ).length
    };
    
    // Get file statistics
    const firstCommit = execSync(
      `git log --since="${startISO}" --until="${endISO}" --pretty=format:"%H" --no-merges | tail -1`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    
    const stats = firstCommit ? execSync(
      `git diff --shortstat ${firstCommit}^ HEAD 2>/dev/null || echo ""`,
      { cwd: ROOT, encoding: 'utf8' }
    ).trim() : '';
    
    return {
      commits: commitLines,
      stats: stats || 'Changes statistics unavailable',
      byType,
      totalCommits: commitLines.length
    };
  } catch (error) {
    console.warn('⚠️  Could not retrieve Git activity:', error.message);
    return null;
  }
}

/**
 * Generate digest content
 */
async function generateDigest() {
  console.log('📝 Generating daily digest...');
  console.log(`📅 Date: ${targetDate}\n`);
  
  // 1. Read TODO.md
  console.log(`📖 Reading TODO.md: ${TODO_PATH}`);
  const todoContent = await fs.readFile(TODO_PATH, 'utf8');
  
  // 2. Extract tasks
  console.log('🔄 Extracting tasks from TODO.md...');
  const { completed, pending, highPriority } = extractTasks(todoContent);
  
  console.log(`   ✓ Completed: ${completed.length} tasks`);
  console.log(`   ✓ Pending: ${pending.length} tasks`);
  console.log(`   ✓ High Priority: ${highPriority.length} tasks`);
  
  // 3. Get Git activity
  console.log('\n📊 Fetching Git activity...');
  const gitActivity = getGitActivity(targetDate);
  
  if (gitActivity) {
    console.log(`   ✓ Commits: ${gitActivity.totalCommits}`);
    console.log(`   ✓ Stats: ${gitActivity.stats || 'No stats available'}`);
  } else {
    console.log('   ℹ️  No Git activity found');
  }
  
  // 4. Build digest content
  const formatTasks = (tasks) => {
    if (tasks.length === 0) return '（なし）\n';
    return tasks.map(t => t).join('\n') + '\n';
  };
  
  let content = `---
date: ${targetDate}
type: daily-digest
generated: ${new Date().toISOString()}
tags:
  - daily-digest
  - auto-generated
---

# Daily Digest - ${targetDate}

**Generated**: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST  
**Status**: 🟡 Draft (要手動補完)

---

## 📋 Today's Focus

### ✅ Completed Tasks
${formatTasks(completed)}

### 🔥 High Priority
${formatTasks(highPriority)}

### ⏳ Pending Tasks
${formatTasks(pending)}

---

## 📊 Git Activity

`;

  if (gitActivity) {
    content += `**Commits**: ${gitActivity.totalCommits} total\n`;
    content += `- Features: ${gitActivity.byType.feat}\n`;
    content += `- Fixes: ${gitActivity.byType.fix}\n`;
    content += `- Docs: ${gitActivity.byType.docs}\n`;
    content += `- Other: ${gitActivity.byType.other}\n\n`;
    
    if (gitActivity.stats) {
      content += `**Changes**: ${gitActivity.stats}\n\n`;
    }
    
    content += `**Commit Log**:\n\`\`\`\n${gitActivity.commits.join('\n')}\n\`\`\`\n\n`;
  } else {
    content += `（Git activity not available）\n\n`;
  }

  content += `---

## 🎯 Key Achievements

_(手動で追記: 今日の主な成果・実装内容)_

- 

---

## 💡 Learnings & Insights

_(手動で追記: 学び・気づき・改善点)_

- 

---

## 📝 Technical Notes

_(手動で追記: 技術的な詳細・設計判断・トラブルシューティング)_

---

## 🔜 Tomorrow's Plan

_(手動で追記: 明日のタスク・フォーカスエリア)_

- 

---

**Generated by**: Cortex Daily Digest System v1.1  
**Source**: TODO.md + Git activity  
**Mode**: Draft (manual enrichment recommended)
`;

  // 5. Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // 6. Write digest file
  console.log(`\n💾 Writing digest: ${OUTPUT_PATH}`);
  await fs.writeFile(OUTPUT_PATH, content, 'utf8');
  
  const stats = await fs.stat(OUTPUT_PATH);
  
  console.log(`\n✅ Daily digest generated successfully!`);
  console.log(`   📁 File: ${OUTPUT_PATH}`);
  console.log(`   📊 Size: ${stats.size} bytes (${Math.round(stats.size / 1024 * 10) / 10} KB)`);
  console.log(`   📝 Tasks: ${completed.length} completed, ${pending.length} pending`);
  console.log(`   🔄 Git: ${gitActivity ? gitActivity.totalCommits : 0} commits`);
  console.log(`\n🟡 Status: Draft generated - manual enrichment recommended`);
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
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
