# Recipe 02: Analytics Integration Guide

**日付**: 2025-12-07  
**目的**: Nightly KB Rebuild に Analytics 自動更新を統合

---

## 🎯 統合内容

Recipe 02 (毎晩03:00 JST実行) に以下を追加：

### 既存のステップ

1. ✅ Analyze Rhythm (タスクリズム分析)
2. ✅ Analyze Duration (所要時間分析)
3. ✅ Rebuild KB Index (KB インデックス再構築)
4. ✅ Reload KB API (KB API のリロード)
5. ✅ Format Result Message (結果メッセージ整形)
6. ✅ Send to Slack (Slack 通知)

### 追加するステップ（Analytics 統合）

3. **➕ Analyze Category Heatmap** (曜日×カテゴリ相性分析)
4. **➕ Analyze Health Score** (Cortex OS 健康度スコア)
5. **➕ Analyze Recipe Metrics** (Recipe 実行統計)

**挿入位置**: "Analyze Duration" の後、"Rebuild KB Index" の前

---

## 📦 n8n ノード設定

### 前提条件

- Recipe 02 が既にアクティブで動作している
- Python スクリプトがローカルテスト済み（Step 1 完了）
- n8n コンテナが正常稼働中
- n8n コンテナに Python 3 がインストール済み（カスタムイメージ使用）

### 追加するノード

以下の3つの Execute Command ノードを追加します。
これらは **"Analyze Duration" と "Rebuild KB Index" の間** に配置されます。

---

#### Node 4: Analyze Category Heatmap

```json
{
  "parameters": {
    "command": "cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-category-heatmap.py",
    "options": {}
  },
  "name": "Analyze Category Heatmap",
  "type": "n8n-nodes-base.executeCommand",
  "typeVersion": 1,
  "position": [1200, 300],
  "continueOnFail": true
}
```

**説明**: 曜日×カテゴリの相性を分析  
**出力**: `cortex/state/category-heatmap.json`  
**エラーハンドリング**: `continueOnFail: true` で失敗時も続行

---

#### Node 5: Analyze Health Score

```json
{
  "parameters": {
    "command": "cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-health.py --window-days 7",
    "options": {}
  },
  "name": "Analyze Health Score",
  "type": "n8n-nodes-base.executeCommand",
  "typeVersion": 1,
  "position": [1400, 300],
  "continueOnFail": true
}
```

**説明**: Cortex OS 全体の健康度スコアを計算  
**出力**: `cortex/state/health-score.json`  
**パラメータ**: `--window-days 7` で過去7日間を分析

---

#### Node 6: Analyze Recipe Metrics

```json
{
  "parameters": {
    "command": "cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-recipes.py",
    "options": {}
  },
  "name": "Analyze Recipe Metrics",
  "type": "n8n-nodes-base.executeCommand",
  "typeVersion": 1,
  "position": [1600, 300],
  "continueOnFail": true
}
```

**説明**: n8n Recipe の実行統計を収集  
**出力**: `cortex/state/recipe-metrics.json`  
**機能**: 成功率、失敗理由、平均実行時間を記録

---

## 🔧 実装手順

### Step 1: n8n UI を開く

```bash
open http://localhost:5678
```

### Step 2: Recipe 02 を編集

1. Workflows → "Recipe 02: Nightly KB Rebuild" をクリック
2. 編集モードに入る（右上の "Edit" ボタン）

### Step 3: ノードを追加

1. 既存の "Analyze Duration" ノードの後ろに新しいノードを追加
2. 検索窓で "Execute Command" を選択
3. 上記のJSON設定をコピーして貼り付け（または手動設定）
4. ノード名を設定：
   - "Analyze Category Heatmap"
   - "Analyze Health Score"
   - "Analyze Recipe Metrics"
5. 各ノードで **"Continue On Fail"** を有効化

### Step 4: ノードを接続

#### 既存の構成（Before）

