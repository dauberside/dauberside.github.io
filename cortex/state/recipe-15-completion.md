# Recipe 15: Daily Analytics Runner - Complete

**完了日時**: 2025-12-20 13:25 JST
**所要時間**: 25分（予定40分、15分短縮）
**ステータス**: ✅ **READY FOR DEPLOYMENT**

---

## 実装サマリー

### Recipe 15: Daily Analytics Runner

**目的**: Data Freshness 95を永続的に維持
**スケジュール**: 毎朝 07:00 JST（Recipe 10の1時間前）
**実行時間**: ~5分（3 analytics scripts）

---

## ワークフロー構成

### Nodes: 8

1. **Daily Trigger 07:00 JST** (scheduleTrigger)
   - 毎日07:00 JSTに自動実行

2. **Calculate Timestamp** (code)
   - 実行開始時刻を記録

3. **Run analyze-duration.py** (executeCommand)
   - Duration patterns分析・更新

4. **Run analyze-rhythm.py** (executeCommand)
   - Rhythm patterns分析・更新

5. **Run analyze-category-heatmap.py** (executeCommand)
   - Category heatmap分析・更新

6. **Verify All Files Updated** (executeCommand)
   - 3ファイルの更新確認

7. **Prepare Success Log Entry** (code)
   - ログエントリ作成（success/warning/error）

8. **Write Success Log** (executeCommand)
   - JSONL形式でログ保存

### Connections: 7 (Linear Flow)

```
Trigger → Calculate → Duration → Rhythm → Category → Verify → Prepare Log → Write Log
```

---

## ログ仕様

### Log File
```
cortex/logs/recipe-15-YYYY-MM-DD.jsonl
```

### Log Format
```json
{
  "ts": "2025-12-20T07:05:00.000Z",
  "workflow": "Recipe 15: Daily Analytics Runner",
  "executionId": "xxx",
  "status": "success",
  "durationMs": 5234,
  "env": "production",
  "errorMessage": null,
  "meta": {
    "scriptsRun": 3,
    "durationSuccess": true,
    "rhythmSuccess": true,
    "categorySuccess": true
  }
}
```

### Status Types
- **success**: 全スクリプト正常終了
- **warning**: 一部スクリプトにwarning（実行は継続）
- **error**: スクリプト実行失敗

---

## テスト手順

### 1. n8nでの手動実行テスト

#### n8n UIでの操作
1. n8n にアクセス (`http://localhost:5678`)
2. Workflows → "Recipe 15: Daily Analytics Runner" を開く
3. 右上の "Execute Workflow" をクリック
4. 実行完了を待つ（~5分）

#### 期待結果
- ✅ 全8ノードが緑色（成功）
- ✅ 最終ノード "Write Success Log" 完了
- ✅ エラーなし

---

### 2. ログファイル確認

```bash
# ログファイルが生成されたか確認
ls -lh cortex/logs/recipe-15-$(date +%Y-%m-%d).jsonl

# ログ内容確認
cat cortex/logs/recipe-15-$(date +%Y-%m-%d).jsonl | jq

# 期待:
# - status: "success"
# - scriptsRun: 3
# - all *Success: true
```

---

### 3. State Files更新確認

```bash
# 3ファイルが更新されているか確認
ls -lht cortex/state/duration-patterns.json \
        cortex/state/rhythm-patterns.json \
        cortex/state/category-heatmap.json

# 期待: 最新のタイムスタンプ（数分以内）
```

---

### 4. Health Score確認

```bash
# Health Score を再計算
python3 scripts/analyze-health.py --window-days 7

# 期待結果:
# - average_age_hours: < 1.0
# - data_freshness score: 95
# - overall_score: 80
```

---

## デプロイ手順

### n8nへのインポート

#### Method 1: UI経由
1. n8n UI → Workflows
2. "+" → "Import from File"
3. `services/n8n/workflows/recipe-15-daily-analytics-runner.json` を選択
4. "Import" → "Save"
5. Workflow を "Active" に設定

#### Method 2: Docker経由（推奨）
```bash
# n8n container にファイルをコピー（必要に応じて）
docker cp services/n8n/workflows/recipe-15-daily-analytics-runner.json n8n:/data/

# n8n UIでインポート
# または、既にマウントされている場合は自動認識
```

---

## 運用監視

### 日次確認（オプション）

```bash
# 毎朝08:00頃（Recipe 15実行後）にチェック
cat cortex/logs/recipe-15-$(date +%Y-%m-%d).jsonl | jq '.status'

# "success" なら問題なし
# "warning" or "error" なら調査
```

