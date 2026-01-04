# Automation Logging基盤設計

**作成日**: 2025-12-20
**目的**: v1.3 Milestone 1 - Observability基盤の確立
**所要時間**: 20分設計 + 25分実装 = 45分

---

## 現状分析

### ✅ 既に実装済み
1. **ログディレクトリ**: `cortex/logs/` 存在
2. **JSONL形式**: Recipe 10で既に正しいフォーマットで出力中
3. **ファイル命名**: `recipe-10-YYYY-MM-DD.jsonl` 形式で日次ローテーション済み

**確認コマンド**:
```bash
ls -lh cortex/logs/
head -n 1 cortex/logs/recipe-10-2025-12-17.jsonl | jq
```

**出力例**:
```json
{
  "ts": "2025-12-17T14:25:43.666Z",
  "workflow": "Recipe 10: TODO.md Auto-sync",
  "executionId": "647",
  "status": "success",
  "durationMs": 0,
  "env": "production",
  "errorMessage": null,
  "meta": {
    "tasksAdded": 0,
    "statusCode": 204,
    "target": "vault/TODO.md",
    "warnings": ["No new tasks extracted"]
  }
}
```

### 🔧 未実装（Milestone 1で必要）
1. **Log Collector Workflow**: 中央集約ログ受付エンドポイント
2. **他Recipeへの展開**: Recipe 02, 03, 11, 13, 14へのログ送信実装

---

## 設計方針

### Option A: Log Collector方式（推奨）
**メリット**:
- 各Recipeは「送るだけ」（ファイル書き込み権限不要）
- ログフォーマット統一が容易
- エラーハンドリング一元化

**デメリット**:
- 新規ワークフロー作成が必要（30分）
- 各Recipeに HTTP Request追加が必要

### Option B: 各Recipeで直接追記（簡易版）
**メリット**:
- 実装が早い（各Recipe 5分で追加可能）
- 外部依存なし

**デメリット**:
- 各Recipeにファイル書き込み権限が必要
- JSON生成ロジックが分散
- エラーハンドリングが各所に散在

---

## 決定: **Option B（各Recipeで直接追記）**を採用

**理由**:
1. **時間制約**: Milestone 1は60分で完了させる必要がある
2. **Recipe 10で実証済み**: 既に動作しているパターンをコピーするだけ
3. **リスク最小化**: 新規ワークフロー作成よりも既存パターンの展開が安全
4. **Phase 2で移行可能**: 将来的にLog Collectorに切り替えても後方互換性維持

**Phase 2移行計画**:
- v1.3データ蓄積フェーズ（12/15-12/31）でLog Collector実装
- 既存の直接追記も並行動作させて段階的移行

---

## 実装仕様（Option B）

### 1. ログ出力ノードの標準テンプレート

**配置場所**: 各Recipeの最終ノード（成功時）

**ノード構成**:
```
Main Workflow
    ↓
[Success Node]
    ↓
Prepare Log Entry (Code Node) ← 実行時メトリクス収集
    ↓
Write Log to File (Execute Command) ← JSONL追記
```

---

### 2. Code Node: Prepare Log Entry

```javascript
// 📊 実行時メトリクス収集
const startTime = $('Start Time Marker').first()?.json?.startTime || Date.now();
const endTime = Date.now();

const logEntry = {
  ts: new Date().toISOString(),
  workflow: "Recipe XX: [ワークフロー名]",  // ← Recipe番号と名前
  executionId: $executionId,
  status: "success",  // or "error"
  durationMs: endTime - startTime,
  env: "production",
  errorMessage: null,
  meta: {
    // Recipe固有のメトリクス
    // 例: tasksAdded, filesProcessed, apiCalls など
  }
};

return { json: logEntry };
```

**カスタマイズポイント**:
- `workflow`: Recipe番号と名前を記載
- `meta`: Recipe固有のメトリクスを追加

---

### 3. Execute Command Node: Write Log to File

