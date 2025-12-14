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
const args = process.argv.slice(2);
const dashboardOnly = args.includes('--dashboard');
const targetDate = dashboardOnly ? null : (args.find(a => !a.startsWith('--')) || getTodayInJST());

// Debug: Ensure targetDate is valid (skip if dashboard-only mode)
if (!dashboardOnly && (!targetDate || targetDate === 'undefined' || !targetDate.match(/^\d{4}-\d{2}-\d{2}$/))) {
  console.error(`❌ Invalid target date: "${targetDate}"`);
  console.error(`   Expected format: YYYY-MM-DD`);
  console.error(`   Falling back to date calculation...`);

  // Emergency fallback: manual calculation
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  const fallbackDate = `${y}-${m}-${d}`;

  console.error(`   Using fallback date: ${fallbackDate}`);
  process.exit(1); // Exit to prevent bad file generation
}

const TEMPLATE_PATH = path.join(ROOT, 'cortex/templates/daily-digest-template.md');
// TODO.md is now in Obsidian vault (see ADR-0013)
const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || path.join(ROOT, '../obsidian-vault');
const TODO_PATH = path.join(OBSIDIAN_VAULT_PATH, 'TODO.md');
const TOMORROW_JSON_PATH = path.join(ROOT, 'cortex/state/tomorrow.json');
const OUTPUT_DIR = path.join(ROOT, 'cortex/daily');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `${targetDate}-digest.md`);
const CATEGORY_HEATMAP_PATH = path.join(ROOT, 'cortex/state/category_heatmap.json');
const CATEGORY_DASHBOARD_PATH = path.join(ROOT, 'cortex/state/category-dashboard.md');

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
 * Get today's date in JST
 * This is the default behavior for digest generation (journal for today)
 */
function getTodayInJST() {
  try {
    const now = new Date();

    // Validate that 'now' is a valid date
    if (isNaN(now.getTime())) {
      throw new Error('Invalid current date');
    }

    const result = formatDate(now);

    // Validate result
    if (!result || !result.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`Invalid date format: ${result}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error calculating today date:', error.message);
    console.error('   This may be due to timezone/Intl API issues');

    // Emergency fallback: manual calculation (UTC-based)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Load tomorrow.json if it exists
 */
async function loadTomorrowJson() {
  try {
    const content = await fs.readFile(TOMORROW_JSON_PATH, 'utf8');
    const data = JSON.parse(content);
    console.log(`📖 Reading tomorrow.json: ${TOMORROW_JSON_PATH}`);
    console.log(`   ✓ Candidates: ${data.tomorrow_candidates?.length || 0}`);
    console.log(`   ✓ Carryover: ${data.carryover_tasks?.length || 0}`);
    return data;
  } catch (error) {
    console.log(`ℹ️  tomorrow.json not found, using TODO.md only`);
    return null;
  }
}

/**
 * Fetch TODO.md from Obsidian via REST API
 */
async function fetchTODOFromObsidian() {
  try {
    const { default: https } = await import('node:https');

    const options = {
      hostname: process.env.MCP_OBSIDIAN_HOST || '127.0.0.1',
      port: parseInt(process.env.MCP_OBSIDIAN_PORT || '27124'),
      path: '/vault/TODO.md',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MCP_OBSIDIAN_API_KEY}`,
        'Accept': 'text/markdown'
      },
      rejectUnauthorized: false  // Allow self-signed cert
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('📖 Reading TODO.md from Obsidian vault (via REST API)');
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  } catch (error) {
    // Fallback to file system if API fails
    console.log(`ℹ️  Obsidian API failed, trying file system: ${TODO_PATH}`);
    return await fs.readFile(TODO_PATH, 'utf8');
  }
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
 * Estimate category for a task (keyword-based, safe + explainable)
 */
function estimateCategory(task) {
  const rules = [
    { cat: 'ops', re: /運用|防御|incident|on[- ]?call|alert|pager|slack/i },
    { cat: 'n8n', re: /\bn8n\b|recipe|workflow|verification node|error workflow/i },
    { cat: 'cortex', re: /\bcortex\b|llm|digest|tomorrow\.json|daily/i },
    { cat: 'docs', re: /docs?|ドキュメント|readme|spec|設計/i },
    { cat: 'github', re: /github|\bpr\b|pull request|merge/i },
    { cat: 'infra', re: /deploy|production|staging|docker|k8s|server|infra/i },
  ];

  for (const r of rules) {
    if (r.re.test(task)) return r.cat;
  }
  return 'other';
}

function normalizeTaskText(line) {
  return String(line || '')
    .replace(/^-\s*\[\s\]\s*/i, '')
    .replace(/<!--.*?-->/g, '')
    .trim();
}

/**
 * Update cortex/state/category_heatmap.json
 * - Does NOT fail digest generation if heatmap update fails
 */
async function updateCategoryHeatmap(date, taskLines) {
  const tasks = (taskLines || []).map(normalizeTaskText).filter(Boolean);

  const counts = {};
  for (const t of tasks) {
    const cat = estimateCategory(t);
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || 'none';

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(CATEGORY_HEATMAP_PATH), { recursive: true });

    let data = {};
    try {
      const existing = await fs.readFile(CATEGORY_HEATMAP_PATH, 'utf8');
      data = JSON.parse(existing);
    } catch {
      data = {};
    }

    // Overwrite per-day counts to avoid double counting on retries/re-runs
    data[date] = counts;

    await fs.writeFile(CATEGORY_HEATMAP_PATH, JSON.stringify(data, null, 2), 'utf8');

    console.log(`📊 Category heatmap updated: ${CATEGORY_HEATMAP_PATH}`);
    console.log(`   Date: ${date}`);
    console.log(`   Summary: ${summary}`);
  } catch (error) {
    console.log('⚠️  Category heatmap update failed (non-fatal):', error.message);
  }

  return { counts, summary };
}

