#!/usr/bin/env python3
"""
Rhythm Detection Analyzer

Detects daily rhythm patterns (morning/evening type, peak hours)
from historical task-entry data.

Input:
  - cortex/state/task-entry-*.json (past N days)

Output:
  - cortex/state/rhythm-patterns.json

Usage:
    python scripts/analyze-rhythm.py [--days 30] [--min-tasks 10]
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict
import argparse
import statistics


STATE_DIR = Path("cortex/state")


def load_task_entries(days: int) -> List[Dict[str, Any]]:
    """Load task-entry files from the past N days."""
    if not STATE_DIR.exists():
        print(f"❌ State directory not found: {STATE_DIR}", file=sys.stderr)
        sys.exit(1)

    entries: List[Dict[str, Any]] = []
    today = datetime.now().date()

    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        entry_file = STATE_DIR / f"task-entry-{date_str}.json"

        if entry_file.exists():
            try:
                with entry_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["__date"] = date_str
                    entries.append(data)
            except json.JSONDecodeError:
                print(f"⚠️  Skipping invalid JSON: {entry_file}", file=sys.stderr)
            except Exception as e:
                print(f"⚠️  Error loading {entry_file}: {e}", file=sys.stderr)

    return entries


def parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def is_task_completed(task: Dict[str, Any]) -> bool:
    """
    Check if a task is completed using multiple indicators.

    Supports:
    - status: "completed", "done", "finished"
    - title: starts with "[x]" or "- [x]"
    """
    status = task.get("status", "").lower()
    title = task.get("title", "")

    return (
        status in ("completed", "done", "finished") or
        title.startswith("[x]") or
        title.startswith("- [x]")
    )


def extract_activity(entries: List[Dict[str, Any]]):
    """
    Extract activity by hour and weekday.

    Returns:
        hourly_counts: dict[int, int]
        weekday_hour: dict[str, dict[int, int]]
        active_days: int
        start_hours: list[int]
    """
    hourly_counts: Dict[int, int] = {h: 0 for h in range(24)}
    weekday_hour: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    start_hours: List[int] = []

    days_with_activity: set[str] = set()

    for entry in entries:
        date_str = entry.get("__date")
        # Support both "tasks" (scheduled) and "completed" (finished)
        tasks = entry.get("tasks", []) + entry.get("completed", [])
        day_has_task = False

        for task in tasks:
            if not is_task_completed(task):
                continue

            started_at = parse_iso_datetime(task.get("started_at"))
            completed_at = parse_iso_datetime(task.get("completed_at"))

            # Support timestamp field (HH:MM format) from /log completed tasks
            timestamp_str = task.get("timestamp")
            if timestamp_str and date_str and not (started_at or completed_at):
                try:
                    # Parse "HH:MM" and combine with date
                    hour_min = timestamp_str.split(":")
                    if len(hour_min) == 2:
                        dt = datetime.strptime(f"{date_str} {timestamp_str}", "%Y-%m-%d %H:%M")
                    else:
                        dt = None
                except Exception:
                    dt = None
            else:
                dt = started_at or completed_at

            if not dt:
                continue

            hour = dt.hour
            weekday = dt.strftime("%A")

            hourly_counts[hour] += 1
            weekday_hour[weekday][hour] += 1
            start_hours.append(hour)
            day_has_task = True

        if day_has_task and date_str:
            days_with_activity.add(date_str)

    active_days = len(days_with_activity)
    return hourly_counts, weekday_hour, active_days, start_hours


def classify_chronotype(start_hours: List[int], min_tasks: int) -> str:
    """
    Classify into morning / balanced / evening / night / unknown.

    Handles midnight crossover:
    - 0-4: night (late night continuation)
    - 5-10: morning
    - 11-16: balanced
    - 17-23: evening
    """
    if len(start_hours) < min_tasks:
        return "unknown"

    median_hour = statistics.median(start_hours)

    # Midnight crossover handling: 0-4 is considered late night, not morning
    if 0 <= median_hour <= 4:
        return "night"
    elif median_hour < 11:
        return "morning"
    elif median_hour > 17:
        return "evening"
    else:
        return "balanced"


def find_peak_hour(hourly_counts: Dict[int, int]) -> int | None:
    if not any(hourly_counts.values()):
        return None
    return max(hourly_counts.keys(), key=lambda h: hourly_counts[h])


def find_peak_window(hourly_counts: Dict[int, int], window_size: int = 3) -> Tuple[int, int, int]:
    """
    Find the contiguous window of hours [start, end) with the highest total tasks.
    Returns (start_hour, end_hour_non_inclusive, total_tasks).
    """
    hours = list(range(24))
    best_start = 0
    best_sum = -1

    for start in hours:
        end = start + window_size
        window_hours = [h for h in range(start, min(end, 24))]
        total = sum(hourly_counts[h] for h in window_hours)
        if total > best_sum:
            best_sum = total
            best_start = start

    return best_start, min(best_start + window_size, 24), best_sum


def normalize_weekday_hour(weekday_hour: Dict[str, Dict[int, int]]) -> Dict[str, Dict[str, int]]:
    """Convert keys to strings for JSON compatibility."""
    result: Dict[str, Dict[str, int]] = {}
    for weekday, hours in weekday_hour.items():
        result[weekday] = {str(h): count for h, count in sorted(hours.items())}
    return result


def generate_insights(
    chronotype: str,
    peak_hour: int | None,
    peak_window: Tuple[int, int, int] | None,
    total_tasks: int,
    active_days: int,
) -> List[str]:
    insights: List[str] = []

    if total_tasks == 0:
        insights.append("No completed tasks in the analysis period.")
        return insights

    if chronotype != "unknown":
        label = {
            "morning": "morning type (早起き型)",
            "evening": "evening type (夜型)",
            "night": "night owl type (深夜型)",
            "balanced": "balanced type (バランス型)",
        }.get(chronotype, chronotype)
        insights.append(f"Your current rhythm is classified as: {label}.")

    if peak_hour is not None:
        insights.append(f"Single peak hour: around {peak_hour:02d}:00.")

    if peak_window is not None:
        start, end, total = peak_window
        if end > start and total > 0:
            insights.append(
                f"Most active window: {start:02d}:00–{end:02d}:00 "
                f"({total} tasks in {active_days} active days)."
            )

    avg_per_day = total_tasks / active_days if active_days > 0 else 0
    insights.append(
        f"Average completed tasks per active day: {avg_per_day:.2f} "
        f"over {active_days} active days."
    )

    return insights


def main():
    parser = argparse.ArgumentParser(description="Analyze daily rhythm patterns")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to analyze (default: 30)",
    )
    parser.add_argument(
        "--min-tasks",
        type=int,
        default=10,
        help="Minimum number of completed tasks required to classify chronotype (default: 10)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="cortex/state/rhythm-patterns.json",
        help="Output file path",
    )

    args = parser.parse_args()

    print(f"📊 Analyzing rhythm patterns (past {args.days} days)...", file=sys.stderr)

    entries = load_task_entries(args.days)
    if not entries:
        print("❌ No task entries found", file=sys.stderr)
        sys.exit(1)

    print(f"✅ Loaded {len(entries)} task entries", file=sys.stderr)

    hourly_counts, weekday_hour, active_days, start_hours = extract_activity(entries)
    total_tasks = sum(hourly_counts.values())

    print(
        f"✅ Extracted {total_tasks} completed tasks across {active_days} active days",
        file=sys.stderr,
    )

    chronotype = classify_chronotype(start_hours, args.min_tasks)
    peak_hour = find_peak_hour(hourly_counts)
    peak_window_tuple = find_peak_window(hourly_counts) if total_tasks > 0 else None

    weekday_hour_json = normalize_weekday_hour(weekday_hour)

    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "analysis_period_days": args.days,
        "total_tasks": total_tasks,
        "active_days": active_days,
        "chronotype": chronotype,
        "peak_hour": peak_hour,
        "peak_window": {
            "start_hour": peak_window_tuple[0],
            "end_hour": peak_window_tuple[1],
            "total_tasks": peak_window_tuple[2],
        }
        if peak_window_tuple
        else None,
        "hourly_distribution": {str(h): hourly_counts[h] for h in range(24)},
        "weekday_hour_matrix": weekday_hour_json,
        "insights": generate_insights(
            chronotype,
            peak_hour,
            peak_window_tuple,
            total_tasks,
            active_days,
        ),
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Rhythm patterns saved to {output_path}", file=sys.stderr)

    if result["insights"]:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in result["insights"]:
            print(f"   • {insight}", file=sys.stderr)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
