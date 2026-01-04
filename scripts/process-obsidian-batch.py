#!/usr/bin/env python3
"""
Process Obsidian Daily Digests from Batch Read

Processes multiple daily digest markdown contents and generates
task-entry-*.json files for analytics.

Usage:
    python scripts/process-obsidian-batch.py
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any


STATE_DIR = Path("cortex/state")


def extract_timerange_from_text(text: str) -> tuple[str | None, str | None, str]:
    """
    Extract time range from text like (18:20-18:30 JST).
    Returns (start_time, end_time, cleaned_text) tuple.
    Times are returned in HH:MM format.
    """
    # Pattern: (HH:MM-HH:MM JST) or (HH:MM-HH:MM)
    timerange_pattern = r'\((\d{2}:\d{2})-(\d{2}:\d{2})(?:\s*JST)?\)'
    match = re.search(timerange_pattern, text)

    if match:
        start_time = match.group(1)
        end_time = match.group(2)
        # Remove the time range from text
        text = re.sub(timerange_pattern, '', text).strip()
        text = re.sub(r'\s+', ' ', text).strip()
        return start_time, end_time, text

    return None, None, text


def extract_duration_from_text(text: str) -> tuple[int | None, str, str]:
    """
    Extract duration from text using multiple patterns.
    Returns (duration_minutes, duration_source, cleaned_text) tuple.

    duration_source values:
    - "explicit": Explicitly stated duration (10分, 10m, **所要時間**: 10m)
    - None: No duration found
    """
    duration = None
    duration_source = None

    # Try multiple patterns
    duration_patterns = [
        (r'\((\d+)分\)', 1),         # (30分)
        (r'(\d+)分', 1),             # 30分
        (r'\((\d+)m\)', 1),          # (10m)
        (r'(\d+)m(?!\w)', 1),        # 10m (not followed by word chars)
        (r'\*\*所要時間\*\*:\s*(\d+)m', 1),  # **所要時間**: 10m
        (r'\*\*所要時間\*\*:\s*(\d+)分', 1),  # **所要時間**: 10分
    ]

    for pattern, _ in duration_patterns:
        duration_match = re.search(pattern, text)
        if duration_match:
            duration = int(duration_match.group(1))
            duration_source = "explicit"
            # Remove the duration from text
            text = re.sub(pattern, '', text).strip()
            # Clean up extra whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            break

    return duration, duration_source, text


def parse_daily_digest(content: str, date_str: str) -> Dict[str, Any]:
    """
    Parse a daily digest markdown content and extract task data.

    Supports multiple formats:
    1. Task list: - [x] Task title (30分)
    2. Table: | Time | Task | Duration |
    3. Progress section: ### Title (time) + **所要時間**: Xm

    Returns task entry dict in format:
    {
        "tasks": [
            {
                "title": "Task title",
                "status": "completed" | "incomplete",
                "category": "high-priority" | "normal" | "untagged",
                "completed_at": "ISO8601" or None,
                "duration_minutes": int or None
            }
        ]
    }
    """
    tasks = []
    current_category = "untagged"

    lines = content.split("\n")

    # Phase 1: Parse task list format
    for line in lines:
        line = line.strip()

        # Detect category headers
        if "優先度：高" in line or "優先度: 高" in line or "High Priority" in line:
            current_category = "high-priority"
            continue
        elif "通常タスク" in line or "Regular Tasks" in line:
            current_category = "normal"
            continue
        elif "タグなしタスク" in line or "No Tags" in line:
            current_category = "untagged"
            continue

        # Parse task lines: - [x] or - [ ]
        task_match = re.match(r'^-\s*\[([ xX✓])\]\s+(.+)$', line)
        if task_match:
            is_completed = task_match.group(1).lower() in ['x', '✓']
            task_text = task_match.group(2).strip()

            # Skip placeholder tasks
            if "タスクなし" in task_text or "今日の主な進捗" in task_text:
                continue

            # Extract time range first (highest priority)
            start_time, end_time, task_text = extract_timerange_from_text(task_text)

            # Extract duration using unified function
            duration, duration_source, task_text = extract_duration_from_text(task_text)

            task = {
                "title": task_text,
                "status": "completed" if is_completed else "incomplete",
                "category": current_category
            }

            # Timestamp handling with source/confidence
            if start_time and end_time:
                # Timerange found: highest confidence
                task["started_at"] = f"{date_str}T{start_time}:00+09:00"
                task["completed_at"] = f"{date_str}T{end_time}:00+09:00"
                task["timestamp_source"] = "timerange"
                task["timestamp_confidence"] = 0.7

                # Calculate duration from timerange if not explicitly provided
                if not duration:
                    start_h, start_m = map(int, start_time.split(':'))
                    end_h, end_m = map(int, end_time.split(':'))
                    duration_mins = (end_h * 60 + end_m) - (start_h * 60 + start_m)
                    if 1 <= duration_mins <= 240:  # Sanity check: 1-240 minutes
                        task["duration_minutes"] = duration_mins
                        task["duration_source"] = "timerange"
                        task["duration_confidence"] = 0.7
            elif is_completed:
                # No timerange: use fixed placeholder (方針B)
                task["completed_at"] = f"{date_str}T01:00:00Z"
                task["timestamp_source"] = "fixed"
                task["timestamp_confidence"] = 0.1
            else:
                task["completed_at"] = None
                task["timestamp_source"] = "unknown"
                task["timestamp_confidence"] = 0.0

            # Duration handling with source/confidence
            if duration and duration_source == "explicit":
                task["duration_minutes"] = duration
                task["duration_source"] = "explicit"
                task["duration_confidence"] = 1.0
            elif "duration_source" not in task:
                # No duration info at all
                task["duration_source"] = "unknown"
                task["duration_confidence"] = 0.0

            tasks.append(task)

    # Phase 2: Parse table format (| Time | Task | Duration |)
    in_table = False
    for i, line in enumerate(lines):
        line = line.strip()

        # Detect table header row
        if re.match(r'\|\s*時刻\s*\|.*\|\s*時間\s*\|', line, re.IGNORECASE):
            in_table = True
            continue

        # Skip separator row
        if in_table and re.match(r'\|[-:\s]+\|', line):
            continue

        # Parse table data rows
        if in_table and line.startswith('|') and not re.match(r'\|[-:\s]+\|', line):
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 4:  # | time | task | duration |
                time_text = parts[1]
                task_title = parts[2]
                duration_text = parts[3] if len(parts) > 3 else ""

                # Extract time range from time column
                start_time, end_time, _ = extract_timerange_from_text(time_text)

                # Extract duration from the duration column
                duration, duration_source, _ = extract_duration_from_text(duration_text)

                if task_title and task_title != "タスク":
                    task = {
                        "title": task_title,
                        "status": "completed",  # Table tasks are assumed completed
                        "category": "normal"
                    }

                    # Timestamp handling
                    if start_time and end_time:
                        task["started_at"] = f"{date_str}T{start_time}:00+09:00"
                        task["completed_at"] = f"{date_str}T{end_time}:00+09:00"
                        task["timestamp_source"] = "timerange"
                        task["timestamp_confidence"] = 0.7

                        # Calculate duration from timerange if not in duration column
                        if not duration:
                            start_h, start_m = map(int, start_time.split(':'))
                            end_h, end_m = map(int, end_time.split(':'))
                            duration_mins = (end_h * 60 + end_m) - (start_h * 60 + start_m)
                            if 1 <= duration_mins <= 240:
                                task["duration_minutes"] = duration_mins
                                task["duration_source"] = "timerange"
                                task["duration_confidence"] = 0.7
                    else:
                        # No time info: fixed placeholder
                        task["completed_at"] = f"{date_str}T01:00:00Z"
                        task["timestamp_source"] = "fixed"
                        task["timestamp_confidence"] = 0.1

                    # Duration handling
                    if duration and duration_source == "explicit":
                        task["duration_minutes"] = duration
                        task["duration_source"] = "explicit"
                        task["duration_confidence"] = 1.0
                    elif "duration_source" not in task:
                        task["duration_source"] = "unknown"
                        task["duration_confidence"] = 0.0

                    tasks.append(task)
        elif in_table and not line.startswith('|'):
            # End of table
            in_table = False

    # Phase 3: Parse progress section format (### Title (HH:MM-HH:MM JST) + **所要時間**: Xm)
    for i, line in enumerate(lines):
        line = line.strip()

        # Detect section header with time range: ### Title (HH:MM-HH:MM JST)
        section_match = re.match(r'^###\s+(.+?)\s*\((\d{2}:\d{2})-(\d{2}:\d{2})\s*JST\)', line)
        if section_match:
            section_title = section_match.group(1).strip()
            start_time = section_match.group(2)
            end_time = section_match.group(3)

            # Look ahead for **所要時間**: Xm in the next few lines
            duration = None
            duration_source = None
            for j in range(i + 1, min(i + 5, len(lines))):
                next_line = lines[j].strip()
                # Check for duration marker
                if '**所要時間**:' in next_line or '**カテゴリ**:' in next_line:
                    dur, dur_src, _ = extract_duration_from_text(next_line)
                    if dur:
                        duration = dur
                        duration_source = dur_src
                        break
                # Stop if we hit another section or empty lines
                if next_line.startswith('###') or (not next_line and j > i + 2):
                    break

            task = {
                "title": section_title,
                "status": "completed",
                "category": "normal",
                "started_at": f"{date_str}T{start_time}:00+09:00",
                "completed_at": f"{date_str}T{end_time}:00+09:00",
                "timestamp_source": "timerange",
                "timestamp_confidence": 0.7
            }

            # Duration handling
            if duration and duration_source == "explicit":
                task["duration_minutes"] = duration
                task["duration_source"] = "explicit"
                task["duration_confidence"] = 1.0
            else:
                # Calculate from timerange
                start_h, start_m = map(int, start_time.split(':'))
                end_h, end_m = map(int, end_time.split(':'))
                duration_mins = (end_h * 60 + end_m) - (start_h * 60 + start_m)
                if 1 <= duration_mins <= 240:
                    task["duration_minutes"] = duration_mins
                    task["duration_source"] = "timerange"
                    task["duration_confidence"] = 0.7
                else:
                    task["duration_source"] = "unknown"
                    task["duration_confidence"] = 0.0

            tasks.append(task)

    return {"tasks": tasks}


# Digest data from MCP batch read
DIGEST_DATA = {
    "2025-11-17": """# Daily Digest - 2025-11-17

