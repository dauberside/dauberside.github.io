#!/usr/bin/env python3
"""
Duration Learning Analyzer

Learns task duration patterns from historical task-entry data.

Input:
  - cortex/state/task-entry-*.json (past 30+ days)

Output:
  - cortex/state/duration-patterns.json

Usage:
    python scripts/analyze-duration.py [--days 30] [--min-samples 3]
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict
import argparse
import statistics


def load_task_entries(days: int) -> List[Dict[str, Any]]:
    """Load task-entry files from the past N days."""
    state_dir = Path('cortex/state')
    if not state_dir.exists():
        print(f"❌ State directory not found: {state_dir}", file=sys.stderr)
        sys.exit(1)
    
    entries = []
    today = datetime.now().date()
    
    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        entry_file = state_dir / f'task-entry-{date_str}.json'
        
        if entry_file.exists():
            try:
                with open(entry_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    entries.append(data)
            except json.JSONDecodeError:
                print(f"⚠️  Skipping invalid JSON: {entry_file}", file=sys.stderr)
            except Exception as e:
                print(f"⚠️  Error loading {entry_file}: {e}", file=sys.stderr)
    
    return entries


def is_task_completed(task: Dict[str, Any]) -> bool:
    """
    Check if a task is completed using multiple indicators.

    Supports:
    - status: "completed", "done", "finished"
    - title: starts with "[x]" or "- [x]"
    """
    status = task.get("status", "").lower()
    title = task.get("title", "")

    return (
        status in ("completed", "done", "finished") or
        title.startswith("[x]") or
        title.startswith("- [x]")
    )


def extract_durations(entries: List[Dict[str, Any]], min_confidence: float = 0.7) -> Dict[str, List[float]]:
    """
    Extract duration data grouped by category.

    Args:
        entries: List of task entry dictionaries
        min_confidence: Minimum duration_confidence to include (default: 0.7)
                       This filters out low-quality duration data:
                       - 1.0: explicit duration (10分, 10m)
                       - 0.7: timerange-derived duration
                       - 0.3: inferred (excluded by default)
                       - 0.0: unknown (excluded by default)

    Returns:
        {
            "development": [1.5, 2.0, 1.8, ...],
            "meeting": [0.5, 1.0, 0.75, ...],
            ...
        }
    """
    durations_by_category = defaultdict(list)
    filtered_count = 0
    total_with_duration = 0

    for entry in entries:
        tasks = entry.get('tasks', [])
        for task in tasks:
            # Only analyze completed tasks with duration data
            if not is_task_completed(task):
                continue

            # Support both duration_hours and duration_minutes
            duration_hours = task.get('duration_hours')
            duration_minutes = task.get('duration_minutes')

            # Check duration_confidence (new: confidence filtering)
            duration_confidence = task.get('duration_confidence', 1.0)  # Default to 1.0 for backwards compat

            if duration_minutes is not None or duration_hours is not None:
                total_with_duration += 1

                # Filter by confidence threshold
                if duration_confidence < min_confidence:
                    filtered_count += 1
                    continue

            # Convert minutes to hours if available
            if duration_minutes is not None and duration_minutes > 0:
                duration = duration_minutes / 60.0
            elif duration_hours is not None and duration_hours > 0:
                duration = duration_hours
            else:
                continue

            category = task.get('category', 'uncategorized')
            durations_by_category[category].append(duration)

    # Log filtering statistics
    if total_with_duration > 0:
        print(f"🔍 Duration confidence filtering (min_confidence={min_confidence}):", file=sys.stderr)
        print(f"   Total with duration: {total_with_duration}", file=sys.stderr)
        print(f"   Filtered out (low confidence): {filtered_count}", file=sys.stderr)
        print(f"   Accepted: {total_with_duration - filtered_count}", file=sys.stderr)

    return dict(durations_by_category)


def calculate_duration_stats(durations: List[float]) -> Dict[str, Any]:
    """Calculate statistical measures for a list of durations."""
    if not durations:
        return {
            'count': 0,
            'mean': 0,
            'median': 0,
            'std_dev': 0,
            'min': 0,
            'max': 0,
            'confidence': 'none'
        }
    
    count = len(durations)
    mean = statistics.mean(durations)
    median = statistics.median(durations)
    std_dev = statistics.stdev(durations) if count > 1 else 0
    
    # Determine confidence level based on sample size
    if count >= 10:
        confidence = 'high'
    elif count >= 5:
        confidence = 'medium'
    elif count >= 3:
        confidence = 'low'
    else:
        confidence = 'insufficient'
    
    return {
        'count': count,
        'mean': round(mean, 2),
        'median': round(median, 2),
        'std_dev': round(std_dev, 2),
        'min': round(min(durations), 2),
        'max': round(max(durations), 2),
        'confidence': confidence
    }


def generate_duration_patterns(durations_by_category: Dict[str, List[float]], 
                               min_samples: int) -> Dict[str, Any]:
    """Generate duration pattern analysis."""
    patterns = {}
    
    for category, durations in durations_by_category.items():
        if len(durations) < min_samples:
            continue
        
        patterns[category] = calculate_duration_stats(durations)
    
    # Calculate overall statistics
    all_durations = []
    for durations in durations_by_category.values():
        all_durations.extend(durations)
    
    overall_stats = calculate_duration_stats(all_durations)
    
    return {
        'generated_at': datetime.now().isoformat(),
        'analysis_period_days': None,  # Will be set by caller
        'min_samples_required': min_samples,
        'overall': overall_stats,
        'by_category': patterns,
        'insights': generate_insights(patterns, overall_stats)
    }


def generate_insights(patterns: Dict[str, Any], overall: Dict[str, Any]) -> List[str]:
    """Generate human-readable insights from duration patterns."""
    insights = []
    
    # Identify quick vs long categories
    quick_threshold = 1.0  # hours
    long_threshold = 3.0   # hours
    
    quick_categories = []
    long_categories = []
    
    for category, stats in patterns.items():
        if stats['confidence'] in ['high', 'medium']:
            if stats['mean'] < quick_threshold:
                quick_categories.append(category)
            elif stats['mean'] > long_threshold:
                long_categories.append(category)
    
    if quick_categories:
        insights.append(f"Quick tasks (< 1h): {', '.join(quick_categories)}")
    
    if long_categories:
        insights.append(f"Long tasks (> 3h): {', '.join(long_categories)}")
    
    # High variance categories (unpredictable)
    high_variance = []
    for category, stats in patterns.items():
        if stats['confidence'] in ['high', 'medium']:
            if stats['std_dev'] > stats['mean'] * 0.5:  # CoV > 50%
                high_variance.append(category)
    
    if high_variance:
        insights.append(f"Unpredictable duration: {', '.join(high_variance)}")
    
    # Overall productivity insight
    if overall['count'] > 0:
        insights.append(f"Average task duration: {overall['mean']}h ({overall['count']} completed tasks)")
    
    return insights


def main():
    parser = argparse.ArgumentParser(description='Analyze task duration patterns')
    parser.add_argument('--days', type=int, default=30,
                       help='Number of days to analyze (default: 30)')
    parser.add_argument('--min-samples', type=int, default=3,
                       help='Minimum samples required per category (default: 3)')
    parser.add_argument('--min-confidence', type=float, default=0.7,
                       help='Minimum duration_confidence to include (default: 0.7, range: 0.0-1.0)')
    parser.add_argument('--output', type=str,
                       default='cortex/state/duration-patterns.json',
                       help='Output file path')

    args = parser.parse_args()

    print(f"📊 Analyzing duration patterns (past {args.days} days)...", file=sys.stderr)

    # Load task entries
    entries = load_task_entries(args.days)
    if not entries:
        print("❌ No task entries found", file=sys.stderr)
        sys.exit(1)

    print(f"✅ Loaded {len(entries)} task entries", file=sys.stderr)

    # Extract durations with confidence filtering
    durations_by_category = extract_durations(entries, min_confidence=args.min_confidence)
    total_samples = sum(len(d) for d in durations_by_category.values())
    
    print(f"✅ Extracted {total_samples} duration samples from {len(durations_by_category)} categories", 
          file=sys.stderr)
    
    # Generate patterns
    patterns = generate_duration_patterns(durations_by_category, args.min_samples)
    patterns['analysis_period_days'] = args.days
    
    # Save output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(patterns, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Duration patterns saved to {output_path}", file=sys.stderr)
    
    # Display insights
    if patterns['insights']:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in patterns['insights']:
            print(f"   • {insight}", file=sys.stderr)
    
    # Output JSON to stdout for piping
    print(json.dumps(patterns, ensure_ascii=False))


if __name__ == '__main__':
    main()
