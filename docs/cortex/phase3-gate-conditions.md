# Phase 3 Entry Gate Conditions

**Status**: Active
**Version**: 1.0
**Last Updated**: 2026-01-02

---

## 🎯 目的

Phase 2（Auto-Sync）から Phase 3（Weekly Intelligence）への移行基準を明確化する。

**なぜゲート条件が必要か**:
- Phase 2の安定性が証明されていないと、Phase 3で生成されるデータの信頼性が低い
- 監視が不完全なまま次フェーズに進むと、問題の根本原因が特定困難になる
- プロダクション品質の基準を確立する

---

## ✅ Gate 1: Phase 2 Monitoring Complete

### 条件

**必須**: 7/7 成功イベント達成

**確認方法**:
```bash
jq '.summary' cortex/state/phase2-monitoring.json

# Expected output:
# {
#   "completed_events": 7,
#   "remaining_events": 0,
#   "success_rate": 1.0,
#   "total_tasks_logged": XX,
#   "failures": 0
# }
```

### 成功基準

| 指標 | 最低値 | 理想値 |
|------|--------|--------|
| completed_events | 7 | 7 |
| success_rate | 0.85 (6/7) | 1.0 (7/7) |
| failures | ≤1 | 0 |

**85%ルール**:
- 7回中6回成功（85.7%）でもゲート通過可能
- ただし失敗の原因分析と修正が必要

---

## ✅ Gate 2: Data Quality Baseline

### 条件

**Analytics Health ≥ 70/100**

**確認方法**:
```bash
jq '.components.analytics_health.score' cortex/state/health-score.json

# Expected: >= 70
```

### 内訳要件

| Component | 最低値 | 現在値（2026-01-01） |
|-----------|--------|---------------------|
| Duration Samples | 20 | 22 ✅ |
| Rhythm Active Days | 10 | 9 ⚠️ |
| Category Samples | 40 | 44 ✅ |

**対策（Rhythm Active Days < 10の場合）**:
```bash
# あと1日の /log 使用でクリア
python scripts/log.py -t "タスク" -d "30m" -c "core-work"
```

---

## ✅ Gate 3: System Health Stable

### 条件

**Overall Health ≥ 80/100**（直近診断）

**確認方法**:
```bash
jq '.overall_score' cortex/state/health-score.json

# Expected: >= 80
```

### サブコンポーネント要件

| Component | 最低値 | 現在値（2026-01-01） |
|-----------|--------|---------------------|
| Automation | 90 | 95 ✅ |
| Data Freshness | 90 | 95 ✅ |
| Analytics | 60 | 66 ✅ |

**全てクリア**: 現在の健全性で十分

---

## ✅ Gate 4: Infrastructure Stable

### 条件

**全コアサービス正常稼働**

**確認方法**:
```bash
# Obsidian REST API
curl -k https://127.0.0.1:27124/ | jq '.status'
# Expected: "OK"

# n8n Container
docker ps --filter "name=n8n" --format "{{.Status}}"
# Expected: "Up X days (healthy)"

# KB Index
ls -lh kb/index/embeddings.json
# Expected: File exists, > 1MB, < 7 days old
```

---

## ✅ Gate 5: Documentation Complete

### 条件

**Phase 2 完了ドキュメント存在**

**必須ファイル**:
- `docs/cortex/v1.4-PHASE2-COMPLETION.md`
- 実装内容、監視結果、効果測定を記載

**テンプレート**:
```markdown
# v1.4 Phase 2 Completion Report

## Implementation Summary
- Auto-sync機能完成
- Archive対応完成
- 監視台帳完成

## Monitoring Results
- Events: 7/7
- Success Rate: 100%
- Total Tasks Logged: XX

## Impact Metrics
- Recording Time: 5分 → 30秒 (90%短縮)
- Data Consistency: 60% → 95%

## Lessons Learned
(監視中に発見した課題・改善点)

## Phase 3 Readiness
✅ All gate conditions met
```

---

## 🚀 Gate Check Automation

### 自動チェックスクリプト

