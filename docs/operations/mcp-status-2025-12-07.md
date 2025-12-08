# 🔌 MCP復旧状況レポート

**確認日時**: 2025-12-07 19:12 JST
**報告者**: Claude Code
**対応ステータス**: 要修正（n8n MCP接続）

---

## 📊 MCPサーバー接続状態

### ✅ **正常に動作中** (4/6)

1. **✅ Obsidian MCP** - 完全動作
   - Status: Connected
   - Vault: `/Volumes/Extreme Pro/dauberside.github.io-1/cortex`
   - Files: 11件のファイル/ディレクトリ確認
   - API Version: 3.2.0
   - Process: `mcp-obsidian` (PID 46139)

2. **✅ GitHub MCP** - 完全動作
   - Status: Connected
   - Token: Valid (`ghp_***Xs`)
   - Test: リポジトリ検索成功（`dauberside/dauberside.github.io`検出）
   - Process: `mcp-server-github` (PID 46185)

3. **✅ Memory MCP** - 接続可能
   - Status: Connected
   - Graph: 空（未使用状態）
   - 読み書き可能

4. **✅ Cortex Filesystem MCP** - 動作中
   - Status: Connected
   - Root: `/Volumes/Extreme Pro/dauberside.github.io-1`
   - Files: プロジェクトルート読み取り可能
   - Process: `services/mcp/filesystem.mjs` (PID 46068)

### ⚠️ **接続不良** (2/6)

5. **⚠️ n8n MCP** - 接続エラー
   - Status: Connection Failed
   - エラー: `Unable to connect to n8n`
   - 設定API URL: `http://host.docker.internal:5678` ← **問題の原因**
   - 実際のn8n: `http://localhost:5678` で動作中（確認済み）
   - **修正が必要**: 環境変数 `MCP_N8N_API_URL` を `localhost` に変更

6. **❌ cortex-query MCP** - 未起動
   - Status: Not Running
   - エラー: `Failed to reconnect to cortex-query`
   - Process: プロセスリストに存在せず
   - **修正が必要**: サーバー起動またはクライアント設定確認

---

## 🔧 起動中のMCPプロセス

```
✅ docker-mcp gateway (PID: 20113, 20111, 46110, 46067)
✅ n8n-mcp (PID: 46244) - クライアント起動中だが接続エラー
✅ mcp-server-github (PID: 46185)
✅ mcp-obsidian (PID: 46139)
✅ cortex-filesystem (PID: 46068)
✅ cortex-terminal (PID: 46069)
```

---

## 🛠️ 修正が必要な項目

### 1. n8n MCP接続修正（優先度: 高）

**問題**: API URLが `host.docker.internal` になっているため、ホスト側のMCPクライアントから接続不可

**根本原因**: `.env.mcp` の設定がDockerコンテナ内からの接続を想定している

**影響範囲**:
- n8nワークフロー管理がMCP経由で不可
- n8n自体は正常稼働（docker経由での操作は可能）

**標準修正手順**:

```bash
# Step 1: .env.mcpを編集
nano .env.mcp

# 修正内容:
# 変更前: MCP_N8N_API_URL=http://host.docker.internal:5678
# 変更後: MCP_N8N_API_URL=http://localhost:5678

# Step 2: 環境変数を再読み込み
./bin/reload-mcp

# Step 3: Claude Codeを再起動
./bin/claude-dev
```

**修正確認**:
```bash
# Claude Codeセッション内で実行
/diagnose

# 期待される出力:
# ⚠️ n8n MCP: ❌ Connection Failed
# ↓
# ✅ n8n MCP: Connected
```

### 2. cortex-query MCP起動（優先度: 中）

**問題**: `cortex-query` サーバーが起動していない

**調査が必要**:
- サーバー実装場所の確認: `services/mcp/` ディレクトリ内か？
- 起動スクリプトの有無確認
- 設定ファイルの確認（`.mcp.json` など）

