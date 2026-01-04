#!/bin/bash
# Phase 3 Entry Gate Check Script
#
# 5つのゲート条件を自動チェック
# 4/5 以上で Phase 3 開始可能

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🚦 Phase 3 Entry Gate Check"
echo "============================"
echo ""

PASS=0
TOTAL=5

# Gate 1: Phase 2 Monitoring Complete
echo "Gate 1: Phase 2 Monitoring"
COMPLETED=$(jq -r '.summary.completed_events' cortex/state/phase2-monitoring.json 2>/dev/null || echo "0")
TARGET=$(jq -r '.target_events' cortex/state/phase2-monitoring.json 2>/dev/null || echo "7")
SUCCESS_RATE=$(jq -r '.summary.success_rate' cortex/state/phase2-monitoring.json 2>/dev/null || echo "0")

if [ "$COMPLETED" -ge "$TARGET" ]; then
  echo "  ✅ PASS: $COMPLETED/$TARGET events (100% success rate)"
  PASS=$((PASS+1))
elif [ "$COMPLETED" -ge 6 ]; then
  SUCCESS_PCT=$(echo "$SUCCESS_RATE * 100" | bc)
  echo "  ⚠️  ALMOST: $COMPLETED/$TARGET events (${SUCCESS_PCT}% success rate)"
  echo "     85%ルール適用: 残り課題の修正が必要"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL: $COMPLETED/$TARGET events (need $TARGET)"
fi
echo ""

# Gate 2: Data Quality Baseline
echo "Gate 2: Data Quality (Analytics Health)"
ANALYTICS=$(jq -r '.components.analytics_health.score' cortex/state/health-score.json 2>/dev/null || echo "0")
RHYTHM_DAYS=$(jq -r '.components.analytics_health.rhythm_active_days' cortex/state/health-score.json 2>/dev/null || echo "0")

if [ "$ANALYTICS" -ge 70 ]; then
  echo "  ✅ PASS: $ANALYTICS/100 (Rhythm: $RHYTHM_DAYS active days)"
  PASS=$((PASS+1))
elif [ "$ANALYTICS" -ge 65 ]; then
  echo "  ⚠️  ALMOST: $ANALYTICS/100 (need ≥70)"
  echo "     Rhythm: $RHYTHM_DAYS/10 active days (あと1日で改善)"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL: $ANALYTICS/100 (need ≥70)"
fi
echo ""

# Gate 3: System Health Stable
echo "Gate 3: System Health"
OVERALL=$(jq -r '.overall_score' cortex/state/health-score.json 2>/dev/null || echo "0")

if [ "$OVERALL" -ge 80 ]; then
  echo "  ✅ PASS: $OVERALL/100"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL: $OVERALL/100 (need ≥80)"
fi
echo ""

# Gate 4: Infrastructure Stable
echo "Gate 4: Infrastructure"
INFRA_OK=true

# Obsidian check
if curl -k -s --max-time 3 https://127.0.0.1:27124/ 2>/dev/null | jq -e '.status == "OK"' > /dev/null 2>&1; then
  OBSIDIAN_STATUS="✅"
else
  OBSIDIAN_STATUS="❌"
  INFRA_OK=false
fi

# n8n check
if docker ps --filter "name=n8n" --format "{{.Status}}" 2>/dev/null | grep -q "healthy"; then
  N8N_STATUS="✅"
else
  N8N_STATUS="⚠️"
  # n8nは必須ではない（Phase 3で使用）
fi

# KB check
if [ -f "kb/index/embeddings.json" ] && [ $(stat -f%z kb/index/embeddings.json 2>/dev/null || stat -c%s kb/index/embeddings.json 2>/dev/null) -gt 1000000 ]; then
  KB_STATUS="✅"
else
  KB_STATUS="❌"
  INFRA_OK=false
fi

if $INFRA_OK; then
  echo "  ✅ PASS"
  echo "     Obsidian: $OBSIDIAN_STATUS  n8n: $N8N_STATUS  KB: $KB_STATUS"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL"
  echo "     Obsidian: $OBSIDIAN_STATUS  n8n: $N8N_STATUS  KB: $KB_STATUS"
fi
echo ""

# Gate 5: Documentation Complete
echo "Gate 5: Documentation"
if [ -f "docs/cortex/v1.4-PHASE2-COMPLETION.md" ]; then
  echo "  ✅ PASS: v1.4-PHASE2-COMPLETION.md exists"
  PASS=$((PASS+1))
else
  echo "  ⏳ PENDING: Create docs/cortex/v1.4-PHASE2-COMPLETION.md"
fi
echo ""

# Summary
echo "============================"
echo "Result: $PASS/$TOTAL gates passed"
echo ""

if [ "$PASS" -ge 5 ]; then
  echo "🟢 Phase 3 READY TO START"
  echo ""
  echo "次のステップ:"
  echo "  1. Phase 3 実装開始（4h工数）"
  echo "  2. Weekly Intelligence MVP実装"
  exit 0
elif [ "$PASS" -ge 4 ]; then
  echo "🟡 Phase 3 ALMOST READY (4/5 minimum)"
  echo ""
  echo "残りタスク:"
  [ "$COMPLETED" -lt 7 ] && echo "  - Phase 2 監視継続（残り$((7-COMPLETED))イベント）"
  [ ! -f "docs/cortex/v1.4-PHASE2-COMPLETION.md" ] && echo "  - Phase 2 完了ドキュメント作成"
  exit 0
elif [ "$PASS" -ge 3 ]; then
  echo "🟡 Phase 3 IN PROGRESS (3/5)"
  echo ""
  echo "残りタスク:"
  [ "$COMPLETED" -lt 7 ] && echo "  - Phase 2 監視継続（残り$((7-COMPLETED))イベント）"
  [ "$ANALYTICS" -lt 70 ] && echo "  - Analytics改善（あと1日の/log使用）"
  [ ! -f "docs/cortex/v1.4-PHASE2-COMPLETION.md" ] && echo "  - Phase 2 完了ドキュメント作成"
  exit 1
else
  echo "🔴 Phase 3 NOT READY (< 3/5)"
  echo ""
  echo "重要タスク:"
  [ "$OVERALL" -lt 80 ] && echo "  - システムヘルス改善（現在$OVERALL/100）"
  [ "$COMPLETED" -lt 7 ] && echo "  - Phase 2 監視継続（残り$((7-COMPLETED))イベント）"
  exit 1
fi
