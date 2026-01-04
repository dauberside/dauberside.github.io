#!/usr/bin/env python3
"""
Phase 2 監視イベント検証スクリプト（v2.0 - 成功条件固定版）

使用方法:
  python scripts/verify-phase2-event.py 2026-01-02

成功条件（ブレない定義）:
  1. /log 実施の証跡がある（最低1件）
  2. digest 更新がある
  3. task-entry 更新がある
  4. データ整合性OK（digest件数 == task-entry件数）
"""

import json
import sys
import hashlib
from pathlib import Path
from datetime import datetime
import re

ROOT = Path(__file__).parent.parent
MONITORING_FILE = ROOT / "cortex/state/phase2-monitoring.json"


def compute_file_hash(file_path):
    """ファイルのSHA256ハッシュを計算"""
    if not file_path.exists():
        return None

    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            sha256.update(chunk)
    return f"sha256:{sha256.hexdigest()[:16]}"


def load_monitoring_data():
    """監視台帳を読み込む"""
    if not MONITORING_FILE.exists():
        return {
            "monitoring_start_date": "2025-12-29",
            "monitoring_definition": "event-based",
            "target_events": 7,
            "success_criteria": {
                "log_event_present": "最低1件の/logタスク記録",
                "digest_updated": "digest ファイル更新確認",
                "task_entry_updated": "task-entry.json 更新確認",
                "data_integrity": "digest と task-entry の内容一致"
            },
            "events": [],
            "summary": {
                "completed_events": 0,
                "remaining_events": 7,
                "success_rate": 0.0,
                "total_tasks_logged": 0,
                "failures": 0
            },
            "metadata": {
                "last_updated": datetime.now().isoformat(),
                "schema_version": "2.0.0"
            }
        }

    with open(MONITORING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_monitoring_data(data):
    """監視台帳を保存"""
    data["metadata"]["last_updated"] = datetime.now().isoformat()
    with open(MONITORING_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def verify_event(date_str):
    """
    指定日付の /log イベントを検証

    成功条件:
      1. digest に /log タスクが1件以上
      2. digest ファイルが存在
      3. task-entry.json ファイルが存在
      4. digest タスク数 == task-entry completed数
    """
    print(f"🔍 Verifying Phase 2 event for {date_str}...")
    print()

    digest_path = ROOT / f"cortex/daily/{date_str}-digest.md"
    tasks_json_path = ROOT / f"cortex/state/task-entry-{date_str}.json"

    result = {
        "event_id": None,
        "date": date_str,
        "log_event": False,
        "log_count": 0,
        "digest": {
            "exists": False,
            "path": str(digest_path.relative_to(ROOT)),
            "mtime": None,
            "hash": None
        },
        "task_entry": {
            "exists": False,
            "path": str(tasks_json_path.relative_to(ROOT)),
            "mtime": None,
            "hash": None
        },
        "result": "unknown",
        "notes": "",
        "errors": []
    }

    # 1. Digest チェック
    if not digest_path.exists():
        result["errors"].append("digest file not found")
        result["result"] = "fail"
        print("❌ Digest not found")
        return result

    result["digest"]["exists"] = True
    result["digest"]["mtime"] = datetime.fromtimestamp(digest_path.stat().st_mtime).isoformat()
    result["digest"]["hash"] = compute_file_hash(digest_path)

    # /log 形式のタスクを抽出: ### タスク名 (HH:MM JST)
    with open(digest_path, 'r', encoding='utf-8') as f:
        content = f.read()

    task_pattern = r'### (.+?) \((\d{2}:\d{2}) JST\)'
    tasks_found = re.findall(task_pattern, content)

    if not tasks_found:
        result["errors"].append("no /log tasks found in digest")
        result["log_event"] = False
        result["log_count"] = 0
        result["result"] = "fail"
        print("❌ No /log tasks found in digest")
        print(f"   Expected pattern: ### タスク名 (HH:MM JST)")
        return result

    result["log_event"] = True
    result["log_count"] = len(tasks_found)
    print(f"✅ Digest found: {len(tasks_found)} task(s)")
    for title, time in tasks_found:
        print(f"   - {title} ({time} JST)")

    # 2. task-entry.json チェック
    if not tasks_json_path.exists():
        result["errors"].append("task-entry.json not found (auto-sync failed)")
        result["task_entry"]["exists"] = False
        result["result"] = "fail"
        print("❌ task-entry.json not found (auto-sync failed)")
        return result

    result["task_entry"]["exists"] = True
    result["task_entry"]["mtime"] = datetime.fromtimestamp(tasks_json_path.stat().st_mtime).isoformat()
    result["task_entry"]["hash"] = compute_file_hash(tasks_json_path)

    with open(tasks_json_path, 'r', encoding='utf-8') as f:
        tasks_data = json.load(f)

    completed_tasks = tasks_data.get("completed", [])
    print(f"✅ task-entry.json found: {len(completed_tasks)} task(s)")

    # 3. データ整合性チェック
    if len(tasks_found) != len(completed_tasks):
        result["errors"].append(
            f"data integrity fail: digest={len(tasks_found)}, json={len(completed_tasks)}"
        )
        result["result"] = "partial"
        result["notes"] = f"auto-sync成功だが件数不一致（digest={len(tasks_found)}, json={len(completed_tasks)}）"
        print(f"⚠️  Data integrity: PARTIAL")
        print(f"   Digest: {len(tasks_found)} tasks")
        print(f"   JSON: {len(completed_tasks)} tasks")
    else:
        result["result"] = "success"
        result["notes"] = f"{len(tasks_found)}タスク記録、auto-sync成功、データ整合性OK"
        print("✅ Data integrity: PASS")

    print()
    print(f"📊 Result: {result['result'].upper()}")

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/verify-phase2-event.py YYYY-MM-DD")
        print("Example: python scripts/verify-phase2-event.py 2026-01-02")
        sys.exit(1)

    date_str = sys.argv[1]

    # 検証実行
    event_result = verify_event(date_str)

    # 監視台帳に記録
    monitoring = load_monitoring_data()

    # イベントIDを設定
    existing_dates = [e["date"] for e in monitoring["events"]]
    if date_str in existing_dates:
        print()
        print(f"⚠️  Event for {date_str} already exists - updating...")
        for i, e in enumerate(monitoring["events"]):
            if e["date"] == date_str:
                event_result["event_id"] = e["event_id"]
                monitoring["events"][i] = event_result
                break
    else:
        event_result["event_id"] = len(monitoring["events"]) + 1
        monitoring["events"].append(event_result)
        print()
        print(f"✅ New event #{event_result['event_id']} recorded")

    # サマリー更新
    success_events = [e for e in monitoring["events"] if e["result"] == "success"]
    monitoring["summary"]["completed_events"] = len(success_events)
    monitoring["summary"]["remaining_events"] = monitoring["target_events"] - len(success_events)
    monitoring["summary"]["success_rate"] = (
        len(success_events) / len(monitoring["events"]) if monitoring["events"] else 0.0
    )
    monitoring["summary"]["total_tasks_logged"] = sum(e["log_count"] for e in monitoring["events"])
    monitoring["summary"]["failures"] = len([e for e in monitoring["events"] if e["result"] == "fail"])

    save_monitoring_data(monitoring)

    print()
    print("📝 Monitoring log updated:")
    print(f"   Events: {monitoring['summary']['completed_events']}/{monitoring['target_events']}")
    print(f"   Success rate: {monitoring['summary']['success_rate']*100:.1f}%")
    print(f"   Total tasks: {monitoring['summary']['total_tasks_logged']}")
    print(f"   File: {MONITORING_FILE.relative_to(ROOT)}")

    # 残りイベント数表示
    remaining = monitoring["summary"]["remaining_events"]
    if remaining > 0:
        print()
        print(f"🎯 Remaining: {remaining} more successful events needed")
    else:
        print()
        print("🎉 Phase 2 monitoring complete!")


if __name__ == "__main__":
    main()
