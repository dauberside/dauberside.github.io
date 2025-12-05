# Task Entry Schema — Cortex OS 情報モデル統一

**Version**: 1.0.0  
**Date**: 2025-12-05  
**Status**: ✅ Production Ready

---

## 概要

**task-entry.json** は、Cortex OS の全データレイヤーで使用される統一フォーマットです。

### 目的

- Daily Digest, TODO.md, Weekly Summary の **形式を統一**
- データ変換コストを **ゼロに**
- 全レイヤーで **一貫した処理** を可能に
- 将来の「月次 Summary」「AI 教師データ生成」を **簡単に**

### 適用範囲

| データソース | 従来形式 | 新形式 | 変換スクリプト |
|------------|---------|-------|--------------|
| Daily Digest | Markdown | task-entry.json | `convert-to-task-entry.mjs` |
| tomorrow.json | JSON (partial) | task-entry.json | Schema migration |
| TODO.md | Markdown | task-entry.json | Parser + Converter |
| Weekly Summary | Markdown | task-entry.json (aggregated) | Weekly aggregator |

---

## Schema 定義

### 完全なスキーマ

**Location**: `cortex/schema/task-entry.json`

**JSON Schema Draft-07**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://xn--rn8h03a.st/schemas/cortex/task-entry.json",
  "title": "Cortex OS Task Entry",
  "description": "Unified task entry format for Cortex OS daily/weekly data",
  "type": "object",
  "required": ["date", "tasks"],
  "properties": {
    "date": "YYYY-MM-DD",
    "tasks": [...],
    "completed": [...],
    "carryover": [...],
    "reflection": "...",
    "tomorrow_candidates": [...],
    "metadata": {...}
  }
}
```

---

## フィールド仕様

### 1. `date` (required)

**Type**: `string`  
**Pattern**: `^\d{4}-\d{2}-\d{2}$`  
**Description**: 日付 (YYYY-MM-DD 形式)

**Examples**:
```json
"date": "2025-12-05"
```

---

### 2. `tasks` (required)

**Type**: `array<Task>`  
**Description**: 今日の予定タスク一覧

**Task Object**:
```json
{
  "content": "Recipe 10 最終確認とクローズ",
  "status": "pending",
  "tags": ["urgent"],
  "emoji": "⚡",
  "category": "n8n",
  "estimate": 1.5
}
```

**Task Fields**:

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `content` | string | ✅ | タスク内容 | - |
| `status` | enum | ✅ | `pending`, `completed`, `blocked`, `waiting`, `cancelled` | `pending` |
| `tags` | array<string> | | タグ配列 (`urgent`, `blocked`, `waiting`, `deepwork`, `review`, `milestone`, `done`) | `[]` |
| `emoji` | string | | 絵文字 (`⚡`, `🚧`, `⏳`, `🎯`, `👁️`, `🎉`, `""`) | `""` |
| `category` | string | | カテゴリ (`Cortex`, `n8n`, `Docs`, `MCP`, `KB`) | `""` |
| `estimate` | number | | 所要時間 (hours) | `1.0` |
| `completed_at` | string (ISO 8601) | | 完了日時 | - |
| `created_at` | string (ISO 8601) | | 作成日時 | - |

---

### 3. `completed` (optional)

**Type**: `array<Task>`  
**Description**: 完了したタスク一覧  
**Default**: `[]`

**Example**:
```json
"completed": [
  {
    "content": "llms-input.json パイプライン完成",
    "status": "completed",
    "tags": ["milestone", "done"],
    "emoji": "🎉",
    "category": "Cortex",
    "estimate": 2.0,
    "completed_at": "2025-12-05T05:42:00.000Z"
  }
]
```

---

### 4. `carryover` (optional)

**Type**: `array<Task>`  
**Description**: 前日から持ち越したタスク  
**Default**: `[]`

---

### 5. `reflection` (optional)

**Type**: `string`  
**Description**: 日次の振り返り (気づき、学び、課題)  
**Default**: `""`

**Example**:
```json
"reflection": "llms.txt 生成パイプラインが完成し、v1.2 の情報モデル統一が 80% に到達。5 MCP Servers が稼働し、Cortex OS v1.1+ が完成した。"
```

---

### 6. `tomorrow_candidates` (optional)

**Type**: `array<string>`  
**Description**: 明日の候補タスク  
**Default**: `[]`

**Example**:
```json
"tomorrow_candidates": [
  "task-entry.json スキーマ実装",
  "/ask コマンド実装",
  "n8n 本番環境デプロイ"
]
```

---

### 7. `metadata` (optional)

**Type**: `object`  
**Description**: メタデータ

**Fields**:

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `generated_at` | string (ISO 8601) | 生成日時 | - |
| `source` | string | データソース (`daily-digest`, `manual`, `recipe-10`, `recipe-13`) | - |
| `version` | string | スキーマバージョン | `"1.0.0"` |

---

## 使用例

### Example 1: 完全な task-entry.json

```json
{
  "date": "2025-12-05",
  "tasks": [
    {
      "content": "Recipe 10 最終確認とクローズ",
      "status": "pending",
      "tags": ["urgent"],
      "emoji": "⚡",
      "category": "n8n",
      "estimate": 1.5
    },
    {
      "content": "v1.2 Roadmap の次のマイルストーン特定",
      "status": "pending",
      "tags": ["deepwork"],
      "emoji": "🎯",
      "category": "Cortex",
      "estimate": 2.0
    }
  ],
  "completed": [
    {
      "content": "llms-input.json パイプライン完成",
      "status": "completed",
      "tags": ["milestone", "done"],
      "emoji": "🎉",
      "category": "Cortex",
      "estimate": 2.0,
      "completed_at": "2025-12-05T05:42:00.000Z"
    }
  ],
  "carryover": [],
  "reflection": "llms.txt 生成パイプラインが完成し、v1.2 の情報モデル統一が 80% に到達。",
  "tomorrow_candidates": [
    "task-entry.json スキーマ実装",
    "/ask コマンド実装"
  ],
  "metadata": {
    "generated_at": "2025-12-05T14:00:00.000Z",
    "source": "daily-digest",
    "version": "1.0.0"
  }
}
```

---

## データ変換

### Daily Digest → task-entry.json

**入力**: `cortex/daily/2025-12-05-digest.md`

```markdown
# Daily Digest — 2025-12-05

