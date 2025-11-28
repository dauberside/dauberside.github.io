# Cortex OS System Diagnostics

Run comprehensive health checks on Cortex OS v1.2 "Autonomy" components.

## System Architecture Context

Cortex OS is an **external autonomous nervous system** that:
- Maintains cognitive loops (daily/weekly)
- Manages task workflows automatically
- Preserves long-term memory (KB)
- Operates 24/7 without human intervention

This diagnostic command verifies all critical components are functioning correctly.

---

## Checks to Perform

Execute the following health checks in sequence and generate a comprehensive status report:

### 1. Obsidian REST API Connection
```bash
# Check if Obsidian REST API is responding
curl -k -s --max-time 5 https://127.0.0.1:27124/ 2>&1
```

**Expected**: `{"status":"OK",...}`

**Scoring**:
- ✅ Status OK: +20 points
- ⚠️ Slow response (>3s): +10 points
- ❌ Connection failed: 0 points

---

### 2. n8n Container Status
```bash
# Check n8n container health
docker ps --filter "name=n8n" --format "{{.Status}}"
```

**Expected**: `Up X days (healthy)` or `Up X hours (healthy)`

**Scoring**:
- ✅ Healthy + Up >1 day: +20 points
- ⚠️ Healthy but recently restarted: +10 points
- ❌ Not running or unhealthy: 0 points

---

### 3. Latest Daily Digest
```bash
# Check if today's digest exists
TODAY=$(date +%Y-%m-%d)
ls -lh "cortex/daily/${TODAY}-digest.md" 2>/dev/null
```

**Expected**: File exists with reasonable size (>500 bytes)

**Scoring**:
- ✅ Today's digest exists: +15 points
- ⚠️ Yesterday's exists, today's missing: +5 points
- ❌ No recent digests: 0 points

---

### 4. Weekly Summary Status
```bash
# Check latest weekly summary
ls -lt cortex/weekly/*.md | head -1
```

**Expected**: Current week's summary exists

**Scoring**:
- ✅ Current week summary exists: +10 points
- ⚠️ Last week's summary exists: +5 points
- ❌ No weekly summaries: 0 points

---

### 5. TODO.md Freshness
```bash
# Check TODO.md last modified time
stat -f "%Sm %z" -t "%Y-%m-%d %H:%M" TODO.md 2>/dev/null
```

**Expected**: Modified today (Recipe 10 runs at 08:05 JST)

**Scoring**:
- ✅ Modified today: +15 points
- ⚠️ Modified yesterday: +5 points
- ❌ Older than 2 days: 0 points

---

### 6. Knowledge Base Index
```bash
# Check KB index size and modification time
ls -lh kb/index/embeddings.json | awk '{print $5, $6, $7, $8, $9}'
```

**Expected**: File exists, size >1MB, modified within last 7 days

**Scoring**:
- ✅ Fresh (<7 days) + >1MB: +15 points
- ⚠️ Stale (7-30 days): +5 points
- ❌ Very old (>30 days) or missing: 0 points

---

### 7. tomorrow.json State
```bash
# Check tomorrow.json for Recipe 13 output
cat cortex/state/tomorrow.json | jq -r '.generated_at, .tomorrow_candidates | length'
```

**Expected**: Valid JSON with recent timestamp and candidates

**Scoring**:
- ✅ Fresh (<24h) with candidates: +5 points
- ⚠️ Old (>24h): +2 points
- ❌ Missing or invalid: 0 points

---

## Output Format

Generate a Markdown report with the following structure:

```markdown
# 🏥 Cortex OS Health Report

**Generated**: {timestamp}
**System**: Cortex OS v1.2 "Autonomy"

---

## 📊 Component Status

### Core Services
- 🔌 **Obsidian REST API**: {status} ({details})
- 🐳 **n8n Container**: {status} ({details})

### Data Freshness
- 📅 **Daily Digest**: {status} ({latest_date})
- 📊 **Weekly Summary**: {status} ({latest_week})
- 📝 **TODO.md**: {status} ({last_modified})
- 🧠 **KB Index**: {status} ({size}, {modified})
- 🌅 **tomorrow.json**: {status} ({generated_at})

---

## 🎯 Health Score

**Overall Health**: {score}% ({grade})

Grade Scale:
- 90-100%: Excellent ✅
- 70-89%: Good ⚠️
- 50-69%: Fair ⚠️
- <50%: Critical ❌

---

## ⚠️ Warnings

{list of warnings, if any}

---

## 💡 Recommendations

{list of recommended actions}

---

## 📈 System Metrics

- **Uptime**: n8n {uptime}
- **Total Digests**: {count}
- **KB Chunks**: {chunks}
- **Autonomous Loops**: {active_recipes}

---

**Next Diagnostic**: Run `/diagnose` again in 24 hours
```