## Tasks
- [x] Recipe 1 完了（Obsidian → Slack 通知）
- [x] Recipe 2 完了（定期 KB 再構築）
- [x] Recipe 3 完成（Daily Digest to Slack）
- [x] Phase 2 基盤構築完了

## Reflection
- Phase 2 の基盤が整った
- Recipe 1-3 が全て動作確認済み
- 自動化の土台ができた""",

    "2025-11-18": """# Daily Digest - 2025-11-18

## Tasks
- [x] Recipe 3 完成（Daily Digest to Slack）
- [x] Phase 2 基盤構築完了
- [x] Recipe 9 テスト実行
- [x] Weekly Summary ワークフロー設計
- [x] Claude Code 連携動作確認

## Reflection
- Phase 2 の自動化基盤が整った
- n8n と Obsidian の連携がスムーズに動作
- KB 夜間自動再構築、朝の Digest 配信、重要ノート変更通知のループが完成
- 次は Claude Code との直結（Recipe 9）で開発体験をさらに向上""",

    "2025-11-19": """# Daily Digest 2025-11-19

## Tasks
- [ ] Cortex OS Weekly テスト
- [ ] Recipe 11 動作確認
- [ ] Continue On Fail 設定追加

## Reflection
- Weekly Summary のテスト用に作成
- Phase 2.1 自動化基盤の検証中""",

    "2025-11-25": """### ✅ 完了タスク（時系列）

