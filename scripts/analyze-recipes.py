
#!/usr/bin/env python3
"""
Recipe Performance Monitoring Analyzer

Analyzes recipe execution logs to track success rates, failures,
and performance metrics for each automation recipe.

Input:
  - cortex/logs/recipe-*.log (execution logs)

Output:
  - cortex/state/recipe-metrics.json

Usage:
    python scripts/analyze-recipes.py [--days 7] [--output path/to/output.json]
"""

import json
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict
import argparse


LOGS_DIR = Path("cortex/logs")
STATE_DIR = Path("cortex/state")


def parse_log_line(line: str) -> Tuple[str | None, str | None, str | None, float | None]:
    """
    Parse a single log line to extract:
    - timestamp (ISO8601)
    - recipe name
    - status (success/failure)
    - duration (seconds, if available)
    
    Expected format (flexible):
    2025-12-05T22:00:02+09:00 [recipe_13_nightly_wrapup] SUCCESS (42.5s)
    2025-12-04T08:05:01+09:00 [recipe_10_todo_auto_sync] FAILURE: Obsidian API timeout
    """
    # Regex patterns
    timestamp_pattern = r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})'
    recipe_pattern = r'\[([^\]]+)\]'
    status_pattern = r'(SUCCESS|FAILURE|✅|❌|ERROR|FAILED)'
    duration_pattern = r'\((\d+\.?\d*)\s*s\)'
    
    timestamp = None
    recipe_name = None
    status = None
    duration = None
    
    # Extract timestamp
    ts_match = re.search(timestamp_pattern, line)
    if ts_match:
        timestamp = ts_match.group(1)
    
    # Extract recipe name
    recipe_match = re.search(recipe_pattern, line)
    if recipe_match:
        recipe_name = recipe_match.group(1)
    
    # Extract status
    status_match = re.search(status_pattern, line, re.IGNORECASE)
    if status_match:
        status_text = status_match.group(1).upper()
        if status_text in ('SUCCESS', '✅'):
            status = 'success'
        elif status_text in ('FAILURE', 'ERROR', 'FAILED', '❌'):
            status = 'failure'
    
    # Extract duration
    dur_match = re.search(duration_pattern, line)
    if dur_match:
        try:
            duration = float(dur_match.group(1))
        except ValueError:
            pass
    
    return timestamp, recipe_name, status, duration


def load_recipe_logs(days: int) -> List[Dict[str, Any]]:
    """Load and parse recipe logs from the past N days."""
    if not LOGS_DIR.exists():
        print(f"⚠️  Logs directory not found: {LOGS_DIR}", file=sys.stderr)
        return []
    
    entries: List[Dict[str, Any]] = []
    cutoff_date = datetime.now().astimezone() - timedelta(days=days)
    
    for log_file in sorted(LOGS_DIR.glob("recipe-*.log")):
        try:
            with log_file.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    timestamp, recipe_name, status, duration = parse_log_line(line)
                    
                    if not (timestamp and recipe_name and status):
                        continue
                    
                    try:
                        dt = datetime.fromisoformat(timestamp)
                    except ValueError:
                        continue
                    
                    if dt < cutoff_date:
                        continue
                    
                    entries.append({
                        "timestamp": timestamp,
                        "recipe": recipe_name,
                        "status": status,
                        "duration_sec": duration,
                        "log_file": log_file.name,
                        "raw_line": line,
                    })
        except Exception as e:
            print(f"⚠️  Error reading {log_file}: {e}", file=sys.stderr)
    
    return entries


