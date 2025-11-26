#!/usr/bin/env node
/**
 * weekly.mjs
 *
 * Weekly aggregator for Cortex OS v2.0
 * Automatically generates weekly summaries from daily digests
 *
 * Usage:
 *   node weekly.mjs                    # Generate for current week
 *   node weekly.mjs 2025-W48           # Generate for specific week
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root
const ROOT = path.resolve(__dirname, '../../..');
const DAILY_DIR = path.join(ROOT, 'cortex/daily');
const WEEKLY_DIR = path.join(ROOT, 'cortex/weekly');

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const weekId = args[0] || getCurrentWeekId();

  console.log(`📅 Generating weekly summary for ${weekId}...`);

  // Load daily digests for the week
  const digests = loadDailyDigestsForWeek(weekId);

  if (digests.length === 0) {
    console.log(`⚠️  No daily digests found for ${weekId}`);
    return;
  }

  console.log(`📝 Found ${digests.length} daily digests`);

  // Generate summary
  const summary = await generateWeeklySummary(weekId, digests);

  // Render markdown
  const markdown = renderWeeklySummary(summary);

  // Write to file
  const outputPath = path.join(WEEKLY_DIR, `${weekId}-summary.md`);
  fs.writeFileSync(outputPath, markdown, 'utf8');

  console.log(`✅ Weekly summary generated: ${outputPath}`);
  console.log(`   - ${summary.dailyCount} days`);
  console.log(`   - ${summary.highlights.length} highlights`);
  console.log(`   - ${summary.tasksCompleted.length} tasks completed`);
}

/**
 * Get current week ID (ISO week format: YYYY-Www)
 */
function getCurrentWeekId() {
  const now = new Date();
  const year = now.getFullYear();
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Get ISO week number
 */
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Load daily digests for a specific week
 */
function loadDailyDigestsForWeek(weekId) {
  if (!fs.existsSync(DAILY_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(DAILY_DIR)
    .filter(f => f.endsWith('-digest.md'))
    .sort();

  const digests = [];

  for (const file of files) {
    const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const fileWeekId = getWeekIdForDate(date);

    if (fileWeekId === weekId) {
      const fullPath = path.join(DAILY_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const digest = parseDailyDigest(file, content);
      digests.push(digest);
    }
  }

  return digests;
}

/**
 * Get week ID for a specific date
 */
function getWeekIdForDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Parse daily digest markdown
 */
function parseDailyDigest(filename, content) {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : 'unknown';

  const sections = extractSections(content);
  const wordCount = content.split(/\s+/).length;
  const sectionCount = Object.keys(sections).filter(k => sections[k]).length;

  return {
    date,
    filename,
    raw: content,
    sections,
    metadata: {
      hasContent: wordCount > 50,
      wordCount,
      sectionCount,
    },
  };
}

/**
 * Extract sections from markdown
 */
function extractSections(content) {
  const sections = {};

  const patterns = {
    todaysPlan: /## Today's Plan\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    tasks: /## Tasks\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    highlights: /## Highlights\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    reflection: /## Reflection\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    notes: /## Notes\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern);
    if (match && match[1]) {
      sections[key] = match[1].trim();
    }
  }

  return sections;
}

/**
 * Generate weekly summary
 */
async function generateWeeklySummary(weekId, digests) {
  const sorted = digests.sort((a, b) => a.date.localeCompare(b.date));

  const allHighlights = sorted.flatMap(d => extractBulletPoints(d.sections.highlights || ''));
  const allInsights = sorted.flatMap(d => extractBulletPoints(d.sections.reflection || ''));
  const allTasks = sorted.flatMap(d => extractCompletedTasks(d.sections.tasks || ''));

  // Simple overview
  const overview = `${sorted.length}日分の活動を集約。完了タスク ${allTasks.length}件。`;

  // Top highlights
  const highlights = allHighlights.slice(0, 7);

  // Top insights
  const keyInsights = allInsights.slice(0, 5);

  // Detect themes
  const themes = detectThemes(sorted);

  // Daily logs
  const dailyLogs = sorted.map(d => ({
    date: d.date,
    summary: getBriefSummary(d),
  }));

  return {
    weekId,
    dateRange: {
      start: sorted[0]?.date || 'unknown',
      end: sorted[sorted.length - 1]?.date || 'unknown',
    },
    generatedAt: new Date().toISOString(),
    dailyCount: sorted.length,
    overview,
    highlights,
    keyInsights,
    tasksCompleted: allTasks,
    themes,
    dailyLogs,
  };
}

/**
 * Render weekly summary as markdown
 */
function renderWeeklySummary(summary) {
  const lines = [];

  lines.push(`# Weekly Summary — ${summary.weekId}`);
  lines.push('');

  lines.push('## Overview');
  lines.push(`- 📅 日付範囲: ${summary.dateRange.start} → ${summary.dateRange.end}`);
  lines.push(`- 🕐 生成日時: ${summary.generatedAt}`);
  lines.push(`- 📝 Daily count: ${summary.dailyCount} files`);
  lines.push('');
  lines.push(summary.overview);
  lines.push('');

  if (summary.highlights.length > 0) {
    lines.push('## ✨ Highlights');
    for (const highlight of summary.highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push('');
  }

  if (summary.keyInsights.length > 0) {
    lines.push('## 💡 Key Insights');
    for (const insight of summary.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  if (summary.tasksCompleted.length > 0) {
    lines.push('## ✅ Tasks Completed');
    for (const task of summary.tasksCompleted) {
      lines.push(`- ${task}`);
    }
    lines.push('');
  }

  if (summary.themes.length > 0) {
    lines.push('## 🏷️ Recurring Themes');
    lines.push(summary.themes.map(t => `\`${t}\``).join(', '));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## 📚 Daily Logs');
  lines.push('');
  for (const log of summary.dailyLogs) {
    lines.push(`### ${log.date}`);
    lines.push(log.summary);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Generated by**: Cortex OS v2.0 Auto-Aggregation Layer');
  lines.push(`**Timestamp**: ${summary.generatedAt}`);
  lines.push('');

  return lines.join('\n');
}

// Helper functions

function extractBulletPoints(text) {
  return text
    .split('\n')
    .filter(line => line.match(/^[-*]\s/))
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line.length > 5);
}

function extractCompletedTasks(text) {
  return text
    .split('\n')
    .filter(line => line.match(/✅|✔|\[x\]/i))
    .map(line =>
      line
        .replace(/✅|✔|\[x\]/gi, '')
        .replace(/^[-*]\s*/, '')
        .trim()
    )
    .filter(line => line.length > 5);
}

function getBriefSummary(digest) {
  const highlights = digest.sections.highlights || digest.sections.todaysPlan || '';
  const words = highlights.split(/\s+/).slice(0, 40);
  return words.join(' ') + (words.length === 40 ? '...' : '');
}

function detectThemes(digests) {
  const words = {};

  for (const digest of digests) {
    const content = [
      digest.sections.highlights,
      digest.sections.reflection,
      digest.sections.todaysPlan,
    ]
      .filter(Boolean)
      .join(' ');

    const tokens = content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4 && !isStopWord(w));

    for (const token of tokens) {
      words[token] = (words[token] || 0) + 1;
    }
  }

  return Object.entries(words)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

function isStopWord(word) {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'from',
    'have',
    'した',
    'する',
    'ある',
    'です',
    'ます',
    'られ',
    'から',
    'への',
  ]);
  return stopWords.has(word);
}

// Run main
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
