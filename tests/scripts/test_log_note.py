#!/usr/bin/env python3
"""
Test suite for log.py and note.py commands

Run:
    pytest tests/scripts/test_log_note.py -v
"""

import sys
import tempfile
from pathlib import Path
from datetime import datetime

# Add scripts to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from log import format_log_entry, insert_into_digest as log_insert
from note import format_note_entry, insert_into_digest as note_insert

# Import sync functions for Phase 2 tests
import json
import importlib.util

# Load sync-digest-tasks.py module
sync_script_path = Path(__file__).resolve().parents[2] / "scripts" / "sync-digest-tasks.py"
spec = importlib.util.spec_from_file_location("sync_digest_tasks", sync_script_path)
sync_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_module)

parse_digest_progress = sync_module.parse_digest_progress
sync_digest_to_tasks = sync_module.sync_digest_to_tasks
sync_tasks_to_digest = sync_module.sync_tasks_to_digest
get_digest_task_titles = sync_module.get_digest_task_titles
format_task_for_digest = sync_module.format_task_for_digest


# Sample digest template
DIGEST_TEMPLATE = """# デイリーダイジェスト - 2025-12-08

## 今日のフォーカス

### 優先度：高
（タスクなし）

## 進捗

（今日の主な進捗をここに記録）

## 振り返り

### 💡 学び

（今日の振り返り・学び・気づきをここに記録）

---

**生成日時**: 2025-12-08T02:03:52.773Z
"""


def test_format_log_entry():
    """Test log entry formatting"""
    entry = format_log_entry(
        title="テストタスク",
        duration="12m",
        category="admin",
        memo="テストメモ"
    )
    
    assert "### テストタスク" in entry
    assert "**カテゴリ**: admin" in entry
    assert "**所要時間**: 12m" in entry
    assert "**メモ**: テストメモ" in entry
    assert "JST)" in entry


def test_format_log_entry_without_memo():
    """Test log entry without memo"""
    entry = format_log_entry(
        title="タスク",
        duration="1h",
        category="core-work"
    )
    
    assert "### タスク" in entry
    assert "**カテゴリ**: core-work" in entry
    assert "**所要時間**: 1h" in entry
    assert "**メモ**:" not in entry


def test_log_insert_into_digest():
    """Test inserting log entry into digest"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(DIGEST_TEMPLATE)
        temp_path = Path(f.name)
    
    try:
        # Insert a log entry
        entry = format_log_entry("タスク1", "15m", "admin")
        log_insert(temp_path, entry)
        
        # Verify insertion
        content = temp_path.read_text(encoding='utf-8')
        assert "### タスク1" in content
        assert "**カテゴリ**: admin" in content
        
        # Check it's in the right section (after ## 進捗)
        progress_idx = content.index("## 進捗")
        task_idx = content.index("### タスク1")
        assert task_idx > progress_idx
        
    finally:
        temp_path.unlink()


def test_format_note_entry():
    """Test note entry formatting"""
    entry = format_note_entry("これはテストメモ")
    
    assert "JST**: これはテストメモ" in entry
    assert entry.startswith("- **")


def test_note_insert_into_digest():
    """Test inserting note into digest with existing 学び section"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(DIGEST_TEMPLATE)
        temp_path = Path(f.name)
    
    try:
        # Insert a note
        entry = format_note_entry("テストの気づき")
        note_insert(temp_path, entry)
        
        # Verify insertion
        content = temp_path.read_text(encoding='utf-8')
        assert "テストの気づき" in content
        
        # Check it's in the right section (after ### 💡 学び)
        learning_idx = content.index("### 💡 学び")
        note_idx = content.index("テストの気づき")
        assert note_idx > learning_idx
        
    finally:
        temp_path.unlink()