**推奨アクション**:
```bash
# MCPサーバーディレクトリを確認
ls -la services/mcp/

# .mcp.jsonを確認
cat .mcp.json | jq '.mcpServers."cortex-query"'

# 起動スクリプトの有無確認
find services/mcp -name "*query*"
```

**調査後のアクション**:
- サーバーが存在する場合: 起動スクリプトを実行
- サーバーが存在しない場合: クライアント設定から削除を検討
- 実装途中の場合: TODO追加して優先度を判断

---

## 📈 総合評価

**MCP接続率**: 67% (4/6)

**グレード**: ⚠️ **Good（一部機能制限あり）**

**稼働状況サマリー**:
```
Core Services:    ✅✅✅✅ (4/4)  - Obsidian, GitHub, Memory, Filesystem
Extended Services: ⚠️❌  (0/2)  - n8n (修正可能), cortex-query (要調査)
```

**影響範囲**:
- ✅ **コア機能は正常**: Obsidian, GitHub, Memory, Filesystemはすべて動作
- ⚠️ **n8n統合が制限**: ワークフロー管理・実行がMCP経由で不可（n8n自体は正常稼働）
- ❌ **cortex-query不可**: 機能不明だが復旧推奨

**ビジネスインパクト**:
- 低: 主要な開発作業は影響なし
- n8nはDocker経由で直接操作可能
- cortex-queryは用途不明のため影響評価不可

---

## 🎯 推奨アクション

### 即座に実行（5分以内）

**標準修正フロー**:
```bash
# 1. .env.mcpを編集（MCP_N8N_API_URL を localhost に変更）
nano .env.mcp

# 2. 以下のコマンドを順次実行
./bin/reload-mcp    # MCPサーバー再読み込み
./bin/claude-dev    # Claude Code再起動
```

**修正確認**:
- Claude Codeセッション内で `/diagnose` を実行
- 「n8n MCP: Connected」と表示されることを確認

### 次回セッションで確認（30分以内）

1. **cortex-query調査**
   ```bash
   # サーバー実装の確認
   ls -la services/mcp/
   cat .mcp.json | jq '.mcpServers."cortex-query"'
   ```

2. **必要に応じて起動または設定修正**
   - サーバーが存在 → 起動手順をドキュメント化
   - サーバーが未実装 → TODO追加または設定削除

3. **全MCPサーバーの動作確認**
   ```bash
   /diagnose
   # MCP接続率: 100% (6/6) を目指す
   ```

---

## 📝 運用メモ

### MCPサーバー起動確認コマンド

```bash
# プロセス確認
ps aux | grep -E "(mcp|cortex)" | grep -v grep

# ポート使用状況
lsof -i :5050  # 標準MCPポート（該当なし）
lsof -i :27124 # Obsidian REST API

# Docker MCP Gateway
docker ps --filter "name=mcp"
```

### トラブルシューティング

**問題**: MCP接続が突然切れた

**チェックリスト**:
1. `.env.mcp` が正しく読み込まれているか確認
   ```bash
   env | grep MCP_
   ```

2. MCPサーバープロセスが起動しているか確認
   ```bash
   ps aux | grep mcp | grep -v grep
   ```

3. Claude Codeを再起動
   ```bash
   ./bin/claude-dev
   ```

**問題**: Obsidian MCP接続エラー

**解決策**:
1. Obsidian Local REST APIプラグインが有効か確認
2. APIキーが正しいか確認
3. ポート27124が開いているか確認
   ```bash
   curl -k https://127.0.0.1:27124/
   # Expected: {"status":"OK",...}
   ```

---

## 🔄 変更履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
| 2025-12-07 | 初回作成。n8n MCP接続エラー検出。 | Claude Code |

---

## 📚 関連ドキュメント

- [MCP Troubleshooting Guide](./mcp-troubleshooting.md)
- [CLAUDE.md - MCP & Environment](../../CLAUDE.md#5-obsidian-integration)
- [Services Architecture](../requirements/services.md)

---

**次回確認**: n8n MCP修正後に再診断を実行
**追跡Issue**: なし（軽微な設定ミス）
**エスカレーション**: 不要
