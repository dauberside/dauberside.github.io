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


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
