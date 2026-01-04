#!/bin/bash
# Phase 2監視の失敗検出能力テスト
#
# 目的: verify-phase2-event.py が正しく失敗を検出できるか確認
#
# テストケース:
#   1. digest のみ存在（task-entry.json なし）→ fail
#   2. task-entry.json のみ存在（digest なし）→ fail
#   3. 両方存在だが /log 形式タスクなし → fail
#   4. 両方存在、/log あり、件数不一致 → partial
#   5. 正常ケース → success

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DATE="2099-12-31"  # 未来日付でテスト
TEST_DIR="$ROOT/.test-phase2-monitoring"

echo "🧪 Phase 2 Monitoring Failure Detection Test"
echo "============================================="
echo ""

# クリーンアップ関数
cleanup() {
    echo ""
    echo "🧹 Cleaning up test files..."
    rm -rf "$TEST_DIR"
    echo "✅ Cleanup complete"
}

# テスト終了時にクリーンアップ
trap cleanup EXIT

# テスト準備
mkdir -p "$TEST_DIR/cortex/daily"
mkdir -p "$TEST_DIR/cortex/state"

echo "Test Date: $TEST_DATE"
echo ""

# ==================== Test Case 1: digest のみ存在 ====================
echo "Test Case 1: digest exists, task-entry.json missing"
echo "Expected: FAIL (auto-sync failed)"
echo ""

cat > "$TEST_DIR/cortex/daily/$TEST_DATE-digest.md" << 'EOF'
# デイリーダイジェスト - 2099-12-31

## 進捗

### テストタスク1 (10:00 JST)
- **カテゴリ**: testing
- **所要時間**: 5分
EOF

# task-entry.json を作らない

# 検証実行（失敗を期待）
if python3 "$ROOT/scripts/verify-phase2-event.py" "$TEST_DATE" 2>&1 | grep -q "FAIL"; then
    echo "✅ Test Case 1: PASS (correctly detected failure)"
else
    echo "❌ Test Case 1: FAIL (should have detected auto-sync failure)"
    exit 1
fi

echo ""
echo "---"
echo ""

# ==================== Test Case 2: /log形式タスクなし ====================
echo "Test Case 2: digest exists but no /log tasks"
echo "Expected: FAIL (no log event)"
echo ""

# task-entry.json を追加
cat > "$TEST_DIR/cortex/state/task-entry-$TEST_DATE.json" << 'EOF'
{
  "date": "2099-12-31",
  "completed": [
    {"content": "テストタスク1", "duration": "5m", "category": "testing"}
  ]
}
EOF

# digest を手動編集形式に変更（/log形式でない）
cat > "$TEST_DIR/cortex/daily/$TEST_DATE-digest.md" << 'EOF'
# デイリーダイジェスト - 2099-12-31

## 進捗

- [x] テストタスク1（手動記入、/log形式でない）
EOF

if python3 "$ROOT/scripts/verify-phase2-event.py" "$TEST_DATE" 2>&1 | grep -q "FAIL"; then
    echo "✅ Test Case 2: PASS (correctly detected no /log tasks)"
else
    echo "❌ Test Case 2: FAIL (should have detected missing /log format)"
    exit 1
fi

echo ""
echo "---"
echo ""

# ==================== Test Case 3: 件数不一致 ====================
echo "Test Case 3: task count mismatch (digest=1, json=2)"
echo "Expected: PARTIAL (data integrity fail)"
echo ""

# digest: 1タスク
cat > "$TEST_DIR/cortex/daily/$TEST_DATE-digest.md" << 'EOF'
# デイリーダイジェスト - 2099-12-31

## 進捗

### テストタスク1 (10:00 JST)
- **カテゴリ**: testing
- **所要時間**: 5分
EOF

# task-entry.json: 2タスク
cat > "$TEST_DIR/cortex/state/task-entry-$TEST_DATE.json" << 'EOF'
{
  "date": "2099-12-31",
  "completed": [
    {"content": "テストタスク1", "duration": "5m", "category": "testing"},
    {"content": "テストタスク2", "duration": "10m", "category": "testing"}
  ]
}
EOF

if python3 "$ROOT/scripts/verify-phase2-event.py" "$TEST_DATE" 2>&1 | grep -q "PARTIAL"; then
    echo "✅ Test Case 3: PASS (correctly detected data mismatch)"
else
    echo "❌ Test Case 3: FAIL (should have detected partial success)"
    exit 1
fi

echo ""
echo "---"
echo ""

# ==================== Test Case 4: 正常ケース ====================
echo "Test Case 4: perfect sync (digest=1, json=1)"
echo "Expected: SUCCESS"
echo ""

# task-entry.json: 1タスク（digest と一致）
cat > "$TEST_DIR/cortex/state/task-entry-$TEST_DATE.json" << 'EOF'
{
  "date": "2099-12-31",
  "completed": [
    {"content": "テストタスク1", "duration": "5m", "category": "testing"}
  ]
}
EOF

if python3 "$ROOT/scripts/verify-phase2-event.py" "$TEST_DATE" 2>&1 | grep -q "SUCCESS"; then
    echo "✅ Test Case 4: PASS (correctly detected success)"
else
    echo "❌ Test Case 4: FAIL (should have succeeded)"
    exit 1
fi

echo ""
echo "==========================================="
echo "🎉 All test cases passed!"
echo ""
echo "Failure detection capability: VERIFIED ✅"
echo "  - auto-sync failure: detectable"
echo "  - missing /log format: detectable"
echo "  - data integrity issues: detectable"
echo "  - success cases: correctly identified"
