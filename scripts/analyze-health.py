#!/usr/bin/env python3
"""Health Score Engine

Evaluates the overall health of Cortex OS by analyzing:
- Automation reliability (Recipe execution logs)
- Data freshness (state file timestamps)
- Analytics health (sample sizes and completeness)

Input:
  - cortex/logs/*.jsonl (v1.3+ structured execution logs)
  - cortex/logs/*.log   (legacy text logs)
  - cortex/state/*.json (analytics outputs)

Output:
  - cortex/state/health-score.json

Usage:
    python scripts/analyze-health.py [--window-days 7] [--verbose]
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Tuple, Optional


STATE_DIR = Path("cortex/state")
LOGS_DIR = Path("cortex/logs")


def _parse_iso_ts(value: Any) -> Optional[datetime]:
    """Parse ISO timestamps used in JSONL logs.

    Supports:
      - `2025-12-20T02:09:21.000Z`
      - `2025-12-20T11:09:21+09:00`
      - naive ISO strings (treated as UTC)

    Returns a timezone-aware UTC datetime, or None if parsing fails.
    """
    if not isinstance(value, str) or not value.strip():
        return None

    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def parse_log_files(window_days: int) -> Tuple[int, int, int]:
    """Parse Recipe execution logs for success/failure counts.

    Supports both:
    - .jsonl files (JSONL format, v1.3+)
    - .log files (legacy text format)

    Returns:
        (runs, successes, failures)

    Notes:
      - For JSONL, each log line is treated as one run.
      - Entries are filtered by `ts` when available (more accurate than file mtime).
      - Legacy .log files are counted per-file.
    """
    if not LOGS_DIR.exists():
        return 0, 0, 0

    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=window_days)

    runs = 0
    successes = 0
    failures = 0

    # Parse JSONL files (v1.3+)
    for log_file in LOGS_DIR.glob("recipe-*.jsonl"):
        try:
            # Fast skip: if the file itself is old, it's unlikely to contain recent entries.
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime, tz=timezone.utc)
            if mtime < cutoff_dt:
                continue

            with log_file.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Skip if entry is not a dict (e.g., bare integers, strings)
                    if not isinstance(entry, dict):
                        continue

                    entry_ts = _parse_iso_ts(entry.get("ts"))
                    if entry_ts is not None and entry_ts < cutoff_dt:
                        continue

                    runs += 1
                    status = entry.get("status")
                    if status == "success":
                        successes += 1
                    elif status == "error":
                        failures += 1

        except Exception as e:
            print(f"⚠️  Error reading {log_file}: {e}", file=sys.stderr)

    # Parse legacy .log files (backwards compatibility)
    for log_file in LOGS_DIR.glob("recipe-*.log"):
        try:
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime, tz=timezone.utc)
            if mtime < cutoff_dt:
                continue

            content = log_file.read_text(encoding="utf-8")

            if "✅" in content or "SUCCESS" in content or "completed" in content.lower():
                successes += 1
            elif "❌" in content or "ERROR" in content or "FAILED" in content:
                failures += 1

            runs += 1

        except Exception as e:
            print(f"⚠️  Error reading {log_file}: {e}", file=sys.stderr)

    return runs, successes, failures


def calculate_automation_score(runs: int, successes: int, failures: int) -> Tuple[int, Dict[str, Any]]:
    """Calculate automation reliability score (0-100)."""
    if runs == 0:
        return 50, {
            "score": 50,
            "runs": 0,
            "successes": 0,
            "failures": 0,
            "status": "no_data",
        }

    success_rate = successes / runs

    if success_rate >= 0.95:
        score = 95
    elif success_rate >= 0.90:
        score = 85
    elif success_rate >= 0.80:
        score = 75
    elif success_rate >= 0.70:
        score = 65
    else:
        score = max(50, int(success_rate * 100))

    return score, {
        "score": score,
        "runs": runs,
        "successes": successes,
        "failures": failures,
        "success_rate": round(success_rate, 3),
    }


def calculate_freshness_score(state_files: Dict[str, Path]) -> Tuple[int, Dict[str, Any]]:
    """Calculate data freshness score based on file ages."""
    now = datetime.now(timezone.utc)
    ages: Dict[str, Optional[float]] = {}

    for key, path in state_files.items():
        if not path.exists():
            ages[key] = None
            continue

        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        hours_old = (now - mtime).total_seconds() / 3600
        ages[key] = round(hours_old, 1)

    valid_ages = [age for age in ages.values() if age is not None]

    if not valid_ages:
        return 50, {
            "score": 50,
            "status": "no_data",
            "file_ages_hours": ages,
        }

    avg_age = sum(valid_ages) / len(valid_ages)

    # Scoring: 0-6h=95, 6-24h=80, 24-48h=60, >48h=40
    if avg_age <= 6:
        score = 95
    elif avg_age <= 24:
        score = 80
    elif avg_age <= 48:
        score = 60
    else:
        score = 40

    return score, {
        "score": score,
        "average_age_hours": round(avg_age, 1),
        "file_ages_hours": ages,
    }


def calculate_analytics_health(state_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Calculate analytics health based on sample sizes."""
    scores: List[int] = []
    details: Dict[str, Any] = {}

    # Check duration stats (support both legacy + current filenames)
    duration_candidates = [
        state_dir / "duration-patterns.json",
        state_dir / "duration-stats.json",
    ]
    duration_file = next((p for p in duration_candidates if p.exists()), None)

    if duration_file is not None:
        try:
            data = json.loads(duration_file.read_text(encoding="utf-8"))
            # Support both legacy and v1.3+ formats
            total_tasks = (
                data.get("total_tasks_with_duration")
                or data.get("total_tasks")
                or data.get("task_count")
                or data.get("count")
                or data.get("overall", {}).get("count")  # v1.3+ format
                or 0
            )

            if total_tasks >= 50:
                dur_score = 95
            elif total_tasks >= 30:
                dur_score = 85
            elif total_tasks >= 15:
                dur_score = 70
            elif total_tasks >= 5:
                dur_score = 55
            else:
                dur_score = 40

            scores.append(dur_score)
            details["duration_samples"] = total_tasks
            details["duration_score"] = dur_score
            details["duration_file"] = duration_file.name
        except Exception:
            pass

    # Check rhythm patterns
    rhythm_file = state_dir / "rhythm-patterns.json"
    if rhythm_file.exists():
        try:
            data = json.loads(rhythm_file.read_text(encoding="utf-8"))
            active_days = data.get("active_days", 0)
            total_tasks = data.get("total_tasks", 0)

            if active_days >= 15 and total_tasks >= 30:
                rhythm_score = 95
            elif active_days >= 10 and total_tasks >= 20:
                rhythm_score = 80
            elif active_days >= 5 and total_tasks >= 10:
                rhythm_score = 65
            else:
                rhythm_score = 45

            scores.append(rhythm_score)
            details["rhythm_active_days"] = active_days
            details["rhythm_samples"] = total_tasks
            details["rhythm_score"] = rhythm_score
        except Exception:
            pass

    # Check category heatmap
    category_file = state_dir / "category-heatmap.json"
    if category_file.exists():
        try:
            data = json.loads(category_file.read_text(encoding="utf-8"))
            total_tasks = data.get("total_completed_tasks", 0)

            # Get active_days from file (unique calendar days), not weekday count
            active_days = data.get("active_days", 0)

            if active_days >= 14 and total_tasks >= 40:
                cat_score = 95
            elif active_days >= 10 and total_tasks >= 25:
                cat_score = 80
            elif active_days >= 5 and total_tasks >= 15:
                cat_score = 65
            else:
                cat_score = 45

            scores.append(cat_score)
            details["category_samples"] = total_tasks
            details["category_active_days"] = active_days
            details["category_score"] = cat_score
        except Exception:
            pass

    if not scores:
        return 50, {"score": 50, "status": "no_analytics"}

    overall_score = int(sum(scores) / len(scores))
    details["score"] = overall_score

    return overall_score, details


