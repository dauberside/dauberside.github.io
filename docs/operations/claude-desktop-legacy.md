# Claude Desktop（レガシー）環境セットアップ

> **注記**: このドキュメントは Claude Desktop を使った従来の開発手順を記録しています。
>
> **現行の推奨手順**（シンプル・HTTP/MCP連携）は [claude-code.md](./claude-code.md) を参照してください。
>
> このファイルは以下のケースで参照してください：
> - Claude Desktop の GUI 機能を使いたい場合
> - Docker 経由の MCP サーバー設定が必要な場合
> - 過去の設定を復元・参照したい場合

---

このドキュメントは、Claude Desktop の「Claude Code」環境を本リポジトリ（Next.js + pnpm）で使うための最小セットアップ手順です。オプションで Obsidian MCP（Docker）や既存の Next.js API を組み合わせる方法も併記します。

## 前提
- macOS（Docker Desktop は Obsidian MCP を使う場合のみ必要）
- Node.js 20 以上推奨（本リポは Node 22 を想定）
- pnpm（Corepack 有効化で可）
- **Claude Desktop（最新版）** ← このドキュメントの主要前提

## 1) プロジェクト準備
- 本リポをローカルにクローン
- ルート直下の `.env.local` に必要な環境変数を設定（秘匿を厳守。公開リポにコミットしないこと）
  - Obsidian 連携を使う場合: `OBSIDIAN_API_KEY`, `OBSIDIAN_API_URL`（既定 http://127.0.0.1:27123）
  - KB 埋め込みを外部 API に送らない場合: `KB_EMBED_MODE=hash`（既定でローカルハッシュ）

> セキュリティ注意: `.env.local` に含まれるキーは第三者に渡さないでください。既に公開された形跡がある場合は即時ローテーションしてください。

## 2) Claude Code 環境の作成

Claude Desktop の GUI を使った環境構築手順：

1. **Claude Desktop を開く** → **Claude Code** → **New Environment**（新規環境）
2. **名前**: `dauberside`（任意）
3. **ワークスペースフォルダ**: 本リポのパス
   - 例: `/Volumes/Extreme Pro/dauberside.github.io-1`
4. **権限**: File System / Network に許可を与える
5. **起動時コマンド**（任意・推奨）
   ```bash
   corepack enable pnpm
   pnpm i
   ```
6. **よく使うタスクを登録**（任意）
   - **Typecheck**: `pnpm -s tsc --noEmit`
   - **Dev**: `pnpm dev`
   - **Build**: `pnpm -s build`

### Claude Code のターミナル機能

Claude Desktop の「Claude Code」環境では、以下の機能が利用できます：

- **統合ターミナル**: Claude とのチャット内で直接コマンド実行
- **ファイル操作**: GUI からのファイル編集・作成
- **タスク実行**: 登録したタスク（上記の Typecheck, Dev, Build 等）をワンクリック実行
- **コンテキスト共有**: 開いているファイルやターミナル出力を Claude が参照可能

## 3) 最小スモークテスト（Claude Code のターミナルから）

Claude Code 環境のターミナルで以下を実行：

1. **Typecheck**
   ```bash
   pnpm -s tsc --noEmit
   ```
   → 0 エラーで終了すること

2. **Dev 起動**
   ```bash
   pnpm dev
   ```
   → http://127.0.0.1:3000 にアクセスできること

3. **Obsidian 連携の疎通**（必要時）
   ```bash
   curl -sS http://127.0.0.1:3000/api/obsidian/ping | jq
   curl -sS 'http://127.0.0.1:3000/api/obsidian/search?q=test' | jq
   ```

## 4) Obsidian MCP（Docker）を Claude に接続する（任意）

> **前提**: 既存の「mcp/obsidian」イメージが実在すること。README の要求環境変数名に合わせて調整してください。

### MCP サーバー設定

