#!/usr/bin/env python3
"""
Tests for scripts/analyze-category-heatmap.py

Validates category heatmap logic including:
- Weekday × category matrix construction
- Dominant category detection (threshold 30%)
- Busiest day calculation
- Insights generation
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
            "completed": sum(1 for t in tasks if t.get("status") in ["completed", "done", "finished"])
        }
    }


def test_category_heatmap_basic(tmp_path):
    """Test basic category heatmap construction."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Monday: development tasks
    monday = today - timedelta(days=today.weekday())  # Get last Monday
    monday_tasks = [
        {
            "title": f"Dev Task {i}",
            "status": "completed",
            "category": "development"
        }
        for i in range(5)
    ]
    
    monday_entry = create_mock_task_entry(monday.strftime("%Y-%m-%d"), monday_tasks)
    
    (state_dir / f"task-entry-{monday_entry['date']}.json").write_text(
        json.dumps(monday_entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0, f"Script failed: {result.stderr}"
    
    output_file = tmp_path / "category-heatmap.json"
    assert output_file.exists()
    
    heatmap = json.loads(output_file.read_text())
    
    # Validate structure
    assert "generated_at" in heatmap
    assert "analysis_period_days" in heatmap
    assert "total_tasks" in heatmap
    assert "weekday_category_matrix" in heatmap
    assert "weekday_totals" in heatmap
    assert "category_totals" in heatmap
    assert "dominant_categories" in heatmap
    
    # Check data
    assert heatmap["total_tasks"] == 5
    assert "Monday" in heatmap["weekday_category_matrix"]
    assert heatmap["weekday_category_matrix"]["Monday"]["development"] == 5


def test_category_heatmap_dominant_detection(tmp_path):
    """Test dominant category detection with 30% threshold."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    # Create tasks with clear dominance
    tasks = []
    
    # 7 development tasks (70% of 10)
    for i in range(7):
        tasks.append({
            "title": f"Dev {i}",
            "status": "completed",
            "category": "development"
        })
    
    # 2 admin tasks (20%)
    for i in range(2):
        tasks.append({
            "title": f"Admin {i}",
            "status": "completed",
            "category": "admin"
        })
    
    # 1 other task (10%)
    tasks.append({
        "title": "Other",
        "status": "completed",
        "category": "other"
    })
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    weekday = base_date.strftime("%A")
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Check dominant categories
    dominant = heatmap["dominant_categories"].get(weekday, [])
    assert len(dominant) == 1  # Only development > 30%
    assert dominant[0]["category"] == "development"
    assert dominant[0]["percentage"] == 70.0


def test_category_heatmap_multiple_days(tmp_path):
    """Test heatmap across multiple weekdays."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Create different patterns for different days
    days_config = [
        (0, "development", 8),  # Monday: development
        (1, "meetings", 6),      # Tuesday: meetings
        (2, "development", 5),  # Wednesday: development
        (3, "admin", 4),        # Thursday: admin
        (4, "planning", 3),     # Friday: planning
    ]
    
    for days_ago, category, count in days_config:
        date = today - timedelta(days=days_ago)
        tasks = [
            {
                "title": f"{category} {i}",
                "status": "completed",
                "category": category
            }
            for i in range(count)
        ]
        
        entry = create_mock_task_entry(date.strftime("%Y-%m-%d"), tasks)
        
        (state_dir / f"task-entry-{entry['date']}.json").write_text(
            json.dumps(entry, ensure_ascii=False, indent=2)
        )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Check category totals
    assert heatmap["category_totals"]["development"] == 13  # 8 + 5
    assert heatmap["category_totals"]["meetings"] == 6
    assert heatmap["category_totals"]["admin"] == 4


def test_category_heatmap_busiest_day(tmp_path):
    """Test busiest day detection."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    
    # Create different task counts for different days
    days_config = [
        (0, 3),   # Today: 3 tasks
        (1, 8),   # Yesterday: 8 tasks (busiest)
        (2, 2),   # 2 days ago: 2 tasks
        (3, 5),   # 3 days ago: 5 tasks
    ]
    
    for days_ago, count in days_config:
        date = today - timedelta(days=days_ago)
        tasks = [
            {
                "title": f"Task {i}",
                "status": "completed",
                "category": "test"
            }
            for i in range(count)
        ]
        
        entry = create_mock_task_entry(date.strftime("%Y-%m-%d"), tasks)
        
        (state_dir / f"task-entry-{entry['date']}.json").write_text(
            json.dumps(entry, ensure_ascii=False, indent=2)
        )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Check weekday totals
    yesterday = (today - timedelta(days=1)).strftime("%A")
    assert heatmap["weekday_totals"][yesterday] == 8
    
    # Check insights mention busiest day
    insights = heatmap.get("insights", [])
    insights_text = " ".join(insights)
    assert yesterday in insights_text or "8" in insights_text


def test_category_heatmap_filters_status(tmp_path):
    """Test that only completed/done/finished tasks are counted."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    tasks = [
        {"title": "Completed", "status": "completed", "category": "test"},
        {"title": "Done", "status": "done", "category": "test"},
        {"title": "Finished", "status": "finished", "category": "test"},
        {"title": "Pending", "status": "pending", "category": "test"},
        {"title": "In Progress", "status": "in_progress", "category": "test"},
        {"title": "Cancelled", "status": "cancelled", "category": "test"},
    ]
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Should only count completed/done/finished (3 tasks)
    assert heatmap["total_tasks"] == 3
    assert heatmap["category_totals"]["test"] == 3


def test_category_heatmap_markdown_checkbox(tmp_path):
    """Test that markdown checkbox format is recognized."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    
    tasks = [
        {"title": "- [x] Completed checkbox", "status": "completed", "category": "test"},
        {"title": "- [ ] Incomplete checkbox", "status": "pending", "category": "test"},
    ]
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Should count completed checkbox
    assert heatmap["total_tasks"] == 1


def test_category_heatmap_insights_generation(tmp_path):
    """Test insights generation."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    
    today = datetime.now().date()
    base_date = today - timedelta(days=1)
    weekday = base_date.strftime("%A")
    
    # Create clear pattern
    tasks = []
    
    # 10 development tasks (dominant)
    for i in range(10):
        tasks.append({
            "title": f"Dev {i}",
            "status": "completed",
            "category": "development"
        })
    
    # 2 admin tasks
    for i in range(2):
        tasks.append({
            "title": f"Admin {i}",
            "status": "completed",
            "category": "admin"
        })
    
    entry = create_mock_task_entry(base_date.strftime("%Y-%m-%d"), tasks)
    
    (state_dir / f"task-entry-{entry['date']}.json").write_text(
        json.dumps(entry, ensure_ascii=False, indent=2)
    )
    
    result = subprocess.run(
        [
            "python3",
            "scripts/analyze-category-heatmap.py",
            "--days", "7",
            "--output", str(tmp_path / "category-heatmap.json")
        ],
        capture_output=True,
        text=True,
        cwd=Path.cwd()
    )
    
    assert result.returncode == 0
    
    heatmap = json.loads((tmp_path / "category-heatmap.json").read_text())
    
    # Check insights
    insights = heatmap.get("insights", [])
    assert len(insights) > 0
    
    insights_text = " ".join(insights).lower()
    
    # Should mention development as most common
    assert "development" in insights_text or "most common" in insights_text
    
    # Should mention the weekday
    assert weekday.lower() in insights_text or "busiest" in insights_text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
