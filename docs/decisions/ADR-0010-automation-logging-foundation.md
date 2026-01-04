# ADR-0010: Automation Logging Foundation

**Status**: Accepted
**Date**: 2025-12-21
**Context**: v1.3 Entry Gate - Observability基盤確立

---

## Context

Cortex OS v1.3では、全Recipeの実行状況を可視化し、Automation Health Scoreを改善するため、統一的なロギング基盤が必要。

**現状**:
- Recipe 10: JSONL logging実装済み（2025-12-21）
- Recipe 15: JSONL logging実装済み
- Recipe 02, 03, 11, 13, 14: ロギングなし

**課題**:
- 実行履歴が不透明（成功/失敗の追跡不可）
- Health Scoreが `no_data` となり信頼性が低い
- トラブルシューティングに時間がかかる

---

## Decision

### 1. Architecture: Method B（直接追記方式）を採用

**理由**:
- ✅ 実装が簡潔（各Recipe に2ノード追加のみ）
- ✅ 環境制約が少ない（Webhook不要）
- ✅ Recipe 10, 15で実績あり
- ✅ 短期間で全Recipe展開可能（1-2時間）

**将来の改善パス**:
- v1.4以降で Method A（Log Collector Workflow）へ移行検討
- 現行の直接追記方式は互換性を保ちつつ段階移行

---

### 2. 標準 JSONL Schema

**Core Fields** (全Recipe共通):
```json
{
  "ts": "2025-12-21T14:05:31.120Z",        // ISO 8601 timestamp
  "workflow": "Recipe XX: Name",           // Workflow name
  "executionId": "abc123",                 // n8n execution ID
  "status": "success" | "error",           // Execution status
  "durationMs": 1842,                      // Execution duration
  "env": "production",                     // Environment
  "errorMessage": null | "error details", // Error message if failed
  "meta": { /* recipe-specific */ }       // Custom metadata
}
```

**Meta Field Guidelines**:

| Recipe | Meta Fields | Example |
|--------|-------------|---------|
| Recipe 02 | `scriptsRun`, `kbChunks`, `kbSizeMB` | `{"scriptsRun": 3, "kbChunks": 298}` |
| Recipe 10 | `tasksAdded`, `totalTasks`, `sourceSection`, `statusCode` | `{"tasksAdded": 7, "totalTasks": 10}` |
| Recipe 11 | `weeksProcessed`, `digestsFound`, `summaryLength` | `{"weeksProcessed": 1, "digestsFound": 7}` |
| Recipe 13 | `sessionDuration`, `tasksCompleted`, `tomorrowGenerated` | `{"sessionDuration": 180}` |
| Recipe 14 | `digestLength`, `tasksExtracted`, `dateGenerated` | `{"tasksExtracted": 5}` |
| Recipe 15 | `scriptsRun`, `durationSuccess`, `rhythmSuccess`, `categorySuccess` | `{"scriptsRun": 3}` |

---

### 3. Implementation Template

**Node 1: Prepare Log Entry** (Code Node):
```javascript
// TEMPLATE: Prepare JSONL Log Entry
const startTime = $('FIRST_NODE_NAME').first().json.startTime || Date.now();
const endTime = Date.now();

// Get data from workflow nodes
const resultData = $('RESULT_NODE_NAME').first().json;

const logEntry = {
  ts: new Date().toISOString(),
  workflow: "Recipe XX: Workflow Name",
  executionId: $executionId,
  status: "success",  // or "error" based on conditions
  durationMs: endTime - startTime,
  env: "production",
  errorMessage: null,
  meta: {
    // Recipe-specific fields
    exampleField: resultData.exampleValue
  }
};

const today = new Date().toISOString().split('T')[0];
const filename = `cortex/logs/recipe-XX-${today}.jsonl`;
const logLine = JSON.stringify(logEntry);

return {
  json: {
    logEntry: logEntry,
    logLine: logLine,
    filename: filename
  }
};
```

**Node 2: Write JSONL Log** (Execute Command Node):
```
{{ "echo '" + $json.logLine + "' >> /workspace/dauberside.github.io-1/" + $json.filename }}
```

**Connection**:
```
Last Business Logic Node
    ↓
Prepare Log Entry
    ↓
Write JSONL Log
```

---

### 4. Rollout Plan

**Phase 1: 残りRecipeへの展開**（目標: 1-2時間）

| Recipe | 優先度 | 所要時間 | 実装タイミング |
|--------|--------|----------|----------------|
| Recipe 13 | P0 | 15分 | 即座 |
| Recipe 14 | P0 | 15分 | 即座 |
| Recipe 02 | P1 | 20分 | 12/22 |
| Recipe 11 | P2 | 20分 | 12/22 |
| Recipe 03 | P3 | 15分 | 12/23 |

**Phase 2: Entry Gate検証**（12/22-23）

1. **7日間の安定稼働確認**:
   ```bash
   # 全Recipeのログファイル確認
   ls -lh cortex/logs/recipe-*-$(date +%Y-%m-%d).jsonl
   ```

2. **Health Score改善確認**:
   ```bash
   python3 scripts/analyze-health.py --window-days 7
   ```
   - 期待: Automation score 50 → 75+
   - 期待: `no_data` が解消

3. **ログ品質確認**:
   ```bash
   # 各Recipeのログが正常に出力されているか
   for recipe in 02 10 11 13 14 15; do
     echo "Recipe $recipe:"
     tail -3 cortex/logs/recipe-$recipe-*.jsonl | jq .
   done
   ```

---

### 5. Future Improvements (v1.4+)

**Method A への移行検討**:
1. Log Collector Workflow 実装
2. 各Recipe を HTTP Request 方式に変更
3. 段階的移行（Recipe 1つずつテスト）

**追加機能**:
- ログ集約・分析ダッシュボード
- エラー通知（Slack integration）
- ログローテーション（30日以上は自動削除）
- ログ検索UI（Obsidian plugin or Web UI）

---

## Consequences

### Positive

- ✅ 全Recipeの実行状況が可視化される
- ✅ Automation Health Scoreが信頼できる指標になる
- ✅ トラブルシューティングが高速化（ログ参照で原因特定）
- ✅ 1-2時間で全Recipe展開可能
- ✅ 標準化されたフォーマットで分析が容易

### Negative

- ⚠️ 各Recipeにファイル書き込み権限が必要
- ⚠️ JSON生成ロジックが各Recipeに散在
- ⚠️ ログローテーション未実装（手動管理が必要）

### Neutral

- 📊 v1.4でMethod Aへの移行を検討（段階的改善）
- 📊 ログファイルサイズ: 1日あたり数KB（許容範囲）

---

## Implementation Status

- [x] Recipe 10: Logging implemented (2025-12-21)
- [x] Recipe 15: Logging already exists
- [ ] Recipe 13: Not implemented
- [ ] Recipe 14: Not implemented
- [ ] Recipe 02: Not implemented
- [ ] Recipe 11: Not implemented
- [ ] Recipe 03: Not implemented

---

## References

- Implementation Guide: `cortex/roadmap/v1.3-implementation-guide.md`
- Example Logs: `cortex/logs/recipe-10-2025-12-21.jsonl`
- Health Score Script: `scripts/analyze-health.py`