Claude Desktop の **MCP 設定エディタ**（アプリ内）に以下を追加：

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "OBSIDIAN_HOST",
        "-e", "OBSIDIAN_PORT",
        "-e", "OBSIDIAN_API_KEY",
        "mcp/obsidian"
      ],
      "env": {
        "OBSIDIAN_HOST": "host.docker.internal",
        "OBSIDIAN_PORT": "27123",
        "OBSIDIAN_API_KEY": "<YOUR_OBSIDIAN_API_KEY>"
      }
    }
  }
}
```

### 設定のポイント

- **macOS の Docker Desktop**: `host.docker.internal` でコンテナからホストの Obsidian に到達できます
- **環境変数名の違い**: イメージによっては `OBSIDIAN_BASE_URL` / `OBSIDIAN_TOKEN` など異なる変数名を要求します。必ずイメージの README に従ってください
- **Linux**: `host.docker.internal` が効かない場合、`--add-host=host.docker.internal:host-gateway` を args に追加

### 事前疎通確認（任意）

Docker コンテナから Obsidian API にアクセスできるか確認：

```bash
docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl \
  -sS -H "Authorization: Bearer <YOUR_OBSIDIAN_API_KEY>" \
  "http://host.docker.internal:27123/vault/" | head -c 200
```

### MCP サーバーの動作確認

Claude Desktop で Obsidian MCP が正常に接続されると：
- チャット内で Obsidian vault の検索・取得が可能
- `/mcp` コマンドで利用可能な MCP サーバー一覧が表示される
- `obsidian` サーバーが `connected` 状態になる

## 5) 代替: 既存の Next.js API をそのまま使う

Docker 不要で、すでに本リポに実装済みのエンドポイントが使えます。

### 利用可能なエンドポイント

- `GET /api/obsidian/ping` — Obsidian API の接続確認
- `GET /api/obsidian/list` — ルート一覧
- `GET /api/obsidian/get?path=...` — ノート取得
- `GET /api/obsidian/search?q=...` — 検索
- `POST /api/obsidian/ingest` — ノート取り込み（差分→チャンク→埋め込み→KB 追記）
  - 任意ヘッダ `x-obsidian-token` を `OBSIDIAN_INGEST_TOKEN` と一致させると簡易トークンガード

### 利点

- Docker Desktop 不要
- Next.js のホットリロード・デバッグがそのまま使える
- MCP サーバーの設定・メンテナンスが不要

## 6) トラブルシュート

### 認証エラー（401/403）
- API キー不一致を確認
- ヘッダ名やトークン形式（`Bearer` / `X-API-Key`）を確認
- Claude Desktop の MCP 設定で環境変数が正しく渡されているか確認

### 接続不可
- Obsidian Local REST API プラグインが起動しているか確認
- ポート番号の確認（既定は `27123`）
- URL の確認（既定は `http://127.0.0.1:27123`）
- Docker Desktop が起動しているか確認（MCP Docker使用時）

### Linux で `host.docker.internal` が効かない
- `--add-host=host.docker.internal:host-gateway` を `args` に追加
- または、ホストの実IPアドレスを直接指定

### 自己署名証明書（https）
- 実装側に自己署名許可フラグがあるか確認（例: `ALLOW_SELF_SIGNED=1`）
- Node.js の `NODE_TLS_REJECT_UNAUTHORIZED=0` は非推奨（セキュリティリスク）

### 型チェックエラー
- Node 22 / pnpm / Next.js 14 を想定
- `pnpm -s tsc --noEmit` で型チェック
- `pnpm install` で依存関係を再インストール

## 7) 次の一歩（任意）

### MCP サーバーの拡張
- `services/mcp`（HTTP スケルトン）を拡張して Next.js API や Obsidian をプロキシ
- 複数の MCP サーバーを組み合わせ（GitHub, Slack, Google Calendar 等）

### セキュリティ強化
- Rate limiting の実装
- 監査ログの追加
- Zero Trust（Tailscale / Cloudflare Tunnel）による保護

### KB（Knowledge Base）の高度化
- 埋め込みの OpenAI 切替（`KB_EMBED_MODE=openai` とモデル設定）
- カスタムチャンキング戦略
- ベクトル DB への移行（Pinecone, Weaviate 等）

---

## 再起動・障害対応（レガシー）

Claude Desktop を使った環境での再起動・トラブルシューティング手順は [claude-restart-legacy.md](./claude-restart-legacy.md) を参照してください。

## 現行手順への移行

このレガシー手順から現行の軽量手順に移行する場合：

1. **Claude Desktop 不要の確認**: 現在の開発で Claude Desktop の GUI 機能が必須か確認
2. **MCP の HTTP 化**: Docker MCP を HTTP エンドポイント（`/api/obsidian/*` 等）に置き換え
3. **現行ドキュメント参照**: [claude-code.md](./claude-code.md) に従って再構築

---

**最終更新**: 2025-11-14（レガシー化）

このファイルは運用の「歴史的記録」を目的としています。Claude 側の UI/仕様が変わる場合があるため、必要に応じて更新してください。
