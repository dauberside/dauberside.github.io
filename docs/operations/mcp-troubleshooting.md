# MCP Troubleshooting Checklist

> **目的**: MCP サーバー（Obsidian, GitHub, n8n）が動かないときの高速デバッグ

最終更新: 2025-11-25

---

## 🚨 症状別チェックリスト

### 1. Obsidian MCP が「Authorization required」エラー

**チェック項目**:

```bash
# ✅ 環境変数が読み込まれているか
echo $MCP_OBSIDIAN_API_KEY
# 期待値: (64文字のランダム文字列が表示されるはず)

# ✅ .env.mcp の値と一致しているか
grep MCP_OBSIDIAN_API_KEY "/Volumes/Extreme Pro/dauberside.github.io-1/.env.mcp"

# ✅ Obsidian Local REST API が起動しているか（PORT 27124）
curl -k -H "Authorization: Bearer $MCP_OBSIDIAN_API_KEY" \
  https://127.0.0.1:27124/ 2>&1 | head -5
# 期待値: 200 OK または JSON レスポンス
```

**原因と対処**:

| 原因 | 対処 |
|------|------|
| 環境変数が空 | `source ~/.zshrc` または新しいターミナルで起動 |
| API キーが間違っている | `.env.mcp` を修正 → `reload-mcp` |
| Obsidian プラグインが停止 | Obsidian 起動 → プラグイン有効化確認 |
| PORT が違う | TODO.md に記載の PORT 27124 を確認 |

---

### 2. GitHub MCP が動かない

**チェック項目**:

```bash
# ✅ 環境変数確認
echo $MCP_GITHUB_TOKEN
# 期待値: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (GitHub Personal Access Token)

# ✅ トークンの有効性確認
curl -H "Authorization: Bearer $MCP_GITHUB_TOKEN" \
  https://api.github.com/user | jq '.login'
# 期待値: "DAUBER" または GitHub ユーザー名
```

**原因と対処**:

| 原因 | 対処 |
|------|------|
| トークンが期限切れ | GitHub で新しい PAT を発行 → `.env.mcp` 更新 |
| スコープ不足 | `repo`, `workflow` スコープを追加 |

---

### 3. n8n MCP が動かない

**チェック項目**:

```bash
# ✅ 環境変数確認
echo $MCP_N8N_API_URL
echo $MCP_N8N_API_KEY

# ✅ n8n が起動しているか
curl -I "$MCP_N8N_API_URL/healthz" 2>&1 | head -3
# 期待値: 200 OK

# ✅ Docker 内から host にアクセスできるか（host.docker.internal）
docker run --rm alpine/curl:latest -k -I \
  http://host.docker.internal:5678/healthz
```

**原因と対処**:

| 原因 | 対処 |
|------|------|
| n8n が起動していない | `docker compose up -d` または n8n を起動 |
| JWT トークンが期限切れ | n8n UI で新しいトークンを発行 → `.env.mcp` 更新 |
| `host.docker.internal` が解決しない | ローカルなら `localhost:5678` に変更 |

---

## 🔧 共通デバッグ手順

### Step 1: 環境変数が読み込まれているか確認

```bash
# すべての MCP 環境変数を表示
env | grep MCP_
```

**空の場合**:
- 新しいターミナルを開く（`.zshrc` 自動読み込み）
- または `source ~/.zshrc` を実行

---

### Step 2: `.env.mcp` と環境変数の値が一致しているか

```bash
# .env.mcp の内容
cat "/Volumes/Extreme Pro/dauberside.github.io-1/.env.mcp" | grep -v '^#'

# 現在の環境変数
env | grep MCP_
```

**不一致の場合**:
```bash
reload-mcp  # エイリアスで再読み込み
```

---

### Step 3: Claude Code を正しく起動しているか

**推奨起動方法（環境依存ゼロ）**:

```bash
# 方法1: プロジェクトのスクリプトを使う（最も確実）
./bin/claude-dev

# 方法2: Makefile を使う
make claude

# 方法3: シェルエイリアスを使う
claude-dev

# 方法4: 明示的に環境変数を読み込む
source ~/.zshrc && claude
```

**GUI アプリ（VSCode, Cursor, Raycast 等）から起動する場合**:
- GUI アプリは `.zshrc` を読み込まない可能性がある
- **解決策**: ターミナルから `./bin/claude-dev` で起動する
- `bin/claude-dev` スクリプトは GUI 環境でも動作する（絶対パスで `.env.mcp` を読み込む）

---

## 📝 環境変数の管理ルール

### Single Source of Truth（信頼できる唯一の情報源）

```
/Volumes/Extreme Pro/dauberside.github.io-1/.env.mcp
```

**他の場所にコピーしない**:
- ❌ 環境ごとに別ファイル（`.env.local`, `.env.prod` など）
- ❌ Docker Compose に直書き
- ✅ すべて `.env.mcp` から参照

---

### 値を変更したとき

1. `.env.mcp` を編集
2. **現在のターミナル**で `reload-mcp` を実行
3. **Claude Code を再起動**（新しいターミナルから `claude-dev`）

---

## 🚀 クイックリファレンス

```bash
# 環境変数を再読み込み
reload-mcp

# Claude Code を正しく起動
claude-dev

# MCP 環境変数を確認
env | grep MCP_

# Obsidian API テスト
curl -k -H "Authorization: Bearer $MCP_OBSIDIAN_API_KEY" \
  https://127.0.0.1:27124/

# GitHub トークンテスト
curl -H "Authorization: Bearer $MCP_GITHUB_TOKEN" \
  https://api.github.com/user

# n8n 接続テスト
curl -I "$MCP_N8N_API_URL/healthz"
```

---

## 🔄 新しいマシン・環境でのセットアップ

1. `.env.mcp` をコピー
2. `.zshrc` に以下を追加:

```bash
if [ -f "/path/to/project/.env.mcp" ]; then
  set -a
  source "/path/to/project/.env.mcp"
  set +a
fi

alias reload-mcp='set -a && source "/path/to/project/.env.mcp" && set +a && echo "✅ MCP env reloaded"'
alias claude-dev='source ~/.zshrc && claude'
```

3. 新しいターミナルで `claude-dev` を実行

---

## 関連ドキュメント

- [.mcp.json](../../.mcp.json) - MCP サーバー設定
- [.env.mcp.example](../../.env.mcp.example) - 環境変数テンプレート
- [TODO.md](../../TODO.md) - PORT 情報・システム構成
- [Cortex OS Task Policy](./cortex-task-policy.md) - タスク管理ポリシー

---

**最終更新**: 2025-11-25
