# Daily Digest System - 要件定義書

**Document Version**: 1.1  
**Last Updated**: 2025-12-01  
**Status**: 承認済み・実装完了・パッチ適用済み  
**Implementation**: Recipe 14 (recipe-14-daily-digest-generator.json)

---

## 📋 目次

1. [概要](#概要)
2. [設計思想](#設計思想)
3. [機能要件](#機能要件)
4. [非機能要件](#非機能要件)
5. [技術仕様](#技術仕様)
6. [テスト要件](#テスト要件)
7. [運用要件](#運用要件)
8. [変更履歴](#変更履歴)

---

## 概要

### システム目的

TODO.md の「Today」セクションから前日のタスク実績を自動抽出し、構造化された日次ダイジェストを生成する。

### 対象ユーザー

- **本人**: 日々の振り返り・進捗確認
- **AI エージェント**: コンテキスト理解・memory priming
- **チームメンバー**: 透明性・情報共有

### システム範囲

**Input**: 
- `TODO.md` (root)
- 前日の日付 (JST)

**Output**:
- `cortex/daily/{YYYY-MM-DD}-digest.md`

**Dependencies**:
- Node.js 20+
- n8n workflow engine
- Docker environment (optional)

---

## 設計思想

### 核となる原則

**"Digest = Yesterday's Record"**

Daily Digest は「昨日の確定した記録」である。

```
Timeline:
┌─────────────────────────────────────────────────┐
│ [23:59 JST] Day N ends                          │
│   → TODO "Today" contains Day N tasks          │
│                                                 │
│ [00:00 JST] Day N+1 begins                     │
│   → Date boundary crossed                      │
│                                                 │
│ [00:30 JST] Recipe 14 runs                     │
│   → Reads TODO "Today" (= Day N tasks)        │
│   → Generates Day N digest                     │
│   → File: cortex/daily/{Day N}-digest.md      │
│                                                 │
│ [08:00 JST] Morning reflection                 │
│   → Recipe 03, 09, 10 use Day N digest        │
└─────────────────────────────────────────────────┘
```

### 3層時間構造との整合

Cortex OS は3つの時間層で動作:

1. **Yesterday** (確定済み)
   - Daily Digest の対象
   - 振り返り・学習の材料
   - 不変 (immutable)

2. **Today** (進行中)
   - 現在の作業
   - TODO "Today" セクション
   - 可変 (mutable)

3. **Tomorrow** (計画中)
   - 準備・スケジューリング
   - `tomorrow.json` で管理
   - 予測 (predictive)

**Daily Digest は Yesterday 層のみを扱う**。

---

## 機能要件

### FR-1: タスク抽出

**優先度**: 🔴 Critical

#### FR-1.1 セクション識別

- TODO.md の "Today" セクションを特定
- マーカー: `## 🎯 Today` または `## Today`
- 次のセクション (例: `## Tomorrow`) までを範囲とする

#### FR-1.2 タスク分類

抽出したタスクを以下に分類:

| 分類 | 条件 | 例 |
|------|------|-----|
| High Priority | `#urgent`, `#deepwork`, `#blocked` を含む | `- [x] Fix auth bug #urgent` |
| Regular | 上記以外のタスク | `- [x] Write docs` |
| Excluded | `#someday`, `#maybe` を含む | `- [ ] Research AI #someday` |

**Output Structure**:
```javascript
{
  highPriority: [
    { text: "...", completed: true, tags: [...] }
  ],
  regular: [
    { text: "...", completed: false, tags: [...] }
  ]
}
```

#### FR-1.3 完了率計算

```
Completion Rate = (Completed Tasks / Total Tasks) × 100
```

- High Priority と Regular を合算
- Excluded タスクは計算に含めない
- 小数点以下1桁まで表示

---

### FR-2: ダイジェスト生成

**優先度**: 🔴 Critical

#### FR-2.1 日付処理

**要求**:
- 日付は **JST (Asia/Tokyo)** で決定
- サーバーのタイムゾーン設定に依存しない
- 実行時に「昨日」を動的計算

**実装**:
```javascript
function formatDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  // Return YYYY-MM-DD
}

function getYesterdayInJST() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return formatDate(now);
}
```

#### FR-2.2 ファイル構造

**Output Path**:
```
{WORKSPACE_ROOT}/cortex/daily/{YYYY-MM-DD}-digest.md
```

**Frontmatter**:
```yaml
---
date: {YYYY-MM-DD}
type: daily-digest
generated: {ISO 8601 timestamp}
completion_rate: {percentage}
tags:
  - cortex-os
  - daily-digest
  - auto-generated
---
```

**Content Sections**:

1. **Date Header**
   ```markdown
   # Daily Digest - {YYYY-MM-DD}
   ```

2. **Summary**
   ```markdown
   ## 📊 Summary
   - Total Tasks: {count}
   - Completed: {count} ({percentage}%)
   - High Priority: {count}
   ```

3. **Today's Focus**
   ```markdown
   ## 🎯 Today's Focus
   
   ### High Priority Tasks
   - [x] Task 1 #urgent
   - [ ] Task 2 #deepwork
   
   ### Regular Tasks
   - [x] Task 3
   - [x] Task 4
   ```

4. **Tasks Completed**
   ```markdown
   ## ✅ Tasks Completed
   - Task description 1
   - Task description 2
   ```

5. **Key Learnings**
   ```markdown
   ## 💡 Key Learnings
   _(This section is for manual addition)_
   ```

6. **Tomorrow's Plan**
   ```markdown
   ## 🔜 Tomorrow's Plan
   _(This section is for manual addition)_
   ```

#### FR-2.3 プレースホルダー禁止

生成されたファイルに以下を含んではならない:
- `{{DATE}}`
- `{{TASK_COUNT}}`
- その他の `{{...}}` 形式
- `_placeholder_`

**Rationale**: 未解決のプレースホルダーは下流システムでエラーを引き起こす。

---

### FR-3: エラーハンドリング

**優先度**: 🟡 High

#### FR-3.1 入力検証

| 検証項目 | エラー条件 | 処理 |
|---------|-----------|------|
| TODO.md 存在 | ファイルが存在しない | Error + Exit code 1 |
| Today セクション | セクションが見つからない | Warning + 空のダイジェスト |
| ファイルサイズ | 0 bytes | Error + Exit code 1 |

#### FR-3.2 出力検証

生成後に以下を検証:

```javascript
async function validateOutput(filePath) {
  const MIN_SIZE = 100; // bytes
  const stats = await fs.stat(filePath);
  
  // Check 1: File size
  if (stats.size < MIN_SIZE) {
    throw new Error(`File too small: ${stats.size} bytes`);
  }
  
  // Check 2: Required sections
  const content = await fs.readFile(filePath, 'utf8');
  const requiredSections = [
    "## 📊 Summary",
    "## 🎯 Today's Focus",
    "## ✅ Tasks Completed"
  ];
  
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      throw new Error(`Missing section: ${section}`);
    }
  }
  
  // Check 3: No placeholders
  if (content.includes('{{') || content.includes('_placeholder_')) {
    throw new Error('Contains unresolved placeholders');
  }
  
  return true;
}
```

#### FR-3.3 ログ出力

**Success**:
```
✅ Daily Digest generated successfully
📅 Date: 2025-11-30
📁 File: cortex/daily/2025-11-30-digest.md
📊 Size: 2.4 KB
✅ Validation passed
```

**Error**:
```
❌ Daily Digest generation failed
📅 Date: 2025-11-30
❌ Error: Missing section: ## Summary
💡 Hint: Check TODO.md format
```

---

## 非機能要件

### NFR-1: パフォーマンス

**優先度**: 🟢 Medium

| Metric | Target | Rationale |
|--------|--------|-----------|
| 実行時間 | < 3秒 | 00:30 JST の自動実行で遅延を防ぐ |
| メモリ使用量 | < 50MB | n8n コンテナリソースを圧迫しない |
| ファイルサイズ | < 10KB | Git diff を小さく保つ |

### NFR-2: 可用性

**優先度**: 🟡 High

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| 成功率 | ≥ 99% | エラーハンドリング + 検証 |
| 再試行 | 3回まで | n8n workflow の retry 設定 |
| 通知 | 失敗時 Slack | n8n error webhook |

### NFR-3: 保守性

**優先度**: 🟡 High

**Code Quality**:
- ESLint: no errors
- Functions: < 50 lines
- Cyclomatic complexity: < 10

**Documentation**:
- Inline comments (必要な箇所のみ)
- README: 最新状態を維持
- CHANGELOG: バージョン管理

### NFR-4: 移植性

**優先度**: 🔴 Critical

**Environment Independence**:
```javascript
// ✅ Good: Environment-aware
const ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(__dirname, '../..');

// ❌ Bad: Hard-coded
const ROOT = '/workspace/dauberside.github.io-1';
```

**Timezone Independence**:
```javascript
// ✅ Good: UTC → JST 変換（現在の実装）
function getJSTDate() {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

// ❌ Bad: Implicit (server-dependent)
const date = new Date().toISOString().split('T')[0];
```

---

## 技術仕様

### 実装環境

**Runtime**:
- Node.js: 20.x or later
- ES Modules (ESM): Required

**Dependencies**:
- `node:fs/promises` (built-in)
- `node:path` (built-in)

**Optional**:
- Docker: For containerized execution
- n8n: For workflow orchestration

### ファイル構成

```
/
├── bin/
│   └── cortex-digest.mjs                    # メインスクリプト（実装済み）
├── cortex/
│   └── daily/
│       └── {YYYY-MM-DD}-digest.md           # Obsidian Vault内の生成ファイル
├── services/
│   └── n8n/
│       └── workflows/
│           ├── recipe-14-daily-digest-generator.json
│           └── REQUIREMENTS-daily-digest.md  # この文書
└── TODO.md                                   # 入力ソース
```

### 環境変数

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WORKSPACE_ROOT` | ✅ | なし | リポジトリルート（例: `/Volumes/Extreme Pro/dauberside.github.io-1`） |
| `OBSIDIAN_VAULT_PATH` | ✅ | なし | Obsidian Vault パス（例: `/Users/.../Obsidian Vault`） |
| `TZ` | ❌ | N/A | 使用しない（UTC→JST変換で明示的に処理） |

### 実行モード

#### 1. CLI (開発・デバッグ)

```bash
cd /workspace/dauberside.github.io-1
node bin/cortex-digest.mjs
```

#### 2. n8n Workflow (本番)

```json
{
  "name": "Daily Digest Generator",
  "nodes": [
    {
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "triggerTimes": {
          "hour": 15,
          "minute": 30
        }
      }
    },
    {
      "type": "n8n-nodes-base.executeCommand",
      "parameters": {
        "command": "cd ${WORKSPACE_ROOT} && node bin/cortex-digest.mjs"
      }
    }
  ]
}
```

**Schedule**:
- **Trigger**: 15:30 UTC (= 00:30 JST)
- **Frequency**: Daily
- **Timezone**: UTC (container default)

#### 3. Docker (コンテナ内)

```bash
docker exec n8n sh -c 'cd ${WORKSPACE_ROOT} && node bin/cortex-digest.mjs'
```

---

## テスト要件

### UT-1: 単体テスト

**Scope**: 各関数の単体動作

**Test Cases**:

| Test ID | Function | Input | Expected Output |
|---------|----------|-------|-----------------|
| UT-1.1 | `getJSTDate()` | `new Date('2025-11-30T15:30:00Z')` | `"2025-12-01"` (JST) |
| UT-1.2 | `getJSTDate()` | `new Date('2025-12-01T08:00:00Z')` | `"2025-12-01"` (JST) |
| UT-1.3 | JST offset calculation | UTC midnight | JST 09:00 same day |
| UT-1.4 | File path resolution | `OBSIDIAN_VAULT_PATH` | `{vault}/cortex/daily/{date}-digest.md` |
| UT-1.5 | Environment validation | Missing `WORKSPACE_ROOT` | Error with clear message |

### IT-1: 統合テスト

**Scope**: エンドツーエンドの動作

**Test Cases**:

| Test ID | Scenario | Input | Expected Outcome |
|---------|----------|-------|------------------|
| IT-1.1 | 正常系 (タスクあり) | Valid TODO.md | Digest 生成成功 |
| IT-1.2 | 正常系 (タスクなし) | Empty "Today" | 空のダイジェスト |
| IT-1.3 | 異常系 (TODO.md なし) | Missing file | Error + Exit 1 |
| IT-1.4 | 異常系 (Today なし) | No section | Warning + 空 |
| IT-1.5 | 検証失敗 (サイズ小) | < 100 bytes | Error + Exit 1 |
| IT-1.6 | 検証失敗 (セクション欠) | Missing section | Error + Exit 1 |
| IT-1.7 | 検証失敗 (placeholder) | Contains `{{DATE}}` | Error + Exit 1 |

### PT-1: パフォーマンステスト

**Scope**: 性能要件の検証

**Test Cases**:

| Test ID | Metric | Target | Test Method |
|---------|--------|--------|-------------|
| PT-1.1 | 実行時間 | < 3秒 | `time node bin/cortex-digest.mjs` |
| PT-1.2 | メモリ使用量 | < 50MB | `node --max-old-space-size=50 bin/cortex-digest.mjs` |
| PT-1.3 | ファイルサイズ | < 10KB | `ls -lh "${OBSIDIAN_VAULT_PATH}/cortex/daily/"*.md` |

---

## 運用要件

### OP-1: 監視

**Metrics to Track**:

| Metric | Collection | Alert Threshold |
|--------|-----------|-----------------|
| 成功率 | Daily | < 95% (週次) |
| 実行時間 | Per run | > 5秒 |
| ファイルサイズ | Per file | > 15KB |
| エラー率 | Daily | > 2回/日 |

**Monitoring Tools**:
- n8n execution logs
- Slack notifications (failures)
- `cortex/logs/digest-{YYYY-MM}.log` (Phase 2)

### OP-2: バックアップ

**Strategy**:
- Git commit: Daily (via automation)
- Retention: Unlimited (Git history)

**Recovery**:
```bash
# Restore yesterday's digest
git checkout HEAD~1 -- cortex/daily/2025-11-30-digest.md
```

### OP-3: メンテナンス

**Regular Tasks**:

| Task | Frequency | Owner |
|------|-----------|-------|
| README 更新 | On change | Developer |
| ログローテーション | Monthly | Automation |
| パフォーマンスレビュー | Quarterly | Tech Lead |

**Upgrade Path**:
1. Phase 1 → Phase 2: Function refactoring
2. Phase 2 → Phase 3: Test infrastructure
3. Phase 3 → v1.4: AI-enhanced features

---

## 変更履歴

### Version 1.1 (2025-12-01) - Path Normalization & Timezone Safety Patch

**Updated**:
1. **スクリプトパス変更**
   - Before: `cortex/scripts/generate-daily-digest.mjs`
   - After: `bin/cortex-digest.mjs`
   - Reason: プロジェクト構造の標準化

2. **環境変数の必須化**
   - `WORKSPACE_ROOT`: 必須（デフォルト削除）
   - `OBSIDIAN_VAULT_PATH`: 必須（デフォルト削除）
   - Reason: 環境非依存性の徹底

3. **タイムゾーン処理の実装更新**
   - Method: `Intl.DateTimeFormat` → UTC offset calculation
   - Implementation: `getJSTDate()` with explicit offset
   - Reason: シンプル化・計算の明確化

4. **出力パス変更**
   - Before: `${WORKSPACE_ROOT}/cortex/daily/`
   - After: `${OBSIDIAN_VAULT_PATH}/cortex/daily/`
   - Reason: Obsidian Vault との統合

**Validated**:
- ✅ Environment variables properly configured
- ✅ No hardcoded paths remaining
- ✅ Timezone calculation verified
- ✅ File generation tested

### Version 1.0 (2025-12-01) - Initial Release

**Implemented**:
- ✅ FR-1: タスク抽出
- ✅ FR-2: ダイジェスト生成
- ✅ FR-3: エラーハンドリング
- ✅ NFR-4: 移植性 (環境変数 + タイムゾーン)
- ✅ OP-1: 監視 (基本)

**Changes**:
1. **タイムゾーン安全化**
   - Before: `new Date().toISOString().split('T')[0]`
   - After: `Intl.DateTimeFormat` with explicit timezone

2. **環境変数対応**
   - Added: `WORKSPACE_ROOT` support
   - Pattern: Env-aware with fallback

3. **検証強化**
   - Added: `validateOutput()` function
   - Checks: Size, sections, placeholders

4. **トリガー時刻変更**
   - Before: 07:00 JST
   - After: 00:30 JST
   - Reason: "Digest = Yesterday's Record"

**Implementation Status**:
- Script: `bin/cortex-digest.mjs` ✅
- Workflow: `recipe-14-daily-digest-generator.json` ✅
- Environment variables: `.env.mcp` ✅
- Path normalization: All hardcoded paths removed ✅
- Timezone safety: UTC→JST conversion implemented ✅
- Tests: Not implemented (planned for Phase 2)

---

## Appendix

### A. 用語集

| Term | Definition |
|------|------------|
| Daily Digest | 前日のタスク実績をまとめた日次レポート |
| TODO.md | タスク管理用の Markdown ファイル (root) |
| Today セクション | TODO.md 内の現在進行中タスク領域 |
| High Priority | `#urgent`, `#deepwork`, `#blocked` タグ付きタスク |
| Completion Rate | タスク完了率 (%) |
| JST | Japan Standard Time (UTC+9) |
| WORKSPACE_ROOT | リポジトリのルートディレクトリパス |

### B. 参考資料

**Internal Docs**:
- `bin/cortex-digest.mjs` (実装ファイル)
- `services/n8n/workflows/README-recipe-14.md`
- `.env.mcp.example` (環境変数設定例)
- Obsidian Vault: `cortex/daily/2025-12-01-digest.md` (実例)

**External Resources**:
- [Intl.DateTimeFormat - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [n8n Workflow Documentation](https://docs.n8n.io/)

### C. FAQ

**Q1: なぜ 00:30 JST に実行するのか？**

A: TODO.md の "Today" セクションは「今日のタスク」を含むが、日付が変わった直後 (00:00 JST) では「昨日のタスク」として確定する。00:30 に実行することで、確実に前日の記録を取得できる。

**Q2: タイムゾーンはなぜ明示的に指定するのか？**

A: Docker コンテナや CI 環境では TZ 設定が予測できない。`Intl.DateTimeFormat` で明示的に `Asia/Tokyo` を指定することで、どの環境でも一貫した動作を保証する。

**Q3: 検証が失敗したらどうなるか？**

A: スクリプトは Exit code 1 で終了し、n8n はエラーを検知してリトライまたは Slack 通知を行う。生成されたファイルは削除されない (デバッグ用)。

**Q4: Phase 2 では何が追加されるのか？**

A: 関数分割、テストインフラ、設定ファイル外出し、JSON 形式での出力オプション。

---

**Document Owner**: Development Team  
**Approval**: Tech Lead  
**Review Cycle**: Quarterly or on major changes

**Last Reviewed**: 2025-12-01  
**Next Review**: 2026-03-01
