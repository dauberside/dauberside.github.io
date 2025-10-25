# KB API

独立プロセスとして動作する最小の KB 検索 API。Next 本体から切り離してスケール/再起動の自由度を確保します。

## エンドポイント
- `GET /healthz` — ヘルスチェック
- `GET /search?q=...&topK=5` — クエリ埋め込み → コサイン類似度で上位 `topK` 件を返す（レスポンス: `{ hits: [...] }`）
- `POST /search` — `{"query": string, "topK"?: number}` を受け取り、`GET /search` と同等のレスポンスを返す
- `GET /reload` — KB インデックスの再読込
- `GET /metrics` — 簡易メトリクス（起動時刻、uptime、総リクエスト数、エラー数、ルート別の件数/平均時間）

## 環境変数
- `PORT` または `KB_API_PORT`（既定: 4040）
- `KB_INDEX_PATH`（既定: `<repo>/kb/index/embeddings.json`）
- `OPENAI_API_KEY`（クエリ埋め込みに使用）
- `ALLOWED_ORIGINS`（任意: CORS 許可。指定され、`Origin` が未許可の場合は 403）
- 認証（任意）
	- `KB_API_TOKEN` — `Authorization: Bearer <token>` または `X-API-Key: <token>` を要求
	- `KB_API_BASIC=1` と `ADMIN_BASIC_USERS="user:pass;user2:pass2"` — BASIC 認証を要求（`WWW-Authenticate` レスポンス）
- 埋め込み API 呼び出し動作（任意）
	- `KB_API_EMBED_TIMEOUT_MS`（既定 10000ms）
	- `KB_API_EMBED_RETRIES`（既定 1 回再試行）
	- `KB_API_MOCK=1`（OpenAI を呼ばずにダミーの埋め込みを返す。CI/ローカルのスモーク用途）
		- 注意: 本番（NODE_ENV=production）では `KB_API_MOCK=1` を禁止。起動時にエラー終了します。

## 起動（PM2）
- apps は `services/ecosystem.config.cjs` に定義済み
- 起動: `npx pm2 start services/ecosystem.config.cjs --only kb-api`
- 永続化: `npx pm2 save`

## セキュリティ
- tailnet 内からの利用を前提。`ALLOWED_ORIGINS` を設定すると CORS を厳格化
- 認証を有効化するには `KB_API_TOKEN` または `KB_API_BASIC=1`（+ `ADMIN_BASIC_USERS`）を設定
- `OPTIONS` は常に 204 を返し、ブラウザの preflight を許可

## 観測性（Observability）
- 構造化ログ（標準出力）: リクエストごとに測定し、ルート別の件数/エラー/処理時間を集計
- `/metrics` で JSON を返すため、pm2 logs と合わせて一次観測が可能（Prometheus 導入は将来検討）