def test_multiple_log_entries():
    """Test inserting multiple log entries"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(DIGEST_TEMPLATE)
        temp_path = Path(f.name)
    
    try:
        # Insert multiple entries
        entry1 = format_log_entry("タスク1", "10m", "admin")
        entry2 = format_log_entry("タスク2", "20m", "core-work")
        
        log_insert(temp_path, entry1)
        log_insert(temp_path, entry2)
        
        # Verify both are present
        content = temp_path.read_text(encoding='utf-8')
        assert "### タスク1" in content
        assert "### タスク2" in content
        
        # Verify order (タスク2 should be before タスク1 - newest first)
        task1_idx = content.index("### タスク1")
        task2_idx = content.index("### タスク2")
        assert task2_idx < task1_idx  # Most recent first
        
    finally:
        temp_path.unlink()


def test_multiple_notes():
    """Test inserting multiple notes"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(DIGEST_TEMPLATE)
        temp_path = Path(f.name)
    
    try:
        # Insert multiple notes
        note1 = format_note_entry("最初の気づき")
        note2 = format_note_entry("次の気づき")
        
        note_insert(temp_path, note1)
        note_insert(temp_path, note2)
        
        # Verify both are present
        content = temp_path.read_text(encoding='utf-8')
        assert "最初の気づき" in content
        assert "次の気づき" in content
        
    finally:
        temp_path.unlink()


# ========================================
# Phase 2: Bidirectional Sync Tests
# ========================================

DIGEST_WITH_TASKS = """# デイリーダイジェスト - 2025-12-08

## 進捗

### 既存タスク1 (10:00 JST)
- **カテゴリ**: core-work
- **所要時間**: 30m
- **メモ**: 既存のタスク

### 既存タスク2 (11:00 JST)
- **カテゴリ**: admin
- **所要時間**: 15m

## 振り返り

（記録）
"""


def test_parse_digest_progress():
    """Test parsing tasks from digest ## 進捗 section"""
    tasks = parse_digest_progress(DIGEST_WITH_TASKS)

    assert len(tasks) == 2
    assert tasks[0]["title"] == "既存タスク1"
    assert tasks[0]["timestamp"] == "10:00"
    assert tasks[0]["category"] == "core-work"
    assert tasks[0]["duration"] == "30m"
    assert tasks[0]["memo"] == "既存のタスク"

    assert tasks[1]["title"] == "既存タスク2"
    assert tasks[1]["timestamp"] == "11:00"
    assert tasks[1]["memo"] is None


def test_sync_digest_to_tasks_adds_new():
    """Test digest → tasks sync adds new items"""
    # Given: digest with 2 tasks
    digest_tasks = [
        {
            "title": "タスクA",
            "category": "core-work",
            "duration": "20m",
            "timestamp": "10:00",
            "memo": "メモA"
        },
        {
            "title": "タスクB",
            "category": "admin",
            "duration": "10m",
            "timestamp": "11:00",
            "memo": None
        }
    ]

    # Given: empty task-entry
    task_entry = {
        "date": "2025-12-08",
        "completed": []
    }

    # When: sync digest → tasks
    changed = sync_digest_to_tasks("2025-12-08", digest_tasks, task_entry)

    # Then: both tasks added
    assert changed is True
    assert len(task_entry["completed"]) == 2
    assert task_entry["completed"][0]["content"] == "タスクA"
    assert task_entry["completed"][1]["content"] == "タスクB"


def test_sync_digest_to_tasks_no_duplicates():
    """Test digest → tasks sync prevents duplicates"""
    # Given: digest with 1 task
    digest_tasks = [
        {
            "title": "既存タスク",
            "category": "core-work",
            "duration": "30m",
            "timestamp": "10:00",
            "memo": None
        }
    ]

    # Given: task-entry already has this task
    task_entry = {
        "date": "2025-12-08",
        "completed": [
            {
                "content": "既存タスク",
                "category": "core-work",
                "duration": "30m",
                "timestamp": "10:00"
            }
        ]
    }

    # When: sync digest → tasks
    changed = sync_digest_to_tasks("2025-12-08", digest_tasks, task_entry)

    # Then: no changes (duplicate prevented)
    assert changed is False
    assert len(task_entry["completed"]) == 1