#### 1. 環境準備・確認
- [x] /init でセッション状態復元
- [x] Recipe 13 実行結果確認（22:00自動実行成功）
- [x] tomorrow.json 検証（正常生成確認）
- [x] Phase 2 実装状況確認

#### 2. n8n デプロイ準備
- [x] デプロイ手順ドキュメント確認
- [x] プラットフォーム選択（Railway 決定）
- [x] .env.production 作成
- [x] セキュリティキー生成
- [x] .gitignore 確認（機密情報保護）

#### 3. Railway 設定ファイル作成
- [x] railway.json 作成（ビルド設定）
- [x] Dockerfile.railway 作成（Railway最適化）
- [x] README-RAILWAY.md 作成（デプロイガイド）
- [x] Caddyfile 作成（自前VPS用）
- [x] deploy-production.sh 作成（自前VPS用）""",

    "2025-11-26": """#### 1. 問題調査
- [x] Obsidian MCP エラー確認（2件）
- [x] 環境変数確認（MCP_OBSIDIAN_* すべて正常）
- [x] Obsidian プロセス確認（未起動を確認）

#### 2. 根本原因特定
- [x] PORT 27124 接続テスト（失敗）
- [x] lsof でポート確認（リスニングなし）
- [x] curl テスト（Connection refused）
- [x] **根本原因確定**: Obsidian REST API 未起動""",

    "2025-11-27": """**実装完了**:
