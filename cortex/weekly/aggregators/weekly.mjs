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
const STATE_DIR = path.join(ROOT, 'cortex/state');

// OpenAI API key (optional, graceful degradation if missing)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

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
 * Load task entries for a specific week
 * @param {string} weekId - Week ID (e.g., "2026-W01")
 * @returns {Array<Object>} Task entries with date and tasks
 */
function loadTaskEntriesForWeek(weekId) {
  if (!fs.existsSync(STATE_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(STATE_DIR)
    .filter(f => f.startsWith('task-entry-') && f.endsWith('.json'))
    .sort();

  const entries = [];

  for (const file of files) {
    const dateMatch = file.match(/task-entry-(\d{4}-\d{2}-\d{2})\.json/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const fileWeekId = getWeekIdForDate(date);

    if (fileWeekId === weekId) {
      try {
        const fullPath = path.join(STATE_DIR, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const data = JSON.parse(content);
        entries.push({
          date,
          tasks: data.tasks || [],
          completed: data.completed || [],
        });
      } catch (err) {
        console.warn(`⚠️  Failed to load ${file}:`, err.message);
      }
    }
  }

  return entries;
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
 * Analyze category distribution from task entries
 * @param {Array<Object>} taskEntries - Task entries for the week
 * @returns {Object} Category distribution and insights
 */
function analyzeCategoryDistribution(taskEntries) {
  const categoryCount = {};
  let totalTasks = 0;

  for (const entry of taskEntries) {
    const allTasks = [...(entry.tasks || []), ...(entry.completed || [])];
    for (const task of allTasks) {
      const category = task.category || 'uncategorized';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      totalTasks++;
    }
  }

  // Sort by count descending
  const distribution = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
    }));

  return {
    distribution,
    totalTasks,
    topCategory: distribution[0] || null,
  };
}

/**
 * Calculate completion rate trends
 * @param {Array<Object>} taskEntries - Task entries for the week
 * @returns {Object} Completion trends
 */
function analyzeCompletionTrends(taskEntries) {
  const dailyStats = taskEntries.map(entry => {
    const planned = (entry.tasks || []).length;
    const completed = (entry.completed || []).length;
    const rate = planned > 0 ? Math.round((completed / planned) * 100) : 100;

    return {
      date: entry.date,
      planned,
      completed,
      rate,
    };
  });

  const avgRate = dailyStats.length > 0
    ? Math.round(dailyStats.reduce((sum, s) => sum + s.rate, 0) / dailyStats.length)
    : 0;

  return {
    dailyStats,
    averageCompletionRate: avgRate,
  };
}

/**
 * Generate AI-powered weekly insights (Phase 3 Intelligence)
 * @param {Object} analytics - Analytics data
 * @param {Array<Object>} digests - Daily digests
 * @returns {Promise<Object>} AI insights or null if unavailable
 */
async function generateAIInsights(analytics, digests) {
  if (!OPENAI_API_KEY) {
    console.log('ℹ️  OpenAI API key not found - skipping AI insights');
    return null;
  }

  try {
    const prompt = buildInsightsPrompt(analytics, digests);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a productivity coach analyzing weekly work patterns. Provide concise, actionable insights in Japanese.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️  OpenAI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    return {
      strengths: extractSection(content, 'よくできた点'),
      improvements: extractSection(content, '改善できる点'),
      recommendations: extractSection(content, '来週の推奨'),
    };
  } catch (err) {
    console.warn(`⚠️  Failed to generate AI insights:`, err.message);
    return null;
  }
}

/**
 * Build prompt for AI insights
 */
function buildInsightsPrompt(analytics, digests) {
  const { categoryDistribution, completionTrends } = analytics;

  const lines = [];
  lines.push('# 今週の活動データ');
  lines.push('');
  lines.push('## カテゴリ分布');
  for (const { category, count, percentage } of categoryDistribution.distribution.slice(0, 5)) {
    lines.push(`- ${category}: ${count}件 (${percentage}%)`);
  }
  lines.push('');
  lines.push(`## 平均完了率: ${completionTrends.averageCompletionRate}%`);
  lines.push('');
  lines.push('## 主な活動（日次サマリー抜粋）');
  for (const digest of digests.slice(0, 3)) {
    const summary = getBriefSummary(digest);
    if (summary) {
      lines.push(`- ${digest.date}: ${summary}`);
    }
  }
  lines.push('');
  lines.push('上記データをもとに、以下の3点を簡潔に分析してください：');
  lines.push('1. **よくできた点**: 今週の強みや成果');
  lines.push('2. **改善できる点**: ボトルネックや課題');
  lines.push('3. **来週の推奨**: 具体的なアクションアイテム');

  return lines.join('\n');
}

/**
 * Extract section from AI response
 */
function extractSection(content, keyword) {
  const lines = content.split('\n').filter(l => l.trim());
  const sectionLines = [];
  let capturing = false;

  for (const line of lines) {
    if (line.includes(keyword)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (line.match(/^(##|#+|\*\*[^*]+\*\*:|[0-9]\.|•)/)) {
        // Stop at next section
        if (!line.includes(keyword)) {
          break;
        }
      }
      if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
        sectionLines.push(line.trim().replace(/^[-•]\s*/, ''));
      }
    }
  }

  return sectionLines.slice(0, 3); // Top 3 items
}

/**
 * Generate weekly summary (Phase 3 enhanced)
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

  // Phase 3: Load task entries and analyze
  const taskEntries = loadTaskEntriesForWeek(weekId);
  const categoryDistribution = analyzeCategoryDistribution(taskEntries);
  const completionTrends = analyzeCompletionTrends(taskEntries);

  // Phase 3: AI insights (optional, graceful degradation)
  const aiInsights = await generateAIInsights(
    { categoryDistribution, completionTrends },
    sorted
  );

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
    // Phase 3: Intelligence data
    analytics: {
      categoryDistribution,
      completionTrends,
    },
    aiInsights,
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

  // Phase 3: Weekly Intelligence Analytics
  if (summary.analytics) {
    const { categoryDistribution, completionTrends } = summary.analytics;

    lines.push('---');
    lines.push('');
    lines.push('## 📊 Weekly Intelligence (Phase 3)');
    lines.push('');

    // Category Distribution
    if (categoryDistribution.distribution.length > 0) {
      lines.push('### カテゴリ分布');
      lines.push('');
      lines.push('| Category | Count | % |');
      lines.push('|----------|-------|---|');
      for (const { category, count, percentage } of categoryDistribution.distribution) {
        lines.push(`| ${category} | ${count} | ${percentage}% |`);
      }
      lines.push('');

      if (categoryDistribution.topCategory) {
        lines.push(`**Top Category**: \`${categoryDistribution.topCategory.category}\` (${categoryDistribution.topCategory.count}件)`);
        lines.push('');
      }
    }

    // Completion Trends
    if (completionTrends.dailyStats.length > 0) {
      lines.push('### 完了率推移');
      lines.push('');
      lines.push('| Date | Planned | Completed | Rate |');
      lines.push('|------|---------|-----------|------|');
      for (const { date, planned, completed, rate } of completionTrends.dailyStats) {
        lines.push(`| ${date} | ${planned} | ${completed} | ${rate}% |`);
      }
      lines.push('');
      lines.push(`**Average Completion Rate**: ${completionTrends.averageCompletionRate}%`);
      lines.push('');
    }
  }

  // Phase 3: AI Insights (if available)
  if (summary.aiInsights) {
    const { strengths, improvements, recommendations } = summary.aiInsights;

    lines.push('---');
    lines.push('');
    lines.push('## 🤖 AI分析');
    lines.push('');

    if (strengths && strengths.length > 0) {
      lines.push('### ✅ よくできた点');
      for (const item of strengths) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (improvements && improvements.length > 0) {
      lines.push('### ⚠️ 改善できる点');
      for (const item of improvements) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (recommendations && recommendations.length > 0) {
      lines.push('### 💡 来週の推奨アクション');
      for (const item of recommendations) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
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
