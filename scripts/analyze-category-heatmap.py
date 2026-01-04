#!/usr/bin/env python3
"""
Category Heatmap Analyzer

Analyzes task completion patterns across weekdays and categories
to reveal weekly habits and productivity patterns.

Input:
  - cortex/state/task-entry-*.json (past N days)

Output:
  - cortex/state/category-heatmap.json

Usage:
    python scripts/analyze-category-heatmap.py [--days 30] [--min-tasks 5]
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict
import argparse


STATE_DIR = Path("cortex/state")
WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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
    """Parse ISO 8601 datetime string."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def extract_category_activity(entries: List[Dict[str, Any]]):
    """
    Extract category activity by weekday.

    Returns:
        weekday_category_matrix: dict[str, dict[str, int]]
        category_totals: dict[str, int]
        weekday_totals: dict[str, int]
        total_completed: int
        active_days: int (number of unique calendar days with completed tasks)
    """
    weekday_category_matrix: Dict[str, Dict[str, int]] = {
        day: defaultdict(int) for day in WEEKDAY_ORDER
    }
    category_totals: Dict[str, int] = defaultdict(int)
    weekday_totals: Dict[str, int] = {day: 0 for day in WEEKDAY_ORDER}
    total_completed = 0
    active_dates = set()  # Track unique dates with completed tasks

    for entry in entries:
        tasks = entry.get("tasks", [])
        
        for task in tasks:
            # Only count completed tasks (various status formats)
            status = task.get("status", "").lower()
            title = task.get("title", "")
            
            # Check if task is completed
            is_completed = (
                status in ("completed", "done", "finished") or
                title.startswith("[x]") or
                title.startswith("- [x]")
            )
            
            if not is_completed:
                continue

            # Extract category (default to "uncategorized")
            category = task.get("category", "uncategorized")
            if not category or category.strip() == "":
                category = "uncategorized"

            # Get weekday from started_at or completed_at
            started_at = parse_iso_datetime(task.get("started_at"))
            completed_at = parse_iso_datetime(task.get("completed_at"))
            dt = started_at or completed_at

            if not dt:
                continue

            weekday = dt.strftime("%A")  # e.g., "Monday"

            # Update counters
            weekday_category_matrix[weekday][category] += 1
            category_totals[category] += 1
            weekday_totals[weekday] += 1
            total_completed += 1

            # Track active dates
            entry_date = entry.get("__date")
            if entry_date:
                active_dates.add(entry_date)

    # Convert defaultdict to regular dict for JSON serialization
    weekday_category_matrix = {
        day: dict(categories) for day, categories in weekday_category_matrix.items()
    }

    return (
        weekday_category_matrix,
        dict(category_totals),
        weekday_totals,
        total_completed,
        len(active_dates),  # active_days
    )


def find_dominant_categories(
    weekday_category_matrix: Dict[str, Dict[str, int]],
    weekday_totals: Dict[str, int],
    threshold: float = 0.3,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Find dominant categories for each weekday.
    A category is "dominant" if it represents >= threshold% of that day's tasks.
    """
    dominant: Dict[str, List[Dict[str, Any]]] = {}

    for weekday in WEEKDAY_ORDER:
        total = weekday_totals[weekday]
        if total == 0:
            dominant[weekday] = []
            continue

        categories = weekday_category_matrix[weekday]
        dominant_cats = []

        for category, count in sorted(categories.items(), key=lambda x: -x[1]):
            percentage = (count / total) * 100
            if percentage >= (threshold * 100):
                dominant_cats.append({
                    "category": category,
                    "count": count,
                    "percentage": round(percentage, 1),
                })

        dominant[weekday] = dominant_cats

    return dominant


def generate_insights(
    weekday_category_matrix: Dict[str, Dict[str, int]],
    category_totals: Dict[str, int],
    weekday_totals: Dict[str, int],
    dominant_categories: Dict[str, List[Dict[str, Any]]],
    total_completed: int,
    min_tasks: int,
) -> List[str]:
    """Generate human-readable insights from the heatmap."""
    insights: List[str] = []

    if total_completed == 0:
        insights.append("No completed tasks in the analysis period.")
        return insights

    # Overall category distribution
    if category_totals:
        top_category = max(category_totals.items(), key=lambda x: x[1])
        percentage = (top_category[1] / total_completed) * 100
        insights.append(
            f"Most common category overall: '{top_category[0]}' "
            f"({top_category[1]} tasks, {percentage:.1f}%)"
        )

    # Weekday patterns
    busiest_day = max(weekday_totals.items(), key=lambda x: x[1])
    if busiest_day[1] > 0:
        insights.append(
            f"Busiest day: {busiest_day[0]} ({busiest_day[1]} completed tasks)"
        )

    # Dominant category patterns
    for weekday in WEEKDAY_ORDER:
        dominant = dominant_categories.get(weekday, [])
        if len(dominant) > 0 and weekday_totals[weekday] >= min_tasks:
            cat_names = ", ".join([f"'{d['category']}' ({d['percentage']}%)" for d in dominant])
            insights.append(f"{weekday}: Dominated by {cat_names}")

    # Light days
    light_days = [day for day, count in weekday_totals.items() if 0 < count < min_tasks]
    if light_days:
        insights.append(f"Light activity days: {', '.join(light_days)}")

    return insights


def main():
    parser = argparse.ArgumentParser(description="Analyze category patterns across weekdays")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to analyze (default: 30)",
    )
    parser.add_argument(
        "--min-tasks",
        type=int,
        default=5,
        help="Minimum tasks per day to consider for dominant category detection (default: 5)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.3,
        help="Threshold for dominant category (e.g., 0.3 = 30%% of day's tasks)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="cortex/state/category-heatmap.json",
        help="Output file path",
    )

    args = parser.parse_args()

    print(f"📊 Analyzing category heatmap (past {args.days} days)...", file=sys.stderr)

    entries = load_task_entries(args.days)
    if not entries:
        print("❌ No task entries found", file=sys.stderr)
        sys.exit(1)

    print(f"✅ Loaded {len(entries)} task entries", file=sys.stderr)

    (
        weekday_category_matrix,
        category_totals,
        weekday_totals,
        total_completed,
        active_days,
    ) = extract_category_activity(entries)

    print(f"✅ Extracted {total_completed} completed tasks across {active_days} active days", file=sys.stderr)

    dominant_categories = find_dominant_categories(
        weekday_category_matrix,
        weekday_totals,
        args.threshold,
    )

    insights = generate_insights(
        weekday_category_matrix,
        category_totals,
        weekday_totals,
        dominant_categories,
        total_completed,
        args.min_tasks,
    )

    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "analysis_period_days": args.days,
        "total_completed_tasks": total_completed,
        "active_days": active_days,  # Number of unique calendar days with completed tasks
        "weekday_category_matrix": weekday_category_matrix,
        "category_totals": category_totals,
        "weekday_totals": weekday_totals,
        "dominant_categories": dominant_categories,
        "insights": insights,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"✅ Category heatmap saved to {output_path}", file=sys.stderr)

    if result["insights"]:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in result["insights"]:
            print(f"   • {insight}", file=sys.stderr)

    # stdout にも JSON を出す（パイプ用）
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
