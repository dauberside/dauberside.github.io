#!/usr/bin/env python3
"""
Tests for scripts/analyze-duration.py

Validates duration analysis logic including:
- Completed task filtering
- Category-wise statistics (mean, median, std_dev)
- Confidence level calculation
- Insights generation
"""

import pytest
import json
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

# Import the module we're testing
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


def test_duration_analysis_basic(tmp_path):
    """Test basic duration analysis with completed tasks."""
    # Create mock data
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Day 1: 2 completed tasks
    entry1 = create_mock_task_entry(
        (today - timedelta(days=1)).strftime("%Y-%m-%d"),
        [
            {
                "title": "Task 1",
                "status": "completed",
                "category": "development",
                "duration_hours": 2.5,
                "estimated_minutes": 120
            },
            {
                "title": "Task 2",
                "status": "completed",
                "category": "development",
                "duration_hours": 1.5,
                "estimated_minutes": 90
            }
        ]
    )
    
    (state_dir / f"task-entry-{entry1['date']}.json").write_text(
        json.dumps(entry1, ensure_ascii=False, indent=2)
    )
    
    # Run analyzer
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-duration.py",
            "--days", "7",
            "--output", str(tmp_path / "duration-stats.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0, f"Script failed: {result.stderr}"
    
    # Load output
    output_file = tmp_path / "duration-stats.json"
    assert output_file.exists()
    
    stats = json.loads(output_file.read_text())
    
    # Validate structure
    assert "generated_at" in stats
    assert "analysis_period_days" in stats
    assert "total_tasks" in stats
    assert "categories" in stats
    assert "global" in stats
    
    # Validate global stats
    assert stats["total_tasks"] == 2
    assert stats["global"]["mean_actual"] == 120  # (2.5 + 1.5) * 60 / 2
    
    # Validate category stats
    assert "development" in stats["categories"]
    dev_stats = stats["categories"]["development"]
    assert dev_stats["count"] == 2
    assert dev_stats["mean_actual"] == 120
    assert dev_stats["confidence"] == "insufficient"  # 2 samples


def test_duration_analysis_confidence_levels(tmp_path):
    """Test confidence level calculation based on sample count."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Create tasks with different sample counts
    tasks_low = [
        {
            "title": f"Low Task {i}",
            "status": "completed",
            "category": "low_confidence",
            "duration_hours": 1.0,
            "estimated_minutes": 60
        }
        for i in range(3)
    ]
    
    tasks_medium = [
        {
            "title": f"Medium Task {i}",
            "status": "completed",
            "category": "medium_confidence",
            "duration_hours": 1.0,
            "estimated_minutes": 60
        }
        for i in range(6)
    ]
    
    tasks_high = [
        {
            "title": f"High Task {i}",
            "status": "completed",
            "category": "high_confidence",
            "duration_hours": 1.0,
            "estimated_minutes": 60
        }
        for i in range(12)
    ]
    
    entry = create_mock_task_entry(
        (today - timedelta(days=1)).strftime("%Y-%m-%d"),
        tasks_low + tasks_medium + tasks_high
    )
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    # Run analyzer
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-duration.py",
            "--days", "7",
            "--output", str(tmp_path / "duration-stats.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    stats = json.loads((tmp_path / "duration-stats.json").read_text())
    
    # Check confidence levels
    assert stats["categories"]["low_confidence"]["confidence"] == "low"
    assert stats["categories"]["medium_confidence"]["confidence"] == "medium"
    assert stats["categories"]["high_confidence"]["confidence"] == "high"


def test_duration_analysis_filters_incomplete(tmp_path):
    """Test that incomplete tasks are filtered out."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    entry = create_mock_task_entry(
        (today - timedelta(days=1)).strftime("%Y-%m-%d"),
        [
            {
                "title": "Completed",
                "status": "completed",
                "category": "test",
                "duration_hours": 2.0,
                "estimated_minutes": 120
            },
            {
                "title": "In Progress",
                "status": "in_progress",
                "category": "test",
                "duration_hours": 1.0,
                "estimated_minutes": 60
            },
            {
                "title": "Pending",
                "status": "pending",
                "category": "test",
                "duration_hours": 0.5,
                "estimated_minutes": 30
            }
        ]
    )
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-duration.py",
            "--days", "7",
            "--output", str(tmp_path / "duration-stats.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    stats = json.loads((tmp_path / "duration-stats.json").read_text())
    
    # Only 1 completed task should be counted
    assert stats["total_tasks"] == 1
    assert stats["categories"]["test"]["count"] == 1
    assert stats["categories"]["test"]["mean_actual"] == 120


def test_duration_analysis_insights(tmp_path):
    """Test insights generation for quick/long/unpredictable tasks."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Quick tasks (< 30 min)
    quick_tasks = [
        {
            "title": f"Quick {i}",
            "status": "completed",
            "category": "quick_cat",
            "duration_hours": 0.3,  # 18 min
            "estimated_minutes": 20
        }
        for i in range(5)
    ]
    
    # Long tasks (> 2 hours)
    long_tasks = [
        {
            "title": f"Long {i}",
            "status": "completed",
            "category": "long_cat",
            "duration_hours": 3.0,  # 180 min
            "estimated_minutes": 150
        }
        for i in range(5)
    ]
    
    entry = create_mock_task_entry(
        (today - timedelta(days=1)).strftime("%Y-%m-%d"),
        quick_tasks + long_tasks
    )
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-duration.py",
            "--days", "7",
            "--output", str(tmp_path / "duration-stats.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    stats = json.loads((tmp_path / "duration-stats.json").read_text())
    
    # Check insights
    insights = stats.get("insights", [])
    assert len(insights) > 0
    
    # Should mention quick and long categories
    insights_text = " ".join(insights)
    assert "quick" in insights_text.lower() or "18" in insights_text
    assert "long" in insights_text.lower() or "180" in insights_text


def test_duration_analysis_no_data(tmp_path):
    """Test graceful handling when no task-entry files exist."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-duration.py",
            "--days", "7",
            "--output", str(tmp_path / "duration-stats.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    # Should fail gracefully
    assert result.returncode != 0
    assert "No task entries found" in result.stderr or "State directory not found" in result.stderr


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