## Tasks
- [x] llms-input.json パイプライン完成 <!-- #milestone,#done -->
- [ ] Recipe 10 最終確認とクローズ <!-- #urgent -->

## Reflection
llms.txt 生成パイプラインが完成...
```

**出力**: `cortex/state/task-entry-2025-12-05.json`

**変換スクリプト**: `scripts/convert-to-task-entry.mjs`

```bash
pnpm cortex:convert-digest -- 2025-12-05
```

---

### tomorrow.json → task-entry.json

**従来の tomorrow.json** (部分的な構造化):
```json
{
  "generated_at": "2025-12-05T13:00:00.000Z",
  "source_date": "2025-12-05",
  "tomorrow_candidates": [
    "task-entry.json スキーマ実装",
    "/ask コマンド実装"
  ]
}
```

**新しい task-entry.json** (完全な構造化):
```json
{
  "date": "2025-12-06",
  "tasks": [
    {
      "content": "task-entry.json スキーマ実装",
      "status": "pending",
      "tags": [],
      "emoji": "",
      "category": "Cortex",
      "estimate": 1.0
    }
  ],
  "metadata": {
    "generated_at": "2025-12-05T13:00:00.000Z",
    "source": "recipe-13",
    "version": "1.0.0"
  }
}
```

**Migration**: Recipe 13 の出力形式を task-entry.json に変更

---

## バリデーション

### スクリプト

**Location**: `scripts/validate-task-entry.mjs`

```bash
# 単一ファイル検証
pnpm cortex:validate-task-entry -- cortex/state/task-entry-2025-12-05.json

# ディレクトリ一括検証
pnpm cortex:validate-task-entry -- cortex/state/
```

**出力例**:
```
✅ cortex/state/task-entry-2025-12-05.json: Valid
❌ cortex/state/task-entry-2025-12-04.json: Invalid
  - Missing required field: date
  - tasks[0].status: Invalid enum value "in-progress"
```

---

## Recipe 統合

### Recipe 10 (TODO Auto-sync)

**変更点**:
- 出力形式を task-entry.json に変更
- `TODO.md` の代わりに `cortex/state/task-entry-YYYY-MM-DD.json` に保存
- TODO.md は task-entry.json から自動生成

### Recipe 13 (Nightly Wrap-up)

**変更点**:
- tomorrow.json → task-entry.json (next day)
- 完了タスク、振り返り、明日の候補を含む完全なエントリを生成

### Recipe 03 (Morning Digest)

**変更点**:
- 出力を task-entry.json 形式に変更
- Markdown digest は task-entry.json から自動生成

---

## マイグレーション計画

### Phase 1: Schema & Tools (✅ 完了 - 2025-12-05)
- [x] JSON Schema 定義
- [x] ドキュメント作成
- [x] バリデータ実装
- [x] 変換スクリプト実装

### Phase 2: Recipe 統合 (予定: 2025-12-06)
- [ ] Recipe 13 を task-entry.json 出力に変更
- [ ] Recipe 10 を task-entry.json 読み込みに変更
- [ ] Recipe 03 を task-entry.json 出力に変更

### Phase 3: 既存データ変換 (予定: 2025-12-07)
- [ ] 過去の digest を一括変換
- [ ] tomorrow.json を task-entry.json に移行
- [ ] 互換性検証

### Phase 4: Markdown 生成 (予定: 2025-12-08)
- [ ] task-entry.json → TODO.md 生成
- [ ] task-entry.json → Daily Digest Markdown 生成
- [ ] 既存フォーマットとの互換性維持

---

## メリット

### 1. データ変換コストがゼロに

**Before**:
```
Daily Digest (MD) → Parser → Custom Object → Converter → TODO.md
```

**After**:
```
task-entry.json (read) → task-entry.json (write)
```

### 2. 全レイヤーで一貫した処理

- Recipe 10, 13, 03 が同じデータ形式を使用
- バリデーション、変換、集約が統一ロジック
- テストが簡単に

### 3. 将来の拡張が容易

- 月次 Summary: 30 個の task-entry.json を集約するだけ
- AI 教師データ: task-entry.json をそのまま使用
- 統計分析: JSON を直接処理

---

## 関連ドキュメント

- [Cortex OS v1.2 "Autonomy" Roadmap](../cortex/v1.2-autonomy.md)
- [CHANGELOG](./CHANGELOG.md)
- [llms-input Schema](./llms-input-schema.md)

---

**Status**: ✅ Production Ready (2025-12-05)  
**Version**: 1.0.0  
**Author**: Cortex OS Team
