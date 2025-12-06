#!/usr/bin/env python3
"""
/suggest - Smart Task Suggestions
Version: 2.0 (Adaptive Suggestions - Phase 2)
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
STATE_DIR = REPO_ROOT / "cortex" / "state"

TEMPORAL_PATTERNS = ANALYTICS_DIR / "temporal-patterns.json"
TOMORROW_CANDIDATES = STATE_DIR / "tomorrow.json"  # Fixed: Read from cortex/state (Recipe 13 output)
RHYTHM_PATTERNS = STATE_DIR / "rhythm-patterns.json"
CATEGORY_HEATMAP = STATE_DIR / "category-heatmap.json"
DURATION_STATS = STATE_DIR / "duration-patterns.json"
FEEDBACK_HISTORY = STATE_DIR / "feedback-history.json"


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
    """Load tomorrow.json and normalize format."""
    data = load_json(TOMORROW_CANDIDATES)
    if not data or 'tomorrow_candidates' not in data:
        print("⚠️  No tomorrow candidates found.", file=sys.stderr)
        return []

    candidates = data['tomorrow_candidates']
    normalized = []

    for candidate in candidates:
        # Handle both string and dict formats
        if isinstance(candidate, str):
            # Convert string to dict format with default values
            normalized.append({
                'task': candidate,
                'priority': 2,  # Default to medium priority
                'estimated_time': '20min'
            })
        elif isinstance(candidate, dict):
            # Already in correct format
            normalized.append(candidate)

    return normalized


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


def rhythm_score(task: Dict, rhythm: Dict) -> float:
    """Calculate rhythm compatibility score (0.0-1.0)."""
    if not rhythm or 'chronotype' not in rhythm:
        return 0.5  # neutral
    
    chronotype = rhythm['chronotype']
    estimated_minutes = task.get('estimated_minutes', 30)
    is_heavy = estimated_minutes >= 45
    
    if chronotype in ['morning', 'evening'] and is_heavy:
        return 1.0  # Heavy tasks match user's peak time
    elif is_heavy:
        return 0.2  # Heavy tasks in non-optimal time
    else:
        return 0.6  # Light tasks are flexible


def category_score(task: Dict, weekday: str, category_heatmap: Dict) -> float:
    """Calculate category-weekday compatibility score (0.0-1.0)."""
    if not category_heatmap:
        return 0.5  # neutral
    
    category = task.get('category', 'uncategorized')
    dominant = category_heatmap.get('dominant_categories', {}).get(weekday, [])
    
    # Extract category names from dominant list
    dominant_names = [d['category'] for d in dominant] if dominant else []
    
    if category in dominant_names:
        return 1.0  # Perfect match with weekday pattern
    
    # Check if category appears at all on this weekday
    weekday_matrix = category_heatmap.get('weekday_category_matrix', {}).get(weekday, {})
    if category in weekday_matrix and weekday_matrix[category] > 0:
        return 0.6  # Category is used on this weekday
    
    return 0.4  # Rare category for this weekday


def energy_factor(energy: int | None) -> float:
    """Calculate energy-based score multiplier."""
    if energy is None:
        return 1.0  # No adjustment
    if energy <= 4:
        return 0.6  # Low energy: reduce heavy tasks
    if energy <= 7:
        return 1.0  # Normal energy
    return 1.2      # High energy: boost heavy tasks


def score_task(task: Dict, context: Dict) -> float:
    """Calculate comprehensive task score."""
    # Base priority score (P1 > P2 > P3)
    priority = task.get('priority', 3)
    priority_score = (4 - priority) / 3.0  # 1.0 for P1, 0.67 for P2, 0.33 for P3
    
    # Rhythm compatibility
    rhythm = context.get('rhythm', {})
    rhythm_s = rhythm_score(task, rhythm)
    
    # Category-weekday fit
    weekday = context.get('weekday', 'Monday')
    category_heatmap = context.get('category_heatmap', {})
    category_s = category_score(task, weekday, category_heatmap)
    
    # Energy-based adjustment
    feedback = context.get('feedback', {})
    energy = feedback.get('energy')
    energy_mult = energy_factor(energy)
    
    # Weighted combination
    total_score = (
        0.50 * priority_score +  # Priority is most important
        0.25 * rhythm_s +        # Rhythm compatibility
        0.25 * category_s        # Category fit
    )
    
    # Apply energy multiplier
    return total_score * energy_mult


def select_top_suggestions(candidates: List[Dict], context: Dict, limit: int = 3) -> List[Dict]:
    """Select top N suggestions based on comprehensive scoring."""
    # Score all candidates
    scored = [(task, score_task(task, context)) for task in candidates]

    # Sort by score (descending)
    sorted_candidates = sorted(scored, key=lambda x: x[1], reverse=True)

    # Return top N tasks (without scores)
    return [task for task, _ in sorted_candidates[:limit]]


def format_output(suggestions: List[Dict], context: Dict) -> str:
    """Format suggestions as Markdown."""
    today = datetime.now()
    weekday_name = context.get('weekday', 'Today')
    
    output = [
        f"🎯 Today's Suggestions ({weekday_name}, {today.strftime('%b %d')})",
        "",
        "📊 Based on your patterns:",
        f"- {weekday_name} avg load: {context['avg_tasks']:.0f} tasks ({load_level(context['avg_tasks'])})",
        f"- Typical completion rate: {context['avg_completion']*100:.0f}%",
    ]
    
    # Add v1.3 intelligence insights
    rhythm = context.get('rhythm', {})
    if rhythm and 'chronotype' in rhythm:
        chrono_labels = {
            'morning': '🌅 Morning type',
            'evening': '🌙 Evening type',
            'balanced': '⚖️ Balanced',
            'unknown': '❓ Unknown'
        }
        chrono_label = chrono_labels.get(rhythm['chronotype'], rhythm['chronotype'])
        output.append(f"- Your rhythm: {chrono_label}")
    
    # Add energy/mood feedback
    feedback = context.get('feedback', {})
    if feedback:
        energy = feedback.get('energy')
        mood = feedback.get('mood')
        if energy is not None:
            energy_labels = {
                (1, 4): "⚠️ Low energy",
                (5, 7): "🔋 Normal energy",
                (8, 10): "⚡ High energy"
            }
            energy_label = next((label for (low, high), label in energy_labels.items() 
                                if low <= energy <= high), f"Energy: {energy}/10")
            output.append(f"- {energy_label} ({energy}/10)")
        if mood:
            mood_emoji = {1: "😔", 2: "🙁", 3: "😐", 4: "🙂", 5: "😀"}.get(mood, "")
            output.append(f"- Mood: {mood_emoji} {mood}/5")
    
    category_heatmap = context.get('category_heatmap', {})
    if category_heatmap and 'dominant_categories' in category_heatmap:
        dominant = category_heatmap['dominant_categories'].get(weekday_name, [])
        if dominant:
            top_cat = dominant[0]['category']
            output.append(f"- {weekday_name}'s focus: {top_cat}")
    
    output.extend(["", "✨ Recommended tasks:", ""])
    
    priority_labels = {1: "🔴 High", 2: "🟡 Medium", 3: "🟢 Low"}
    
    for i, suggestion in enumerate(suggestions, 1):
        task = suggestion.get('task', 'Unknown task')
        priority = suggestion.get('priority', 3)
        category = suggestion.get('category', '')
        label = priority_labels.get(priority, "Normal")
        
        task_line = f"{i}. {label} {task}"
        if category:
            task_line += f" [{category}]"
        output.append(task_line)
        
        # Add optional metadata
        if 'estimated_time' in suggestion:
            output.append(f"   ⏱️  Est. {suggestion['estimated_time']}")
        
        output.append("")
    
    output.append(f"💡 These suggestions are optimized for your {weekday_name} patterns and current priorities.")
    
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
    weekday_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekday_name = weekday_names[weekday]
    
    # Load data sources
    patterns = load_temporal_patterns()
    candidates = load_tomorrow_candidates()
    existing_tasks = load_today_digest(today_str)
    
    # Load v1.3 analytics (optional - graceful degradation)
    rhythm = load_json(RHYTHM_PATTERNS) or {}
    category_heatmap = load_json(CATEGORY_HEATMAP) or {}
    feedback_history = load_json(FEEDBACK_HISTORY) or {}
    
    # Get latest feedback (today or yesterday)
    latest_feedback = {}
    if feedback_history and 'entries' in feedback_history:
        entries = feedback_history['entries']
        if entries:
            latest_feedback = entries[0]  # Most recent entry
    
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
    
    # Build context for scoring
    context = {
        'avg_tasks': load_pattern['avg_tasks'],
        'avg_completion': load_pattern['avg_completion'],
        'weekday': weekday_name,
        'rhythm': rhythm,
        'category_heatmap': category_heatmap,
        'feedback': latest_feedback
    }
    
    # Select top suggestions with adaptive scoring
    suggestions = select_top_suggestions(filtered_candidates, context, limit=3)
    
    if not suggestions:
        print("⚠️  Could not generate suggestions.")
        return
    
    # Format and output
    output = format_output(suggestions, context)
    print(output)


if __name__ == "__main__":
    main()
