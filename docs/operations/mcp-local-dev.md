# MCP ローカル開発ガイド

このガイドでは、MCP サーバーを使った開発環境のセットアップと起動手順を説明します。

## 前提条件

### 必須ツール
- **Node.js 22.x** - ランタイム
- **pnpm** - パッケージマネージャー
- **uvx** - Python ツール実行環境（MCP サーバー起動用）
  ```bash
  # uvx のインストール（uv がない場合）
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### MCP サーバー別の前提条件

#### Obsidian MCP
- **Obsidian** アプリがインストールされていること
- **Local REST API Plugin** が有効化されていること
- ポート: `8443`（デフォルト、変更可能）

#### GitHub MCP
- **GitHub Personal Access Token (Classic)** が必要
- Scopes: `repo`, `read:user`

#### Vercel MCP
- **Vercel API Token** が必要

#### n8n MCP（オプション）
- **n8n** インスタンスが稼働していること
- API アクセストークンが設定されていること

---

## 環境変数設定

`.env.local` に以下を設定してください：

```bash
# Obsidian MCP
OBSIDIAN_API_URL=http://127.0.0.1:8443
OBSIDIAN_API_KEY=your_obsidian_api_key_here

# GitHub MCP (via .mcp.local.json)
# GITHUB_PERSONAL_ACCESS_TOKEN は .mcp.local.json に設定

# Vercel MCP (via .mcp.local.json)
# VERCEL_API_TOKEN は .mcp.local.json に設定

# n8n MCP（オプション）
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key_here
```

---

## MCP サーバー起動手順

### 1. Obsidian MCP サーバー起動

**前提**: Obsidian が起動済みで Local REST API Plugin が有効

```bash
# ターミナル 1
uvx mcp-obsidian
```

**確認**:
```bash
# 別ターミナルでテスト
curl -H "Authorization: Bearer YOUR_API_KEY" http://127.0.0.1:8443/vault/
```

### 2. GitHub MCP サーバー起動

GitHub MCP は通常、Claude Desktop や Cursor などの MCP クライアント経由で自動起動されます。

**手動起動が必要な場合**:
```bash
# ターミナル 2
npx -y @modelcontextprotocol/server-github
```

### 3. Vercel MCP サーバー起動

Vercel MCP も MCP クライアント経由で自動起動されます。

**手動起動が必要な場合**:
```bash
# ターミナル 3
npx -y @modelcontextprotocol/server-vercel
```

### 4. n8n MCP サーバー起動（オプション）

```bash
# Docker Compose で起動（推奨）
docker compose up -d n8n

# または PM2 で起動
npx pm2 start services/ecosystem.config.cjs --only n8n
```

---

## 開発サーバー起動

すべての MCP サーバーが起動したら、Next.js 開発サーバーを起動します：

```bash
# MCP ガイドを表示してから dev サーバー起動
pnpm dev:mcp
```

または、KB 再構築も含めて起動：
```bash
pnpm dev:kb
```

---

## ポート一覧

| サービス | ポート | 用途 |
|---------|-------|------|
| Next.js Dev | 3000 | 開発サーバー（デフォルト） |
| Next.js Dev (Agent) | 3030 | Agent 専用サーバー |
| Obsidian REST API | 8443 | Obsidian Vault アクセス |
| KB API Service | 4040 | KB スタンドアロン（オプション） |
| MCP Server | 5050 | MCP サーバー（オプション） |
| n8n | 5678 | ワークフロー自動化 |

**ポート競合時の対応**:
```bash
# 別のポートで起動
pnpm dev -p 3001
```

---

## 統合フロー（典型的な開発セッション）

### パターン 1: MCP + KB 開発

```bash
# 1. Obsidian を起動（Local REST API Plugin 有効化）

# 2. MCP サーバー起動（ターミナル 1）
uvx mcp-obsidian

# 3. KB 再構築 + Dev サーバー起動（ターミナル 2）
pnpm dev:kb
```

### パターン 2: Agent + Workflow 開発

```bash
# 1. n8n 起動（ターミナル 1）
docker compose up -d n8n

# 2. Agent dev サーバー起動（ターミナル 2）
pnpm agent:dev

# 3. KB API サービス起動（ターミナル 3、オプション）
pnpm kb:smoke:api
```

---

## トラブルシューティング

### MCP サーバーが起動しない

**Obsidian MCP**:
```bash
# Obsidian が起動しているか確認
ps aux | grep Obsidian

# Local REST API Plugin が有効か確認
curl http://127.0.0.1:8443/vault/
```

**uvx が見つからない**:
```bash
# uv のインストール
curl -LsSf https://astral.sh/uv/install.sh | sh

# PATH に追加（.zshrc または .bashrc）
export PATH="$HOME/.cargo/bin:$PATH"
```

### ポート競合

```bash
# ポート使用状況確認
lsof -i :3000
lsof -i :8443

# プロセス終了
kill -9 <PID>
```

### KB インデックスが更新されない

```bash
# 手動で再構築
pnpm kb:build

# または API 経由で再取り込み
curl -X POST http://localhost:3000/api/obsidian/ingest \
  -H "x-internal-token: YOUR_INTERNAL_API_TOKEN"
```

---

## Tailscale / Cloud Code 統合

### Tailscale 経由でリモートアクセス

```bash
# Tailscale を起動
sudo tailscale up

# 開発サーバーを 0.0.0.0 にバインド（既にデフォルト）
pnpm dev
# → http://your-tailscale-hostname:3000 でアクセス可能
```

### Cloud Code (GCP / K8s) 統合

```bash
# Cloud Code から localhost:3000 にポートフォワード
kubectl port-forward svc/your-service 3000:3000

# または Tailscale VPN 経由でアクセス
```

---

## 関連ドキュメント

- [MCP セットアップガイド](./mcp-setup-guide.md) - MCP サーバーの初期設定
- [KB セットアップガイド](./kb-setup.md) - Knowledge Base の構築手順
- [ADR-0003: MCP統合アーキテクチャ](../decisions/ADR-0003-mcp-integration-architecture.md)
- [ADR-0004: Obsidian二層統合](../decisions/ADR-0004-obsidian-dual-layer-integration.md)

---

## Phase 2 での自動化予定

現在は手動で MCP サーバーを起動する必要がありますが、Phase 2 では以下の自動化を予定：

- `scripts/dev/start-with-mcp.mjs` - MCP サーバーと Next.js を自動起動
- プロセス管理（終了時の cleanup）
- MCP サーバーの生死監視
- 自動再起動機能

---

**最終更新**: 2025-11-17