// ===== Dashboard Generation Functions =====

function toISO(ts = new Date()) {
  return new Date(ts).toISOString();
}

function sortDatesAsc(dates) {
  return [...dates].sort((a, b) => a.localeCompare(b));
}

function sumCounts(listOfCounts) {
  const out = {};
  for (const c of listOfCounts) {
    for (const [k, v] of Object.entries(c || {})) {
      out[k] = (out[k] || 0) + (v || 0);
    }
  }
  return out;
}

function formatCountsInline(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  if (entries.length === 0) return 'none';
  return entries.map(([k, v]) => `${k}:${v}`).join(', ');
}

function pickRecentDates(allDatesAsc, n) {
  if (!allDatesAsc || allDatesAsc.length === 0) return [];
  return allDatesAsc.slice(Math.max(0, allDatesAsc.length - n));
}

/**
 * Write a simple Markdown dashboard from category_heatmap.json
 * - Non-fatal: dashboard generation should never break digest generation
 */
async function writeCategoryDashboard() {
  try {
    let heatmap = {};
    try {
      heatmap = JSON.parse(await fs.readFile(CATEGORY_HEATMAP_PATH, 'utf8'));
    } catch {
      heatmap = {};
    }

    const datesAsc = sortDatesAsc(Object.keys(heatmap));
    const latest = datesAsc[datesAsc.length - 1];

    const last7Dates = pickRecentDates(datesAsc, 7);
    const last30Dates = pickRecentDates(datesAsc, 30);

    const last7 = sumCounts(last7Dates.map(d => heatmap[d] || {}));
    const last30 = sumCounts(last30Dates.map(d => heatmap[d] || {}));

    // Collect all categories seen
    const categorySet = new Set();
    for (const d of datesAsc) {
      for (const k of Object.keys(heatmap[d] || {})) categorySet.add(k);
    }
    const categories = [...categorySet].sort();

    const recent14 = pickRecentDates(datesAsc, 14);

    const header = `# Category Analytics Dashboard\n\n` +
      `Last updated: ${toISO()}\n\n` +
      `- Latest date: ${latest || 'n/a'}\n` +
      `- Total days tracked: ${datesAsc.length}\n\n`;

    const summary = `## Rolling totals\n\n` +
      `- Last 7 days: ${formatCountsInline(last7)}\n` +
      `- Last 30 days: ${formatCountsInline(last30)}\n\n`;

    const tableHeader = ['Date', ...categories].join(' | ');
    const tableSep = ['---', ...categories.map(() => '---')].join(' | ');
    const tableRows = recent14.map(d => {
      const row = [d, ...categories.map(c => String((heatmap[d] && heatmap[d][c]) ? heatmap[d][c] : 0))];
      return row.join(' | ');
    }).join('\n');

    const recent = `## Recent (last ${recent14.length} days)\n\n` +
      `${tableHeader}\n` +
      `${tableSep}\n` +
      `${tableRows || ''}\n\n`;

    const content = header + summary + recent;

    await fs.mkdir(path.dirname(CATEGORY_DASHBOARD_PATH), { recursive: true });
    await fs.writeFile(CATEGORY_DASHBOARD_PATH, content, 'utf8');

    console.log(`📈 Category dashboard written: ${CATEGORY_DASHBOARD_PATH}`);
  } catch (error) {
    console.log('⚠️  Category dashboard generation failed (non-fatal):', error.message);
  }
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

  if (!content.includes("## 今日のフォーカス") || content.includes('{{DATE}}')) {
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

  // 2. Load tomorrow.json (if exists)
  const tomorrowData = await loadTomorrowJson();

  // 3. Read TODO.md from Obsidian vault
  const todoContent = await fetchTODOFromObsidian();

  // 4. Extract tasks
  console.log('🔄 Extracting tasks...');
  const { highPriority, regular, noTag } = extractTasks(todoContent);

  // 5. Merge with tomorrow.json candidates
  let finalHighPriority = [...highPriority];
  let finalRegular = [...regular];

  if (tomorrowData && tomorrowData.tomorrow_candidates) {
    console.log('🔀 Merging tomorrow.json candidates...');
    const candidates = tomorrowData.tomorrow_candidates.map(task => `- [ ] ${task}`);
    finalHighPriority = [...candidates, ...highPriority];
    console.log(`   ✓ Added ${candidates.length} candidates from tomorrow.json`);
  }

  console.log(`   ✓ High Priority: ${finalHighPriority.length} tasks`);
  console.log(`   ✓ Regular: ${finalRegular.length} tasks`);
  console.log(`   ✓ No Tags: ${noTag.length} tasks\n`);

  // 6. Format task lists
  const formatTasks = (tasks) => {
    if (tasks.length === 0) return '（タスクなし）';
    return tasks.join('\n');
  };

  // 7. Replace template placeholders
  let content = template
    .replace(/\{\{DATE\}\}/g, targetDate)
    .replace(/\{\{HIGH_PRIORITY_TASKS\}\}/g, formatTasks(finalHighPriority))
    .replace(/\{\{REGULAR_TASKS\}\}/g, formatTasks(finalRegular))
    .replace(/\{\{NO_TAG_TASKS\}\}/g, formatTasks(noTag))
    .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());

  // Verify all placeholders were replaced
  const remainingPlaceholders = content.match(/\{\{[A-Z_]+\}\}/g);
  if (remainingPlaceholders) {
    throw new Error(`Unresolved placeholders found: ${remainingPlaceholders.join(', ')}`);
  }

  // 8. Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // 9. Write digest file
  console.log(`💾 Writing digest: ${OUTPUT_PATH}`);
  await fs.writeFile(OUTPUT_PATH, content, 'utf8');

  console.log(`✅ Daily digest generated successfully!`);
  console.log(`   File: ${OUTPUT_PATH}`);
  console.log(`   Size: ${content.length} bytes`);
  console.log(`   Tasks: ${finalHighPriority.length + finalRegular.length + noTag.length} total`);

  // Update category heatmap from all tasks (non-fatal)
  const allTaskLines = [...finalHighPriority, ...finalRegular, ...noTag];
  await updateCategoryHeatmap(targetDate, allTaskLines);

  // Update category dashboard (non-fatal)
  await writeCategoryDashboard();

  // Validate the generated file
  await validateOutput();
}

/**
 * Main execution
 */
async function main() {
  try {
    // Dashboard-only mode: just regenerate the dashboard
    if (dashboardOnly) {
      console.log('📊 Dashboard-only mode: Regenerating category dashboard...\n');
      await writeCategoryDashboard();
      console.log('\n✅ Dashboard generation complete!');
      return;
    }

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
