# MCP Server（スケルトン）

将来の MCP サーバを置く場所です。Claude Desktop 等の MCP クライアントと接続する想定です。

## 現状
- 最小の HTTP スケルトンを提供（`server.mjs`）
	- `GET /healthz` / `GET /info`
	- `GET /metrics`（起動時刻、uptime、総リクエスト数、エラー数、ルート別の件数/平均時間）
	- PORT は `MCP_PORT` または `PORT`（既定: 5050）

### KB ツール（最小）
- `GET /kb/search?q=...&topK=5` — kb-api へプロキシして `{hits}` を返します
- `POST /kb/search` — `{"query": string, "topK"?: number}` を受け付け、同様に `{hits}` を返します
- 連携先の kb-api は `KB_API_URL`（未設定時は `http://127.0.0.1:${KB_API_PORT||4040}`）
- kb-api 側でトークン保護が有効な場合は `KB_API_TOKEN` を設定してください（`X-API-Key` ヘッダで送信）

### CORS / 認証トグル
- CORS 許可: `ALLOWED_ORIGINS` をカンマ区切りで設定すると、Origin が未許可のとき 403（`OPTIONS` は 204）
- 認証（任意）:
	- `MCP_API_TOKEN` — `Authorization: Bearer <token>` または `X-API-Key: <token>` を要求
	- `MCP_API_BASIC=1` と `ADMIN_BASIC_USERS="user:pass;user2:pass2"` — BASIC 認証を要求
- 既定では認証無効（tailnet 内前提）。必要に応じて有効化してください。

## 目的
- KB検索やファイル参照などを MCP の tool/resource として公開
- tailnet 内でのみ接続を許可（Zero Trust）

## セキュリティ/拡張
- 将来的に stdio / WebSocket ベースの実装に切替
- 認可/監査は将来拡張（トークン、IP制限、ログ）

## 観測性（Observability）
- 標準出力へ簡易構造化ログ（ルート別集計）
- `/metrics` で JSON を返すため、pm2 logs と合わせて一次観測が可能

## PM2 連携
- apps は `services/ecosystem.config.cjs` に定義済み（`mcp-server`）
- 起動: `npx pm2 start services/ecosystem.config.cjs --only mcp-server`
- 永続化: `npx pm2 save`
