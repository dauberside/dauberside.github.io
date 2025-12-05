# Recipe 10 Merge Logic Fix

**Date**: 2025-12-02  
**Task**: P0 #urgent - TODO.md Auto-sync Merge ロジック修正  
**Status**: ✅ FIXED

---

## Problem

Recipe 10の「Merge Tasks into TODO」ノードの正規表現が、既存の`## Today`セクションを完全に削除できていなかった。

### Root Cause

```javascript
// 旧パターン（問題あり）
const updatedContent = todoContent.replace(
  /## Today — \d{4}-\d{2}-\d{2}[\s\S]*?(?=\n---|$)/,
  ''
).trim() + newSection;
```

**問題点**:
- `(?=\n---|$)` のlookaheadが最初の`---`の**前**で止まる
- TODO.mdの `## Today` セクションには複数のサブセクション（`### High Priority`, `### Regular Tasks`）があり、その後に `---` がある
- 結果: 古いタスクが残り、二重登録や混乱を引き起こす

---

## Solution

```javascript
// 新パターン（修正後）
const todayRegex = /^## Today — \d{4}-\d{2}-\d{2}\s*\n[\s\S]*?^---\s*$/m;

let updatedContent = todoContent.replace(todayRegex, '').trim();
updatedContent = newSection + '\n' + updatedContent;
```

**改善点**:
1. `^---\s*$/m` で `---` **自体を含めて**マッチ
2. マルチラインモード (`m`) で行頭・行末を正しく認識
3. `## Today` から `---` までを完全に削除
4. 新しいセクションをクリーンな状態で追加

---

## Additional Improvements

### Structured Section Output

```javascript
// Categorize tasks by urgency
const urgentTasks = newTasks.filter(t => t.includes('<!-- #urgent'));
const regularTasks = newTasks.filter(t => !t.includes('<!-- #urgent'));

// Build structured section
let newSection = `## Today — ${today}\n\n`;
newSection += '### High Priority\n';
if (urgentTasks.length > 0) {
  urgentTasks.forEach(task => { newSection += `${task}\n`; });
} else {
  newSection += '（タスクなし）\n';
}
newSection += '\n### Regular Tasks\n';
// ...
```

**メリット**:
- タスクなし時にも `### High Priority` / `### Regular Tasks` の構造を保持
- `#urgent` タグを持つタスクを自動的に High Priority に配置
- TODO.md の可読性が向上

---

## Testing

### Test Case 1: Replace existing "## Today" section

**Input TODO.md**:
```markdown
## Today — 2025-12-01

### High Priority
- [ ] Old urgent task

### Regular Tasks
- [ ] Old regular task

---

## 📋 システム情報
```

**New tasks from digest**:
```markdown
- [ ] [Cortex] ⚡ Recipe 10 修正  <!-- #urgent -->
- [ ] Cortex OS ヘルスチェック
```

**Expected Output**:
```markdown
## Today — 2025-12-02

### High Priority
- [ ] [Cortex] ⚡ Recipe 10 修正  <!-- #urgent -->

### Regular Tasks
- [ ] Cortex OS ヘルスチェック

---

## 📋 システム情報
```

**Result**: ✅ PASS (verified with `recipe-10-merge-test-v2.js`)

### Test Case 2: No double `---`

**Assertion**: Final content should NOT contain `---\n\n---`

**Result**: ✅ PASS

---

## Deployment

1. ✅ Backup created: `backups/2025-12-02/recipe-10-todo-autosync-pre-merge-fix.json.backup`
2. ✅ Workflow updated: `recipe-10-todo-autosync.json`
3. ⏳ Import to n8n UI (next step)
4. ⏳ Manual test execution
5. ⏳ Enable cron trigger (08:05 JST daily)

---

## Next Steps

1. Import updated workflow to n8n:
   - Open n8n UI: http://localhost:5678
   - Workflows → Import from File → `recipe-10-todo-autosync.json`
   - Or: Replace in UI directly via copy-paste

2. Test execution:
   - Manual trigger with test digest
   - Verify TODO.md update via Obsidian REST API
   - Check Slack notification

3. Monitor for 3 days:
   - Daily execution at 08:05 JST
   - Verify no duplicate tasks
   - Verify proper section replacement

---

## Files Modified

- `services/n8n/workflows/recipe-10-todo-autosync.json` - Main workflow
- `services/n8n/workflows/recipe-10-merge-fix.js` - Extracted fixed code
- `services/n8n/workflows/recipe-10-merge-test-v2.js` - Test script
- `services/n8n/workflows/backups/2025-12-02/` - Backups

---

## References

- Original spec: `docs/recipes/recipe-10-tags.md`
- Task tracking: `TODO.md` line 12-13
- Cortex state: `cortex/state/brief-2025-12-02.json`