```bash
echo '{{ $json | toJsonString }}' >> /workspace/dauberside.github.io-1/cortex/logs/recipe-{{ $json.workflow | match("Recipe (\\d+)") | first }}-$(date +%Y-%m-%d).jsonl
```

**簡略版**（Recipe番号を手動指定）:
```bash
echo '{{ $json | toJsonString }}' >> /workspace/dauberside.github.io-1/cortex/logs/recipe-10-$(date +%Y-%m-%d).jsonl
```

**ファイル名形式**: `recipe-XX-YYYY-MM-DD.jsonl`

---

### 4. エラー時のログ出力

**On Error Node**:
```javascript
const logEntry = {
  ts: new Date().toISOString(),
  workflow: "Recipe XX: [ワークフロー名]",
  executionId: $executionId,
  status: "error",
  durationMs: Date.now() - ($('Start Time Marker').first()?.json?.startTime || Date.now()),
  env: "production",
  errorMessage: $('Error Node').first()?.json?.message || "Unknown error",
  meta: {
    errorNode: $('Error Node').first()?.name || "Unknown",
    errorStack: $('Error Node').first()?.json?.stack || null
  }
};

return { json: logEntry };
```

---

## 実装対象Recipe（Milestone 1スコープ）

### 優先度1（必須）
1. **Recipe 10**: TODO.md Auto-sync ← 既に実装済み ✅
2. **Recipe 14**: Daily Digest Generator ← 日次実行、最重要

### 優先度2（推奨）
3. **Recipe 13**: Nightly Wrap-up ← 日次実行
4. **Recipe 11**: Weekly Summary ← 週次実行

### 優先度3（オプション）
5. **Recipe 02**: KB Rebuild ← 手動実行が多い
6. **Recipe 03**: Daily Digest (旧版) ← Recipe 14に統合予定

**Milestone 1判定基準**: 優先度1のみ実装完了でOK

---

## Entry Gate検証手順

### 1. ログファイル確認
```bash
# 直近7日分のログファイルが存在するか
ls -lh cortex/logs/recipe-*.jsonl | tail -7

# 各ファイルの行数確認（少なくとも1行以上）
wc -l cortex/logs/recipe-*.jsonl
```

### 2. analyze-health.py実行
```bash
python3 scripts/analyze-health.py --window-days 7

# 期待結果:
# - automation_score が "no_data" でない
# - automation_score >= 50
```

### 3. Overall Health Score確認
```bash
cat cortex/state/health-score.json | jq '.overall_score'

# 期待: 65以上
```

---

## タイムライン（60分）

### Task 1: 設計（20分） ← 現在
- ✅ 現状分析
- ✅ Option A/B比較
- ✅ Option B選定
- ✅ 実装仕様策定

### Task 2: Recipe 10ログ確認 + Recipe 14実装（25分）
1. Recipe 10の既存実装確認（5分）
2. Recipe 14にログ出力追加（15分）
   - Prepare Log Entry追加
   - Write Log to File追加
   - 手動実行テスト
3. ログファイル生成確認（5分）

### Task 3: Milestone 1達成確認（15分）
1. ログファイル確認（5分）
2. analyze-health.py実行（5分）
3. Entry Gate判定（5分）

---

## Next Steps（Phase 2）

### v1.3データ蓄積フェーズ（12/15-12/31）
1. **Log Collector Workflow実装**（2時間）
   - Webhook Trigger (/log)
   - Format + Append to File
   - エラーハンドリング

2. **既存Recipeの移行**（1時間）
   - 直接追記 → HTTP Request送信に変更
   - 段階的ロールアウト

3. **他Recipeへの展開**（1時間）
   - Recipe 02, 03, 11, 13への追加

---

## 参考資料

- Implementation Guide: `cortex/roadmap/v1.3-implementation-guide.md`
- Entry Checklist: `cortex/roadmap/v1.3-entry-checklist.md`
- 既存ログ: `cortex/logs/recipe-10-*.jsonl`

---

**設計完了**: 2025-12-20
**次のアクション**: Task 2（Recipe 10確認 + Recipe 14実装）
