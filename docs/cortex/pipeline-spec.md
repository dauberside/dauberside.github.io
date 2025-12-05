# Cortex OS パイプライン仕様書

**Version**: 1.0  
**Created**: 2025-12-05  
**Status**: Production (v1.2 Autonomy)

---

## 📊 概要

Cortex OS は3つの主要パイプラインで構成されます：

1. **Task Extraction Pipeline** - タスクの収集と正規化
2. **Workload Analysis Pipeline** - パターン分析と可視化  
3. **Smart Suggestion Pipeline** - コンテキスト対応タスク提案

すべてのパイプラインは `task-entry.json` スキーマに準拠したデータを扱います。

---

## 🔄 Pipeline 1: Task Extraction

### 目的
複数ソースからタスクを抽出し、統一フォーマット（task-entry.json）に変換します。

### Input Sources
1. **Daily Digest** - `cortex/daily/YYYY-MM-DD-digest.md`
2. **TODO.md** - プロジェクトルート
3. **tomorrow.json** - `data/tomorrow.json`

### Output
- **Format**: `cortex/state/task-entry-YYYY-MM-DD.json`
- **Schema**: `data/schemas/task-entry.json` (JSON Schema Draft-07)

### 実行
```bash
# 単日抽出
python scripts/extract-tasks.py --date 2025-12-05

# 過去N日分抽出
python scripts/extract-tasks.py --days 30

# デフォルト（今日のみ）
python scripts/extract-tasks.py
```

### I/O Contract

#### Input Contract
- **Daily Digest**: Markdown形式、タスクは `- [ ]` または `- [x]` 形式
- **TODO.md**: 同上
- **tomorrow.json**: JSON形式、`tomorrow_candidates` 配列を含む

#### Output Contract
```json
{
  "date": "YYYY-MM-DD",
  "generated_at": "ISO-8601 timestamp",
  "sources": ["digest", "todo", "tomorrow"],
  "tasks": [
    {
      "title": "string (必須)",
      "status": "pending|completed|cancelled (必須)",
      "source": "digest|todo|tomorrow (必須)",
      "priority": "critical|high|medium|low|none (オプション)",
      "category": "string (オプション)",
      "tags": ["string"] (オプション),
      "estimated_duration": "integer (minutes, オプション)",
      "actual_duration": "integer (minutes, オプション)",
      "created_at": "ISO-8601 timestamp (オプション)",
      "completed_at": "ISO-8601 timestamp (オプション)"
    }
  ],
  "metadata": {
    "total_tasks": "integer",
    "completed": "integer",
    "pending": "integer",
    "completion_rate": "float (0.0-1.0)"
  }
}
```

### エラーハンドリング
- **ファイル不在**: 警告ログ、空配列として処理継続
- **JSON パースエラー**: stderr にエラー、exit code 1
- **無効な日付形式**: stderr にエラー、exit code 1

### パフォーマンス
- **処理時間**: ~100ms/日 (典型的な20タスク)
- **メモリ使用量**: < 10MB (30日分)

---

## 📈 Pipeline 2: Workload Analysis

### 目的
task-entry.json ファイルを分析し、時間的パターンと負荷傾向を抽出します。

### Input
- **Source**: `cortex/state/task-entry-*.json` (複数ファイル)
- **Range**: デフォルト30日、`--days` で指定可能

### Output
1. **temporal-patterns.json** - `data/analytics/temporal-patterns.json`
2. **workload-report.md** - `data/analytics/workload-report.md`

### 実行
```bash
# デフォルト（過去30日）
python scripts/analyze-workload.py

# 過去7日のみ
python scripts/analyze-workload.py --days 7
```

### I/O Contract

#### Input Contract
- **複数のtask-entry.json**: Pipeline 1の出力形式に準拠
- **最小データ量**: 3日分以上推奨（統計的信頼性のため）

#### Output Contract: temporal-patterns.json
```json
{
  "generated_at": "ISO-8601 timestamp",
  "analysis_period": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "days_analyzed": "integer"
  },
  "summary": {
    "avg_tasks": "float",
    "avg_completion_rate": "float (0.0-1.0)",
    "total_tasks": "integer",
    "total_completed": "integer"
  },
  "weekday_patterns": {
    "Monday": {
      "avg_tasks": "float",
      "avg_completion_rate": "float",
      "task_count": "integer",
      "days_observed": "integer"
    }
    // ... 他の曜日も同様
  },
  "category_breakdown": {
    "category_name": {
      "count": "integer",
      "completion_rate": "float"
    }
  }
}
```

#### Output Contract: workload-report.md
Markdown形式のレポート。含む内容：
- 分析期間サマリー
- 曜日別負荷ヒートマップ（テキスト表現）
- カテゴリ別統計
- 完了率トレンド

### エラーハンドリング
- **task-entry.json 不在**: 警告ログ、空データとして処理
- **pandas import エラー**: `pip install pandas` 指示、exit code 1
- **データ不足（< 1日）**: 警告、最小限のサマリー出力

### パフォーマンス
- **処理時間**: ~500ms (30日 × 20タスク/日)
- **メモリ使用量**: < 50MB (pandas DataFrame)
- **依存関係**: pandas >= 1.3.0

---

## 💡 Pipeline 3: Smart Suggestion

### 目的
時間的パターンと今日の状況に基づき、最適なタスクを提案します。

