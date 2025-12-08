#!/usr/bin/env python3
"""
Test suite for detect-incomplete-tasks.py

Run:
    pytest tests/scripts/test_incomplete_tasks.py -v
"""

import sys
import json
from pathlib import Path

# Add scripts to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

# Import module under test (will fail until implementation exists)
import importlib.util

detect_script_path = Path(__file__).resolve().parents[2] / "scripts" / "detect-incomplete-tasks.py"
spec = importlib.util.spec_from_file_location("detect_incomplete_tasks_module", detect_script_path)
detect_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(detect_module)

detect_incomplete_tasks_from_entry = detect_module.detect_incomplete_tasks_from_entry


# Test Case 1: Basic case - partial completion
def test_basic_partial_completion():
    """
    Given: 3 planned tasks
    When: 2 are completed (both in planned)
    Then: 1 incomplete, completion_rate = 2/3 ≈ 0.67
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "Task A", "category": "core-work"},
            {"content": "Task B", "category": "learning"},
            {"content": "Task C", "category": "health"}
        ],
        "completed": [
            {"content": "Task A", "status": "completed"},
            {"content": "Task B", "status": "completed"}
        ],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["date"] == "2025-12-08"
    assert result["planned"] == 3
    assert result["completed"] == 2
    assert result["incomplete"] == 1
    assert abs(result["completion_rate"] - 0.67) < 0.01
    assert len(result["incomplete_tasks"]) == 1
    assert result["incomplete_tasks"][0]["content"] == "Task C"


# Test Case 2: 100% completion
def test_full_completion():
    """
    Given: tasks and completed are identical
    Then: incomplete = 0, completion_rate = 1.0
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "Task A"},
            {"content": "Task B"}
        ],
        "completed": [
            {"content": "Task A", "status": "completed"},
            {"content": "Task B", "status": "completed"}
        ],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 2
    assert result["completed"] == 2
    assert result["incomplete"] == 0
    assert result["completion_rate"] == 1.0
    assert len(result["incomplete_tasks"]) == 0


# Test Case 3: 0% completion
def test_zero_completion():
    """
    Given: tasks exist but completed is empty
    Then: incomplete = len(tasks), completion_rate = 0.0
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "Task A"},
            {"content": "Task B"},
            {"content": "Task C"}
        ],
        "completed": [],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 3
    assert result["completed"] == 0
    assert result["incomplete"] == 3
    assert result["completion_rate"] == 0.0
    assert len(result["incomplete_tasks"]) == 3


# Test Case 4: Missing content field
def test_missing_content_field():
    """
    Given: Some tasks lack 'content' field
    Then: Those tasks are excluded from detection
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "Task A"},
            {"category": "core-work"},  # No content
            {"content": "Task B"}
        ],
        "completed": [
            {"content": "Task A", "status": "completed"}
        ],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    # Only tasks with content are counted
    assert result["planned"] == 2  # Task A, Task B
    assert result["completed"] == 1  # Task A
    assert result["incomplete"] == 1  # Task B
    assert len(result["incomplete_tasks"]) == 1
    assert result["incomplete_tasks"][0]["content"] == "Task B"


# Test Case 5: Empty task-entry
def test_empty_task_entry():
    """
    Given: tasks and completed are both empty
    Then: planned = 0, completed = 0, incomplete = 0, completion_rate = 0.0
    
    Spec: "planned == 0 の場合は 0.0 とする（計画なし=完了率0）"
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [],
        "completed": [],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 0
    assert result["completed"] == 0
    assert result["incomplete"] == 0
    assert result["completion_rate"] == 0.0
    assert len(result["incomplete_tasks"]) == 0


# Test Case 6: Ad-hoc completed tasks (not in planned)
def test_adhoc_completed_tasks():
    """
    Given: completed contains tasks not in planned
    Then: Those are NOT counted toward completion_rate
    
    Spec: "/log のみで発生する ad-hoc な作業ログは完了率には含めない"
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "Task A"},
            {"content": "Task B"}
        ],
        "completed": [
            {"content": "Task A", "status": "completed"},
            {"content": "Ad-hoc work", "status": "completed"}  # Not in tasks
        ],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 2
    assert result["completed"] == 1  # Only Task A counts
    assert result["incomplete"] == 1  # Task B
    assert result["completion_rate"] == 0.5


# Test Case 7: Whitespace handling
def test_whitespace_handling():
    """
    Given: content has leading/trailing whitespace
    Then: Strip and match correctly
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": [
            {"content": "  Task A  "},
            {"content": "Task B"}
        ],
        "completed": [
            {"content": "Task A", "status": "completed"}
        ],
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 2
    assert result["completed"] == 1
    assert result["incomplete"] == 1
    assert result["incomplete_tasks"][0]["content"].strip() == "Task B"


# Test Case 8: Non-list tasks/completed (defensive)
def test_non_list_fields():
    """
    Given: tasks or completed is not a list
    Then: Treat as empty list (0 tasks)
    
    Spec: "安全側に倒して「タスク 0 件」とみなす"
    """
    task_entry = {
        "date": "2025-12-08",
        "tasks": None,  # Invalid
        "completed": "invalid",  # Invalid
        "carryover": [],
        "metadata": {}
    }
    
    result = detect_incomplete_tasks_from_entry(task_entry)
    
    assert result["planned"] == 0
    assert result["completed"] == 0
    assert result["incomplete"] == 0
    assert result["completion_rate"] == 0.0
