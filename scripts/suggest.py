#!/usr/bin/env python3
"""
/suggest - Smart Task Suggestions
Version: 1.0 (MVP)
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Paths
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
ANALYTICS_DIR = DATA_DIR / "analytics"
CORTEX_DIR = REPO_ROOT / "cortex" / "daily"

TEMPORAL_PATTERNS = ANALYTICS_DIR / "temporal-patterns.json"
TOMORROW_CANDIDATES = DATA_DIR / "tomorrow.json"


def load_json(filepath: Path) -> Any:
    """Load JSON file safely."""
    if not filepath.exists():
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Error reading {filepath}: {e}", file=sys.stderr)
        return None


def load_temporal_patterns() -> Dict:
    """Load temporal-patterns.json."""
    patterns = load_json(TEMPORAL_PATTERNS)
    if not patterns:
        print("⚠️  No temporal patterns found. Run analyze-workload.py first.", file=sys.stderr)
        return {}
    return patterns


def load_tomorrow_candidates() -> List[Dict]:
    """Load tomorrow.json."""
    data = load_json(TOMORROW_CANDIDATES)
    if not data or 'tomorrow_candidates' not in data:
        print("⚠️  No tomorrow candidates found.", file=sys.stderr)
        return []
    return data['tomorrow_candidates']


def load_today_digest(date_str: str) -> List[str]:
    """Extract task list from today's digest."""
    digest_path = CORTEX_DIR / f"{date_str}-digest.md"
    if not digest_path.exists():
        return []
    
    tasks = []
    with open(digest_path, 'r', encoding='utf-8') as f:
        in_tasks_section = False
        for line in f:
            if line.startswith('## Tasks'):
                in_tasks_section = True
                continue
            if in_tasks_section:
                if line.startswith('##'):  # Next section
                    break
                if line.strip().startswith('- '):
                    # Extract task text (remove checkbox and formatting)
                    task_text = line.strip()[2:].replace('[x]', '').replace('[ ]', '').strip()
                    tasks.append(task_text)
    
    return tasks


def get_weekday_pattern(patterns: Dict, weekday: int) -> Dict:
    """Get today's weekday pattern."""
    weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekday_name = weekday_names[weekday]
    
    if 'by_weekday' not in patterns:
        return {'avg_tasks': 10, 'avg_completion': 0.75}
    
    weekday_data = patterns['by_weekday'].get(weekday_name, {})
    return {
        'avg_tasks': weekday_data.get('avg_tasks', 10),
        'avg_completion': weekday_data.get('avg_completion', 0.75)
    }


def filter_duplicate_tasks(candidates: List[Dict], existing_tasks: List[str]) -> List[Dict]:
    """Filter out tasks that already exist in today's digest."""
    filtered = []
    existing_lower = [task.lower() for task in existing_tasks]
    
    for candidate in candidates:
        task_text = candidate.get('task', '').lower()
        # Check for substring matches (flexible matching)
        is_duplicate = any(task_text in existing or existing in task_text 
                          for existing in existing_lower)
        if not is_duplicate:
            filtered.append(candidate)
    
    return filtered


def select_top_suggestions(candidates: List[Dict], load_pattern: Dict, limit: int = 3) -> List[Dict]:
    """Select top N suggestions based on load pattern."""
    avg_load = load_pattern.get('avg_tasks', 10)
    
    # Strategy: if high load day, prefer lighter tasks (bottom of priority)
    # If low load day, prefer important tasks (top of priority)
    if avg_load > 15:  # High load threshold
        # Reverse order for lighter tasks
        sorted_candidates = sorted(candidates, key=lambda x: x.get('priority', 999), reverse=True)
    else:
        # Normal order for important tasks
        sorted_candidates = sorted(candidates, key=lambda x: x.get('priority', 999))
    
    return sorted_candidates[:limit]


def format_output(suggestions: List[Dict], context: Dict) -> str:
    """Format suggestions as Markdown."""
    weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    today = datetime.now()
    weekday_name = weekday_names[today.weekday()]
    
    output = [
        f"🎯 Today's Suggestions ({weekday_name}, {today.strftime('%b %d')})",
        "",
        "Based on your patterns:",
        f"- {weekday_name} avg load: {context['avg_tasks']:.0f} tasks ({load_level(context['avg_tasks'])})",
        f"- Typical completion rate: {context['avg_completion']*100:.0f}%",
        "",
        "Recommended tasks:",
        ""
    ]
    
    priority_labels = {1: "High Priority", 2: "Medium Priority", 3: "Low Priority"}
    
    for i, suggestion in enumerate(suggestions, 1):
        task = suggestion.get('task', 'Unknown task')
        priority = suggestion.get('priority', 3)
        label = priority_labels.get(priority, "Normal Priority")
        
        output.append(f"{i}. [{label}] {task}")
        
        # Add optional metadata if available
        if 'estimated_time' in suggestion:
            output.append(f"   → Est. {suggestion['estimated_time']}")
        
        output.append("")
    
    output.append(f"💡 Tip: These suggestions balance your typical {weekday_name} workload with current priorities.")
    
    return "\n".join(output)


def load_level(avg_tasks: float) -> str:
    """Classify load level."""
    if avg_tasks < 10:
        return "light"
    elif avg_tasks < 15:
        return "moderate"
    else:
        return "heavy"


def main():
    """Main execution."""
    today = datetime.now()
    today_str = today.strftime('%Y-%m-%d')
    weekday = today.weekday()
    
    # Load data
    patterns = load_temporal_patterns()
    candidates = load_tomorrow_candidates()
    existing_tasks = load_today_digest(today_str)
    
    # Check if we have candidates
    if not candidates:
        print("⚠️  No task candidates available. Nothing to suggest.")
        return
    
    # Get today's load pattern
    load_pattern = get_weekday_pattern(patterns, weekday)
    
    # Filter duplicates
    filtered_candidates = filter_duplicate_tasks(candidates, existing_tasks)
    
    if not filtered_candidates:
        print("✅ All candidate tasks are already in today's digest!")
        return
    
    # Select top suggestions
    suggestions = select_top_suggestions(filtered_candidates, load_pattern, limit=3)
    
    if not suggestions:
        print("⚠️  Could not generate suggestions.")
        return
    
    # Format and output
    context = {
        'avg_tasks': load_pattern['avg_tasks'],
        'avg_completion': load_pattern['avg_completion']
    }
    
    output = format_output(suggestions, context)
    print(output)


if __name__ == "__main__":
    main()
