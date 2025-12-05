#!/usr/bin/env python3
"""
Tests for scripts/analyze-rhythm.py

Validates rhythm detection logic including:
- Hour extraction from started_at/completed_at
- Chronotype classification (morning/balanced/evening)
- Peak hour and peak window detection
- Hourly distribution and weekday matrix
"""

import pytest
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

import subprocess


def create_mock_task_entry(date_str: str, tasks: list) -> dict:
    """Create a mock task-entry JSON structure."""
    return {
        "date": date_str,
        "version": "1.0",
        "source": "test",
        "tasks": tasks,
        "meta": {
            "total_tasks": len(tasks),
            "completed": sum(1 for t in tasks if t.get("status") == "completed")
        }
    }


def test_rhythm_morning_type(tmp_path):
    """Test chronotype detection for morning type."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create morning tasks (8-11 AM)
    tasks = [
        {
            "title": f"Morning Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T{8+i}:00:00+09:00",
            "completed_at": f"{base_date}T{9+i}:00:00+09:00"
        }
        for i in range(4)  # 8, 9, 10, 11 AM
    ] * 3  # 12 total tasks
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0, f"Script failed: {result.stderr}"
    
    output_file = tmp_path / "rhythm-patterns.json"
    assert output_file.exists()
    
    patterns = json.loads(output_file.read_text())
    
    # Validate structure
    assert "chronotype" in patterns
    assert "peak_hour" in patterns
    assert "hourly_distribution" in patterns
    
    # Check morning type
    assert patterns["chronotype"] == "morning"
    assert patterns["total_tasks"] == 12
    assert patterns["active_days"] == 1


def test_rhythm_evening_type(tmp_path):
    """Test chronotype detection for evening type."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create evening tasks (18-22)
    tasks = [
        {
            "title": f"Evening Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T{18+i}:00:00+09:00",
            "completed_at": f"{base_date}T{19+i}:00:00+09:00"
        }
        for i in range(4)  # 18, 19, 20, 21
    ] * 3  # 12 total tasks
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Check evening type
    assert patterns["chronotype"] == "evening"


def test_rhythm_balanced_type(tmp_path):
    """Test chronotype detection for balanced type."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create tasks spread across the day (11-17)
    tasks = [
        {
            "title": f"Day Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T{11+i}:00:00+09:00",
            "completed_at": f"{base_date}T{12+i}:00:00+09:00"
        }
        for i in range(6)  # 11-16
    ] * 2  # 12 total tasks
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Check balanced type
    assert patterns["chronotype"] == "balanced"


def test_rhythm_peak_window(tmp_path):
    """Test peak window detection (3-hour window)."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create concentrated tasks (10-12 AM peak)
    tasks = []
    
    # Heavy activity 10-12
    for hour in [10, 11, 12]:
        for i in range(5):
            tasks.append({
                "title": f"Peak Task {hour}-{i}",
                "status": "completed",
                "started_at": f"{base_date}T{hour}:00:00+09:00",
                "completed_at": f"{base_date}T{hour}:30:00+09:00"
            })
    
    # Light activity elsewhere
    for hour in [8, 14, 16]:
        tasks.append({
            "title": f"Other Task {hour}",
            "status": "completed",
            "started_at": f"{base_date}T{hour}:00:00+09:00",
            "completed_at": f"{base_date}T{hour}:30:00+09:00"
        })
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Check peak window
    assert "peak_window" in patterns
    peak_window = patterns["peak_window"]
    assert peak_window is not None
    assert peak_window["start_hour"] == 10
    assert peak_window["end_hour"] == 13
    assert peak_window["total_tasks"] == 15  # 5 tasks * 3 hours


def test_rhythm_hourly_distribution(tmp_path):
    """Test hourly distribution counting."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create specific hourly distribution
    tasks = []
    
    # 3 tasks at 9 AM
    for i in range(3):
        tasks.append({
            "title": f"9AM Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T09:00:00+09:00"
        })
    
    # 5 tasks at 14 (2 PM)
    for i in range(5):
        tasks.append({
            "title": f"2PM Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T14:00:00+09:00"
        })
    
    # 2 tasks at 20 (8 PM)
    for i in range(2):
        tasks.append({
            "title": f"8PM Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T20:00:00+09:00"
        })
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "5",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Check hourly distribution
    hourly = patterns["hourly_distribution"]
    assert hourly["9"] == 3
    assert hourly["14"] == 5
    assert hourly["20"] == 2
    assert hourly["0"] == 0  # No midnight tasks


def test_rhythm_filters_incomplete(tmp_path):
    """Test that only completed tasks are counted."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    tasks = [
        {
            "title": "Completed",
            "status": "completed",
            "started_at": f"{base_date}T10:00:00+09:00"
        }
    ] * 12  # 12 completed
    
    tasks += [
        {
            "title": "Pending",
            "status": "pending",
            "started_at": f"{base_date}T14:00:00+09:00"
        }
    ] * 5  # 5 pending (should be ignored)
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Should only count completed tasks
    assert patterns["total_tasks"] == 12
    assert patterns["hourly_distribution"]["10"] == 12
    assert patterns["hourly_distribution"]["14"] == 0


def test_rhythm_insufficient_data(tmp_path):
    """Test chronotype is 'unknown' with insufficient data."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Only 3 tasks (below min-tasks threshold of 10)
    tasks = [
        {
            "title": f"Task {i}",
            "status": "completed",
            "started_at": f"{base_date}T10:00:00+09:00"
        }
        for i in range(3)
    ]
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-rhythm.py",
            "--days", "7",
            "--min-tasks", "10",
            "--output", str(tmp_path / "rhythm-patterns.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    patterns = json.loads((tmp_path / "rhythm-patterns.json").read_text())
    
    # Should be unknown with insufficient data
    assert patterns["chronotype"] == "unknown"
    assert patterns["total_tasks"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
