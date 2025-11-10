# Claude Code の再起動方法

Claude Code を再起動する方法を説明します。

## ターミナルで実行中の Claude Code を再起動

### 方法 1: スクリプトを使用（推奨）

```bash
./scripts/restart-claude.sh
```

このスクリプトは以下を実行します：
1. 実行中の `claude` プロセスを検出して終了
2. Claude Desktop アプリケーションを終了
3. Claude Desktop アプリケーションを再起動

### 方法 2: 手動で再起動

#### ステップ 1: 実行中のプロセスを確認

```bash
ps aux | grep -i claude | grep -v grep
```

または

```bash
pgrep -f claude
```

#### ステップ 2: プロセスを終了

```bash
# プロセス ID を確認してから終了
kill <PID>

# または、すべての claude プロセスを終了
pkill -f claude
```

#### ステップ 3: Claude Desktop を再起動

```bash
# Claude Desktop アプリケーションを終了
killall "Claude" 2>/dev/null || true

# 少し待つ
sleep 1

# Claude Desktop アプリケーションを起動
open -a Claude
```

### 方法 3: ターミナルセッション内で再起動

ターミナルで `claude` コマンドを実行している場合：

1. **Ctrl+C** で現在のプロセスを中断
2. 再度 `claude` コマンドを実行

```bash
# 現在のプロセスを中断（Ctrl+C）
# その後、再起動
claude
```

## Claude Code 環境内での再起動

Claude Code のターミナル内で実行している場合：

1. ターミナルを閉じる（または Ctrl+C で中断）
2. Claude Code 環境を再起動
3. 新しいターミナルセッションを開始

## 再起動後の確認

再起動後、以下を確認してください：

1. **MCP サーバーの確認**
   ```
   /mcp
   ```
   GitHub と Vercel の MCP サーバーが表示されることを確認

2. **設定ファイルの確認**
   ```bash
   cat .mcp.local.json | grep -E "(GITHUB|VERCEL)"
   ```

3. **動作確認**
   ```
   @github このリポジトリの open issues を表示して
   @vercel 最新のデプロイメント状況を確認して
   ```

## トラブルシュート

### プロセスが終了しない場合

```bash
# 強制終了
kill -9 <PID>

# または
pkill -9 -f claude
```

### アプリケーションが起動しない場合

```bash
# アプリケーションの状態を確認
ps aux | grep -i claude

# 手動で起動
open -a Claude
```

### 設定が反映されない場合

1. `.mcp.local.json` の JSON 構文を確認
2. API トークンが正しく設定されているか確認
3. Claude Code を完全に再起動（アプリケーションを終了してから再起動）

## 参考

- [Claude Code セットアップガイド](./claude-code.md)
- [MCP セットアップガイド](./mcp-setup-guide.md)

