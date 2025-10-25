# LangChain 要件定義書

最終更新: 2025-10-25

状態: Deferred（保留）

注意: 本要件は一旦クローズ（着手保留）とする。現行は @openai/agents を正路線として継続し、LangChain への移行/併用は将来の再評価時まで凍結する。以下の内容はアーカイブ目的で保持し、実装/運用の前提とはしない。

## 1. 目的とスコープ（アーカイブ）
- 目的: 安全なサーバサイド実行（プロキシ経由）で、LangChain を用いた会話、ツール実行、RAG（簡易）を実現する。
- スコープ: Chat UI からの呼び出し、トークンストリーム配信（SSE）、ツール/リトリーバ、簡易履歴、観測（LangSmith 任意）。
- 非スコープ: マスユーザ向け公開配布、大規模ワークフローオーケストレーション、Edge Runtime（初期段階では Node.js Runtime 前提）。

## 2. アーキテクチャ方針（アーカイブ）
- ランタイム: Next.js pages API（Node.js runtime）。Edge は依存の非対応があるため将来検討。
- クライアントは内部トークンを保持しない。必ずサーバプロキシ経由。
- 既存の保護（IP/Basic、noindex/no-store）はそのまま適用。
- 構成スイッチ: env または設定で runtime を agents|langchain 切り替え可能に（段階移行）。

## 3. 主要依存（アーカイブ）
- langchain v0.2+（JS/TS）
- LLM プロバイダ: OpenAI（`OPENAI_API_KEY`）/ Azure OpenAI（任意）。
- 観測（任意）: LangSmith（`LANGCHAIN_TRACING_V2=1`, `LANGCHAIN_API_KEY`, `LANGCHAIN_ENDPOINT`）。
- ベクトルDB（任意・RAG時）: Supabase pgvector またはローカル/簡易 KV（本リポジトリは Supabase 設定ファイルあり）。

## 4. セキュリティ/運用制約（参考）
- 本番で mock 無効。`OPENAI_API_KEY` 未設定時は 500 を返す仕様を維持。
- ミドルウェア保護: `/agent/workflow` と LangChain 関連 API も対象。IP 許可/Basic 認証、`ADMIN_BASIC_USERS` 対応。
- X-Robots-Tag: noindex/noarchive/nofollow、Cache-Control: no-store を適用。
- レート制限（軽量）: 既存の仕組みに準拠。LangChain API にも適用。
- ログ衛生: 入力テキスト/添付の秘匿情報は原則保存しない。エラーログは最小限に要約。

## 5. API 契約（LangChain 用・参考）

### 5.1 非ストリーミング: `POST /api/langchain/chat`
- Request (JSON):
  - message: string
  - history?: Array<{ role: 'user'|'assistant'|'system', content: string }>
  - tools?: string[] （使用を許可する論理名）
  - config?: { temperature?: number; maxTokens?: number; model?: string }
- Response (JSON):
  - id: string
  - message: string
  - usage?: { inputTokens?: number; outputTokens?: number; costUSD?: number }
  - toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  - error?: { code: string; message: string }
- バリデーション: Zod で厳格（400 on invalid）。
- 本番キー未設定: 500（仕様）。

### 5.2 ストリーミング（SSE）: `POST /api/langchain/chat/stream`
- Request: 5.1 と同一 JSON。`Content-Type: application/json`。
- Response: `text/event-stream`
  - イベント: `token`（data: string）, `message`（最終文）, `usage`（推定）、`error`。
  - 心拍: 15秒以上無送信を避けるため `: ping\n\n` を 10s 間隔で送出。
- 切断: サーバ側タイムアウト/中断に対応（UI は中断ボタン可）。

### 5.3 添付RAG（任意・後続）: `POST /api/langchain/rag`
- multipart/form-data: files[], message, options。
- 動作: 一時保存 → ローダー/スプリッター → 埋め込み作成 → ベクトルDB格納（スコープ: 個人/期限付き）→ チャット応答。
- 制限: 1ファイル最大 10MB、合計 20MB、数 5。