def generate_insights(
    overall_score: int,
    automation: Dict[str, Any],
    freshness: Dict[str, Any],
    analytics: Dict[str, Any],
) -> List[str]:
    """Generate human-readable insights about OS health."""
    insights: List[str] = []

    if overall_score >= 90:
        insights.append("✅ Cortex OS is in excellent health.")
    elif overall_score >= 75:
        insights.append("🟢 Cortex OS is healthy with minor areas for improvement.")
    elif overall_score >= 60:
        insights.append("🟡 Cortex OS health is moderate. Some attention needed.")
    else:
        insights.append("🔴 Cortex OS health is low. Review automation and data quality.")

    auto_score = automation.get("score", 0)
    if auto_score >= 90:
        insights.append("🤖 Automation loop is highly reliable.")
    elif automation.get("failures", 0) > 0:
        failures = automation.get("failures")
        insights.append(f"⚠️  {failures} automation failure(s) detected in analysis window.")

    fresh_score = freshness.get("score", 0)
    avg_age = freshness.get("average_age_hours")
    if fresh_score < 70 and avg_age:
        insights.append(f"⏰ Data freshness declined (avg age: {avg_age:.1f}h). Consider running analytics.")

    analytics_score = analytics.get("score", 0)
    if analytics_score < 70:
        insights.append("📊 Analytics health is low. More task history needed for reliable patterns.")

    if analytics.get("rhythm_active_days", 0) < 10:
        insights.append("💡 Rhythm patterns need more data (target: 10+ active days).")

    file_ages = freshness.get("file_ages_hours", {})
    duration_age = file_ages.get("duration-patterns.json")
    if duration_age is None:
        duration_age = file_ages.get("duration-stats.json")

    if duration_age and duration_age > 24:
        insights.append("💡 Duration stats are stale. Run: python scripts/analyze-duration.py")

    return insights


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Cortex OS health")
    parser.add_argument(
        "--window-days",
        type=int,
        default=7,
        help="Days to analyze for automation reliability (default: 7)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed component scores",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="cortex/state/health-score.json",
        help="Output file path",
    )

    args = parser.parse_args()

    print(f"🏥 Analyzing Cortex OS health (window: {args.window_days} days)...", file=sys.stderr)

    # 1. Automation reliability
    runs, successes, failures = parse_log_files(args.window_days)
    automation_score, automation_details = calculate_automation_score(runs, successes, failures)
    automation_details["window_days"] = args.window_days

    # 2. Data freshness
    state_files = {
        "duration-patterns.json": STATE_DIR / "duration-patterns.json",
        "rhythm-patterns.json": STATE_DIR / "rhythm-patterns.json",
        "category-heatmap.json": STATE_DIR / "category-heatmap.json",
    }
    freshness_score, freshness_details = calculate_freshness_score(state_files)

    # 3. Analytics health
    analytics_score, analytics_details = calculate_analytics_health(STATE_DIR)

    # 4. Overall score (weighted average)
    overall_score = round(
        0.4 * automation_score +
        0.3 * freshness_score +
        0.3 * analytics_score
    )

    # 5. Generate insights
    insights = generate_insights(overall_score, automation_details, freshness_details, analytics_details)

    # 6. Build result
    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "version": "1.0",
        "overall_score": overall_score,
        "components": {
            "automation": automation_details,
            "data_freshness": freshness_details,
            "analytics_health": analytics_details,
        },
        "insights": insights,
    }

    # 7. Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.verbose:
        print(f"  Automation: {automation_score}/100 ({successes}/{runs} successful)", file=sys.stderr)
        print(f"  Data Freshness: {freshness_score}/100", file=sys.stderr)
        print(f"  Analytics Health: {analytics_score}/100", file=sys.stderr)

    print(f"✅ Health score: {overall_score}/100", file=sys.stderr)
    print(f"✅ Results saved to {output_path}", file=sys.stderr)

    if insights:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in insights:
            print(f"   {insight}", file=sys.stderr)

    # stdout に JSON を出力（パイプ用）
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
