#!/usr/bin/env python3
"""
Enrich Task Metadata

Enriches existing task-entry-*.json files with source/confidence metadata
for timestamps and durations. Implements spec v0.1 from digest 2025-12-22.

Input:
  - cortex/state/task-entry-*.json (existing format)

Output:
  - cortex/state/task-entry-*-enriched.json (with source/confidence fields)

Usage:
    python scripts/enrich-task-metadata.py [--date YYYY-MM-DD] [--all]
    python scripts/enrich-task-metadata.py --all --overwrite  # Replace originals
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta


STATE_DIR = Path("cortex/state")


def enrich_task(task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single task with source/confidence metadata.

    Rules (from spec v0.1):
    1. DO NOT overwrite existing explicit timestamps/durations
    2. If timestamp is fixed (T01:00:00Z), mark it as such
    3. Add source/confidence even if values are unknown

    Returns:
        Enriched task dict (new dict, does not modify original)
    """
    enriched = task.copy()

    # Timestamp enrichment
    completed_at = enriched.get("completed_at")
    started_at = enriched.get("started_at")

    # Check if source/confidence already exist (from new process-obsidian-batch.py)
    if "timestamp_source" in enriched:
        # Already has source/confidence, keep as-is
        pass
    elif started_at and completed_at and started_at != completed_at:
        # Has both timestamps and they differ -> likely timerange
        if "+09:00" in str(completed_at) or "+09:00" in str(started_at):
            enriched["timestamp_source"] = "timerange"
            enriched["timestamp_confidence"] = 0.7
        else:
            enriched["timestamp_source"] = "explicit"
            enriched["timestamp_confidence"] = 1.0
    elif completed_at and "T01:00:00Z" in str(completed_at):
        # Fixed placeholder timestamp
        enriched["timestamp_source"] = "fixed"
        enriched["timestamp_confidence"] = 0.1
    elif completed_at:
        # Has timestamp but not fixed -> assume explicit
        enriched["timestamp_source"] = "explicit"
        enriched["timestamp_confidence"] = 1.0
    else:
        # No timestamp
        enriched["timestamp_source"] = "unknown"
        enriched["timestamp_confidence"] = 0.0

    # Duration enrichment
    duration_minutes = enriched.get("duration_minutes")
    duration_hours = enriched.get("duration_hours")

    # Check if source/confidence already exist
    if "duration_source" in enriched:
        # Already has source/confidence, keep as-is
        pass
    elif duration_minutes or duration_hours:
        # Has duration, assume explicit unless we know it's timerange-derived
        if enriched.get("timestamp_source") == "timerange" and started_at and completed_at:
            # Likely calculated from timerange
            enriched["duration_source"] = "timerange"
            enriched["duration_confidence"] = 0.7
        else:
            # Explicitly stated duration
            enriched["duration_source"] = "explicit"
            enriched["duration_confidence"] = 1.0
    else:
        # No duration
        enriched["duration_source"] = "unknown"
        enriched["duration_confidence"] = 0.0

    return enriched


