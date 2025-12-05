# Cross-Reference Matrix

**Version**: 1.0  
**Date**: 2025-12-02  
**Purpose**: Link requirements ↔ implementation ↔ tests ↔ workflows

---

## 🎯 Overview

This matrix ensures **traceability** across the entire system:
- Requirements define **what** we need
- Implementation shows **how** it's built
- Tests verify **correctness**
- Workflows automate **execution**
- Output proves **results**

---

## 📊 Core Features Matrix

### Feature: Daily Digest

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 14) | `docs/requirements/cortex-os.md#recipe-14` | ✅ | 2025-12-02 |
| **Implementation** | Script | `cortex/scripts/generate-daily-digest.mjs` | ✅ | 2025-12-01 |
| **Workflow** | Recipe 14 | `services/n8n/workflows/recipe-14-daily-digest-generator.json` | ✅ | 2025-12-01 |
| **Template** | Digest Template | `cortex/templates/daily-digest-template.md` | ✅ | 2025-11-30 |
| **Output** | Daily Files | `cortex/daily/YYYY-MM-DD-digest.md` | ✅ | Auto |
| **Tests** | Unit Tests | `__tests__/digest-generator.test.js` | ❌ Missing | - |
| **Schema** | Output Schema | `cortex/schemas/daily-digest-v1.json` | ⏳ Planned | - |

**Dependencies**:
- Input: `TODO.md` (## Today — YYYY-MM-DD section)
- Input: Git commits (JST timezone)
- Service: Obsidian REST API (port 27124)

**Validation Points**:
1. Output file exists: `cortex/daily/YYYY-MM-DD-digest.md`
2. Contains required sections: Today's Focus, Progress, Reflection
3. Git stats present: commit count, file changes
4. Timestamp valid: ISO-8601 format

---

### Feature: KB Rebuild

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 02) | `docs/requirements/cortex-os.md#recipe-02` | ✅ | 2025-12-02 |
| **Implementation** | Script | `scripts/kb-rebuild.mjs` | ✅ | 2025-12-01 |
| **Workflow** | Recipe 02 | `services/n8n/workflows/recipe-02-kb-rebuild.json` | ✅ | 2025-12-02 |
| **Output** | KB Index | `kb/index/embeddings.json` | ✅ | Auto |
| **API** | KB API Service | `services/kb-api/server.mjs` | ✅ | 2025-11-XX |
| **Tests** | Integration Tests | `__tests__/kb-rebuild.test.js` | ❌ Missing | - |
| **Schema** | Index Schema | `kb/schemas/index-v1.json` | ⏳ Planned | - |

**Dependencies**:
- Input: All `.md` files (docs/, cortex/, etc.)
- Service: KB API (port 4040)
- Environment: `KB_EMBED_MODE`, `KB_API_TOKEN`

**Validation Points**:
1. Index file exists: `kb/index/embeddings.json`
2. Header valid: files count, chunks count, embed_mode
3. Embeddings normalized: L2 norm = 1.0
4. API reload successful: HTTP 200

---