- ✅ build-embeddings.mjs 実装・実行 (184 concepts → embeddings)
- ✅ cluster.mjs 実装・実行 (Connected Components, threshold: 0.7)
- ✅ export-graph.mjs 実装・実行 (graph-v1.json + clusters-v1.md)""",

    "2025-11-28": """### High Priority
  - [ ] cortex/kb/embed.mjs refactoring #urgent #deepwork
  - [ ] Production deployment blocked by infra #blocked
  - [ ] Waiting for design team feedback #waiting

  ### Regular Tasks
  - [ ] cortex/graph/export.mjs テスト追加 #review
  - [ ] n8n Recipe 03 documentation #review
  - [ ] Research new caching strategy #deepwork

  ### No Tags
  - [ ] Update README
  - [ ] Code cleanup""",

    "2025-12-01": """### 🎉 Major Achievement
     KB Rebuild完全実装！11時間のセッションで:
     - Recipe 02完成（n8n workflow）
     - Hash-based embeddings（146 files → 732 chunks）
     - 認証設定・エラー修正
     - Health Score 90%達成""",

    "2025-12-06": """### 優先度：高
1. ⏰ Recipe 03/10 実行ログ確認（スケジュールエラー発覚）

### Regular Tasks
| 時刻  | タスク                     | 時間  |
|-------|---------------------------|-------|
| 17:00+ | Recipe 03/10 実行ログ確認   | 10分  |
| 17:15+ | Health Score 初回診断      | 15分  |
| 17:35+ | /suggest v2.0 動作確認     | 20分  |""",

    "2025-12-08": """### ✅ 完了タスク（時系列）

#### 1. 環境準備・確認
- [x] /init でセッション状態復元
- [x] Recipe 13 実行結果確認（22:00自動実行成功）
- [x] tomorrow.json 検証（正常生成確認）
- [x] Phase 2 実装状況確認

#### 2. n8n デプロイ準備
- [x] デプロイ手順ドキュメント確認
- [x] プラットフォーム選択（Railway 決定）""",

    "2025-12-09": """### 優先度：高
- [x] 日次ダイジェスト生成バグ修正
- [x] Recipe 03修復
- [x] GitHub pushまで完了
- [x] システム診断実行""",

    "2025-12-10": """### 優先度：高