def aggregate_metrics(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate metrics per recipe."""
    recipe_data: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
        "runs": 0,
        "successes": 0,
        "failures": 0,
        "durations": [],
        "last_run": None,
        "last_status": None,
        "last_failure": None,
        "last_failure_reason": None,
    })
    
    for entry in entries:
        recipe = entry["recipe"]
        data = recipe_data[recipe]
        
        data["runs"] += 1
        
        if entry["status"] == "success":
            data["successes"] += 1
        else:
            data["failures"] += 1
            # Track last failure
            if not data["last_failure"] or entry["timestamp"] > data["last_failure"]:
                data["last_failure"] = entry["timestamp"]
                # Try to extract failure reason from raw line
                raw = entry.get("raw_line", "")
                if ":" in raw:
                    reason = raw.split(":", 2)[-1].strip()
                    data["last_failure_reason"] = reason[:100]  # Truncate
        
        if entry["duration_sec"] is not None:
            data["durations"].append(entry["duration_sec"])
        
        # Track most recent run
        if not data["last_run"] or entry["timestamp"] > data["last_run"]:
            data["last_run"] = entry["timestamp"]
            data["last_status"] = entry["status"]
    
    return recipe_data


def compute_statistics(recipe_data: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Compute final statistics for each recipe."""
    recipes: Dict[str, Any] = {}
    
    for recipe_name, data in recipe_data.items():
        runs = data["runs"]
        successes = data["successes"]
        failures = data["failures"]
        
        success_rate = successes / runs if runs > 0 else 0.0
        
        avg_duration = None
        if data["durations"]:
            avg_duration = sum(data["durations"]) / len(data["durations"])
        
        recipe_info: Dict[str, Any] = {
            "runs": runs,
            "successes": successes,
            "failures": failures,
            "success_rate": round(success_rate, 3),
            "last_run": data["last_run"],
            "last_status": data["last_status"],
        }
        
        if avg_duration is not None:
            recipe_info["avg_duration_sec"] = round(avg_duration, 2)
        
        if data["last_failure"]:
            recipe_info["last_failure"] = data["last_failure"]
        
        if data["last_failure_reason"]:
            recipe_info["last_failure_reason"] = data["last_failure_reason"]
        
        recipes[recipe_name] = recipe_info
    
    return recipes


def generate_insights(recipes: Dict[str, Any], window_days: int) -> List[str]:
    """Generate human-readable insights from recipe metrics."""
    insights: List[str] = []
    
    if not recipes:
        insights.append("No recipe execution data found in the analysis window.")
        return insights
    
    # Overall success rate
    total_runs = sum(r["runs"] for r in recipes.values())
    total_successes = sum(r["successes"] for r in recipes.values())
    overall_rate = total_successes / total_runs if total_runs > 0 else 0.0
    
    insights.append(
        f"Overall automation success rate: {overall_rate * 100:.1f}% "
        f"({total_successes}/{total_runs} runs in last {window_days} days)."
    )
    
    # Stable recipes
    stable = [name for name, r in recipes.items() if r["failures"] == 0 and r["runs"] > 0]
    if stable:
        insights.append(
            f"Stable recipes (no failures): {', '.join(stable)}."
        )
    
    # Unstable recipes
    unstable = [(name, r) for name, r in recipes.items() if r["success_rate"] < 0.9 and r["runs"] >= 3]
    if unstable:
        for name, r in sorted(unstable, key=lambda x: x[1]["success_rate"]):
            insights.append(
                f"Recipe '{name}' has low reliability: {r['success_rate'] * 100:.1f}% "
                f"({r['failures']} failures in {r['runs']} runs)."
            )
    
    # Recent failures
    recent_failures = [
        (name, r) for name, r in recipes.items()
        if r.get("last_failure") and r["last_status"] == "failure"
    ]
    if recent_failures:
        for name, r in recent_failures:
            reason = r.get("last_failure_reason", "Unknown error")
            insights.append(
                f"Recipe '{name}' last failed at {r['last_failure']}: {reason}"
            )
    
    return insights


def main():
    parser = argparse.ArgumentParser(description="Analyze recipe execution logs")
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days to analyze (default: 7)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="cortex/state/recipe-metrics.json",
        help="Output file path",
    )
    
    args = parser.parse_args()
    
    print(f"📊 Analyzing recipe logs (past {args.days} days)...", file=sys.stderr)
    
    entries = load_recipe_logs(args.days)
    
    if not entries:
        print("⚠️  No recipe log entries found", file=sys.stderr)
        # Create empty output
        result = {
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "window_days": args.days,
            "total_runs": 0,
            "recipes": {},
            "insights": ["No recipe execution data found."],
        }
    else:
        print(f"✅ Loaded {len(entries)} log entries", file=sys.stderr)
        
        recipe_data = aggregate_metrics(entries)
        recipes = compute_statistics(recipe_data)
        insights = generate_insights(recipes, args.days)
        
        total_runs = sum(r["runs"] for r in recipes.values())
        
        result = {
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "window_days": args.days,
            "total_runs": total_runs,
            "recipes": recipes,
            "insights": insights,
        }
        
        print(f"✅ Analyzed {len(recipes)} recipes ({total_runs} total runs)", file=sys.stderr)
    
    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    
    print(f"✅ Recipe metrics saved to {output_path}", file=sys.stderr)
    
    if result["insights"]:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in result["insights"]:
            print(f"   • {insight}", file=sys.stderr)
    
    # stdout にも JSON を出す（パイプ用）
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