def test_sync_tasks_to_digest_appends_only():
    """Test tasks → digest sync appends new tasks without modifying existing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
        f.write(DIGEST_WITH_TASKS)
        temp_path = Path(f.name)

    try:
        # Given: task-entry with existing + new task
        task_entry = {
            "date": "2025-12-08",
            "completed": [
                {
                    "content": "既存タスク1",
                    "category": "core-work",
                    "duration": "30m",
                    "timestamp": "10:00",
                    "memo": "既存のタスク"
                },
                {
                    "content": "新規タスク",
                    "category": "test",
                    "duration": "5m",
                    "timestamp": "12:00",
                    "memo": "これは新しいタスク"
                }
            ]
        }

        # When: sync tasks → digest
        changed = sync_tasks_to_digest("2025-12-08", task_entry, temp_path)

        # Then: new task added
        assert changed is True

        content = temp_path.read_text(encoding='utf-8')

        # Existing tasks preserved
        assert "### 既存タスク1 (10:00 JST)" in content
        assert "### 既存タスク2 (11:00 JST)" in content

        # New task added
        assert "### 新規タスク (12:00 JST)" in content
        assert "**カテゴリ**: test" in content
        assert "**所要時間**: 5m" in content
        assert "**メモ**: これは新しいタスク" in content

        # Check order: new task should be after existing ones
        existing1_idx = content.index("### 既存タスク1")
        existing2_idx = content.index("### 既存タスク2")
        new_idx = content.index("### 新規タスク")
        assert new_idx > existing1_idx
        assert new_idx > existing2_idx

    finally:
        temp_path.unlink()


def test_sync_tasks_to_digest_no_duplicates():
    """Test tasks → digest sync prevents duplicates"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False, encoding='utf-8') as f:
        f.write(DIGEST_WITH_TASKS)
        temp_path = Path(f.name)

    try:
        # Given: task-entry with only existing tasks
        task_entry = {
            "date": "2025-12-08",
            "completed": [
                {
                    "content": "既存タスク1",
                    "category": "core-work",
                    "duration": "30m",
                    "timestamp": "10:00"
                },
                {
                    "content": "既存タスク2",
                    "category": "admin",
                    "duration": "15m",
                    "timestamp": "11:00"
                }
            ]
        }

        # When: sync tasks → digest
        changed = sync_tasks_to_digest("2025-12-08", task_entry, temp_path)

        # Then: no changes (duplicates prevented)
        assert changed is False

        content = temp_path.read_text(encoding='utf-8')

        # Tasks should appear only once
        assert content.count("### 既存タスク1") == 1
        assert content.count("### 既存タスク2") == 1

    finally:
        temp_path.unlink()


def test_get_digest_task_titles():
    """Test extracting task titles from digest"""
    titles = get_digest_task_titles(DIGEST_WITH_TASKS)

    assert len(titles) == 2
    assert "既存タスク1" in titles
    assert "既存タスク2" in titles


def test_format_task_for_digest():
    """Test formatting task-entry task for digest"""
    task = {
        "content": "テストタスク",
        "category": "core-work",
        "duration": "25m",
        "timestamp": "14:30",
        "memo": "テストメモ"
    }

    formatted = format_task_for_digest(task)

    assert "### テストタスク (14:30 JST)" in formatted
    assert "**カテゴリ**: core-work" in formatted
    assert "**所要時間**: 25m" in formatted
    assert "**メモ**: テストメモ" in formatted


def test_format_task_for_digest_no_memo():
    """Test formatting task without memo"""
    task = {
        "content": "タスク",
        "category": "admin",
        "duration": "10m",
        "timestamp": "15:00"
    }

    formatted = format_task_for_digest(task)

    assert "### タスク (15:00 JST)" in formatted
    assert "**カテゴリ**: admin" in formatted
    assert "**所要時間**: 10m" in formatted
    assert "**メモ**:" not in formatted


if __name__ == "__main__":
    # Simple test runner (no pytest required)
    import traceback

    test_functions = [
        test_format_log_entry,
        test_format_log_entry_without_memo,
        test_log_insert_into_digest,
        test_format_note_entry,
        test_note_insert_into_digest,
        test_multiple_log_entries,
        test_multiple_notes,
        # Phase 2 tests
        test_parse_digest_progress,
        test_sync_digest_to_tasks_adds_new,
        test_sync_digest_to_tasks_no_duplicates,
        test_sync_tasks_to_digest_appends_only,
        test_sync_tasks_to_digest_no_duplicates,
        test_get_digest_task_titles,
        test_format_task_for_digest,
        test_format_task_for_digest_no_memo,
    ]

    passed = 0
    failed = 0

    for test_func in test_functions:
        try:
            test_func()
            print(f"✅ PASS: {test_func.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {test_func.__name__}")
            print(f"   {str(e)}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {test_func.__name__}")
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*60}")
    print(f"Tests: {passed} passed, {failed} failed, {passed + failed} total")
    print(f"{'='*60}")

    if failed > 0:
        sys.exit(1)
