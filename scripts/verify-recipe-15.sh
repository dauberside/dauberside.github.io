#!/bin/bash
# Recipe 15: Daily Analytics Runner - Post-Test Verification Script
# Run this after manual test execution in n8n

set -e

echo "🔍 Recipe 15 Verification Script"
echo "=================================="
echo ""

# Check both UTC and JST dates for log files
echo "📋 Step 1: Check Log File Created"
echo "----------------------------------"
UTC_DATE=$(TZ=UTC date +%Y-%m-%d)
JST_DATE=$(TZ=Asia/Tokyo date +%Y-%m-%d)

LOG_FOUND=0
for d in "$UTC_DATE" "$JST_DATE"; do
  f="cortex/logs/recipe-15-$d.jsonl"
  if [ -f "$f" ]; then
    echo "✅ Found: $f"
    echo ""
    echo "Log entry:"
    tail -n 1 "$f" | jq '
      {
        workflow: .workflow,
        status: .status,
        durationMs: .durationMs,
        scriptsRun: .meta.scriptsRun,
        durationSuccess: .meta.durationSuccess,
        rhythmSuccess: .meta.rhythmSuccess,
        categorySuccess: .meta.categorySuccess
      }
    '
    LOG_FOUND=1
    break
  fi
done

if [ $LOG_FOUND -eq 0 ]; then
  echo "❌ No Recipe 15 log found for dates: $UTC_DATE or $JST_DATE"
  echo "   Expected at: cortex/logs/recipe-15-YYYY-MM-DD.jsonl"
  exit 1
fi

echo ""
echo "📁 Step 2: Verify State Files Refreshed"
echo "----------------------------------------"
echo "State file timestamps (should be within last few minutes):"
ls -lht cortex/state/duration-patterns.json \
        cortex/state/rhythm-patterns.json \
        cortex/state/category-heatmap.json | \
  awk '{print $9 ": " $6 " " $7 " " $8}'

echo ""
echo "📊 Step 3: Confirm Health Score"
echo "--------------------------------"
if [ -f cortex/state/health-score.json ]; then
  cat cortex/state/health-score.json | jq '
    {
      overall_score: .overall_score,
      data_freshness: {
        score: .components.data_freshness.score,
        avg_age_hours: .components.data_freshness.average_age_hours
      },
      automation: {
        score: .components.automation.score,
        runs: .components.automation.runs,
        success_rate: .components.automation.success_rate
      }
    }
  '

  # Check if Freshness is still 95
  FRESHNESS=$(cat cortex/state/health-score.json | jq '.components.data_freshness.score')
  if [ "$FRESHNESS" = "95" ]; then
    echo ""
    echo "✅ Data Freshness maintained at 95/100"
  else
    echo ""
    echo "⚠️  Data Freshness changed from 95 to $FRESHNESS"
  fi
else
  echo "❌ Health score file not found: cortex/state/health-score.json"
  echo "   Run: python3 scripts/analyze-health.py --window-days 7"
  exit 1
fi

echo ""
echo "✅ Verification Complete!"
echo ""
echo "Next Steps:"
echo "1. ✅ Recipe 15 executed successfully"
echo "2. 🕐 Wait until tomorrow morning (07:00 JST)"
echo "3. 🔄 Run this script again to verify scheduled execution"