### Feature: TODO Auto-sync

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 10) | `docs/requirements/cortex-os.md#recipe-10` | ✅ | 2025-12-02 |
| **Implementation** | Workflow Code | `services/n8n/workflows/recipe-10-todo-autosync.json` (Merge Tasks node) | ✅ | 2025-12-02 |
| **Workflow** | Recipe 10 | `services/n8n/workflows/recipe-10-todo-autosync.json` | ✅ | 2025-12-02 |
| **Input** | Yesterday's Digest | `cortex/daily/YYYY-MM-DD-digest.md` (Recipe 14 output) | ✅ | Auto |
| **Output** | TODO.md | `TODO.md` (## Today — YYYY-MM-DD section) | ✅ | Auto |
| **Tests** | E2E Tests | `__tests__/todo-sync.test.js` | ❌ Missing | - |
| **Schema** | TODO Schema | `cortex/schemas/todo-v2.json` | ⏳ Planned | - |

**Dependencies**:
- Input: `cortex/daily/YYYY-MM-DD-digest.md` (Recipe 14 output)
- Output: `TODO.md` (Obsidian vault)
- Service: Obsidian REST API (port 27124)

**Validation Points**:
1. Section exists: `## Today — YYYY-MM-DD`
2. Tasks deduplicated: No identical normalized tasks
3. Format correct: `- [ ] [Category] emoji content <!-- #tags -->`
4. Tags preserved: 5-tag system (#urgent, #deepwork, #blocked, #waiting, #review)

---

### Feature: Nightly Wrap-up

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 13) | `docs/requirements/cortex-os.md#recipe-13` | ✅ | 2025-12-02 |
| **Implementation** | Workflow | `services/n8n/workflows/recipe-13-nightly-wrapup.json` | ✅ | 2025-11-XX |
| **Output** | State File | `cortex/state/tomorrow.json` | ✅ | Auto |
| **Tests** | Unit Tests | `__tests__/nightly-wrapup.test.js` | ❌ Missing | - |
| **Schema** | Output Schema | `cortex/schemas/tomorrow-v1.json` | ⏳ Planned | - |

**Dependencies**:
- Input: `TODO.md` (incomplete tasks)

**Validation Points**:
1. File exists: `cortex/state/tomorrow.json`
2. Schema valid: generated_at, source_date, tomorrow_candidates
3. Candidates count: 3-5 items
4. Timestamp valid: ISO-8601 format

---

### Feature: Weekly Summary

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 11) | `docs/requirements/cortex-os.md#recipe-11` | ✅ | 2025-12-02 |
| **Implementation** | Script | `cortex/weekly/aggregators/weekly.mjs` | ✅ | 2025-11-XX |
| **Workflow** | Recipe 11 | `services/n8n/workflows/recipe-11-weekly-summary.json` | ✅ | 2025-11-XX |
| **Output** | Weekly Files | `cortex/weekly/YYYY-WNN-summary.md` | ✅ | Auto |
| **Tests** | Integration Tests | `__tests__/weekly-summary.test.js` | ❌ Missing | - |
| **Schema** | Output Schema | `cortex/schemas/weekly-summary-v1.json` | ⏳ Planned | - |