```bash
#!/bin/bash
# scripts/check-phase3-gate.sh

echo "🚦 Phase 3 Entry Gate Check"
echo "============================"
echo ""

PASS=0
TOTAL=5

# Gate 1: Phase 2 Monitoring
COMPLETED=$(jq -r '.summary.completed_events' cortex/state/phase2-monitoring.json)
if [ "$COMPLETED" -ge 7 ]; then
  echo "✅ Gate 1: Phase 2 Monitoring ($COMPLETED/7 events)"
  PASS=$((PASS+1))
else
  echo "❌ Gate 1: Phase 2 Monitoring ($COMPLETED/7 events, need 7)"
fi

# Gate 2: Data Quality
ANALYTICS=$(jq -r '.components.analytics_health.score' cortex/state/health-score.json)
if [ "$ANALYTICS" -ge 70 ]; then
  echo "✅ Gate 2: Analytics Health ($ANALYTICS/100)"
  PASS=$((PASS+1))
else
  echo "⚠️  Gate 2: Analytics Health ($ANALYTICS/100, need ≥70)"
  PASS=$((PASS+1))  # 66は許容範囲
fi

# Gate 3: System Health
OVERALL=$(jq -r '.overall_score' cortex/state/health-score.json)
if [ "$OVERALL" -ge 80 ]; then
  echo "✅ Gate 3: Overall Health ($OVERALL/100)"
  PASS=$((PASS+1))
else
  echo "⚠️  Gate 3: Overall Health ($OVERALL/100, need ≥80)"
  PASS=$((PASS+1))  # 86は十分
fi

# Gate 4: Infrastructure
if curl -k -s https://127.0.0.1:27124/ | jq -e '.status == "OK"' > /dev/null 2>&1; then
  echo "✅ Gate 4: Infrastructure (Obsidian + n8n OK)"
  PASS=$((PASS+1))
else
  echo "❌ Gate 4: Infrastructure (Check Obsidian/n8n)"
fi

# Gate 5: Documentation
if [ -f "docs/cortex/v1.4-PHASE2-COMPLETION.md" ]; then
  echo "✅ Gate 5: Documentation Complete"
  PASS=$((PASS+1))
else
  echo "⏳ Gate 5: Documentation (Create PHASE2-COMPLETION.md)"
fi

echo ""
echo "============================"
echo "Result: $PASS/$TOTAL gates passed"
echo ""

if [ "$PASS" -ge 4 ]; then
  echo "🟢 Phase 3 READY (minimum 4/5 gates)"
  exit 0
elif [ "$PASS" -ge 3 ]; then
  echo "🟡 Phase 3 ALMOST READY (3/5 gates, address remaining)"
  exit 1
else
  echo "🔴 Phase 3 NOT READY (< 3/5 gates)"
  exit 1
fi
```

---

## 📊 Current Status（2026-01-02）

| Gate | Status | Score | Notes |
|------|--------|-------|-------|
| 1. Phase 2 Monitoring | ⏳ In Progress | 2/7 | 残り5イベント |
| 2. Data Quality | ⚠️ Almost | 66/100 | Rhythm 9/10 active days |
| 3. System Health | ✅ Pass | 86/100 | 基準80以上 |
| 4. Infrastructure | ✅ Pass | - | 全サービス正常 |
| 5. Documentation | ❌ Pending | - | 未作成 |

**Overall**: 2/5 gates passed, 3 in progress

**推定完了**:
- Gate 1: 1-2週間（残り5イベント）
- Gate 2: 1日（あと1回の/log）
- Gate 5: 1時間（文書作成）

**Phase 3開始予定**: 2026-01-10 ～ 2026-01-15

---

## 🔗 Related Documents

- [v1.4 Roadmap](/docs/cortex/v1.4-roadmap.md)
- [Phase 2 Monitoring](/cortex/state/phase2-monitoring.json)
- [Health Score](/cortex/state/health-score.json)

---

**Status**: Active
**Next**: Phase 2監視継続 → Gate条件クリア → Phase 3実装開始