---

## Scoring Algorithm

**Maximum Score**: 100 points

**Component Weights**:
1. Obsidian REST API: 20 points
2. n8n Container: 20 points
3. Daily Digest: 15 points
4. Weekly Summary: 10 points
5. TODO.md: 15 points
6. KB Index: 15 points
7. tomorrow.json: 5 points

**Health Grades**:
- **90-100%**: Excellent — All systems operational
- **70-89%**: Good — Minor issues, no immediate action needed
- **50-69%**: Fair — Some components need attention
- **<50%**: Critical — Immediate action required

---

## Warning Conditions

Generate warnings for:

1. **Obsidian API Down**
   - Warning: "Obsidian REST API unreachable"
   - Recommendation: "Restart Obsidian, verify Local REST API plugin is enabled"

2. **n8n Unhealthy**
   - Warning: "n8n container not healthy or not running"
   - Recommendation: "Check n8n logs: `docker logs n8n`, restart if needed: `docker compose restart n8n`"

3. **Missing Today's Digest**
   - Warning: "Today's daily digest not found"
   - Recommendation: "Recipe 03 may have failed. Check n8n execution history, or run Recipe 03 manually"

4. **Stale TODO.md**
   - Warning: "TODO.md not updated today"
   - Recommendation: "Recipe 10 may have failed. Check n8n execution history at 08:05 JST"

5. **Old KB Index**
   - Warning: "KB index older than 7 days"
   - Recommendation: "Recipe 02 may have failed. Run `pnpm kb:build` manually or check Recipe 02 execution"

6. **Invalid tomorrow.json**
   - Warning: "tomorrow.json is stale or invalid"
   - Recommendation: "Recipe 13 may have failed. Check n8n execution history at 22:00 JST"

7. **No Weekly Summary**
   - Warning: "Weekly summary not found for current week"
   - Recommendation: "Recipe 11 may have failed, or it's early in the week. Check cortex/weekly/"

---

## Recommendation Priorities

**High Priority** (affects autonomous operation):
- Obsidian API down
- n8n unhealthy
- Missing daily digest for >2 days

**Medium Priority** (affects data quality):
- Stale TODO.md
- Old KB index
- Invalid tomorrow.json

**Low Priority** (cosmetic or early-week issues):
- Missing weekly summary (if it's Monday/Tuesday)
- Yesterday's digest missing (if today's exists)

---

## Implementation Notes

- All checks should be **non-blocking** (use timeouts)
- Failed checks should not crash the diagnostic
- Output should be **human-readable** and **actionable**
- Include **timestamps** for all checks
- Preserve **context** (e.g., "checked at 19:30 JST")

---

## Example Output

```markdown
# 🏥 Cortex OS Health Report

**Generated**: 2025-11-28 19:45:00 JST
**System**: Cortex OS v1.2 "Autonomy"

---

## 📊 Component Status

### Core Services
- 🔌 **Obsidian REST API**: ✅ OK (https://127.0.0.1:27124, response: 145ms)
- 🐳 **n8n Container**: ✅ Healthy (Up 4 days)

### Data Freshness
- 📅 **Daily Digest**: ✅ Fresh (2025-11-28-digest.md, 1.8KB)
- 📊 **Weekly Summary**: ✅ Current (2025-W48-summary.md)
- 📝 **TODO.md**: ✅ Updated Today (2025-11-28 19:15, 21KB)
- 🧠 **KB Index**: ✅ Fresh (1.9MB, updated 2025-11-28 19:08)
- 🌅 **tomorrow.json**: ✅ Recent (generated 2025-11-28T13:00:00Z)

---

## 🎯 Health Score

**Overall Health**: 95% (Excellent ✅)

All systems operational. Cortex OS is functioning autonomously as designed.

---

## ⚠️ Warnings

- Recipe 03: Slack notification not configured (low priority)

---

## 💡 Recommendations

1. **Add Slack Webhook** to Recipe 03 for morning notifications (1-2h implementation)
2. **Monitor for 7 consecutive days** to achieve v1.2 stability milestone
3. Continue as normal — system is healthy

---

## 📈 System Metrics

- **Uptime**: n8n container up 4 days
- **Total Digests**: 5 files in cortex/daily/
- **KB Chunks**: 327 chunks indexed
- **Autonomous Loops**: 3 active (Recipe 02, 03, 10)

---

**Next Diagnostic**: Run `/diagnose` again in 24 hours

**Autonomous Status**: 🟢 Online
```

---

## Usage

```bash
# Run diagnostic from Claude Code
/diagnose

# Or manually execute checks
bash .claude/commands/diagnose.sh
```

---

**Created**: 2025-11-28
**Version**: 1.0
**Owner**: Cortex OS Development Team
