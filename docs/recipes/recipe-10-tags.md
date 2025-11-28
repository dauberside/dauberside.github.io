# Recipe 10: TODO.md Auto-sync - Tag System

**Version**: v1.2 (Complete)
**Last Updated**: 2025-11-28

---

## Overview

Recipe 10 automatically syncs tasks from Daily Digest to TODO.md with intelligent enrichment:

- **Multi-section fallback**: Finds tasks in priority order
- **Category detection**: `[Cortex]`, `[n8n]` based on content
- **Tag-based emoji markers**: Visual priority/state indicators
- **Smart deduplication**: Ignores formatting when comparing tasks

---

## Available Tags

### Emoji Mapping (Priority Order)

Tags are processed in priority order. The **first matching tag** determines the emoji.

| Tag | Emoji | Priority | Meaning | Use When |
|-----|-------|----------|---------|----------|
| `#urgent` | ⚡ | P0 | Time-critical, requires immediate attention | Deadlines, breaking issues |
| `#blocked` | 🚧 | P1 | Blocked by external dependency | Waiting on infrastructure, access, or decisions |
| `#waiting` | ⏳ | P2 | Waiting for response/input from others | Email replies, PR reviews, approvals |
| `#deepwork` | 🎯 | P3 | Requires focused concentration | Complex coding, architecture, research |
| `#review` | 👁️ | P4 | Review/checking/validation work | Code review, document proofreading, QA |

**Priority Logic**: If a task has both `#urgent` and `#deepwork`, only ⚡ will be shown (highest priority wins).

---

## Usage

### Basic Usage

Add tags inline in your Daily Digest:

**Input** (in `cortex/daily/YYYY-MM-DD-digest.md`):
```markdown
## Today's Focus
- [ ] cortex/graph/build-embeddings.mjs 実装 #urgent
- [ ] Code review for PR #123 #review
- [ ] Research new architecture patterns #deepwork
```

**Output** (in `TODO.md`):
```markdown
## 2025-11-28
- [ ] [Cortex] ⚡ cortex/graph/build-embeddings.mjs 実装  <!-- #urgent -->
- [ ] 👁️ Code review for PR #123  <!-- #review -->
- [ ] 🎯 Research new architecture patterns  <!-- #deepwork -->

---
```

### Multiple Tags

Tasks can have multiple tags, but **only the first matching emoji** (by priority) is displayed:

**Input**:
```markdown
- [ ] Fix production bug #urgent #deepwork #review
```

**Output**:
```markdown
- [ ] ⚡ Fix production bug  <!-- #urgent,#deepwork,#review -->
```

All tags are preserved in the HTML comment for future processing.

---

## Section Fallback Hierarchy

Recipe 10 searches for tasks in this order:

1. **`## Today's Focus`** ← Primary section
2. **`## Action Items`** ← Fallback 1
3. **`## Follow-ups`** ← Fallback 2
4. **`## Priority 1`** or **`## Priority 2`** ← Fallback 3

**Behavior**:
- The first section found is used exclusively
- Tasks from other sections are ignored
- If no section is found, zero tasks are extracted

**Example**: If your digest has both `## Today's Focus` and `## Action Items`, only tasks from `## Today's Focus` are synced.

---

## Category Detection

Categories are automatically detected based on task content:

| Pattern | Category | Example |
|---------|----------|---------|
| Contains `cortex/` | `[Cortex]` | `cortex/graph/export.mjs` |
| Contains `n8n` or `Recipe XX` | `[n8n]` | `Recipe 03 修正`, `n8n workflow test` |
| No match | *(none)* | `Update README` |

---

## Output Format

### Full Task Line Structure

```
- [ ] [Category] emoji taskContent  <!-- #tag1,#tag2 -->
```

**Components** (all optional except checkbox and content):
1. `- [ ]` - Checkbox (required)
2. `[Category]` - Category prefix (optional)
3. `emoji` - Visual marker (optional, based on tags)
4. `taskContent` - Task text with tags removed (required)
5. `<!-- #tags -->` - HTML comment with all tags (optional)

### Examples

**With everything**:
```markdown
- [ ] [Cortex] ⚡ cortex/kb/embed.mjs implementation  <!-- #urgent,#deepwork -->
```

**Category + emoji only**:
```markdown
- [ ] [n8n] 🚧 Recipe 03 workflow update  <!-- #blocked -->
```

**Emoji only** (no category match):
```markdown
- [ ] 👁️ Review documentation updates  <!-- #review -->
```

**Plain task** (no tags or category):
```markdown
- [ ] Update README
```

---

## Smart Deduplication

Recipe 10 compares tasks using **normalized text** to prevent duplicates:

### Normalization Process

The following are **ignored** during comparison:
1. Checkbox: `- [ ]` or `- [x]`
2. Category prefix: `[Cortex]`, `[n8n]`, etc.
3. Emoji markers: ⚡, 🚧, ⏳, 🎯, 👁️
4. HTML comments: `<!-- #tags -->`

### Example: Duplicate Detection

**Existing TODO.md**:
```markdown
- [ ] cortex/graph/build-embeddings.mjs 実装
```

**New Digest** (same task with tags):
```markdown
- [ ] cortex/graph/build-embeddings.mjs 実装 #urgent
```

**Result**: Not added (duplicate detected)

**Reason**: After normalization, both tasks become:
```
cortex/graph/build-embeddings.mjs 実装
```

