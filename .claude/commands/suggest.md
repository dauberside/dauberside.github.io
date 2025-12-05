# /suggest - Smart Task Suggestions

**Version**: 1.0 (MVP)  
**Status**: ✅ Active  
**Phase**: v1.3 Temporal Analytics  

## 概要

今日のコンテキスト（曜日パターン・負荷状況・tomorrow候補）を元に、最適なタスクを3つ提案するコマンド。

## 使い方

```bash
/suggest
```

**引数なし**: 自動的に今日の状況を分析して3タスク提案

## 提案ロジック（MVP版）

### 入力データ
1. **Temporal Patterns** (`data/analytics/temporal-patterns.json`)
   - 曜日ごとの平均負荷
   - 今日の曜日の完了率

2. **Tomorrow Candidates** (`data/tomorrow.json`)
   - 次にやるべきタスクリスト
   - 優先度情報

3. **Today's Context** (`cortex/daily/{today}-digest.md`)
   - 今日の既存タスク
   - 現在の進捗状況

### 提案戦略

```
if 今日の曜日の平均負荷 > 15:
    → 軽量タスク優先（tomorrow_candidatesの下位から）
else:
    → 重要タスク優先（tomorrow_candidatesの上位から）

重複除外:
    - 今日の digest にすでに存在するタスクは除外
    - 最大3タスクまで提案
```

## 出力例

```
🎯 Today's Suggestions (Thursday, Dec 5)

Based on your patterns:
- Thursday avg load: 12 tasks (moderate)
- Current completion rate: 75%

Recommended tasks:

1. [High Priority] Implement /suggest command prototype
   → Est. 30-45min, Low dependencies

2. [Medium Priority] Update v1.3 roadmap documentation
   → Est. 15-20min, Documentation task

3. [Low Priority] Review temporal analytics output
   → Est. 10min, Quick review

💡 Tip: These suggestions balance your typical Thursday workload with current priorities.
```

## 技術スタック

- **Python 3.x**: メインロジック
- **JSON**: データソース（temporal-patterns.json, tomorrow.json）
- **Markdown**: 出力フォーマット

## ファイル構成

```
scripts/suggest.py          # メインスクリプト
data/analytics/
  temporal-patterns.json    # 入力: 曜日パターン
data/tomorrow.json          # 入力: タスク候補
cortex/daily/{date}-digest.md  # 入力: 今日の状態
```

## 実装詳細

### suggest.py の構造

```python
def load_temporal_patterns() -> dict
    """temporal-patterns.json を読み込み"""

def load_tomorrow_candidates() -> list
    """tomorrow.json を読み込み"""

def load_today_digest(date: str) -> list
    """今日の digest からタスクリストを抽出"""

def get_today_load_pattern(patterns: dict, weekday: int) -> dict
    """今日の曜日の平均負荷を取得"""

def filter_duplicate_tasks(candidates: list, existing: list) -> list
    """既存タスクと重複を除外"""

def select_top_suggestions(candidates: list, load: dict, limit: int = 3) -> list
    """負荷に応じてタスクを選択"""

def format_output(suggestions: list, context: dict) -> str
    """Markdown 形式で出力"""
```

## Phase 1 → Phase 2 の拡張予定

### Phase 2 で追加する機能
- **依存関係検出**: タスク間の依存を考慮
- **所要時間予測**: 過去データから予測
- **優先度の動的調整**: リアルタイム負荷に応じて調整
- **カスタムフィルタ**: `--tag`, `--priority`, `--time` オプション

### Phase 3 で追加する機能
- **学習フィードバックループ**: 提案の採用率を追跡
- **パーソナライゼーション**: 個人の作業パターンに最適化

## トラブルシューティング

### エラー: temporal-patterns.json が見つからない
```bash
# 先に extract-tasks.py と analyze-workload.py を実行
python scripts/extract-tasks.py
python scripts/analyze-workload.py
```

### 提案が0件
- tomorrow.json が空の可能性
- 今日の digest にすでに全タスクが含まれている可能性

## 関連コマンド

- `/brief` - 今日のブリーフィング生成
- `/wrap-up` - 今日の振り返り
- `/sync-todo` - TODO.md と tomorrow.json の同期

## 変更履歴

- **v1.0** (2025-12-05): MVP版リリース
  - 基本的な提案ロジック実装
  - 曜日パターンベースの負荷考慮
  - 重複除外機能
