#!/usr/bin/env python3
"""
note.py - Quick note/insight to daily digest

Usage:
    python scripts/note.py "n8n の cron は volume 永続化に注意"
    python scripts/note.py "コメントと実装の不一致は設計意図の喪失"

The note will be added to the "振り返り > 💡 学び" section.
"""

import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Resolve paths
ROOT = Path(__file__).resolve().parents[1]
DAILY_DIR = ROOT / "cortex" / "daily"


def get_jst_now():
    """Get current time in JST (UTC+9)"""
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst)


def format_note_entry(note_text: str) -> str:
    """Format a note entry"""
    now = get_jst_now()
    time_str = now.strftime("%H:%M")
    return f"- **{time_str} JST**: {note_text}\n"


def insert_into_digest(digest_path: Path, note_entry: str) -> None:
    """Insert note into digest's 振り返り > 💡 学び section"""
    if not digest_path.exists():
        print(f"❌ Digest file not found: {digest_path}", file=sys.stderr)
        print(f"   Generate today's digest first with Recipe 14", file=sys.stderr)
        sys.exit(1)
    
    content = digest_path.read_text(encoding="utf-8")
    
    # Try to find existing 💡 学び section
    learning_marker = "### 💡 学び"
    
    if learning_marker in content:
        # Insert after the section header
        before, after = content.split(learning_marker, 1)
        
        # Find the first line break after marker
        after_lines = after.split("\n", 1)
        if len(after_lines) == 1:
            # No content after marker
            new_content = before + learning_marker + "\n\n" + note_entry
        else:
            section_header = after_lines[0]
            section_body = after_lines[1]
            
            # Insert at the beginning of section body
            new_content = (
                before + learning_marker + section_header + "\n\n" + 
                note_entry + section_body
            )
    else:
        # If 💡 学び doesn't exist, try to insert after 振り返り section
        reflection_marker = "## 振り返り"
        
        if reflection_marker not in content:
            print(f"❌ Section '## 振り返り' not found in {digest_path}", file=sys.stderr)
            sys.exit(1)
        
        before, after = content.split(reflection_marker, 1)
        
        # Create new 💡 学び section
        new_section = f"\n\n### 💡 学び\n\n{note_entry}"
        new_content = before + reflection_marker + after.split("\n", 1)[0] + new_section + "\n" + after.split("\n", 1)[1]
    
    digest_path.write_text(new_content, encoding="utf-8")
    print(f"✅ Note added to {digest_path.name}")


def main():
    parser = argparse.ArgumentParser(
        description="Add quick note/insight to daily digest",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/note.py "n8n の cron は volume 永続化に注意"
    python scripts/note.py "コメントと実装の不一致は設計意図の喪失"
        """,
    )
    
    parser.add_argument(
        "note",
        help="Note text"
    )
    
    args = parser.parse_args()
    
    # Get today's digest path
    today = get_jst_now().strftime("%Y-%m-%d")
    digest_path = DAILY_DIR / f"{today}-digest.md"
    
    # Format note entry
    note_entry = format_note_entry(args.note)
    
    # Insert into digest
    insert_into_digest(digest_path, note_entry)


if __name__ == "__main__":
    main()
