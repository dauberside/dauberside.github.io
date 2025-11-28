---
render_with_liquid: false
---

# n8n × MCP 連携（docker compose）

このリポの docker compose に `n8n` を追加しました。エディタは http://localhost:5678 で開けます。

- 重要: `http://mcp:5050` は「Docker ネットワーク内専用のホスト名」です。ブラウザなどホストOSからは解決できません。
  - ブラウザ/ホストから MCP を見るとき: http://localhost:5050/
  - n8n（コンテナ）から MCP を呼ぶとき: http://mcp:5050/（`$env.MCP_API_URL` がこれに設定済み）

- 認証（推奨）: `.env` に `N8N_BASIC_AUTH_ACTIVE=1` とユーザー/パスワードを設定してください。
- 重要: docker compose は `.env` を自動読込します（`.env.local` は対象外）。`MCP_API_TOKEN`/`KB_API_TOKEN` は `.env` にも設定してください。

## 起動

```bash
# すでに compose が起動していれば n8n だけ再作成
docker compose up -d --force-recreate n8n

# ステータス
docker compose ps
```

ヘルスチェック:

```bash
curl -s -o /dev/null -w "%{http_code}
" http://localhost:5678/healthz  # 200 を期待
```

## n8n から MCP を呼ぶ（HTTP Request ノード）

1) http://localhost:5678 を開き、新規ワークフローを作成
2) ノード追加 → "HTTP Request"
3) 設定例（GET）
   - Method: GET
   - URL: `{{ $env.MCP_API_URL }}/kb/search`
   - Query Parameters: `q=hello`
   - Headers:
     - `Authorization: Bearer {{ $env.MCP_API_TOKEN }}`
     - `Accept: application/json`
   - Execute を押してレスポンス（`{ hits: [...] }`）を確認

4) 設定例（POST）
   - Method: POST
   - URL: `{{ $env.MCP_API_URL }}/kb/search`
   - Headers:
     - `Authorization: Bearer {{ $env.MCP_API_TOKEN }}`
     - `Content-Type: application/json`
   - Body (JSON):
{% raw %}
```json
{
  "query": "n8n からの検索",
  "topK": 5
}
```
{% endraw %}

## サンプルワークフローのインポート

- このリポに n8n 用のサンプルを同梱しています。
- GET/POST（通常版）: `docs/operations/workflows/mcp-kb-search.json`
- POST Raw JSON 専用: `docs/operations/workflows/mcp-kb-search-post-raw.json`
- Webhook 入口（GET）: `docs/operations/workflows/mcp-kb-search-webhook.json`
- Webhook 入口（POST, JSON {q, topK}）: `docs/operations/workflows/mcp-kb-search-webhook-post-v1.0.json`
 - KB 回答（Webhook POST, 整形レスポンス付）: `docs/operations/workflows/mcp-kb-answer-webhook-post-v1.0.json`
- Google Calendar 予定追加（Webhook POST）: `docs/operations/workflows/gcal-create-event-webhook-post-v1.0.json`

### Google Calendar を OpenAPI で使う（オプション）

OpenAPI 仕様からリクエスト定義を読み込んで、フォーム感覚でパラメータ入力ができます。

- 仕様ファイル: `docs/operations/openapi/google-calendar-min.v1.yaml`
- 手順:
  1) HTTP Request ノードを追加 → UI の OpenAPI 読み込み機能（バージョンによって "From OpenAPI/Swagger"）で上記 YAML を選択
  2) Operation: `createEvent` を選択し、`calendarId`・`requestBody` を入力
  3) Authorization ヘッダーに `Bearer {{$node['Get Access Token'].json.access_token}}` を設定
  4) 併せて前段にトークン取得ノード（`POST https://oauth2.googleapis.com/token`）を置くと自動連携できます

注:
- Google の公式は OpenAPI を配布していないため、このリポの YAML は最小限の createEvent のみを定義しています。必要に応じてパスを拡張可能です。
- n8n のバージョンにより OpenAPI 取込 UI の表示が異なる場合があります。見当たらない場合は通常の HTTP Request で同じエンドポイントを使ってください（本ドキュメントの Webhook 版を参照）。

インポート手順:
1) n8n 右上のメニュー → Import from File
2) 目的に応じて上記いずれかの JSON を選択
3) 画面上部の「Execute Workflow」で Manual Trigger を実行
  - GET/POST それぞれの HTTP Request ノードに `{ hits: [...] }` が表示されれば成功です。

備考:
- Raw JSON 版は、n8n の UI バージョン差で "No fields" やパラメータ解釈の揺らぎが出る場合に有効です。

### Webhook 版の使い方（ローカル）

1) `mcp-kb-search-webhook.json` をインポートし、右上の「Activate」ではなくまずは手動で実行（または必要に応じて有効化）
2) エディタ上部の Webhook URLs に表示されるテストURL（例: http://localhost:5678/webhook-test/mcp-kb-search?q=hello ）を開く
3) 200 が返り、ボディに `{ hits: [...] }` が表示されれば成功