## 6. サービス構成（参考）
- `src/lib/langchain/` 配下に以下を用意：
  - `models.ts`: LLM/Embeddings のファクトリ（OpenAI/Azure 切替）。
  - `chains.ts`: 基本チャットチェーン、RAG チェーン、ツール呼び出し。
  - `tools.ts`: 許可ツールの登録（カレンダー/検索/外部API…は権限境界を明示）。
  - `stream.ts`: LangChain コールバックを SSE にブリッジ。
  - `schemas.ts`: Zod スキーマ（API入出力、tool args）。
- 既存の `src/lib/chat/service.ts` から runtime 切替可能に（config で agents|langchain を選択）。

## 7. ツール/エージェント方針（参考）
- ツールは「明示許可」のみロード。デフォルト無効。
- ツール実行は入出力 Zod で検証。外部 I/O はタイムアウト/リトライ/レート制限を付与。
- 代表ツール（例）:
  - calendar.read/write（スコープ最小）
  - fetch.json（特定ドメインのみ許可）
  - retrieval.query（限定コーパス）

## 8. 設定/環境変数（参考）
- 必須: `OPENAI_API_KEY`
- 任意: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`
- LangSmith（任意）: `LANGCHAIN_TRACING_V2=1`, `LANGCHAIN_API_KEY`, `LANGCHAIN_ENDPOINT`
- RAG（任意）: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` または `VERCEL_KV_*`
- 既存: `ADMIN_ENABLE_PROTECTION`, `ADMIN_BASIC_USERS`, CORS 設定 など

## 9. 性能/制限（参考）
- 1 リクエストあたり 60 秒タイムアウト（初期）。
- トークン上限/費用制御: maxTokens 既定値をモデルごとに設定。月次上限は Vercel/CI に通報（任意）。
- 同時実行: 単ユーザ前提で過負荷にならない範囲。簡易キュー（必要時）。

## 10. テスト/品質（参考）
- ユニット: chain と tools をモック LLM で検証（LangChain Mock）。
- API: supertest で JSON/SSE の最小ケース（200/400/401/429/500）。
- スモーク: 既存の preview/prod smoke に `/api/langchain/chat` 追加（キー未設定時は prod 500 を期待）。
- 型: Zod スキーマと TypeScript 型の相互参照を維持。

## 11. 観測/ログ（参考）
- LangSmith 有効化時は trace を送信。無効時はサーバログの最小限メトリクス（latency, tokens 推定）。
- PII/秘密のログ出力を禁止。マスク/省略を徹底。

## 12. 互換性/移行（参考）
- UI 側は `src/lib/chat/service.ts` 経由で実行方式を抽象化。設定で runtime 切替。
- 同一のミドルウェア保護/セマンティクスを踏襲（noindex/no-store、認証、レート制限）。
- 段階導入: 非ストリーミング → SSE → RAG → 外部ツールの順で拡張。

## 13. リスクと緩和（参考）
- 依存ライブラリの更新頻度/破壊的変更 → version pin とスモークテスト。
- コスト逸脱 → maxTokens/温度制限、失敗リトライ制限、月次上限通知。
- 情報漏えい → ツール許可リスト方式、ログ最小化、CORS/ミドルウェア保護。

## 14. 実装タスク（凍結中）
1) API `POST /api/langchain/chat` と Zod スキーマ実装（非SSE）。
2) SSE ブリッジ `POST /api/langchain/chat/stream` 実装＋UI 対応。
3) `src/lib/langchain/*` の最小チェーン（Chat）とモデルファクトリ。
4) runtime 切替（agents|langchain）設定追加と ChatService 経由の切替。
5) テスト: JSON/SSE ハッピーパス + 400 + 500。

付録A: 参考リンク
- LangChain JS Docs: https://js.langchain.com
- LangSmith: https://smith.langchain.com
