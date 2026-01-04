# Recipe 15: Daily Analytics Runner - Design

**作成日**: 2025-12-20 13:20 JST
**目的**: Data Freshness 95を永続的に維持
**所要時間**: 30-40分（設計5分 + 実装15分 + ログ10分 + 検証10分）

---

## 背景

### 課題
- **現状**: Freshness 95は手動実行で達成（analyze-*.py を手動実行）
- **問題**: 24-48時間後に60-80に低下
- **影響**: Overall score 80 → 70に戻る可能性

### 解決策
**Recipe 15: Daily Analytics Runner** - 毎朝自動でanalyticsを更新

---

## 設計

### スケジュール
- **頻度**: 毎日 07:00 JST
- **理由**: Recipe 10（08:05）の1時間前 → 最新データでTODO sync
- **実行時間**: ~5分（3スクリプト × 1-2分）

### ワークフロー構造

```
Daily Trigger 07:00 JST
    ↓
Calculate Timestamp
    ↓
Run analyze-duration.py
    ↓
Run analyze-rhythm.py
    ↓
Run analyze-category-heatmap.py
    ↓
Verify All Files Updated
    ↓
Prepare Success Log Entry
    ↓
Write Success Log
```

---

## ノード仕様

### 1. Daily Trigger 07:00 JST
**Type**: `n8n-nodes-base.scheduleTrigger`

**Parameters**:
```json
{
  "rule": {
    "interval": [{ "field": "days" }]
  },
  "triggerTimes": {
    "item": [{ "hour": 7, "minute": 0 }]
  }
}
```

---

### 2. Calculate Timestamp
**Type**: `n8n-nodes-base.code`

**Code**:
```javascript
const now = new Date();
return {
  json: {
    startTime: now.toISOString(),
    date: now.toISOString().split('T')[0]
  }
};
```

---

### 3. Run analyze-duration.py
**Type**: `n8n-nodes-base.executeCommand`

**Command**:
```bash
cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-duration.py 2>&1
```

**Options**:
- `onError`: `continueErrorOutput`

---

### 4. Run analyze-rhythm.py
**Type**: `n8n-nodes-base.executeCommand`

**Command**:
```bash
cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-rhythm.py 2>&1
```

**Options**:
- `onError`: `continueErrorOutput`

---

### 5. Run analyze-category-heatmap.py
**Type**: `n8n-nodes-base.executeCommand`

**Command**:
```bash
cd /workspace/dauberside.github.io-1 && python3 scripts/analyze-category-heatmap.py 2>&1
```

**Options**:
- `onError`: `continueErrorOutput`

---

### 6. Verify All Files Updated
**Type**: `n8n-nodes-base.executeCommand`

**Command**:
```bash
ls -lh /workspace/dauberside.github.io-1/cortex/state/duration-patterns.json /workspace/dauberside.github.io-1/cortex/state/rhythm-patterns.json /workspace/dauberside.github.io-1/cortex/state/category-heatmap.json 2>&1
```

**Purpose**: ファイルが更新されたことを確認

---

### 7. Prepare Success Log Entry
**Type**: `n8n-nodes-base.code`

**Code**:
```javascript
// 📊 Success Log Entry for Recipe 15
const startTime = $('Calculate Timestamp').first().json.startTime;
const endTime = new Date().toISOString();

// Extract script outputs
const durationOutput = $('Run analyze-duration.py').first()?.json?.stdout || '';
const rhythmOutput = $('Run analyze-rhythm.py').first()?.json?.stdout || '';
const categoryOutput = $('Run analyze-category-heatmap.py').first()?.json?.stdout || '';

// Check for errors in outputs
const hasErrors =
  durationOutput.includes('Error') ||
  rhythmOutput.includes('Error') ||
  categoryOutput.includes('Error');

const logEntry = {
  ts: endTime,
  workflow: "Recipe 15: Daily Analytics Runner",
  executionId: $executionId,
  status: hasErrors ? "warning" : "success",
  durationMs: new Date(endTime) - new Date(startTime),
  env: "production",
  errorMessage: hasErrors ? "Some analytics scripts had warnings" : null,
  meta: {
    scriptsRun: 3,
    durationSuccess: durationOutput.includes('✅'),
    rhythmSuccess: rhythmOutput.includes('✅'),
    categorySuccess: categoryOutput.includes('✅')
  }
};

return { json: logEntry };
```

---

### 8. Write Success Log
**Type**: `n8n-nodes-base.executeCommand`

**Command**:
```bash
echo '{{ $json | toJsonString }}' >> /workspace/dauberside.github.io-1/cortex/logs/recipe-15-$(date +%Y-%m-%d).jsonl
```

---

## 接続フロー

```
Daily Trigger 07:00 JST
        ↓
Calculate Timestamp
        ↓
Run analyze-duration.py
        ↓
Run analyze-rhythm.py
        ↓
Run analyze-category-heatmap.py
        ↓
Verify All Files Updated
        ↓
Prepare Success Log Entry
        ↓
Write Success Log
        ↓
      (end)
```

---

## 期待効果

### Data Freshness
- **Before**: Manual execution → 26.8h average age → Score 60
- **After**: Daily 07:00 execution → <1h average age → **Score 95 (persistent)**

### Overall Score
- **Before**: 80/100 (manual freshness)
- **After**: **80/100 (stable)** - freshnessが自動維持される

### Automation Coverage
- **Current**: Recipe 10, 13, 11
- **After**: Recipe 10, 13, 11, **15**
- **Runs/week**: 15 → **22** (+7 daily runs)

---

## エラーハンドリング

### Script Failure
- `onError: continueErrorOutput` → 次のスクリプトも実行
- Log entry に `status: "warning"` を記録
- 完全失敗時は `status: "error"`

### File Not Updated
- Verify node でファイル存在確認
- 更新されていなければログに記録

---

## 検証方法

### 1. Manual Test
```bash
# n8n workflow を手動実行
# → cortex/state/*.json が更新されることを確認
```

### 2. Freshness Check
```bash
# Analytics実行後すぐに health check
python3 scripts/analyze-health.py --window-days 7

# 期待結果:
# - average_age_hours: < 1.0
# - freshness score: 95
```

### 3. Log Verification
```bash
# ログファイル確認
cat cortex/logs/recipe-15-$(date +%Y-%m-%d).jsonl | jq

# 期待:
# - status: "success"
# - scriptsRun: 3
# - all *Success: true
```

---

## Next Steps（実装後）

### Immediate
1. **手動実行テスト** - workflow動作確認
2. **翌朝確認** - 07:00自動実行を確認
3. **1週間モニタリング** - Freshness 95が維持されるか

### Future（Optional）
1. **Slack通知追加** - 失敗時のみ通知
2. **Health Score Dashboard** - 日次トレンド可視化
3. **Analytics Health改善** - Category/Duration精度向上

---

**Created**: 2025-12-20 13:20 JST
**Implementation**: Recipe 15 workflow JSON
**Expected Impact**: Freshness 95 → Persistent, Overall 80 → Stable
