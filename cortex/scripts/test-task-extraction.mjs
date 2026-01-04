#!/usr/bin/env node
/**
 * Test Task Extraction Logic
 *
 * Tests that Archive section tasks are NOT extracted
 */

const testTodoContent = `## Today — 2025-12-24

### High Priority
- [ ] Task A from Today #urgent

### Regular Tasks
- [ ] Task B from Today

---

## Archive

### 2025-12-23

**実績**:
- [x] Task C from 12-23 (archived)
- [x] Task D from 12-23 (archived)

### 2025-12-22

**実績**:
- [x] v1.2 Roadmap 確認
- [x] Recipe 動作確認
- [x] ドキュメント整理
`;

function extractTasks(todoContent, targetDate) {
  const lines = todoContent.split('\n');

  const highPriority = [];
  const regular = [];
  const noTag = [];
  const debug = [];

  let inTargetSection = false;
  let currentSectionDate = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect date-based sections
    const todayMatch = trimmed.match(/^##\s+Today\s+—\s+(\d{4}-\d{2}-\d{2})/i);
    const tomorrowMatch = trimmed.match(/^##\s+Tomorrow\s+—\s+(\d{4}-\d{2}-\d{2})/i);
    const archiveMatch = trimmed.match(/^##\s+Archive/i);

    if (todayMatch) {
      currentSectionDate = todayMatch[1];
      inTargetSection = (currentSectionDate === targetDate);
      debug.push(`[Today Section] Date: ${currentSectionDate}, Target: ${targetDate}, inTargetSection: ${inTargetSection}`);
      continue;
    }

    if (tomorrowMatch) {
      currentSectionDate = tomorrowMatch[1];
      inTargetSection = (currentSectionDate === targetDate);
      debug.push(`[Tomorrow Section] Date: ${currentSectionDate}, Target: ${targetDate}, inTargetSection: ${inTargetSection}`);
      continue;
    }

    if (archiveMatch) {
      debug.push(`[Archive Section] Entering Archive - STOP extraction`);
      inTargetSection = false;
      continue;
    }

    // Stop at next ## section (level 2 only, not ### subsections)
    if (trimmed.match(/^##\s+[^#]/) && !todayMatch && !tomorrowMatch && !archiveMatch) {
      debug.push(`[Other Section] ${trimmed} - STOP extraction`);
      inTargetSection = false;
      continue;
    }

    // Extract tasks from target date section
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      if (inTargetSection) {
        debug.push(`[✅ EXTRACTED] ${trimmed}`);

        const hasUrgent = trimmed.includes('#urgent') || trimmed.includes('#deepwork');
        const hasBlocked = trimmed.includes('#blocked') || trimmed.includes('#waiting');
        const hasReview = trimmed.includes('#review');
        const hasTag = trimmed.includes('#');

        let taskText = trimmed.replace(/<!--.*?-->/g, '').trim();

        if (hasUrgent || hasBlocked) {
          highPriority.push(taskText);
        } else if (hasReview || hasTag) {
          regular.push(taskText);
        } else {
          noTag.push(taskText);
        }
      } else {
        debug.push(`[❌ SKIPPED] ${trimmed} (inTargetSection: false)`);
      }
    }
  }

  return { highPriority, regular, noTag, debug };
}

// Test 1: Extract from Today section (2025-12-24)
console.log('\n========== Test 1: Extract from Today — 2025-12-24 ==========\n');
const result1 = extractTasks(testTodoContent, '2025-12-24');
console.log('Debug Log:');
result1.debug.forEach(log => console.log(`  ${log}`));
console.log('\nExtracted Tasks:');
console.log('  High Priority:', result1.highPriority);
console.log('  Regular:', result1.regular);
console.log('  No Tags:', result1.noTag);

// Test 2: Try to extract from Archive (should get nothing)
console.log('\n========== Test 2: Extract from Archive — 2025-12-22 ==========\n');
const result2 = extractTasks(testTodoContent, '2025-12-22');
console.log('Debug Log:');
result2.debug.forEach(log => console.log(`  ${log}`));
console.log('\nExtracted Tasks:');
console.log('  High Priority:', result2.highPriority);
console.log('  Regular:', result2.regular);
console.log('  No Tags:', result2.noTag);

// Test 3: Non-existent date
console.log('\n========== Test 3: Non-existent date — 2025-12-25 ==========\n');
const result3 = extractTasks(testTodoContent, '2025-12-25');
console.log('Debug Log:');
result3.debug.forEach(log => console.log(`  ${log}`));
console.log('\nExtracted Tasks:');
console.log('  High Priority:', result3.highPriority);
console.log('  Regular:', result3.regular);
console.log('  No Tags:', result3.noTag);

console.log('\n========== Summary ==========\n');
console.log('✅ Test 1 (Today 2025-12-24): Should extract 2 tasks');
console.log(`   Result: ${result1.highPriority.length + result1.regular.length + result1.noTag.length} tasks`);
console.log('✅ Test 2 (Archive 2025-12-22): Should extract 0 tasks');
console.log(`   Result: ${result2.highPriority.length + result2.regular.length + result2.noTag.length} tasks`);
console.log('✅ Test 3 (Non-existent 2025-12-25): Should extract 0 tasks');
console.log(`   Result: ${result3.highPriority.length + result3.regular.length + result3.noTag.length} tasks`);

const test1Pass = (result1.highPriority.length + result1.regular.length + result1.noTag.length) === 2;
const test2Pass = (result2.highPriority.length + result2.regular.length + result2.noTag.length) === 0;
const test3Pass = (result3.highPriority.length + result3.regular.length + result3.noTag.length) === 0;

if (test1Pass && test2Pass && test3Pass) {
  console.log('\n🎉 ALL TESTS PASSED! Archive section is correctly ignored.');
  process.exit(0);
} else {
  console.log('\n❌ TESTS FAILED!');
  process.exit(1);
}
