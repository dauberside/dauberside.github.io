#!/usr/bin/env python3
"""
Workload Heatmap Analyzer (MVP)

Analyzes task-entry.json files to generate workload patterns.
Outputs temporal-patterns.json and a Markdown report.

Usage:
    python scripts/analyze-workload.py [--days 30]
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

try:
    import pandas as pd
except ImportError:
    print("Error: pandas is required. Install with: pip install pandas", file=sys.stderr)
    sys.exit(1)


def load_task_entries(days=30):
    """Load task entries from the last N days."""
    entries = []
    base_path = Path(__file__).parent.parent / "cortex" / "state"
    
    if not base_path.exists():
        print(f"Warning: {base_path} does not exist", file=sys.stderr)
        return []
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    current = start_date
    while current <= end_date:
        date_str = current.strftime("%Y-%m-%d")
        file_path = base_path / f"task-entry-{date_str}.json"
        
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    file_date = data.get('date', date_str)
                    
                    # Add date to each task
                    for task in data.get('tasks', []):
                        task['date'] = file_date
                        entries.append(task)
            except Exception as e:
                print(f"Warning: Failed to load {file_path}: {e}", file=sys.stderr)
        
        current += timedelta(days=1)
    
    return entries


def analyze_workload(entries):
    """Analyze workload patterns from task entries."""
    if not entries:
        return {
            "total_tasks": 0,
            "by_weekday": {},
            "by_status": {},
            "by_category": {},
            "completion_rate": 0.0
        }
    
    # Convert to DataFrame
    df = pd.DataFrame(entries)
    
    # Parse dates and add weekday
    df['date'] = pd.to_datetime(df['date'])
    df['weekday'] = df['date'].dt.day_name()
    
    # Basic statistics
    total_tasks = len(df)
    completed = len(df[df['status'] == 'done'])
    completion_rate = (completed / total_tasks * 100) if total_tasks > 0 else 0.0
    
    # By weekday
    weekday_counts = df.groupby('weekday').size().to_dict()
    weekday_completion = df[df['status'] == 'done'].groupby('weekday').size().to_dict()
    
    by_weekday = {}
    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        total = weekday_counts.get(day, 0)
        done = weekday_completion.get(day, 0)
        by_weekday[day] = {
            "total": total,
            "completed": done,
            "completion_rate": (done / total * 100) if total > 0 else 0.0
        }
    
    # By status
    by_status = df['status'].value_counts().to_dict()
    
    # By category
    by_category = {}
    if 'category' in df.columns:
        by_category = df['category'].value_counts().to_dict()
    
    return {
        "total_tasks": total_tasks,
        "completion_rate": round(completion_rate, 1),
        "by_weekday": by_weekday,
        "by_status": by_status,
        "by_category": by_category,
        "period": {
            "start": df['date'].min().strftime("%Y-%m-%d"),
            "end": df['date'].max().strftime("%Y-%m-%d"),
            "days": (df['date'].max() - df['date'].min()).days + 1
        }
    }


def generate_markdown_report(analysis):
    """Generate Markdown report from analysis."""
    lines = [
        "# Workload Analysis Report",
        "",
        f"**Period**: {analysis['period']['start']} to {analysis['period']['end']} ({analysis['period']['days']} days)",
        f"**Total Tasks**: {analysis['total_tasks']}",
        f"**Completion Rate**: {analysis['completion_rate']}%",
        "",
        "## Workload by Weekday",
        "",
        "| Weekday | Total | Completed | Rate |",
        "|---------|-------|-----------|------|"
    ]
    
    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        stats = analysis['by_weekday'].get(day, {"total": 0, "completed": 0, "completion_rate": 0.0})
        lines.append(f"| {day} | {stats['total']} | {stats['completed']} | {stats['completion_rate']:.1f}% |")
    
    lines.extend([
        "",
        "## Task Status Distribution",
        ""
    ])
    
    for status, count in analysis['by_status'].items():
        lines.append(f"- **{status}**: {count}")
    
    if analysis['by_category']:
        lines.extend([
            "",
            "## Task Categories",
            ""
        ])
        for category, count in sorted(analysis['by_category'].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"- **{category}**: {count}")
    
    return "\n".join(lines)


def main():
    """Main entry point."""
    days = 30
    if len(sys.argv) > 1:
        if sys.argv[1] == '--days' and len(sys.argv) > 2:
            days = int(sys.argv[2])
    
    print(f"Loading task entries from the last {days} days...", file=sys.stderr)
    entries = load_task_entries(days)
    
    if not entries:
        print("No task entries found. Generate some with convert-to-task-entry.mjs first.", file=sys.stderr)
        sys.exit(1)
    
    print(f"Analyzing {len(entries)} tasks...", file=sys.stderr)
    analysis = analyze_workload(entries)
    
    # Save JSON
    output_dir = Path(__file__).parent.parent / "data" / "analytics"
    output_dir.mkdir(exist_ok=True)
    
    json_path = output_dir / "temporal-patterns.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved: {json_path}", file=sys.stderr)
    
    # Save Markdown
    md_path = output_dir / "workload-report.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(generate_markdown_report(analysis))
    print(f"✓ Saved: {md_path}", file=sys.stderr)
    
    print("\n" + "="*60, file=sys.stderr)
    print(f"Analysis complete! {analysis['total_tasks']} tasks analyzed.", file=sys.stderr)
    print(f"Completion rate: {analysis['completion_rate']}%", file=sys.stderr)
    print("="*60, file=sys.stderr)


if __name__ == "__main__":
    main()