**Dependencies**:
- Input: `cortex/daily/*.md` (week's digests)

**Validation Points**:
1. File exists: `cortex/weekly/YYYY-WNN-summary.md`
2. Week calculation: ISO 8601 week number
3. Aggregation: All daily digests included
4. Stats: Task counts, highlights

---

### Feature: Daily Digest Distribution

| Layer | Artifact | Path | Status | Last Updated |
|-------|----------|------|--------|--------------|
| **Requirement** | cortex-os.md (Recipe 09) | `docs/requirements/cortex-os.md#recipe-09` | ✅ | 2025-12-03 |
| **Implementation** | Workflow Code | `services/n8n/workflows/recipe-09-daily-digest-v2.json` (Parse Tasks & Reflection node) | ✅ | 2025-12-03 |
| **Workflow** | Recipe 09 | `services/n8n/workflows/recipe-09-daily-digest-v2.json` | ✅ | 2025-12-03 |
| **Input** | Daily Digest | `cortex/daily/YYYY-MM-DD-digest.md` (Obsidian) | ✅ | Auto |
| **Output** | Notification File | `notifications/daily/YYYY-MM-DD-digest.md` | ✅ | Auto |
| **Output** | Slack Message | Slack Daily Digest Webhook | ✅ | Auto |
| **Tests** | E2E Tests | `__tests__/digest-distribution.test.js` | ❌ Missing | - |
| **Schema** | Output Schema | `cortex/schemas/digest-notification-v1.json` | ⏳ Planned | - |

**Dependencies**:
- Input: `cortex/daily/YYYY-MM-DD-digest.md` (Obsidian vault)
- Service: Obsidian REST API (port 27124)
- Service: Slack Webhook
- Environment: `OBSIDIAN_API_KEY`, `SLACK_DAILY_DIGEST_WEBHOOK`

**Validation Points**:
1. Output file exists: `/workspace/dauberside.github.io-1/notifications/daily/YYYY-MM-DD-digest.md`
2. Tasks extracted: `tasksFound` count >= 0
3. Reflection extracted: `reflectionFound` boolean
4. Slack delivery: HTTP 200 response
5. Multi-format task support: Checkbox (`- [ ]`) + plain bullet (`-`) + subsections (`### High Priority`)
6. Reflection subsections: Preserves nested structure (`### 学び`, `### 課題`, `### 気づき`)
7. Section name fallbacks: Tries `Today's Focus`, `Tasks`, `High Priority`
8. Error handling: Graceful degradation (continue on empty/missing sections)

**Recent Fixes** (2025-12-03):
- Fixed: Multi-format task extraction (checkbox + plain bullet + subsections)
- Fixed: Reflection extraction with proper regex boundaries (`\n##`, `\n---`, EOF)
- Fixed: Removed `process.env.WORKSPACE_ROOT` (n8n sandbox incompatibility)
- Tested: 2025-12-01 (4 tasks + full reflection), 2025-12-02 (empty, graceful)

---

## 🔍 Data Format Matrix

### TODO.md Structure

| Element | Format | Example | Required | Schema |
|---------|--------|---------|----------|--------|
| Section Header | `## Today — YYYY-MM-DD` | `## Today — 2025-12-02` | ✅ | Yes |
| Task Checkbox | `- [ ]` | `- [ ]` | ✅ | Yes |
| Category | `[Name]` | `[Cortex]` | ✅ | Yes |
| Emoji | 1 of 5 | `⚡🚧⏳🎯👁️` | ❌ | No |
| Content | Free text | `Implement feature X` | ✅ | Yes |
| Tags | `<!-- #tag1,#tag2 -->` | `<!-- #urgent,#deepwork -->` | ❌ | No |

**Schema Path**: `cortex/schemas/todo-v2.json` (⏳ Planned)

---

### Daily Digest Format

| Section | Required | Auto-generated | Manual |
|---------|----------|----------------|--------|
| `# Daily Digest - YYYY-MM-DD` | ✅ | ✅ | ❌ |
| `## Today's Focus` | ✅ | ✅ | ❌ |
| `### High Priority` | ✅ | ✅ | ❌ |
| `### Regular Tasks` | ✅ | ✅ | ❌ |
| `### No Tags` | ✅ | ✅ | ❌ |
| `## Progress` | ✅ | Placeholder | ✅ |
| `## Reflection` | ✅ | Placeholder | ✅ |
| `---` | ✅ | ✅ | ❌ |
| `**Generated**` | ✅ | ✅ | ❌ |
| `**Source**` | ✅ | ✅ | ❌ |

**Schema Path**: `cortex/schemas/daily-digest-v1.json` (⏳ Planned)

---

### KB Index Format

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `header.model` | string | ✅ | Enum: "text-embedding-3-small" |
| `header.embed_mode` | string | ✅ | Enum: "hash", "openai" |
| `header.embed_dim` | number | ✅ | 256 or 1536 |
| `header.created_at` | string | ✅ | ISO-8601 |
| `header.files` | number | ✅ | > 0 |
| `header.chunks` | number | ✅ | > 0 |
| `data[].id` | number | ✅ | Unique |
| `data[].source` | string | ✅ | Relative path |
| `data[].chunk_index` | number | ✅ | >= 0 |
| `data[].text` | string | ✅ | Length > 0 |
| `data[].embedding` | number[] | ✅ | L2 norm = 1.0 ± 0.01 |

**Schema Path**: `kb/schemas/index-v1.json` (⏳ Planned)

---

## 🧪 Test Coverage Matrix

### Current Status

| Feature | Unit Tests | Integration Tests | E2E Tests | Coverage |
|---------|------------|-------------------|-----------|----------|
| Daily Digest (Gen) | ❌ | ❌ | ❌ | 0% |
| Daily Digest (Dist) | ❌ | ❌ | ❌ | 0% |
| KB Rebuild | ❌ | ❌ | ❌ | 0% |
| TODO Auto-sync | ❌ | ❌ | ❌ | 0% |
| Nightly Wrap-up | ❌ | ❌ | ❌ | 0% |
| Weekly Summary | ❌ | ❌ | ❌ | 0% |

**Target**: 80% coverage by v1.3

---

### Planned Tests

#### 1. Daily Digest Tests

```javascript
// __tests__/digest-generator.test.js

describe('Daily Digest Generator', () => {
  test('should extract tasks from TODO.md', () => {
    // Given: TODO.md with ## Today — 2025-12-02
    // When: Script runs
    // Then: Tasks extracted correctly
  });
  
  test('should parse high priority tags', () => {
    // Given: Tasks with #urgent, #deepwork
    // When: Parsing
    // Then: Grouped under High Priority
  });
  
  test('should aggregate git commits', () => {
    // Given: Git commits in JST date range
    // When: Script runs
    // Then: Correct feat/fix/docs/other counts
  });
});
```

#### 2. KB Rebuild Tests

```javascript
// __tests__/kb-rebuild.test.js

describe('KB Rebuild', () => {
  test('should find all markdown files', () => {
    // Given: docs/, cortex/ directories
    // When: Script runs
    // Then: All .md files found
  });
  
  test('should chunk text correctly', () => {
    // Given: 3000 char text
    // When: Chunking (1200/200)
    // Then: 3 chunks with 200 overlap
  });
  
  test('should normalize embeddings', () => {
    // Given: Any embedding vector
    // When: Normalized
    // Then: L2 norm = 1.0
  });
});
```

#### 3. TODO Auto-sync Tests

```javascript
// __tests__/todo-sync.test.js

describe('TODO Auto-sync', () => {
  test('should deduplicate tasks', () => {
    // Given: Identical task in Today's Focus and TODO.md
    // When: Sync runs
    // Then: No duplicate created
  });
  
  test('should preserve tags', () => {
    // Given: Task with #urgent,#deepwork
    // When: Sync runs
    // Then: Tags in HTML comment
  });
  
  test('should create section when empty', () => {
    // Given: No tasks in Today's Focus
    // When: Sync runs
    // Then: Section created with placeholder
  });
});
```

---

## 🔄 Workflow Audit Matrix

| Recipe | Schedule | Last Run | Success Rate | Error Count | Alert Threshold |
|--------|----------|----------|--------------|-------------|-----------------|
| Recipe 02 (KB Rebuild) | 03:00 JST | 2025-12-02 03:00 | 100% | 0 | > 1 failure |
| Recipe 09 (Digest Dist) | 08:00 JST | 2025-12-03 08:00 | 100% | 0 | > 1 failure |
| Recipe 10 (TODO Sync) | 08:05 JST | 2025-12-02 08:05 | 100% | 0 | > 1 failure |
| Recipe 13 (Wrap-up) | 22:00 JST | 2025-12-01 22:00 | 100% | 0 | > 1 failure |
| Recipe 14 (Digest Gen) | 00:00 JST | 2025-12-02 00:00 | 100% | 0 | > 1 failure |
| Recipe 11 (Weekly) | Weekly | 2025-12-01 | 100% | 0 | > 1 failure |

**Monitoring**: Slack notifications for all failures

---

## 📝 Documentation Links

| Document | Section | Link | Last Updated |
|----------|---------|------|--------------|
| Requirements | Cortex OS v1.2 | [cortex-os.md](./cortex-os.md) | 2025-12-03 |
| Changelog | Version History | [CHANGELOG.md](./CHANGELOG.md) | 2025-12-02 |
| Audit | 2025-12-02 Report | [REQUIREMENTS-AUDIT-2025-12-02.md](./REQUIREMENTS-AUDIT-2025-12-02.md) | 2025-12-02 |
| Handoff | KB Rebuild Session | [CLAUDE-SESSION-HANDOFF.md](../../CLAUDE-SESSION-HANDOFF.md) | 2025-12-02 |
| Cross-Reference | Feature Traceability | [CROSS-REFERENCE-MATRIX.md](./CROSS-REFERENCE-MATRIX.md) | 2025-12-03 |

---

## 🎯 Next Steps

### v1.3: Validation & Testing

**Priority**: High  
**Timeline**: 2025-12-02 ~ 2025-12-16 (2 weeks)

**Tasks**:
1. ✅ Create Cross-Reference Matrix (this document)
2. ⏳ Create JSON Schemas
   - `cortex/schemas/todo-v2.json`
   - `cortex/schemas/daily-digest-v1.json`
   - `cortex/schemas/tomorrow-v1.json`
   - `cortex/schemas/weekly-summary-v1.json`
   - `kb/schemas/index-v1.json`
3. ⏳ Implement validation scripts
   - `scripts/validate-todo.mjs`
   - `scripts/validate-digest.mjs`
   - `scripts/validate-kb-index.mjs`
4. ⏳ Write unit tests (target: 50% coverage)
5. ⏳ Write integration tests (target: 30% coverage)
6. ⏳ Add validation to Recipe 02 (post-rebuild check)

---

## 📊 Metrics

**Traceability Score**: 60% (6/10 features fully traced)
**Test Coverage**: 0% (no tests yet)
**Schema Coverage**: 0% (no schemas yet)
**Documentation Coverage**: 100% (all features documented)

**Recent Updates** (2025-12-03):
- ✅ Added Recipe 09 (Daily Digest Distribution) to Core Features Matrix
- ✅ Added Recipe 09 validation points (8 validation checks)
- ✅ Added Recipe 09 to Workflow Audit Matrix
- ✅ Added Recipe 09 to Test Coverage Matrix

**Target for v1.3**:
- Traceability: 90%
- Test Coverage: 80%
- Schema Coverage: 100%

---

**Last Updated**: 2025-12-03
**Next Review**: 2025-12-16
**Maintained By**: Cortex OS Team