### 週次確認（推奨）

```bash
# 週に1回、Health Scoreトレンド確認
python3 scripts/analyze-health.py --window-days 7 --verbose

# Freshness score が継続的に 95 を維持しているか確認
```

---

## 期待効果

### Data Freshness
| Metric | Before (Manual) | After (Automated) | Change |
|--------|-----------------|-------------------|--------|
| Avg Age | 26.8h | **< 1h** | -96% |
| Score | 60 → 95 (manual) | **95 (stable)** | Persistent |
| Maintenance | 手動実行必要 | **自動維持** | 0 effort |

### Overall Health
| Component | Before | After | Note |
|-----------|--------|-------|------|
| Overall | 80 | **80** | Stable維持 |
| Automation | 95 | 95 | Unchanged |
| Freshness | 95 (manual) | **95 (auto)** | 永続化 |
| Analytics | 45 | 45 | (今後改善可能) |

### Automation Coverage
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Daily Runs | Recipe 10, 13 | **+15** | 7 + 7 + 1 |
| Total Runs/Week | 15 | **22** | +47% |
| Coverage | 3 recipes | **4 recipes** | Recipe 15追加 |

---

## トラブルシューティング

### Q1: ログファイルが生成されない

**確認**:
```bash
# cortex/logs/ディレクトリが存在するか
ls -ld cortex/logs/

# n8nコンテナから書き込めるか
docker exec -it n8n touch /workspace/dauberside.github.io-1/cortex/logs/test.txt
```

**解決**:
```bash
mkdir -p cortex/logs
chmod 755 cortex/logs
```

---

### Q2: Analytics scriptがエラー

**確認**:
```bash
# 手動実行してエラー内容確認
python3 scripts/analyze-duration.py
python3 scripts/analyze-rhythm.py
python3 scripts/analyze-category-heatmap.py
```

**一般的な原因**:
- データ不足（task entries が少ない）
- JSON parsing エラー
- File permission問題

**解決**: エラーメッセージに従って修正

---

### Q3: Freshness scoreが上がらない

**確認**:
```bash
# State filesのタイムスタンプ確認
stat cortex/state/duration-patterns.json
stat cortex/state/rhythm-patterns.json
stat cortex/state/category-heatmap.json

# analyze-health.pyの参照先確認
grep "duration-patterns" scripts/analyze-health.py
```

**原因**: ファイル名の不一致 or パス間違い

---

## Next Steps

### Immediate（今日中）
1. ✅ Recipe 15実装完了
2. 🔄 n8nにインポート
3. 🔄 手動実行テスト
4. 🔄 ログ & Health Score確認

### Tomorrow（明日朝）
1. 自動実行確認（07:00 JST）
2. ログファイル確認
3. Freshness score確認（95維持？）

### Week 1（今週）
1. 毎朝の自動実行モニタリング
2. エラー/警告の有無確認
3. Freshness 95の安定性確認

### Future（Phase 3候補）
1. **Slack通知追加** - 失敗時のみアラート
2. **Health Score Dashboard** - Grafana/Metabase連携
3. **Analytics Health改善** - Category精度向上（45 → 60+）
4. **Recipe 02, 03 logging** - Automation coverage拡大

---

## 成果物

### 新規作成
1. `cortex/state/recipe-15-design.md` - 設計ドキュメント
2. `cortex/state/recipe-15-completion.md` - 完了報告（本ファイル）
3. `services/n8n/workflows/recipe-15-daily-analytics-runner.json` - Workflow定義

### 次回実行時に生成
1. `cortex/logs/recipe-15-2025-12-20.jsonl` - 今日の実行ログ
2. `cortex/logs/recipe-15-2025-12-21.jsonl` - 明日の自動実行ログ（07:00）

---

## レッスン・ラーンド

### ✅ What Went Well
1. **設計の明確化**: recipe-15-design.md で事前に全体像を整理
2. **既存パターン活用**: Recipe 13/14のlogging実装をそのまま適用
3. **高速実装**: 25分で完了（予定40分を15分短縮）

### 💡 Insights
1. **Freshness維持の重要性**: 手動実行では継続不可能 → 自動化必須
2. **Analytics依存性**: Analytics Health改善にはFreshness維持が前提
3. **Logging一貫性**: 全Recipe同じパターン → 運用効率向上

---

**Completed**: 2025-12-20 13:25 JST
**Deployment**: Ready（n8nインポート待ち）
**Next Action**: n8nに手動インポート → テスト実行