---

## Slack Notification

When Recipe 10 completes, Slack receives:

```
✅ TODO.md Auto-sync完了
• 日付: 2025-11-28
• 新規タスク: 4 件
• ソース: Today's Focus
```

The **ソース** (source) field shows which section was used:
- `Today's Focus`
- `Action Items`
- `Follow-ups`
- `Priority 1/2`
- `None` (if no section found)

---

## Advanced Patterns

### Blocked vs. Waiting

**`#blocked`** = External infrastructure/system dependency
```markdown
- [ ] Deploy to prod #blocked
  (Reason: Waiting for infrastructure team to provision servers)
```

**`#waiting`** = Human response/input needed
```markdown
- [ ] Finalize API design #waiting
  (Reason: Waiting for tech lead's feedback on RFC)
```

### Deep Work Sessions

Tag tasks that require uninterrupted focus:
```markdown
- [ ] Refactor authentication system #deepwork
- [ ] Write ADR for caching strategy #deepwork
```

These can later be filtered for dedicated focus blocks.

### Urgent Reviews

Combine urgency with review type:
```markdown
- [ ] Security audit of auth flow #urgent #review
```
→ Shows as ⚡ (urgent takes precedence)

---

## Troubleshooting

### Tags Not Detected

**Symptom**: Tags in digest but no emoji in TODO.md

**Causes**:
1. Tag format incorrect (must be `#tagname`, no spaces)
2. Tag not in the emoji map (only 5 tags supported)
3. Task not in a recognized section (check section names)

**Solution**:
- Verify tag spelling: `#urgent`, `#blocked`, `#waiting`, `#deepwork`, `#review`
- Check section header matches: `## Today's Focus` (case-insensitive)

### Wrong Section Used

**Symptom**: Slack shows `Source: Action Items` but you expected `Today's Focus`

**Cause**: `## Today's Focus` section not found in digest

**Solution**:
- Verify section header is exactly `## Today's Focus` (case-insensitive)
- Check for typos: `## Today's focus` (works), `## Todays Focus` (doesn't work)

### Duplicate Tasks Appearing

**Symptom**: Same task added multiple times

**Cause**: Task text differs slightly (extra space, punctuation, etc.)

**Solution**: Normalization only ignores category/emoji/tags. Content must match exactly:
- `build-embeddings.mjs` ≠ `build_embeddings.mjs`
- `実装` ≠ `実装完了`

---

## Future Enhancements (v1.3+)

Potential extensions for autonomous cognitive loops:

### Time-Based Filtering
```javascript
// Only extract #urgent on weekends
if (isWeekend) {
  tasks = tasks.filter(t => t.tags.includes('urgent'));
}
```

### Priority Scoring
```javascript
// Score tasks by tag combination
const score = {
  urgent: 100,
  blocked: 50,
  waiting: 30,
  deepwork: 20,
  review: 10
};
```

### Task Aging
```markdown
- [ ] [Cortex] ⚡🕐 Old urgent task (3 days)  <!-- #urgent,age:3d -->
```

---

## Tag Design Philosophy

### Why 5 Tags?

The tag system is **intentionally constrained** to prevent decision fatigue:

1. **⚡ urgent** - Addresses: "What's time-critical?"
2. **🚧 blocked** - Addresses: "What's stopping me?"
3. **⏳ waiting** - Addresses: "What needs follow-up?"
4. **🎯 deepwork** - Addresses: "What needs focus?"
5. **👁️ review** - Addresses: "What needs checking?"

These 5 tags form a **minimal complete set** for autonomous task management.

### Why Not More Tags?

- **Cognitive load**: More than 5-7 categories causes choice paralysis
- **Diminishing returns**: Most tasks fit into these 5 buckets
- **System autonomy**: AI can reason about 5 categories without ambiguity

### Adding Custom Tags

If you need additional tags, modify `tagEmojiMap` in the workflow:

```javascript
const tagEmojiMap = [
  { tag: 'urgent', emoji: '⚡' },
  { tag: 'blocked', emoji: '🚧' },
  { tag: 'waiting', emoji: '⏳' },
  { tag: 'deepwork', emoji: '🎯' },
  { tag: 'review', emoji: '👁️' },
  // Add custom tags below
  { tag: 'research', emoji: '🔬' },
  { tag: 'meeting', emoji: '👥' }
];
```

**Warning**: Keep the total under 7 tags to maintain cognitive simplicity.

---

## Summary

Recipe 10 v1.2 provides:

✅ **5-tag emoji system** for visual task state/priority
✅ **Multi-section fallback** for robust extraction
✅ **Smart deduplication** ignoring formatting
✅ **Category auto-detection** for `[Cortex]` and `[n8n]`
✅ **Slack notifications** with source tracking

**Next Steps**:
1. Add tags to your daily digest
2. Run Recipe 10 (or wait for 08:05 JST auto-trigger)
3. Check TODO.md for emoji-enriched tasks
4. Monitor Slack for source section confirmation

**Questions?** See [troubleshooting section](#troubleshooting) or check n8n execution logs.

---

**Version History**:
- **v1.2** (2025-11-28): Added #blocked, #waiting tags + complete documentation
- **v1.1** (2025-11-27): Added #urgent, #deepwork, #review tags + multi-section fallback
- **v1.0** (2025-11-26): Initial implementation (Today's Focus only, no tags)
