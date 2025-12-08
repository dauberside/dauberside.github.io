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


def get_digest_task_titles(digest_content: str) -> set:
    """
    Extract existing task titles from ## 進捗 section

    Returns set of task titles for duplicate detection
    """
    tasks = parse_digest_progress(digest_content)
    return {task["title"].strip() for task in tasks}


def find_section_end(section_name: str, content: str) -> int:
    """
    Find the end position of a markdown section

    Returns position where new content should be inserted
    (before next ## section or EOF)
    """
    # Find section start
    section_pattern = rf'^{re.escape(section_name)}\s*$'
    section_match = re.search(section_pattern, content, re.MULTILINE)

    if not section_match:
        raise ValueError(f"Section '{section_name}' not found in content")

    section_start = section_match.end()

    # Find next ## section or EOF
    next_section_pattern = r'\n##\s+'
    next_section = re.search(next_section_pattern, content[section_start:])

    if next_section:
        return section_start + next_section.start()
    else:
        # EOF
        return len(content)


def format_task_for_digest(task: Dict) -> str:
    """
    Format a task dict into digest markdown format

    Input task dict:
    {
        "content": "タスクタイトル",
        "category": "core-work",
        "duration": "30m",
        "timestamp": "10:00",
        "memo": "optional memo"
    }

    Output markdown:
    ### タスクタイトル (10:00 JST)
    - **カテゴリ**: core-work
    - **所要時間**: 30m
    - **メモ**: optional memo
    """
    lines = []

    title = task.get("content", "").strip()
    timestamp = task.get("timestamp", "00:00").strip()
    category = task.get("category", "unknown").strip()
    duration = task.get("duration", "0m").strip()
    memo = task.get("memo")

    # Title line
    lines.append(f"### {title} ({timestamp} JST)")

    # Metadata
    lines.append(f"- **カテゴリ**: {category}")
    lines.append(f"- **所要時間**: {duration}")

    if memo:
        lines.append(f"- **メモ**: {memo.strip()}")

    return "\n".join(lines) + "\n"


def sync_tasks_to_digest(date: str, task_entry: Dict, digest_path: Path) -> bool:
    """
    Sync tasks.json → digest (append-only, digest-safe)

    Strategy:
    1. Load digest content
    2. Parse existing task titles from ## 進捗
    3. Find tasks in task_entry.completed not in digest
    4. Format new tasks in digest format
    5. Append to ## 進捗 section (末尾追加)
    6. Write back safely

    Returns True if changes were made
    """
    # Load digest
    if not digest_path.exists():
        print(f"  ⚠️  Digest not found: {digest_path.name}")
        return False

    digest_content = digest_path.read_text(encoding='utf-8')

    # Get existing task titles
    try:
        existing_titles = get_digest_task_titles(digest_content)
    except Exception as e:
        print(f"  ❌ Error parsing digest: {e}")
        return False

    # Get completed tasks from task-entry
    completed_tasks = task_entry.get("completed", [])

    # Find new tasks (in task-entry but not in digest)
    new_tasks = []
    for task in completed_tasks:
        task_title = task.get("content", "").strip()
        if task_title and task_title not in existing_titles:
            new_tasks.append(task)

    if not new_tasks:
        return False

    # Format new tasks
    new_tasks_formatted = "\n" + "\n".join(format_task_for_digest(task) for task in new_tasks)

    # Find insertion position (end of ## 進捗 section)
    try:
        progress_end = find_section_end("## 進捗", digest_content)
    except ValueError as e:
        print(f"  ❌ {e}")
        return False

    # Insert new tasks
    new_content = digest_content[:progress_end] + new_tasks_formatted + digest_content[progress_end:]

    # Write back
    digest_path.write_text(new_content, encoding='utf-8')

    print(f"  ✅ Added {len(new_tasks)} tasks to digest:")
    for task in new_tasks:
        print(f"     - {task.get('content', 'Untitled')}")

    return True


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
    
    # Bidirectional sync
    print("\n🔄 Syncing digest → task-entry.json...")
    changed_digest_to_tasks = sync_digest_to_tasks(date, digest_tasks, task_entry)

    print("\n🔄 Syncing task-entry.json → digest...")
    changed_tasks_to_digest = sync_tasks_to_digest(date, task_entry, digest_file)

    # Save task-entry if needed
    if changed_digest_to_tasks:
        save_task_entry(date, task_entry)

    # Summary
    if changed_digest_to_tasks or changed_tasks_to_digest:
        print(f"\n✅ Bidirectional sync complete!")
        if changed_digest_to_tasks:
            print(f"   ↓ digest → task-entry")
        if changed_tasks_to_digest:
            print(f"   ↑ task-entry → digest")
    else:
        print(f"\n✨ No changes needed (already in sync)")


if __name__ == "__main__":
    main()