### Input
1. **temporal-patterns.json** - Pipeline 2の出力
2. **tomorrow.json** - `data/tomorrow.json`
3. **Today's Digest** (オプション) - 重複検出用

### Output
- **Format**: JSON配列（stdout）
- **Content**: 提案タスクのリスト

### 実行
```bash
# 基本実行
python scripts/suggest.py

# Claude コマンド経由
/suggest
```

### I/O Contract

#### Input Contract
- **temporal-patterns.json**: Pipeline 2の出力形式に準拠
- **tomorrow.json**: `tomorrow_candidates` 配列を含む
- **Today's Digest**: オプション、存在すれば重複チェックに使用

#### Output Contract
```json
[
  {
    "title": "string (必須)",
    "priority": "critical|high|medium|low (必須)",
    "source": "tomorrow|suggestion (必須)",
    "reason": "string (提案理由、オプション)",
    "estimated_load": "integer (minutes、オプション)"
  }
]
```

または、提案なしの場合：
```json
{
  "message": "✅ All candidate tasks are already in today's digest!",
  "suggestions": []
}
```

### ロジック

#### 1. 負荷検出
```python
today_weekday = datetime.now().strftime("%A")
avg_tasks = patterns["weekday_patterns"][today_weekday]["avg_tasks"]

if avg_tasks > 15:
    load = "high"
    max_suggestions = 3
elif avg_tasks < 8:
    load = "low"
    max_suggestions = 10
else:
    load = "medium"
    max_suggestions = 5
```

#### 2. 優先度フィルタリング
- **High Load**: "critical", "high" のみ
- **Medium Load**: "critical", "high", "medium"
- **Low Load**: すべて

#### 3. 重複検出
Today's Digest に既存のタスクタイトルと完全一致するものを除外。

### エラーハンドリング
- **temporal-patterns.json 不在**: 警告、デフォルト負荷（medium）で継続
- **tomorrow.json 不在**: 警告、空配列を返す
- **曜日パターン欠損**: `summary.avg_tasks` にフォールバック

### パフォーマンス
- **処理時間**: ~50ms（典型的な10候補）
- **メモリ使用量**: < 5MB

---

## 🔗 パイプライン連携

### 標準フロー（全自動）
```bash
# 1. タスク抽出（過去30日）
python scripts/extract-tasks.py --days 30

# 2. 負荷分析
python scripts/analyze-workload.py --days 30

# 3. 提案生成
python scripts/suggest.py
```

### 日次更新フロー（増分）
```bash
# 今日のタスクのみ抽出
python scripts/extract-tasks.py

# 分析更新（週1回程度で十分）
python scripts/analyze-workload.py --days 30

# 提案（毎朝実行推奨）
python scripts/suggest.py
```

### n8n Recipe 連携
- **Recipe名**: `Cortex OS - Daily Suggestions`
- **トリガー**: 毎朝 6:00 AM
- **フロー**:
  1. `extract-tasks.py` 実行
  2. `analyze-workload.py` 実行（週1回のみ）
  3. `suggest.py` 実行
  4. 結果を Obsidian に書き込み

---

## 📝 データフロー図

```
┌─────────────────┐
│ Daily Digest    │──┐
│ TODO.md         │  │
│ tomorrow.json   │  │
└─────────────────┘  │
                     ▼
              ┌──────────────┐
              │  extract-    │
              │   tasks.py   │
              └──────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ task-entry-YYYY-MM-DD  │
        │        .json           │
        └────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  analyze-    │
              │  workload.py │
              └──────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ temporal-patterns.json │
        │ workload-report.md     │
        └────────────────────────┘
                     │
                     ▼
              ┌──────────────┐     ┌──────────────┐
              │  suggest.py  │◄────│ tomorrow.json│
              └──────────────┘     └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ Suggestions  │
              │   (stdout)   │
              └──────────────┘
```

---

## 🧪 テスト戦略

### Unit Tests
- 各パイプライン独立してテスト
- モックデータで I/O 検証
- エラーケースの網羅

### Integration Tests
- 全パイプライン連携テスト
- 実データサンプルでの動作確認

### Test Cases
詳細は以下を参照：
- `tests/scripts/suggest.test-cases.md`
- （今後追加予定）`tests/scripts/extract.test-cases.md`
- （今後追加予定）`tests/scripts/analyze.test-cases.md`

---

## 🚀 将来の拡張（v1.3+）

### Phase 2: Duration Learning
- `estimated_duration` と `actual_duration` の学習
- タスクごとの所要時間予測
- Pipeline 2 に機械学習モデル追加

### Phase 3: Dependency Detection
- タスク間依存関係の推論
- 依存グラフの生成
- Pipeline 3 の提案ロジックに統合

### Phase 4: Self-Improvement
- パイプライン実行時間のモニタリング
- 異常検知とアラート
- 自動最適化提案

---

## 📚 関連ドキュメント

- **スキーマ定義**: `data/schemas/task-entry.json`
- **v1.2 Roadmap**: `docs/cortex/v1.2-autonomy.md`
- **v1.3 Roadmap**: `docs/cortex/v1.3-intelligence.md`
- **コマンドリファレンス**: `.claude/commands/suggest.md`

---

**最終更新**: 2025-12-05  
**メンテナー**: Cortex OS Team  
**ステータス**: ✅ Production Ready (v1.2)
