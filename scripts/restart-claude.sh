#!/bin/bash
# Claude Code を再起動するスクリプト

echo "Claude Code を再起動しています..."

# ターミナルで実行中の claude プロセスを確認
CLAUDE_PID=$(pgrep -f "claude" | head -1)

if [ -n "$CLAUDE_PID" ]; then
    echo "Claude Code プロセス (PID: $CLAUDE_PID) を終了しています..."
    kill "$CLAUDE_PID" 2>/dev/null || true
    sleep 2
fi

# Claude Desktop アプリケーションも終了（念のため）
killall "Claude" 2>/dev/null || true

# 少し待つ
sleep 1

# Claude Desktop アプリケーションを起動
echo "Claude Code を起動しています..."
open -a Claude

echo ""
echo "Claude Code の再起動が完了しました。"
echo "数秒待ってから、Claude Code 内で /mcp コマンドを実行して動作確認してください。"