```
[Schedule Trigger: 03:00 JST]
    ↓
[Analyze Rhythm]
    ↓
[Analyze Duration]
    ↓
[Rebuild KB Index]
    ↓
[Reload KB API]
    ↓
[Format Result Message]
    ↓
[Send to Slack]
```

#### 新しい構成（After）

```
[Schedule Trigger: 03:00 JST]
    ↓
[Analyze Rhythm]
    ↓
[Analyze Duration]
    ↓
[Analyze Category Heatmap] ← 🆕 NEW
    ↓
[Analyze Health Score] ← 🆕 NEW
    ↓
[Analyze Recipe Metrics] ← 🆕 NEW
    ↓
[Rebuild KB Index]
    ↓
[Reload KB API]
    ↓
[Format Result Message]
    ↓
[Send to Slack]
```

**変更点**: Analytics 3ステップを "Analyze Duration" と "Rebuild KB Index" の間に挿入します。
各ノードを線でつなぎます。

### Step 5: テスト実行

1. ワークフロー画面右上の **"Execute Workflow"** をクリック
2. 全てのノードが緑色（成功）になることを確認
3. エラーがあれば stderr を確認

### Step 6: 保存 & アクティベート

1. 右上の **"Save"** ボタンをクリック
2. ワークフローが **Active** 状態であることを確認
3. 次の 03:00 JST に自動実行される

---

## ✅ 動作確認

### 手動実行後の確認

```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1"

# 出力ファイルが更新されているか確認
ls -lh cortex/state/{category-heatmap,health-score,recipe-metrics}.json

# 各ファイルの中身を確認
cat cortex/state/category-heatmap.json | jq '.insights'
cat cortex/state/health-score.json | jq '.overall_score'
cat cortex/state/recipe-metrics.json | jq '.insights'
```

### 期待される出力

- **category-heatmap.json**: 曜日別の dominant category が記録される
- **health-score.json**: overall_score が 0-100 で記録される
- **recipe-metrics.json**: 各 Recipe の成功率が記録される

---

## 🎉 完成後の効果

### Before (統合前)

- Analytics データは手動実行時のみ更新
- データ鮮度が 24h 以上になることがある
- `/suggest` の精度が低下する可能性

### After (統合後)

- **毎晩 03:00 に自動更新**
- **データは常に最新**（< 24h）
- `/suggest` が常に最適な提案を返す
- Health Score が自動トラッキングされる
- Recipe 失敗が自動検出される

---

## 📊 期待されるメトリクス

### Health Score の改善

- **Data Freshness**: 60/100 → **95/100** (+35)
- **Overall Score**: 70/100 → **85/100** (+15)

### システムの自律性

- ✅ 完全自動化（人間の介入不要）
- ✅ 自己診断機能（Health Score）
- ✅ 失敗検出（Recipe Metrics）

---

## ⚠️ トラブルシューティング

### Python が見つからない

```bash
# n8n コンテナに入る
docker exec -it n8n /bin/sh

# Python のバージョン確認
python3 --version
```

n8n の公式イメージには Python が含まれていないため、カスタムイメージが必要です。

### スクリプトがエラーになる

```bash
# n8n の実行ログを確認
docker logs n8n --tail 100

# 手動でスクリプトをテスト
docker exec -it n8n python3 /workspace/dauberside.github.io-1/scripts/analyze-health.py
```

### ファイルが更新されない

- `continueOnFail: true` が設定されているか確認
- ワークフローが Active 状態か確認
- n8n の Execution History でエラーログを確認

---

## 📝 次のステップ

1. ✅ Recipe 02 統合完了
2. ⏳ 明日 03:00 の自動実行を確認
3. ⏳ /diagnose で Health Score を確認
4. ⏳ 7日間の安定稼働を監視

---

**Updated**: 2025-12-07  
**Version**: 1.0  
**Status**: Ready for Implementation
