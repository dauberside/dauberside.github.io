# n8n 要件定義書

最終更新: 2025-10-29
対象: ローカル/クラウドにデプロイされた n8n を本サイトのチャット機能と連携し、AI エージェント（OpenAI + MCP ツール + メモリ）を安定運用するための要件。

## 1. 目的とスコープ
- 目的: Web サイトの `/api/agent/chat` からの問い合わせを n8n ワークフローで処理し、応答テキストを返す。
- スコープ（In）
  - Webhook 経由の受信（本番 `/webhook/*`、テスト `/webhook-test/*`）
  - AI Agent（OpenAI モデル）+ Simple Memory（会話メモリ）
  - MCP Client ツールによる外部検索/機能実行
  - 認証（Basic / API Token）・ログ・失敗時のトリアージ
- スコープ外（Out）
  - 長時間ジョブのスケジューリング、バイナリ添付ファイルの n8n 内保管
  - エージェントの高度な RAG 設計（本プロジェクトではサイト側 KB API を優先）

## 2. 利用者と利害関係者
- フロントエンド: Next.js から `/api/agent/chat` を呼び出し
- サイト API ブリッジ: n8n Webhook へフォワード（テスト/本番切替、認証付与、セッション管理）
- オペレーター: n8n UI でワークフローの編集、Activate、Executions の監視

## 3. システム構成（概要）
- ポート/URL
  - n8n: `http://localhost:5678/`
  - Webhook(本番): `http://localhost:5678/webhook/mcp-agent-chat`
  - Webhook(テスト): `http://localhost:5678/webhook-test/mcp-agent-chat`（キャンバス待機中のみ有効）
- サイト側ブリッジ
  - エンドポイント: `/api/agent/chat`
  - `?test=1` または `NEXT_PUBLIC_N8N_CHAT_TEST=1` でテスト URL にルーティング
  - 認証ヘッダ（Basic / X-N8N-API-KEY）を自動付与
  - `sessionId` を Cookie/ヘッダ経由で供給

## 4. 環境変数・設定
- 認証
  - `N8N_BASIC_AUTH_ACTIVE=1`
  - `N8N_BASIC_AUTH_USER`
  - `N8N_BASIC_AUTH_PASSWORD`
  - もしくは `N8N_API_TOKEN`（X-N8N-API-KEY）
- ルーティング
  - `N8N_AGENT_URL`（本番 Webhook のフル URL）
  - `N8N_AGENT_TEST_URL`（任意。未指定時は `/webhook/` → `/webhook-test/` 置換）
  - クライアント用: `NEXT_PUBLIC_N8N_CHAT_TEST=1`（開発時に常にテスト URL へ）
- その他（任意）
  - `SITE_TZ`、`GC_CALENDAR_ID` などは他 API 用（スロット計算等）

## 5. ワークフロー要件（MCP_SEVER_AGENT_webhook）
- トリガー
  - Webhook(POST) path: `mcp-agent-chat`
  - レスポンス: lastNode または Respond to Webhook ノードで JSON `{"output_text": string}`
- 前処理
  - Code ノード「Prepare Input」
    - 入力標準化
      ```js
      const body = $json.body ?? $json;
      return [{
        message: body.message ?? body.input_as_text ?? body.text ?? '',
        sessionId: body.sessionId ?? ($json.headers && $json.headers['x-session-id']) ?? $json.sessionId ?? $executionId,
        user: body.user ?? null,
        meta: body.meta ?? {}
      }];
      ```
- AI Agent ノード
  - User Message: `{{$json.message}}`
  - Model: OpenAI（例: gpt-4o-mini）／資格情報必須
  - Memory: Simple Memory（下記）
  - Tools: MCP Client（listTools/executeTool 等。失敗時は段階的に無効化して切り分け）
- Simple Memory（memoryBufferWindow）
  - Session ID = Define below
  - Key: `{{$json.sessionId || ($json.headers && $json.headers['x-session-id']) || $executionId}}`
  - Context Window Length: 5（要件: 1〜20 の範囲で調整可能）
- MCP Client
  - credential: MCP Client (STDIO) など運用に合わせて設定
  - `executeTool` の `toolParameters` は JSON を許容（文字列の場合は JSON.parse）

## 6. I/O 契約（ブリッジとの取り決め）
- 受信 JSON（最小）
  - `message: string`（必須）
  - `sessionId?: string`（ブリッジが Cookie/ヘッダから補完）
  - `meta?: object`（kbSnippets や添付のメタ情報など）
- 返却 JSON
  - `output_text: string`（必須）
- ヘッダ
  - `X-Session-Id: <uuid>` をブリッジが付与
  - 認証ヘッダ（Basic / X-N8N-API-KEY）をブリッジが付与

## 7. セキュリティ要件
- Webhook は必ず認証を有効化（Basic もしくは API Token）
- 機微情報は n8n の Credentials に保存し、Code ノードで直接埋め込まない
- CORS はサイトブリッジ経由で収束させ、外部公開の直接 Webhook 叩きを避ける

## 8. 可用性・性能
- 開発環境: ローカル Docker（5678）
- 目標応答時間: P50 < 2s、P95 < 10s（MCP ツールは外部依存のため例外あり）
- 同時実行: 最低 5 セッション並行（Simple Memory の key で分離）

## 9. 監視・運用
- n8n UI の Executions で失敗ノードを特定
- サイト側 `/api/agent/chat` は 404/405/500 時に原因ヒントを返す
- ログ保存: n8n のデータボリュームを永続化（Docker Compose の volume 定義）

## 10. 例外・エラー処理方針
- 404（Webhook not found）: Activate 不足 or テスト待機外 → Activate するか `?test=1`
- 405（Method not allowed）: POST のみ許可
- 500（workflow error）: Executions で失敗ノードを確認（OpenAI 認証/モデル、MCP 実行環境、式エラー）
- フォールバック: 一時的に Agent を外し、`Respond to Webhook` でエコー応答→段階的にノード復帰

## 11. テスト要件
- 疎通テスト
  - キャンバス `Execute test` 待機中に `/api/agent/chat?test=1` POST → 200
- 本番受信テスト
  - Activate 後 `/api/agent/chat` POST → 200
- 回帰テスト
  - `docs/operations/workflows/*.json` の差分検証（Webhook 設定・Prepare Input スクリプト・Memory Key）

## 12. デプロイ/リリース
- 方式: Docker Compose（n8n / mcp / kb-api）
- 本番/開発の切替
  - ワークフロー複製（例: `mcp-agent-chat-dev`）+ `N8N_AGENT_URL` 切替
  - または別ポート別インスタンスで完全分離

## 13. 受け入れ基準（Acceptance Criteria）
- [ ] `/api/agent/chat?test=1` で 200 が返る（キャンバス待機中）
- [ ] `/api/agent/chat` で 200 が返る（Activate 後）
- [ ] Simple Memory がセッション間で会話を維持する
- [ ] 500 発生時にサイト API が原因ヒントを返す
- [ ] 認証未設定時に外部からの Webhook 呼び出しが拒否される

## 14. 参考
- 運用手順: `docs/operations/n8n.md`
- 代表ワークフロー: `docs/operations/workflows/MCP_SEVER_AGENT_webhook.json`
