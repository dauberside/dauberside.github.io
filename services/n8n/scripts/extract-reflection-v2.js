// ============================================================================
// Recipe 13: Improved Reflection Extraction Logic
// Issue #68: https://github.com/dauberside/dauberside.github.io/issues/68
// ============================================================================

/**
 * Extract reflection from digest with fallback options
 *
 * @param {string} text - Daily Digest content
 * @returns {string} Reflection summary
 */
function extractReflection(text) {
  // Option 1: Extract from ## Reflection section
  const reflectionMatch = text.match(/## Reflection\s*\n([\s\S]*?)(?=\n##|$)/);
  if (reflectionMatch && reflectionMatch[1].trim()) {
    const lines = reflectionMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('- ') && l.trim().length > 2)
      .map(l => l.trim().replace(/^- /, ''));

    if (lines.length > 0) {
      return lines.slice(0, 2).join('、');
    }
  }

  // Option 2: Extract from Yesterday's Summary section
  const yesterdayMatch = text.match(/\*\*Reflection\*\*:\s*(.+)/);
  if (yesterdayMatch && yesterdayMatch[1].trim()) {
    return yesterdayMatch[1].trim();
  }

  // Option 3: Fallback - Generate summary from date
  const dateMatch = text.match(/# Daily Digest — (\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '今日';

  return `${date} の作業完了`;
}

// ============================================================================
// Full Code Node for n8n (Copy this to "Build tomorrow.json" node)
// ============================================================================

const digestData = $items("Get Today's Digest")[0]?.json?.stdout || $items("Get Today's Digest")[0]?.json?.data || '';
const todoData = $items("Get TODO.md")[0]?.json?.stdout || $items("Get TODO.md")[0]?.json?.data || '';
const date = $items("Calculate File Paths")[0]?.json?.date || new Date().toISOString().split('T')[0];

// Extract tasks from digest
function extractTasks(text) {
  const completed = [];
  const pending = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- [x]')) {
      completed.push(trimmed.replace('- [x] ', ''));
    } else if (trimmed.startsWith('- [ ]')) {
      pending.push(trimmed.replace('- [ ] ', ''));
    }
  }

  return { completed, pending };
}

// Extract reflection from digest (IMPROVED VERSION)
function extractReflection(text) {
  // Option 1: Extract from ## Reflection section
  const reflectionMatch = text.match(/## Reflection\s*\n([\s\S]*?)(?=\n##|$)/);
  if (reflectionMatch && reflectionMatch[1].trim()) {
    const lines = reflectionMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('- ') && l.trim().length > 2)
      .map(l => l.trim().replace(/^- /, ''));

    if (lines.length > 0) {
      return lines.slice(0, 2).join('、');
    }
  }

  // Option 2: Extract from Yesterday's Summary section
  const yesterdayMatch = text.match(/\*\*Reflection\*\*:\s*(.+)/);
  if (yesterdayMatch && yesterdayMatch[1].trim()) {
    return yesterdayMatch[1].trim();
  }

  // Option 3: Fallback - Generate summary from date
  const dateMatch = text.match(/# Daily Digest — (\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '今日';

  return `${date} の作業完了`;
}

// Extract tomorrow section from TODO.md
function extractTomorrowTasks(todoText, todayDate) {
  const lines = todoText.split('\n');
  const tasks = [];
  let inTomorrowSection = false;

  // Calculate tomorrow's date
  const today = new Date(todayDate);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  for (const line of lines) {
    if (line.includes(`## ${tomorrowStr}`)) {
      inTomorrowSection = true;
      continue;
    }
    if (inTomorrowSection && line.startsWith('## ')) {
      break;
    }
    if (inTomorrowSection && line.trim().startsWith('- [ ]')) {
      tasks.push(line.trim().replace('- [ ] ', ''));
    }
  }

  return tasks;
}

const digestTasks = extractTasks(digestData);
const reflection = extractReflection(digestData);
const tomorrowTasks = extractTomorrowTasks(todoData, date);

// Build carryover (pending tasks from today)
const carryover = digestTasks.pending.slice(0, 3);

// Build tomorrow candidates
// Priority: carryover first, then tomorrow section tasks
const candidates = [...new Set([...carryover, ...tomorrowTasks])].slice(0, 3);

// If we have less than 3, add generic suggestions
while (candidates.length < 3) {
  const suggestions = [
    'v1.2 Roadmap 確認',
    'Recipe 動作確認',
    'ドキュメント整理'
  ];
  for (const s of suggestions) {
    if (!candidates.includes(s) && candidates.length < 3) {
      candidates.push(s);
    }
  }
}

const total = digestTasks.completed.length + digestTasks.pending.length;
const rate = total === 0 ? 0 : Math.round((digestTasks.completed.length / total) * 100);

// Build tomorrow.json
const tomorrowJson = {
  generated_at: new Date().toISOString(),
  source_date: date,
  tomorrow_candidates: candidates,
  carryover_tasks: carryover,
  reflection_summary: reflection  // Now with improved extraction!
};

return {
  json: {
    date,
    tomorrowJson,
    tomorrowJsonString: JSON.stringify(tomorrowJson, null, 2),
    stats: {
      completed: digestTasks.completed.length,
      pending: digestTasks.pending.length,
      rate
    }
  }
};
