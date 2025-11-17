# Claude Code（Claude Desktop）デフォルト環境セットアップ

このドキュメントは、Claude Desktop の「Claude Code」環境を本リポジトリ（Next.js + pnpm）で使うための最小セットアップ手順です。オプションで Obsidian MCP（Docker）や既存の Next.js API を組み合わせる方法も併記します。

## 前提
- macOS（Docker Desktop は Obsidian MCP を使う場合のみ必要）
- Node.js 20 以上推奨（本リポは Node 22 を想定）
- pnpm（Corepack 有効化で可）
- Claude Desktop（最新版）

## 1) プロジェクト準備
- 本リポをローカルにクローン
- ルート直下の `.env.local` に必要な環境変数を設定（秘匿を厳守。公開リポにコミットしないこと）
  - Obsidian 連携を使う場合: `OBSIDIAN_API_KEY`, `OBSIDIAN_API_URL`（既定 http://127.0.0.1:8443）
  - KB 埋め込みを外部 API に送らない場合: `KB_EMBED_MODE=hash`（既定でローカルハッシュ）

> セキュリティ注意: `.env.local` に含まれるキーは第三者に渡さないでください。既に公開された形跡がある場合は即時ローテーションしてください。

## 2) Claude Code 環境の作成
1. Claude Desktop を開く → Claude Code → New Environment（新規環境）
2. 名前: `dauberside`（任意）
3. ワークスペースフォルダ: 本リポのパス（例）`/Volumes/Extreme Pro/dauberside.github.io-1`
4. 権限: File System / Network に許可を与える
5. 起動時コマンド（任意・推奨）
   - `corepack enable pnpm`
   - `pnpm i`
6. よく使うタスクを登録（任意）
   - Typecheck: `pnpm -s tsc --noEmit`
   - Dev: `pnpm dev`
   - Build: `pnpm -s build`

## 3) 最小スモークテスト（Claude Code のターミナルから）
1. Typecheck
   - `pnpm -s tsc --noEmit` が 0 エラーで終了すること
2. Dev 起動
   - `pnpm dev` を起動 → http://127.0.0.1:3000 にアクセス
3. Obsidian 連携の疎通（必要時）
   - `curl -sS http://127.0.0.1:3000/api/obsidian/ping | jq`
   - `curl -sS 'http://127.0.0.1:3000/api/obsidian/search?q=test' | jq`

## 4) Obsidian MCP（Docker）を Claude に接続する（任意）
> 既存の「mcp/obsidian」イメージが実在する前提。README の要求環境変数名に合わせて調整してください。

Claude の MCP 設定（アプリ内の MCP 設定エディタ推奨）に下記を追加:

```
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
        "OBSIDIAN_PORT": "8443",
        "OBSIDIAN_API_KEY": "<YOUR_OBSIDIAN_API_KEY>"
      }
    }
  }
}
```

- macOS の Docker Desktop では `host.docker.internal` でコンテナからホストの Obsidian に到達できます。
- イメージによっては `OBSIDIAN_BASE_URL` / `OBSIDIAN_TOKEN` など異なる変数名を要求します。必ずイメージの README に従ってください。
- 事前に疎通確認（任意）
  ```zsh
  docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl \
    -sS -H "Authorization: Bearer <YOUR_OBSIDIAN_API_KEY>" \
    "http://host.docker.internal:8443/vault/" | head -c 200
  ```

## 5) 代替: 既存の Next.js API をそのまま使う
Docker 不要で、すでに本リポに実装済みのエンドポイントが使えます。
- `GET /api/obsidian/ping` — Obsidian API の接続確認
- `GET /api/obsidian/list` — ルート一覧
- `GET /api/obsidian/get?path=...` — ノート取得
- `GET /api/obsidian/search?q=...` — 検索
- `POST /api/obsidian/ingest` — ノート取り込み（差分→チャンク→埋め込み→KB 追記）
  - 任意ヘッダ `x-obsidian-token` を `OBSIDIAN_INGEST_TOKEN` と一致させると簡易トークンガード

## 6) トラブルシュート
- 401/403: API キー不一致。ヘッダ名やトークン形式（Bearer / X-API-Key）を確認
- 接続不可: プラグイン未起動 / ポート違い / URL 違い（既定は http://127.0.0.1:8443）
- Linux で `host.docker.internal` が効かない: `--add-host=host.docker.internal:host-gateway` を付与
- 自己署名 https: 実装側に自己署名許可フラグ（例: `ALLOW_SELF_SIGNED=1`）があるか確認
- 依存: Node 22 / pnpm / Next.js 14 を想定（`pnpm -s tsc --noEmit` で型OKを確認）

## 7) 次の一歩（任意）
- `services/mcp`（HTTP スケルトン）を拡張して Next.js API や Obsidian をプロキシ
- rate limiting / 監査ログ / Zero Trust（Tailscale / Cloudflare Tunnel）
- 埋め込みの OpenAI 切替（`KB_EMBED_MODE=openai` とモデル設定）

---
このファイルは運用の「最小の足場」を目的としています。Claude 側の UI/仕様が変わる場合があるため、必要に応じて更新してください。