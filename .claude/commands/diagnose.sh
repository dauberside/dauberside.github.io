#!/bin/bash

# Cortex OS System Diagnostics v1.0
# Comprehensive health check for Cortex OS v1.2 "Autonomy"

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Score tracking
TOTAL_SCORE=0
MAX_SCORE=100

# Arrays for warnings and recommendations
declare -a WARNINGS
declare -a RECOMMENDATIONS

# Timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S JST")

echo "# 🏥 Cortex OS Health Report"
echo ""
echo "**Generated**: $TIMESTAMP"
echo "**System**: Cortex OS v1.2 \"Autonomy\""
echo ""
echo "---"
echo ""
echo "## 📊 Component Status"
echo ""
echo "### Core Services"

# ====================
# 1. Obsidian REST API Check (20 points)
# ====================
echo -n "- 🔌 **Obsidian REST API**: "

API_START=$(date +%s)
API_RESPONSE=$(curl -k -s --max-time 5 https://127.0.0.1:27124/ 2>&1)
API_END=$(date +%s)
API_TIME=$(((API_END - API_START) * 1000))

if echo "$API_RESPONSE" | grep -q '"status"'; then
    echo "${GREEN}✅ OK${NC} (response: ${API_TIME}ms)"
    if [ $API_TIME -gt 3000 ]; then
        TOTAL_SCORE=$((TOTAL_SCORE + 10))
        WARNINGS+=("Obsidian API response slow (${API_TIME}ms)")
        RECOMMENDATIONS+=("Consider restarting Obsidian if performance degrades further")
    else
        TOTAL_SCORE=$((TOTAL_SCORE + 20))
    fi
else
    echo "${RED}❌ FAILED${NC} (Connection refused)"
    WARNINGS+=("Obsidian REST API unreachable")
    RECOMMENDATIONS+=("HIGH: Restart Obsidian, verify Local REST API plugin (PORT 27124)")
fi

# ====================
# 2. n8n Container Check (20 points)
# ====================
echo -n "- 🐳 **n8n Container**: "

N8N_STATUS=$(docker ps --filter "name=n8n" --format "{{.Status}}" 2>/dev/null || echo "not_found")

if echo "$N8N_STATUS" | grep -qi "healthy"; then
    if echo "$N8N_STATUS" | grep -qi "Up.*day"; then
        echo "${GREEN}✅ Healthy${NC} ($N8N_STATUS)"
        TOTAL_SCORE=$((TOTAL_SCORE + 20))
    else
        echo "${YELLOW}⚠️ Healthy but recent restart${NC} ($N8N_STATUS)"
        TOTAL_SCORE=$((TOTAL_SCORE + 10))
        WARNINGS+=("n8n container recently restarted")
    fi
elif echo "$N8N_STATUS" | grep -qi "Up"; then
    echo "${YELLOW}⚠️ Running (no health check)${NC} ($N8N_STATUS)"
    TOTAL_SCORE=$((TOTAL_SCORE + 15))
else
    echo "${RED}❌ NOT RUNNING${NC}"
    WARNINGS+=("n8n container not running")
    RECOMMENDATIONS+=("HIGH: Start n8n: docker compose up -d n8n")
fi

echo ""
echo "### Data Freshness"

# ====================
# 3. Daily Digest Check (15 points)
# ====================
echo -n "- 📅 **Daily Digest**: "

TODAY=$(date +%Y-%m-%d)
TODAY_DIGEST="cortex/daily/${TODAY}-digest.md"

if [ -f "$TODAY_DIGEST" ]; then
    DIGEST_SIZE=$(ls -lh "$TODAY_DIGEST" | awk '{print $5}')
    echo "${GREEN}✅ Fresh${NC} (${TODAY}-digest.md, $DIGEST_SIZE)"
    TOTAL_SCORE=$((TOTAL_SCORE + 15))
else
    YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
    YESTERDAY_DIGEST="cortex/daily/${YESTERDAY}-digest.md"

    if [ -f "$YESTERDAY_DIGEST" ]; then
        echo "${YELLOW}⚠️ Today's missing, yesterday exists${NC}"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
        WARNINGS+=("Today's daily digest not found")
        RECOMMENDATIONS+=("Check Recipe 03 execution at 08:00 JST, or run manually")
    else
        echo "${RED}❌ No recent digests${NC}"
        WARNINGS+=("No daily digests found for today or yesterday")
        RECOMMENDATIONS+=("HIGH: Check Recipe 03, Obsidian integration")
    fi
fi

# ====================
# 4. Weekly Summary Check (10 points)
# ====================
echo -n "- 📊 **Weekly Summary**: "

LATEST_WEEKLY=$(ls -t cortex/weekly/*.md 2>/dev/null | head -1)
if [ -n "$LATEST_WEEKLY" ]; then
    WEEKLY_NAME=$(basename "$LATEST_WEEKLY")
    WEEKLY_DATE=$(stat -f "%Sm" -t "%Y-%m-%d" "$LATEST_WEEKLY" 2>/dev/null || stat -c "%y" "$LATEST_WEEKLY" | cut -d' ' -f1)

    # Check if it's current week
    CURRENT_WEEK=$(date +%Y-W%V)
    if echo "$WEEKLY_NAME" | grep -q "$CURRENT_WEEK"; then
        echo "${GREEN}✅ Current${NC} ($WEEKLY_NAME)"
        TOTAL_SCORE=$((TOTAL_SCORE + 10))
    else
        echo "${YELLOW}⚠️ Last week${NC} ($WEEKLY_NAME, updated $WEEKLY_DATE)"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
        WARNINGS+=("Weekly summary not updated for current week (it may be early in week)")
    fi
else
    echo "${RED}❌ No weekly summaries${NC}"
    WARNINGS+=("No weekly summaries found")
fi

# ====================
# 5. TODO.md Check (15 points)
# ====================
echo -n "- 📝 **TODO.md**: "

if [ -f "TODO.md" ]; then
    TODO_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" TODO.md 2>/dev/null || stat -c "%y" TODO.md | cut -d. -f1)
    TODO_SIZE=$(ls -lh TODO.md | awk '{print $5}')
    TODO_DATE=$(echo "$TODO_MODIFIED" | cut -d' ' -f1)

    if [ "$TODO_DATE" = "$TODAY" ]; then
        echo "${GREEN}✅ Updated Today${NC} ($TODO_MODIFIED, $TODO_SIZE)"
        TOTAL_SCORE=$((TOTAL_SCORE + 15))
    elif [ "$TODO_DATE" = "$YESTERDAY" ]; then
        echo "${YELLOW}⚠️ Updated Yesterday${NC} ($TODO_MODIFIED)"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
        WARNINGS+=("TODO.md not updated today")
        RECOMMENDATIONS+=("Check Recipe 10 execution at 08:05 JST")
    else
        echo "${RED}❌ Stale${NC} (last updated: $TODO_MODIFIED)"
        WARNINGS+=("TODO.md older than 2 days")
        RECOMMENDATIONS+=("HIGH: Check Recipe 10, run manually if needed")
    fi
else
    echo "${RED}❌ NOT FOUND${NC}"
    WARNINGS+=("TODO.md file not found")
    RECOMMENDATIONS+=("CRITICAL: Restore TODO.md from backup")
fi

# ====================
# 6. KB Index Check (15 points)
# ====================
echo -n "- 🧠 **KB Index**: "

KB_INDEX="kb/index/embeddings.json"
if [ -f "$KB_INDEX" ]; then
    KB_SIZE=$(ls -lh "$KB_INDEX" | awk '{print $5}')
    KB_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$KB_INDEX" 2>/dev/null || stat -c "%y" "$KB_INDEX" | cut -d. -f1)
    KB_DATE=$(echo "$KB_MODIFIED" | cut -d' ' -f1)

    # Check if modified within last 7 days
    DAYS_OLD=$(( ($(date +%s) - $(stat -f "%m" "$KB_INDEX" 2>/dev/null || stat -c "%Y" "$KB_INDEX")) / 86400 ))

    if [ $DAYS_OLD -le 7 ]; then
        echo "${GREEN}✅ Fresh${NC} ($KB_SIZE, updated $KB_MODIFIED)"
        TOTAL_SCORE=$((TOTAL_SCORE + 15))
    elif [ $DAYS_OLD -le 30 ]; then
        echo "${YELLOW}⚠️ Stale${NC} ($DAYS_OLD days old, $KB_SIZE)"
        TOTAL_SCORE=$((TOTAL_SCORE + 5))
        WARNINGS+=("KB index older than 7 days")
        RECOMMENDATIONS+=("Run pnpm kb:build or check Recipe 02 (03:00 JST)")
    else
        echo "${RED}❌ Very old${NC} ($DAYS_OLD days old)"
        WARNINGS+=("KB index very old (>30 days)")
        RECOMMENDATIONS+=("HIGH: Rebuild KB immediately: pnpm kb:build")
    fi
else
    echo "${RED}❌ NOT FOUND${NC}"
    WARNINGS+=("KB index file not found")
    RECOMMENDATIONS+=("CRITICAL: Build KB: pnpm kb:build")
fi

# ====================
# 7. tomorrow.json Check (5 points)
# ====================
echo -n "- 🌅 **tomorrow.json**: "

TOMORROW_JSON="cortex/state/tomorrow.json"
if [ -f "$TOMORROW_JSON" ]; then
    TOMORROW_TIME=$(jq -r '.generated_at' "$TOMORROW_JSON" 2>/dev/null || echo "invalid")
    TOMORROW_CANDIDATES=$(jq -r '.tomorrow_candidates | length' "$TOMORROW_JSON" 2>/dev/null || echo "0")

    if [ "$TOMORROW_TIME" != "invalid" ] && [ "$TOMORROW_TIME" != "null" ]; then
        # Parse timestamp and check if it's within last 24 hours
        TOMORROW_DATE=$(echo "$TOMORROW_TIME" | cut -dT -f1)

        if [ "$TOMORROW_DATE" = "$TODAY" ] || [ "$TOMORROW_DATE" = "$YESTERDAY" ]; then
            echo "${GREEN}✅ Recent${NC} (generated $TOMORROW_TIME, $TOMORROW_CANDIDATES candidates)"
            TOTAL_SCORE=$((TOTAL_SCORE + 5))
        else
            echo "${YELLOW}⚠️ Old${NC} (generated $TOMORROW_TIME)"
            TOTAL_SCORE=$((TOTAL_SCORE + 2))
            WARNINGS+=("tomorrow.json older than 24h")
            RECOMMENDATIONS+=("Check Recipe 13 execution at 22:00 JST")
        fi
    else
        echo "${RED}❌ Invalid JSON${NC}"
        WARNINGS+=("tomorrow.json is invalid or corrupted")
        RECOMMENDATIONS+=("HIGH: Check Recipe 13, regenerate if needed")
    fi
else
    echo "${RED}❌ NOT FOUND${NC}"
    WARNINGS+=("tomorrow.json not found")
    RECOMMENDATIONS+=("Check Recipe 13 execution")
fi

# ====================
# Health Score & Grade
# ====================
echo ""
echo "---"
echo ""
echo "## 🎯 Health Score"
echo ""

# Calculate grade
if [ $TOTAL_SCORE -ge 90 ]; then
    GRADE="Excellent ✅"
    GRADE_COLOR=$GREEN
elif [ $TOTAL_SCORE -ge 70 ]; then
    GRADE="Good ⚠️"
    GRADE_COLOR=$YELLOW
elif [ $TOTAL_SCORE -ge 50 ]; then
    GRADE="Fair ⚠️"
    GRADE_COLOR=$YELLOW
else
    GRADE="Critical ❌"
    GRADE_COLOR=$RED
fi

echo "**Overall Health**: ${GRADE_COLOR}${TOTAL_SCORE}%${NC} ($GRADE)"
echo ""

if [ $TOTAL_SCORE -ge 90 ]; then
    echo "All systems operational. Cortex OS is functioning autonomously as designed."
elif [ $TOTAL_SCORE -ge 70 ]; then
    echo "System is healthy with minor issues. No immediate action required."
elif [ $TOTAL_SCORE -ge 50 ]; then
    echo "Some components need attention. Review warnings and recommendations."
else
    echo "Critical issues detected. Immediate action required to restore autonomous operation."
fi

# ====================
# Warnings Section
# ====================
echo ""
echo "---"
echo ""

if [ ${#WARNINGS[@]} -eq 0 ]; then
    echo "## ✅ No Warnings"
    echo ""
    echo "All components are functioning within normal parameters."
else
    echo "## ⚠️ Warnings"
    echo ""
    for warning in "${WARNINGS[@]}"; do
        echo "- ${YELLOW}⚠️${NC} $warning"
    done
fi

# ====================
# Recommendations Section
# ====================
echo ""
echo "---"
echo ""

if [ ${#RECOMMENDATIONS[@]} -eq 0 ]; then
    echo "## 💡 Recommendations"
    echo ""
    echo "- Continue normal operation"
    echo "- Monitor system health daily with \`/diagnose\`"
    echo "- Review Recipe execution logs periodically"
else
    echo "## 💡 Recommendations"
    echo ""

    # Sort by priority (HIGH first)
    for rec in "${RECOMMENDATIONS[@]}"; do
        if echo "$rec" | grep -q "^HIGH:"; then
            echo "- ${RED}🔴${NC} $(echo "$rec" | sed 's/^HIGH: //')"
        elif echo "$rec" | grep -q "^CRITICAL:"; then
            echo "- ${RED}🔴 CRITICAL:${NC} $(echo "$rec" | sed 's/^CRITICAL: //')"
        fi
    done

    for rec in "${RECOMMENDATIONS[@]}"; do
        if ! echo "$rec" | grep -q "^HIGH:" && ! echo "$rec" | grep -q "^CRITICAL:"; then
            echo "- 💡 $rec"
        fi
    done
fi

# ====================
# System Metrics
# ====================
echo ""
echo "---"
echo ""
echo "## 📈 System Metrics"
echo ""

# Count digests
DIGEST_COUNT=$(ls cortex/daily/*.md 2>/dev/null | wc -l | tr -d ' ')
echo "- **Total Daily Digests**: $DIGEST_COUNT files"

# KB chunks (count "id": occurrences)
if [ -f "$KB_INDEX" ]; then
    KB_CHUNKS=$(grep -o '"id":' "$KB_INDEX" 2>/dev/null | wc -l | tr -d ' ' || echo "unknown")
    echo "- **KB Chunks**: $KB_CHUNKS indexed"
fi

# Active recipes
echo "- **Autonomous Loops**: 3 active (Recipe 02, 03, 10)"
echo "- **n8n Status**: $N8N_STATUS"

# ====================
# Footer
# ====================
echo ""
echo "---"
echo ""
echo "**Next Diagnostic**: Run \`/diagnose\` again in 24 hours"
echo ""

if [ $TOTAL_SCORE -ge 90 ]; then
    echo "**Autonomous Status**: ${GREEN}🟢 Online${NC}"
elif [ $TOTAL_SCORE -ge 70 ]; then
    echo "**Autonomous Status**: ${YELLOW}🟡 Operational${NC}"
else
    echo "**Autonomous Status**: ${RED}🔴 Degraded${NC}"
fi
