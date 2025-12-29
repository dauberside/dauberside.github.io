#!/usr/bin/env python3
"""
log.py - Record task completion to daily digest

Usage:
    python scripts/log.py -t "タスク名" -d "12m" -c "admin"
    python scripts/log.py -t "バグ修正" -d "1.5h" -c "core-work"

Options:
    -t, --title     Task title (required)
    -d, --duration  Duration (e.g., 12m, 1.5h) (required)
    -c, --category  Category (default: misc)
    -m, --memo      Optional memo/note
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

# Resolve paths
ROOT = Path(__file__).resolve().parents[1]
DAILY_DIR = ROOT / "cortex" / "daily"


def get_jst_now():
    """Get current time in JST (UTC+9)"""
    from datetime import timezone, timedelta
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst)


def format_log_entry(title: str, duration: str, category: str, memo: str = None) -> str:
    """Format a log entry block"""
    now = get_jst_now()
    time_str = now.strftime("%H:%M")
    
    lines = [
        f"### {title} ({time_str} JST)",
        f"- **カテゴリ**: {category}",
        f"- **所要時間**: {duration}",
    ]
    
    if memo:
        lines.append(f"- **メモ**: {memo}")
    
    lines.append("")  # Blank line after entry
    return "\n".join(lines)


def insert_into_digest(digest_path: Path, entry_block: str) -> None:
    """Insert entry block into digest's 進捗 section"""
    if not digest_path.exists():
        print(f"❌ Digest file not found: {digest_path}", file=sys.stderr)
        print(f"   Generate today's digest first with Recipe 14", file=sys.stderr)
        sys.exit(1)
    
    content = digest_path.read_text(encoding="utf-8")
    marker = "## 進捗"
    
    if marker not in content:
        print(f"❌ Section '{marker}' not found in {digest_path}", file=sys.stderr)
        sys.exit(1)
    
    # Split at marker and insert entry
    before, after = content.split(marker, 1)
    
    # Find the end of the section header line
    after_lines = after.split("\n", 1)
    if len(after_lines) == 1:
        # No content after marker
        new_content = before + marker + "\n\n" + entry_block
    else:
        section_header = after_lines[0]
        section_body = after_lines[1]
        
        # Insert at the beginning of section body
        new_content = (
            before + marker + section_header + "\n\n" + entry_block + section_body
        )
    
    digest_path.write_text(new_content, encoding="utf-8")
    print(f"✅ Logged to {digest_path.name}")


def main():
    parser = argparse.ArgumentParser(
        description="Record task completion to daily digest",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/log.py -t "環境変数修正" -d "12m" -c "admin"
    python scripts/log.py -t "バグ修正" -d "1.5h" -c "core-work" -m "CSS issue"
        """,
    )
    
    parser.add_argument(
        "-t", "--title",
        required=True,
        help="Task title"
    )
    parser.add_argument(
        "-d", "--duration",
        required=True,
        help="Duration (e.g., 12m, 1.5h)"
    )
    parser.add_argument(
        "-c", "--category",
        default="misc",
        help="Task category (default: misc)"
    )
    parser.add_argument(
        "-m", "--memo",
        help="Optional memo/note"
    )
    
    args = parser.parse_args()
    
    # Get today's digest path
    today = get_jst_now().strftime("%Y-%m-%d")
    digest_path = DAILY_DIR / f"{today}-digest.md"
    
    # Format entry
    entry_block = format_log_entry(
        args.title,
        args.duration,
        args.category,
        args.memo
    )
    
    # Insert into digest
    insert_into_digest(digest_path, entry_block)

    # Auto-sync digest → task-entry.json
    try:
        import subprocess
        sync_script = ROOT / "scripts" / "sync-digest-tasks.py"
        if sync_script.exists():
            result = subprocess.run(
                ["python3", str(sync_script), today],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                # Extract summary line from sync output
                for line in result.stdout.split('\n'):
                    if '✅' in line or 'Added:' in line:
                        print(f"   {line.strip()}")
    except Exception:
        # Sync failure is non-fatal - user can manually sync later
        pass


if __name__ == "__main__":
    main()