- [x] Recipe スケジュール修正完了 (10分)
- [x] Recipe 10 診断と誤診の訂正 (35分)
- [x] 誤診用ドキュメント削除
- [x] Recipe 10 再有効化""",

    "2025-12-12": """### 優先度：高
- [x] Recipe 動作確認
- [x] Recipe 14 日付ロジック修正
- [x] Recipe 02 kb-api 参照削除
- [x] スケジュール再設定（22:10スタート）""",

    "2025-12-13": """### 優先度：高
- [x] v1.2 Roadmap 確認
- [x] Recipe 動作確認
- [x] ドキュメント整理""",

    "2025-12-14": """### 優先度：高
- [ ] v1.2 Roadmap 確認
- [ ] Recipe 動作確認
- [ ] ドキュメント整理""",

    "2025-12-19": """### 優先度：高
- [x] v1.2 Roadmap 確認
- [x] Recipe 動作確認
- [x] ドキュメント整理""",
}


def load_digest_files() -> Dict[str, str]:
    """Load digest files from cortex/daily/ directory."""
    daily_dir = Path("cortex/daily")
    if not daily_dir.exists():
        return {}

    digest_data = {}
    for file_path in sorted(daily_dir.glob("????-??-??-digest.md")):
        # Extract date from filename: 2025-12-22-digest.md -> 2025-12-22
        date_str = file_path.stem.replace("-digest", "")

        try:
            with file_path.open("r", encoding="utf-8") as f:
                content = f.read()
                digest_data[date_str] = content
        except Exception as e:
            print(f"⚠️  Error reading {file_path}: {e}", file=sys.stderr)

    return digest_data


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Process Obsidian daily digests')
    parser.add_argument('--from-files', action='store_true',
                       help='Load digests from cortex/daily/*.md files instead of DIGEST_DATA')
    args = parser.parse_args()

    STATE_DIR.mkdir(parents=True, exist_ok=True)

    # Choose data source
    if args.from_files:
        digest_data = load_digest_files()
        source = "cortex/daily/"
    else:
        digest_data = DIGEST_DATA
        source = "DIGEST_DATA (embedded)"

    processed = 0
    extracted_total = 0
    duration_count = 0

    print(f"🔍 Processing {len(digest_data)} daily digests from {source}...")
    print(f"   Output: {STATE_DIR}")
    print()

    for date_str, content in sorted(digest_data.items()):
        # Parse digest
        task_data = parse_daily_digest(content, date_str)
        task_count = len(task_data["tasks"])

        if task_count == 0:
            print(f"⏭️  {date_str}: No tasks found, skipping")
            continue

        # Count tasks with duration
        tasks_with_duration = sum(1 for t in task_data["tasks"] if "duration_minutes" in t)

        # Write task entry JSON
        output_file = STATE_DIR / f"task-entry-{date_str}.json"
        with output_file.open("w", encoding="utf-8") as f:
            json.dump(task_data, f, ensure_ascii=False, indent=2)

        duration_info = f" ({tasks_with_duration} with duration)" if tasks_with_duration > 0 else ""
        print(f"✅ {date_str}: {task_count} tasks{duration_info} → {output_file}")
        processed += 1
        extracted_total += task_count
        duration_count += tasks_with_duration

    print()
    print(f"📊 Summary:")
    print(f"   Files processed: {processed}")
    print(f"   Tasks extracted: {extracted_total}")
    print(f"   Tasks with duration: {duration_count}")
    print()
    print("✅ Task extraction complete!")
    print()
    print("Next steps:")
    print("   1. Run analytics: python3 scripts/analyze-duration.py")
    print("   2. Run analytics: python3 scripts/analyze-category-heatmap.py")
    print("   3. Run analytics: python3 scripts/analyze-rhythm.py")
    print("   4. Run health check: python3 scripts/analyze-health.py --window-days 7")


if __name__ == "__main__":
    import sys
    main()
