#!/usr/bin/env python3
"""
Task Entry Extractor

Extracts tasks from multiple sources and generates task-entry.json files.

Sources:
  - cortex/daily/YYYY-MM-DD-digest.md (daily digest)
  - TODO.md (todo sync)
  - data/tomorrow.json (wrap-up)

Output:
  - cortex/state/task-entry-YYYY-MM-DD.json

Usage:
    python scripts/extract-tasks.py [--date YYYY-MM-DD] [--days 30]
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse


def parse_markdown_tasks(content: str, source: str, date: str) -> List[Dict[str, Any]]:
    """
    Parse tasks from Markdown content.
    
    Recognizes:
      - [ ] Pending task
      - [x] Completed task
      - [X] Completed task
    """
    tasks = []
    task_pattern = r'^\s*-\s*\[([xX ])\]\s*(.+)$'
    
    for line in content.split('\n'):
        match = re.match(task_pattern, line)
        if match:
            status_char = match.group(1)
            title = match.group(2).strip()
            
            # Skip empty titles
            if not title:
                continue
            
            # Determine status
            status = 'done' if status_char.lower() == 'x' else 'pending'
            
            # Extract category from tags (e.g., #work)
            category = None
            tag_match = re.search(r'#(\w+)', title)
            if tag_match:
                category = tag_match.group(1)
            
            # Generate task ID
            task_id = f"{date}-{len(tasks)+1}"
            
            task = {
                "id": task_id,
                "title": title,
                "status": status,
                "source": source
            }
            
            if category:
                task["category"] = category
            
            if status == 'done':
                task["completed_at"] = f"{date}T12:00:00Z"
            
            tasks.append(task)
    
    return tasks


def extract_from_daily_digest(date_str: str) -> List[Dict[str, Any]]:
    """Extract tasks from daily digest file."""
    file_path = Path(f"cortex/daily/{date_str}-digest.md")
    
    if not file_path.exists():
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return parse_markdown_tasks(content, "daily-digest", date_str)
    except Exception as e:
        print(f"Warning: Failed to extract from {file_path}: {e}", file=sys.stderr)
        return []


def extract_from_todo(date_str: str) -> List[Dict[str, Any]]:
    """Extract tasks from TODO.md (today and tomorrow sections)."""
    file_path = Path("TODO.md")
    
    if not file_path.exists():
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract ## Today section
        today_match = re.search(r'## Today.*?(?=\n##|\Z)', content, re.DOTALL)
        if today_match:
            today_content = today_match.group(0)
            return parse_markdown_tasks(today_content, "todo-sync", date_str)
        
        return []
    except Exception as e:
        print(f"Warning: Failed to extract from TODO.md: {e}", file=sys.stderr)
        return []


def extract_from_tomorrow_json(date_str: str) -> List[Dict[str, Any]]:
    """Extract tasks from tomorrow.json."""
    file_path = Path("data/tomorrow.json")
    
    if not file_path.exists():
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        tasks = []
        for idx, candidate in enumerate(data.get('tomorrow_candidates', [])):
            task_id = f"{date_str}-tomorrow-{idx+1}"
            task = {
                "id": task_id,
                "title": candidate.get('task', ''),
                "status": "pending",
                "source": "wrap-up",
                "priority": candidate.get('priority', 'medium')
            }
            
            if 'reasoning' in candidate:
                task["notes"] = candidate['reasoning']
            
            tasks.append(task)
        
        return tasks
    except Exception as e:
        print(f"Warning: Failed to extract from tomorrow.json: {e}", file=sys.stderr)
        return []


def merge_tasks(all_tasks: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Merge tasks from multiple sources, removing duplicates by title.
    Priority order: daily-digest > todo-sync > wrap-up
    """
    seen_titles = set()
    merged = []
    
    for task_list in all_tasks:
        for task in task_list:
            title = task['title'].lower().strip()
            
            # Remove markdown checkbox if present
            title = re.sub(r'^\[[ xX]\]\s*', '', title).strip()
            
            if title not in seen_titles:
                seen_titles.add(title)
                merged.append(task)
    
    return merged


def generate_task_entry(date_str: str) -> Dict[str, Any]:
    """Generate complete task-entry.json for a specific date."""
    
    # Extract from all sources
    digest_tasks = extract_from_daily_digest(date_str)
    todo_tasks = extract_from_todo(date_str) if date_str == datetime.now().strftime("%Y-%m-%d") else []
    tomorrow_tasks = extract_from_tomorrow_json(date_str) if date_str == datetime.now().strftime("%Y-%m-%d") else []
    
    # Merge tasks (priority: digest > todo > tomorrow)
    all_tasks = merge_tasks([digest_tasks, todo_tasks, tomorrow_tasks])
    
    # Calculate metadata
    total_tasks = len(all_tasks)
    completed = sum(1 for t in all_tasks if t['status'] == 'done')
    completion_rate = completed / total_tasks if total_tasks > 0 else 0.0
    
    # Determine workload level
    if total_tasks >= 15:
        workload_level = "high"
    elif total_tasks <= 5:
        workload_level = "low"
    else:
        workload_level = "normal"
    
    return {
        "date": date_str,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tasks": all_tasks,
        "metadata": {
            "total_tasks": total_tasks,
            "completed": completed,
            "completion_rate": round(completion_rate, 2),
            "workload_level": workload_level
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Extract tasks and generate task-entry.json")
    parser.add_argument('--date', type=str, help='Specific date (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, default=30, help='Number of days to process')
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path("cortex/state")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if args.date:
        # Process single date
        dates = [args.date]
    else:
        # Process last N days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=args.days)
        dates = []
        
        current = start_date
        while current <= end_date:
            dates.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
    
    processed = 0
    for date_str in dates:
        entry = generate_task_entry(date_str)
        
        # Only save if there are tasks
        if entry['metadata']['total_tasks'] > 0:
            output_file = output_dir / f"task-entry-{date_str}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(entry, f, indent=2, ensure_ascii=False)
            
            print(f"✓ {date_str}: {entry['metadata']['total_tasks']} tasks ({entry['metadata']['completed']} completed)")
            processed += 1
    
    print(f"\n✅ Processed {processed} dates")
    print(f"📁 Output: cortex/state/task-entry-*.json")


if __name__ == "__main__":
    main()
