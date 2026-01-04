#!/usr/bin/env python3
"""
Simple Task Extractor from Daily Digest Markdown

Reads daily digest markdown from stdin and outputs task-entry JSON.

Usage:
    cat cortex/daily/2025-12-19-digest.md | python3 scripts/extract-tasks-simple.py 2025-12-19
"""

import json
import re
import sys
from typing import Dict, List, Any


def parse_daily_digest(content: str, date_str: str) -> Dict[str, Any]:
    """Parse daily digest markdown and extract tasks."""
    tasks = []
    current_category = "untagged"

    for line in content.split("\n"):
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

        # Parse task lines: - [x] or - [ ]
        task_match = re.match(r'^-\s*\[([ xX])\]\s+(.+)$', line)
        if task_match:
            is_completed = task_match.group(1).lower() == 'x'
            task_text = task_match.group(2).strip()

            # Extract duration if present: (30分)
            duration = None
            duration_match = re.search(r'\((\d+)分\)', task_text)
            if duration_match:
                duration = int(duration_match.group(1))
                task_text = re.sub(r'\s*\(\d+分\)', '', task_text).strip()

            task = {
                "title": task_text,
                "status": "completed" if is_completed else "incomplete",
                "category": current_category
            }

            if is_completed:
                # Default completion time: 10:00 JST (01:00 UTC)
                task["completed_at"] = f"{date_str}T01:00:00Z"
            else:
                task["completed_at"] = None

            if duration:
                task["duration_minutes"] = duration

            tasks.append(task)

    return {"tasks": tasks}


def main():
    if len(sys.argv) < 2:
        print("Usage: cat digest.md | python3 extract-tasks-simple.py YYYY-MM-DD", file=sys.stderr)
        sys.exit(1)

    date_str = sys.argv[1]
    content = sys.stdin.read()

    task_data = parse_daily_digest(content, date_str)
    print(json.dumps(task_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
