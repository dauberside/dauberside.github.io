#!/usr/bin/env python3
"""
Extract Task Data from Obsidian Daily Digests via MCP

Uses MCP Obsidian API to read daily digest files and converts them
to task-entry-*.json format for analytics processing.

Usage:
    python scripts/extract-tasks-mcp.py [--days 30]
"""

import json
import re
import sys
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import argparse


STATE_DIR = Path("cortex/state")


def parse_daily_digest(content: str, date_str: str) -> Dict[str, Any]:
    """
    Parse a daily digest markdown content and extract task data.

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


def read_obsidian_file_via_mcp(filepath: str) -> Optional[str]:
    """Read a file from Obsidian vault using MCP API (via claude mcp__obsidian__obsidian_get_file_contents)."""
    try:
        # This is a placeholder - in practice we'd use MCP tools
        # For now, return None to indicate we need manual MCP calls
        return None
    except Exception as e:
        print(f"⚠️  Error reading {filepath} via MCP: {e}", file=sys.stderr)
        return None


def process_digest_files(file_list: List[str], dry_run: bool = False) -> int:
    """
    Process daily digest files and generate task-entry JSON files.

    Returns number of files processed.
    """
    STATE_DIR.mkdir(parents=True, exist_ok=True)

    processed = 0
    extracted_total = 0

    print(f"📋 Found {len(file_list)} daily digest files", file=sys.stderr)
    print(f"⚠️  This script requires manual MCP file reads. Use batch_get_file_contents instead.", file=sys.stderr)
    print(f"   Or pipe individual files through extract-tasks-simple.py", file=sys.stderr)

    return processed, extracted_total


def main():
    parser = argparse.ArgumentParser(description="Extract task data from Obsidian Daily Digests via MCP")
    parser.add_argument("--days", type=int, default=30, help="Number of days to process (default: 30)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without writing files")

    args = parser.parse_args()

    print(f"🔍 This script is a placeholder.", file=sys.stderr)
    print(f"   Use MCP batch_get_file_contents to read all files, then process manually.", file=sys.stderr)
    print(f"   Or use extract-tasks-simple.py with individual file reads.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