def enrich_task_entry(entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich all tasks in a task entry file.

    Args:
        entry_data: Task entry dict with "tasks" array

    Returns:
        Enriched task entry dict
    """
    enriched_data = entry_data.copy()
    enriched_data["tasks"] = [enrich_task(task) for task in entry_data.get("tasks", [])]
    return enriched_data


def enrich_file(input_path: Path, output_path: Path, overwrite: bool = False) -> bool:
    """
    Enrich a single task-entry file.

    Args:
        input_path: Input file path
        output_path: Output file path
        overwrite: If True, replace original file

    Returns:
        True if successful, False otherwise
    """
    try:
        # Read input
        with input_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        # Enrich
        enriched = enrich_task_entry(data)

        # Count enrichments
        tasks = enriched.get("tasks", [])
        timestamp_enriched = sum(1 for t in tasks if t.get("timestamp_source"))
        duration_enriched = sum(1 for t in tasks if t.get("duration_source"))

        # Write output
        actual_output = input_path if overwrite else output_path
        with actual_output.open("w", encoding="utf-8") as f:
            json.dump(enriched, f, ensure_ascii=False, indent=2)

        return True, timestamp_enriched, duration_enriched

    except Exception as e:
        print(f"❌ Error enriching {input_path}: {e}", file=sys.stderr)
        return False, 0, 0


def main():
    parser = argparse.ArgumentParser(
        description="Enrich task-entry files with source/confidence metadata"
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Date to enrich (YYYY-MM-DD format). If not specified, enriches recent files.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Enrich all task-entry files",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of recent days to enrich (default: 7, used when --date not specified)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite original files instead of creating .enriched.json files (USE WITH CAUTION)",
    )

    args = parser.parse_args()

    if not STATE_DIR.exists():
        print(f"❌ State directory not found: {STATE_DIR}", file=sys.stderr)
        sys.exit(1)

    # Determine which files to process
    files_to_process = []

    if args.date:
        # Single date
        input_file = STATE_DIR / f"task-entry-{args.date}.json"
        if input_file.exists():
            files_to_process.append(input_file)
        else:
            print(f"❌ File not found: {input_file}", file=sys.stderr)
            sys.exit(1)
    elif args.all:
        # All files
        files_to_process = sorted(STATE_DIR.glob("task-entry-*.json"))
        # Exclude already enriched files
        files_to_process = [f for f in files_to_process if "-enriched.json" not in f.name]
    else:
        # Recent N days
        today = datetime.now().date()
        for i in range(args.days):
            date = today - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            input_file = STATE_DIR / f"task-entry-{date_str}.json"
            if input_file.exists():
                files_to_process.append(input_file)

    if not files_to_process:
        print("❌ No files to process", file=sys.stderr)
        sys.exit(1)

    print(f"🔍 Enriching {len(files_to_process)} task-entry files...", file=sys.stderr)
    if args.overwrite:
        print("⚠️  OVERWRITE MODE: Original files will be replaced", file=sys.stderr)
    else:
        print("✅ Safe mode: Creating .enriched.json files", file=sys.stderr)
    print()

    # Process files
    processed = 0
    total_timestamp_enriched = 0
    total_duration_enriched = 0

    for input_path in files_to_process:
        output_path = input_path.parent / input_path.name.replace(".json", ".enriched.json")

        success, ts_count, dur_count = enrich_file(input_path, output_path, args.overwrite)

        if success:
            processed += 1
            total_timestamp_enriched += ts_count
            total_duration_enriched += dur_count

            mode = "✍️" if args.overwrite else "→"
            output_display = input_path.name if args.overwrite else output_path.name
            print(f"✅ {input_path.name} {mode} {output_display}")
            print(f"   Enriched: {ts_count} timestamps, {dur_count} durations")

    print()
    print(f"📊 Summary:", file=sys.stderr)
    print(f"   Files processed: {processed}/{len(files_to_process)}", file=sys.stderr)
    print(f"   Total timestamp enrichments: {total_timestamp_enriched}", file=sys.stderr)
    print(f"   Total duration enrichments: {total_duration_enriched}", file=sys.stderr)
    print()

    if not args.overwrite:
        print("💡 Next steps:", file=sys.stderr)
        print("   1. Verify enriched files: diff cortex/state/task-entry-YYYY-MM-DD.json cortex/state/task-entry-YYYY-MM-DD.enriched.json", file=sys.stderr)
        print("   2. Test with analysis: python3 scripts/analyze-duration.py", file=sys.stderr)
        print("   3. If satisfied, re-run with --overwrite to replace originals", file=sys.stderr)
    else:
        print("✅ Enrichment complete! Run analytics to see the impact:", file=sys.stderr)
        print("   python3 scripts/analyze-duration.py", file=sys.stderr)
        print("   python3 scripts/analyze-health.py", file=sys.stderr)


if __name__ == "__main__":
    main()
