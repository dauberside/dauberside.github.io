#!/usr/bin/env python3
"""
Extract Task Data from Obsidian Daily Digests

Reads Daily Digest markdown files from Obsidian vault and converts them
to task-entry-*.json format for analytics processing.

Usage:
    python scripts/extract-tasks-from-obsidian.py [--days 30]
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import argparse


OBSIDIAN_VAULT = Path("/Volumes/Extreme Pro/Obsidian Vault")
DAILY_DIR = OBSIDIAN_VAULT / "cortex" / "daily"
STATE_DIR = Path("cortex/state")


def parse_daily_digest(file_path: Path, date_str: str) -> Dict[str, Any]:
    """
    Parse a daily digest markdown file and extract task data.

    Returns task entry dict in format:
    {
        "tasks": [
            {
                "title": "Task title",
                "status": "completed" | "incomplete",
                "category": "high-priority" | "normal" | "untagged",
                "completed_at": "ISO8601" or None,
                "duration_minutes": int or None
            }
        ]
    }
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"⚠️  Error reading {file_path}: {e}", file=sys.stderr)
        return {"tasks": []}

    tasks = []
    current_category = "untagged"

    # Split into lines
    lines = content.split("\n")

    for line in lines:
        line = line.strip()

        # Detect category headers
        if "優先度：高" in line or "優先度: 高" in line:
            current_category = "high-priority"
            continue
        elif "通常タスク" in line:
            current_category = "normal"
            continue
        elif "タグなしタスク" in line:
            current_category = "untagged"
            continue

        # Parse task lines
        # Format: - [x] Task title (duration_minutes分)
        # Format: - [ ] Task title (duration_minutes分)
        task_match = re.match(r'^-\s*\[([ xX])\]\s+(.+)$', line)
        if task_match:
            is_completed = task_match.group(1).lower() == 'x'
            task_text = task_match.group(2).strip()

            # Extract duration if present
            duration = None
            duration_match = re.search(r'\((\d+)分\)', task_text)
            if duration_match:
                duration = int(duration_match.group(1))
                # Remove duration from title
                task_text = re.sub(r'\s*\(\d+分\)', '', task_text).strip()

            # Build task entry
            task = {
                "title": task_text,
                "status": "completed" if is_completed else "incomplete",
                "category": current_category
            }

            if is_completed:
                # Use date at 10:00 JST as default completion time
                # (matches the rhythm pattern we saw: peak hour 10:00)
                task["completed_at"] = f"{date_str}T01:00:00Z"  # 10:00 JST = 01:00 UTC
            else:
                task["completed_at"] = None

            if duration:
                task["duration_minutes"] = duration
            else:
                task["duration_minutes"] = None

            tasks.append(task)

    return {"tasks": tasks}


def process_obsidian_digests(days: int, dry_run: bool = False) -> int:
    """
    Process daily digest files from Obsidian and generate task-entry JSON files.

    Returns number of files processed.
    """
    if not DAILY_DIR.exists():
        print(f"❌ Obsidian daily directory not found: {DAILY_DIR}", file=sys.stderr)
        print(f"   Please update OBSIDIAN_VAULT path in script", file=sys.stderr)
        sys.exit(1)

    STATE_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.now().date()
    processed = 0
    extracted_total = 0

    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")

        # Input: Obsidian daily digest
        digest_file = DAILY_DIR / f"{date_str}-digest.md"

        # Output: task entry JSON
        output_file = STATE_DIR / f"task-entry-{date_str}.json"

        if not digest_file.exists():
            continue

        # Parse digest
        task_data = parse_daily_digest(digest_file, date_str)
        task_count = len(task_data["tasks"])

        if task_count == 0:
            continue

        # Write task entry JSON
        if not dry_run:
            with output_file.open("w", encoding="utf-8") as f:
                json.dump(task_data, f, ensure_ascii=False, indent=2)

        print(f"✅ {date_str}: {task_count} tasks extracted → {output_file}")
        processed += 1
        extracted_total += task_count

    return processed, extracted_total


def main():
    parser = argparse.ArgumentParser(description="Extract task data from Obsidian Daily Digests")
    parser.add_argument("--days", type=int, default=30, help="Number of days to process (default: 30)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without writing files")

    args = parser.parse_args()

    print(f"🔍 Extracting tasks from Obsidian Daily Digests (last {args.days} days)...")
    print(f"   Source: {DAILY_DIR}")
    print(f"   Output: {STATE_DIR}")
    print()

    processed, extracted = process_obsidian_digests(args.days, dry_run=args.dry_run)

    print()
    print(f"📊 Summary:")
    print(f"   Files processed: {processed}")
    print(f"   Tasks extracted: {extracted}")

    if args.dry_run:
        print()
        print("   (Dry run - no files written)")
    else:
        print()
        print("✅ Task extraction complete!")
        print()
        print("Next steps:")
        print("   1. Run analytics: python3 scripts/analyze-category-heatmap.py")
        print("   2. Run analytics: python3 scripts/analyze-rhythm.py")
        print("   3. Run health check: python3 scripts/analyze-health.py --window-days 7")


if __name__ == "__main__":
    main()
