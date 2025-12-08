#!/usr/bin/env python3
"""
sync-digest-tasks.py - Sync digest and task-entry.json

Phase 2: Bidirectional sync between digest markdown and task-entry JSON

Usage:
    python scripts/sync-digest-tasks.py [date]
    python scripts/sync-digest-tasks.py 2025-12-08

Strategy:
    1. Parse digest markdown (## 進捗 section)
    2. Extract completed tasks with metadata
    3. Sync to task-entry-YYYY-MM-DD.json
    4. Handle conflicts based on timestamp
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional

# Resolve paths
ROOT = Path(__file__).resolve().parents[1]
DAILY_DIR = ROOT / "cortex" / "daily"
STATE_DIR = ROOT / "cortex" / "state"


def get_jst_now():
    """Get current time in JST (UTC+9)"""
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst)


def parse_digest_progress(digest_content: str) -> List[Dict]:
    """
    Parse ## 進捗 section and extract task entries
    
    Returns list of tasks with:
    - title: str
    - category: str
    - duration: str
    - memo: Optional[str]
    - timestamp: str (HH:MM JST)
    """
    tasks = []
    
    # Find ## 進捗 section
    progress_match = re.search(r'## 進捗\s*\n(.*?)(?=\n## |$)', digest_content, re.DOTALL)
    if not progress_match:
        return tasks
    
    progress_section = progress_match.group(1)
    
    # Parse task blocks: ### Title (HH:MM JST)
    task_pattern = r'### (.+?) \((\d{2}:\d{2}) JST\)\s*\n- \*\*カテゴリ\*\*: (.+?)\n- \*\*所要時間\*\*: (.+?)(?:\n- \*\*メモ\*\*: (.+?))?(?:\n|$)'
    
    for match in re.finditer(task_pattern, progress_section):
        title = match.group(1).strip()
        timestamp = match.group(2).strip()
        category = match.group(3).strip()
        duration = match.group(4).strip()
        memo = match.group(5).strip() if match.group(5) else None
        
        tasks.append({
            "title": title,
            "category": category,
            "duration": duration,
            "memo": memo,
            "timestamp": timestamp,
            "status": "completed"
        })
    
    return tasks


def load_task_entry(date: str) -> Dict:
    """Load task-entry-YYYY-MM-DD.json or create empty structure"""
    task_file = STATE_DIR / f"task-entry-{date}.json"
    
    if task_file.exists():
        with open(task_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    # Create empty structure
    return {
        "date": date,
        "tasks": [],
        "completed": [],
        "carryover": [],
        "reflection": "",
        "tomorrow_candidates": [],
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "sync-digest-tasks",
            "version": "1.0.0"
        }
    }


def sync_digest_to_tasks(date: str, digest_tasks: List[Dict], task_entry: Dict) -> bool:
    """
    Sync digest tasks to task-entry.json
    
    Returns True if changes were made
    """
    changed = False
    
    # Get existing completed task titles for deduplication
    existing_titles = {task.get("content", "") for task in task_entry.get("completed", [])}
    
    for dtask in digest_tasks:
        # Check if task already exists
        if dtask["title"] in existing_titles:
            continue
        
        # Convert to task-entry format
        task_obj = {
            "content": dtask["title"],
            "status": "completed",
            "category": dtask["category"],
            "duration": dtask["duration"],
            "timestamp": dtask["timestamp"]
        }
        
        if dtask["memo"]:
            task_obj["memo"] = dtask["memo"]
        
        # Add to completed list
        task_entry.setdefault("completed", []).append(task_obj)
        changed = True
        print(f"  ✅ Added: {dtask['title']}")
    
    return changed


def save_task_entry(date: str, task_entry: Dict) -> None:
    """Save task-entry-YYYY-MM-DD.json"""
    task_file = STATE_DIR / f"task-entry-{date}.json"
    
    # Update metadata
    task_entry["metadata"]["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    with open(task_file, 'w', encoding='utf-8') as f:
        json.dump(task_entry, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Saved: {task_file.name}")


def get_file_timestamps(date: str) -> Dict[str, Optional[float]]:
    """Get modification timestamps for conflict detection"""
    digest_file = DAILY_DIR / f"{date}-digest.md"
    task_file = STATE_DIR / f"task-entry-{date}.json"
    
    timestamps = {
        "digest": digest_file.stat().st_mtime if digest_file.exists() else None,
        "tasks": task_file.stat().st_mtime if task_file.exists() else None
    }
    
    return timestamps


def main():
    parser = argparse.ArgumentParser(
        description="Sync digest and task-entry.json (Phase 2)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/sync-digest-tasks.py                # Today
    python scripts/sync-digest-tasks.py 2025-12-08     # Specific date
        """,
    )
    
    parser.add_argument(
        "date",
        nargs="?",
        help="Date in YYYY-MM-DD format (default: today)"
    )
    
    args = parser.parse_args()
    
    # Determine date
    if args.date:
        date = args.date
    else:
        date = get_jst_now().strftime("%Y-%m-%d")
    
    print(f"🔄 Syncing digest ↔ tasks for {date}\n")
    
    # Load digest
    digest_file = DAILY_DIR / f"{date}-digest.md"
    if not digest_file.exists():
        print(f"❌ Digest not found: {digest_file}", file=sys.stderr)
        sys.exit(1)
    
    digest_content = digest_file.read_text(encoding='utf-8')
    
    # Parse digest tasks
    print("📖 Parsing digest...")
    digest_tasks = parse_digest_progress(digest_content)
    print(f"   Found {len(digest_tasks)} completed tasks in digest\n")
    
    # Load task-entry
    print("📖 Loading task-entry.json...")
    task_entry = load_task_entry(date)
    print(f"   Current completed tasks: {len(task_entry.get('completed', []))}\n")
    
    # Check timestamps for conflict detection
    timestamps = get_file_timestamps(date)
    if timestamps["digest"] and timestamps["tasks"]:
        if timestamps["digest"] > timestamps["tasks"]:
            print("⏰ Digest is newer → syncing digest → tasks")
        else:
            print("⏰ Tasks is newer → digest takes priority (human input)")
    
    # Sync digest → tasks
    print("\n🔄 Syncing digest → task-entry.json...")
    changed = sync_digest_to_tasks(date, digest_tasks, task_entry)
    
    if changed:
        save_task_entry(date, task_entry)
        print(f"\n✅ Sync complete!")
    else:
        print(f"\n✨ No changes needed (already in sync)")


if __name__ == "__main__":
    main()
