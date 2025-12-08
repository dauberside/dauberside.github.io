#!/usr/bin/env python3
"""
Incomplete Task Detection Script (v1.4)

Detects tasks that were planned but not completed, and updates task-entry with:
- carryover: list of incomplete tasks
- metadata.incomplete_detection: summary statistics

Usage:
    python scripts/detect-incomplete-tasks.py          # Today
    python scripts/detect-incomplete-tasks.py 2025-12-08  # Specific date

Spec: docs/cortex/v1.4-incomplete-task-detection.md
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Cortex paths
CORTEX_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = CORTEX_ROOT / "cortex" / "state"


def detect_incomplete_tasks_from_entry(task_entry: dict) -> dict:
    """
    Core logic: detect incomplete tasks from task-entry JSON
    
    Args:
        task_entry: Parsed task-entry-YYYY-MM-DD.json
        
    Returns:
        {
            "date": str,
            "planned": int,
            "completed": int,
            "incomplete": int,
            "completion_rate": float,
            "incomplete_tasks": list[dict]
        }
    """
    date = task_entry.get("date", "unknown")
    tasks = task_entry.get("tasks", [])
    completed = task_entry.get("completed", [])
    
    # Defensive: ensure lists
    if not isinstance(tasks, list):
        print(f"WARN: tasks is not a list, treating as empty", file=sys.stderr)
        tasks = []
    if not isinstance(completed, list):
        print(f"WARN: completed is not a list, treating as empty", file=sys.stderr)
        completed = []
    
    # Extract content titles (strip whitespace)
    def safe_extract_titles(items):
        titles = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if content and isinstance(content, str):
                titles.add(content.strip())
            else:
                print(f"WARN: Task missing 'content' field, skipping: {item}", file=sys.stderr)
        return titles
    
    planned_titles = safe_extract_titles(tasks)
    completed_titles = safe_extract_titles(completed)
    
    # Calculate incomplete
    incomplete_titles = planned_titles - completed_titles
    
    # Filter incomplete tasks from original tasks list
    incomplete_tasks = []
    for task in tasks:
        if isinstance(task, dict):
            content = task.get("content", "").strip()
            if content in incomplete_titles:
                incomplete_tasks.append(task)
    
    # Calculate metrics
    planned_count = len(planned_titles)
    completed_count = len(planned_titles & completed_titles)  # Only count planned tasks
    incomplete_count = len(incomplete_titles)
    
    # Completion rate (spec: 0.0 if planned == 0)
    if planned_count == 0:
        completion_rate = 0.0
    else:
        completion_rate = round(completed_count / planned_count, 2)
    
    return {
        "date": date,
        "planned": planned_count,
        "completed": completed_count,
        "incomplete": incomplete_count,
        "completion_rate": completion_rate,
        "incomplete_tasks": incomplete_tasks
    }


def load_task_entry(date: str) -> dict:
    """Load task-entry JSON for given date"""
    task_entry_path = STATE_DIR / f"task-entry-{date}.json"
    
    if not task_entry_path.exists():
        print(f"ERROR: Task entry not found: {task_entry_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(task_entry_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to load task-entry-{date}.json: {e}", file=sys.stderr)
        sys.exit(1)


def save_task_entry(date: str, task_entry: dict):
    """Save updated task-entry JSON"""
    task_entry_path = STATE_DIR / f"task-entry-{date}.json"
    
    with open(task_entry_path, "w", encoding="utf-8") as f:
        json.dump(task_entry, f, ensure_ascii=False, indent=2)


def detect_incomplete_tasks_for_date(date: str) -> dict:
    """
    CLI wrapper: load task-entry, detect incomplete, and update file
    
    Args:
        date: YYYY-MM-DD format
        
    Returns:
        Detection result dict
    """
    # Load task-entry
    task_entry = load_task_entry(date)
    
    # Detect incomplete tasks
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    # Update task-entry with results (spec: overwrite carryover)
    task_entry["carryover"] = result["incomplete_tasks"]
    
    # Update metadata
    if "metadata" not in task_entry:
        task_entry["metadata"] = {}
    
    task_entry["metadata"]["incomplete_detection"] = {
        "version": "1.0.0",
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "planned": result["planned"],
        "completed": result["completed"],
        "incomplete": result["incomplete"],
        "completion_rate": result["completion_rate"]
    }
    
    task_entry["metadata"]["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Save updated task-entry
    save_task_entry(date, task_entry)
    
    return result


def main():
    """CLI entry point"""
    # Get date (default: today JST)
    if len(sys.argv) > 1:
        date = sys.argv[1]
    else:
        jst = ZoneInfo("Asia/Tokyo")
        date = datetime.now(jst).strftime("%Y-%m-%d")
    
    print(f"🔎 Incomplete tasks for {date}")
    print()
    
    # Detect and update
    result = detect_incomplete_tasks_for_date(date)
    
    # Display summary
    print(f"  Planned:   {result['planned']}")
    print(f"  Completed: {result['completed']}")
    print(f"  Incomplete: {result['incomplete']}")
    print(f"  Completion rate: {int(result['completion_rate'] * 100)}%")
    print()
    
    # Show incomplete tasks
    if result["incomplete_tasks"]:
        for task in result["incomplete_tasks"]:
            content = task.get("content", "(no content)")
            print(f"  - [ ] {content}")
        print()
    
    print(f"💾 Updated: cortex/state/task-entry-{date}.json")


if __name__ == "__main__":
    main()
