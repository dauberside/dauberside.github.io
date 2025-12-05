#!/usr/bin/env node
/**
 * Task Entry Extraction Script
 * 
 * Purpose: Extract task completion data from multiple sources for v1.3 analytics
 * Sources: 
 *   - cortex/state/brief-{date}.json (daily completed tasks)
 *   - cortex/state/tomorrow.json (tomorrow candidates)
 *   - cortex/daily/{date}-digest.md (contextual metadata)
 * 
 * Output: cortex/state/task-entries.json
 * Format: Array of { date, task, status, duration, priority, tags, context }
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORTEX_ROOT = path.resolve(__dirname, '..');

const PATHS = {
  state: path.join(CORTEX_ROOT, 'state'),
  daily: path.join(CORTEX_ROOT, 'daily'),
  output: path.join(CORTEX_ROOT, 'state', 'task-entries.json'),
};

/**
 * Extract tasks from brief-{date}.json files
 */
async function extractFromBriefFiles(daysBack = 30) {
  const entries = [];
  const today = new Date();
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const briefPath = path.join(PATHS.state, `brief-${dateStr}.json`);
    
    try {
      const content = await fs.readFile(briefPath, 'utf8');
      const brief = JSON.parse(content);
      
      if (brief.tasks && Array.isArray(brief.tasks)) {
        for (const task of brief.tasks) {
          const taskText = typeof task === 'string' 
            ? task 
            : (task.title || task.text || task.task || JSON.stringify(task));
          
          entries.push({
            date: dateStr,
            task: taskText,
            status: (task.status === 'completed' || task.completed) ? 'completed' : 'pending',
            priority: task.priority || 'regular',
            phase: task.phase || null,
            time: task.time || null,
            tags: task.tags || [],
            source: 'brief',
            timestamp: brief.generated_at || brief.generated || date.toISOString(),
          });
        }
      }
    } catch (error) {
      // File doesn't exist or parse error - skip silently
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Could not process ${briefPath}: ${error.message}`);
      }
    }
  }
  
  return entries;
}

/**
 * Extract tomorrow candidates
 */
async function extractTomorrowCandidates() {
  const tomorrowPath = path.join(PATHS.state, 'tomorrow.json');
  
  try {
    const content = await fs.readFile(tomorrowPath, 'utf8');
    const data = JSON.parse(content);
    
    if (data.tomorrow_candidates && Array.isArray(data.tomorrow_candidates)) {
      return data.tomorrow_candidates.map(task => ({
        date: new Date().toISOString().split('T')[0],
        task: task.text || task,
        status: 'candidate',
        priority: task.priority || 'regular',
        tags: task.tags || [],
        source: 'tomorrow',
        timestamp: data.generated || new Date().toISOString(),
      }));
    }
  } catch (error) {
    console.warn(`Warning: Could not process tomorrow.json: ${error.message}`);
  }
  
  return [];
}

/**
 * Enrich entries with context from daily digests
 */
async function enrichWithDigestContext(entries) {
  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
  
  // For each date, try to load digest metadata
  for (const [date, dateEntries] of Object.entries(entriesByDate)) {
    const digestPath = path.join(PATHS.daily, `${date}-digest.md`);
    
    try {
      const content = await fs.readFile(digestPath, 'utf8');
      
      // Extract day of week from digest metadata or filename
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      
      // Add context to all entries for this date
      dateEntries.forEach(entry => {
        entry.dayOfWeek = dayOfWeek;
        entry.hasDigest = true;
      });
    } catch (error) {
      // No digest found - mark accordingly
      dateEntries.forEach(entry => {
        entry.dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
        entry.hasDigest = false;
      });
    }
  }
  
  return entries;
}

/**
 * Main extraction logic
 */
async function extractTaskEntries() {
  console.log('🔍 Extracting task entries...');
  
  // Step 1: Extract from brief files
  console.log('  📄 Reading brief files (last 30 days)...');
  const briefEntries = await extractFromBriefFiles(30);
  console.log(`  ✅ Found ${briefEntries.length} task entries`);
  
  // Step 2: Extract tomorrow candidates
  console.log('  📋 Reading tomorrow candidates...');
  const tomorrowEntries = await extractTomorrowCandidates();
  console.log(`  ✅ Found ${tomorrowEntries.length} tomorrow candidates`);
  
  // Step 3: Combine and enrich
  let allEntries = [...briefEntries, ...tomorrowEntries];
  console.log('  🔗 Enriching with digest context...');
  allEntries = await enrichWithDigestContext(allEntries);
  
  // Step 4: Sort by date (newest first)
  allEntries.sort((a, b) => b.date.localeCompare(a.date));
  
  // Step 5: Write output
  const output = {
    generated: new Date().toISOString(),
    totalEntries: allEntries.length,
    dateRange: {
      start: allEntries[allEntries.length - 1]?.date || null,
      end: allEntries[0]?.date || null,
    },
    entries: allEntries,
  };
  
  await fs.writeFile(PATHS.output, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✅ Task entries extracted to: ${PATHS.output}`);
  console.log(`   Total: ${allEntries.length} entries`);
  console.log(`   Range: ${output.dateRange.start} → ${output.dateRange.end}`);
  
  return output;
}

// Run if executed directly
extractTaskEntries()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Extraction failed:', error);
    process.exit(1);
  });

export { extractTaskEntries };