POST 版（JSON ボディ）:
1) `mcp-kb-search-webhook-post-v1.0.json` をインポート（必要に応じて Activate）
2) テストURL: http://localhost:5678/webhook-test/mcp-kb-search-post
  - Body (application/json): `{ "q": "hello", "topK": 5 }`
3) 成功すると `{ hits: [...] }` が返ります

回答整形版（POST）:
1) `mcp-kb-answer-webhook-post-v1.0.json` をインポート
2) テストURL: http://localhost:5678/webhook-test/mcp-kb-answer
  - Body: `{ "q": "hello", "topK": 5 }`
3) 返り値: `{ ok, q, topK, count, hits, message }`（message に上位ヒットの要約テキスト）

Google Calendar 予定追加（POST）:
1) `gcal-create-event-webhook-post-v1.0.json` をインポート
2) テストURL: http://localhost:5678/webhook-test/gcal-create-event
  - Body (application/json):
{% raw %}
```json
{
  "summary": "打ち合わせ",
  "description": "議題: リリース準備",
  "start": "2025-10-27T10:00:00+09:00",
  "end":   "2025-10-27T11:00:00+09:00",
  "timezone": "Asia/Tokyo",
  "attendees": ["user1@example.com", "user2@example.com"]
}
```
{% endraw %}
  - end を省略する場合は `durationMinutes` を指定可能（既定 60）。
3) 成功すると `{ ok, id, htmlLink, summary, start, end }` が返ります。

前提となる環境変数（.env → n8n に注入）:
- `GC_CLIENT_ID`, `GC_CLIENT_SECRET`, `GC_REFRESH_TOKEN`（OAuth2 リフレッシュトークン）
- `GC_REDIRECT_URI`（取得時に使ったものを念のため）
- `CALENDAR_ID`（省略時は primary）

パラメータ:
- q: 検索クエリ（クエリ文字列 or JSONボディの query/q どちらでも対応）
- topK: 返却件数（既定 5）

バージョンについて:
- ワークフロー名末尾の v1.x がリビジョンです。n8n はインポート時に上書きせず別ワークフローになるため、最新版を使うには旧版を無効化/削除し、新しい v1.x を有効化してください。
- MCP の /info は受け付けるキーを表示します（最新化確認用）。例:
  - curl -s http://localhost:5050/info | jq
  - features.kbSearch.postBodyKeys に ["query","q","topK"] が出ていれば最新版です。

## 使える環境変数（compose で注入済み）

- `MCP_API_URL` → `http://mcp:5050`（Docker ネットワーク内の MCP）
- `MCP_API_TOKEN` → `.env` の値が注入されます
- `N8N_ENCRYPTION_KEY` → n8n の資格情報暗号化キー（任意だが推奨）

n8n ではノードの式で `{{ $env.VAR_NAME }}` で参照可能です。

## セキュリティ注意

- `.env` に強いランダム値を設定してください（`MCP_API_TOKEN`/`KB_API_TOKEN`/`N8N_ENCRYPTION_KEY`）。
- 公開ネットワークに直接晒さず、ローカルだけで使うか VPN（Tailscale 等）を推奨。
- 必要に応じて Basic 認証: `N8N_BASIC_AUTH_ACTIVE=1` と `N8N_BASIC_AUTH_USER/PASSWORD` を設定。

## トラブルシュート

- n8n が未認証で開ける → `.env` に Basic を有効化して `docker compose up -d --force-recreate n8n`
- 401 が返る → MCP 側のトークン未設定の可能性。`.env` に `MCP_API_TOKEN` を設定し再起動。
- KB が 404/500 → `kb/index/embeddings.json` が存在するか確認。`pnpm -s kb:build` で再生成可能。

### 「Invalid URL」/ `$env.MCP_API_URL` が undefined になる

症状:
- HTTP Request ノードの URL を `{{$env.MCP_API_URL}}/kb/search` にしたとき、プレビューの Result が `undefined`、実行で「Invalid URL」が出る。

主な原因:
- n8n の式から環境変数へのアクセスがブロックされている、または n8n プロセスに対象の環境変数が渡っていない。

確認と対処:
- docker compose を利用している場合、本リポの `docker-compose.yml` では `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` と `MCP_API_URL=http://mcp:5050` を n8n に注入済みです。反映されていない場合は以下で再作成してください（環境再読込）。
  - 再作成: `docker compose up -d --force-recreate n8n`
- n8n 内で確認するには、一時的に Code ノードを追加して `return [{ url: $env.MCP_API_URL }];` を実行し、`url` に値が入っているか確認します。
- すぐに動作確認したい場合は、URL を一旦固定値にして実行（n8n からはコンテナ内経路が推奨）:
  - `http://mcp:5050/kb/search`（compose 内の内部 DNS）
  - 本番まで確認できたら、再度 `{{$env.MCP_API_URL}}/kb/search` に戻して運用してください。

補足:
- ホスト側の `.env.local` の `MCP_API_URL="http://localhost:5050"` は Next.js などホストアプリ用です。n8n コンテナ内からは `http://mcp:5050` を使うのが確実です。
