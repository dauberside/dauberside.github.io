# OpenAI Agents SDK 要件定義

最終更新: 2025-10-25

## 目的
- 本プロジェクトにおいて OpenAI Agents SDK（`@openai/agents`）を安全かつ再現性高く利用するための要件を定義する。
- ビルド時に自動生成されるエージェント（`agent.generated.ts`）を Next.js (pages API) から実行し、UI/CI/運用と整合すること。

## スコープ
- SDK 利用方針（バージョン、初期化、実行方法）
- エージェント生成パイプライン（validate → generate → build）
- API エンドポイント契約（`/api/agent/run`, `/api/agent/workflow`, `/api/agent/workflow-proxy`）
- セキュリティ（トークン、環境変数、保護ミドルウェア）
- 観測性/テスト/CI スモーク
- 非機能要件（性能・可用性・変更容易性）

## 用語
- 「エージェント」: `@openai/agents` を用いて構成される実行ユニット。ビルド時に `src/lib/agent/agent.generated.ts` として生成され、`src/lib/agent/agent.ts` から re-export される。
- 「ワークフロー」: 実行ランナー/トレースを含むアプリ層の手続き（例: `text-workflow`）。

## 技術スタック/制約
- Node.js 22.x / Next.js 14 (pages router) / TypeScript 5.8
- SDK: `@openai/agents` v0.1.11（将来更新はセマンティックバージョン＋互換性検証）
- スキーマ: Zod v3（`.nullable()` はポリシーとして明示的に使用）
- パッケージ: pnpm

## 依存関係とバージョン固定
- `package.json` の `dependencies` に `@openai/agents@^0.1.11` を定義すること。
- 破壊的更新が想定される場合は `~` 固定か、Renovate/手動での段階検証プロセスを必須とする。

## 生成パイプライン
- スクリプト
  - `pnpm agent:builder:validate` → 入力仕様の妥当性検証
  - `pnpm agent:builder:generate` → `src/lib/agent/agent.generated.ts` 生成
  - `prebuild` で validate→generate を自動実行（`pnpm build` 前に必ず走る）
- 成果物
  - `src/lib/agent/agent.ts` は `agent.generated.ts` を re-export（TS2742 回避）
- 失敗時
  - validate/generate で失敗した場合はビルドを中断（CI でも fail）

## API 契約
- 共通
  - 認証: `x-internal-token: <INTERNAL_API_TOKEN>` または `Authorization: Bearer/Token <token>`
  - 失敗時: `401 Unauthorized`（`WWW-Authenticate` を返却）、`405 Method Not Allowed`（`Allow` ヘッダー）、`429`（簡易レート制限）、`500`（内部/キー欠落）
  - `GET` は使用ガイドを返す 200（ドキュメント的用途）

- POST `/api/agent/run`
  - Body: `{ input?: string, ... }`（内部実装の都合に依存）
  - 用途: SDK エージェントの直接実行（内部トークン必須）

- POST `/api/agent/workflow`
  - Body: Zod でバリデーション（例: `{ input_as_text: string }`）
  - 用途: アプリ側ワークフロー実行（内部トークン必須）

- POST `/api/agent/workflow-proxy`
  - Body: `{ input_as_text: string }`
  - クライアントから内部トークン不要（サーバ内プロキシ）
  - 用途: ブラウザUI用の安全なゲートウェイ
  - 補足: `?mock=1` は開発時のみ有効。本番では常に無効。

## セキュリティ
- 環境変数
  - `OPENAI_API_KEY`（必須: 本番）。未設定時、本番は 500 を返す（mock も無効）
  - `INTERNAL_API_TOKEN`（内部 API 認証用）
  - 管理保護用: `ADMIN_ENABLE_PROTECTION=1`、`ADMIN_BASIC_USER`/`ADMIN_BASIC_PASS` または `ADMIN_BASIC_USERS="user:pass,..."`、`ADMIN_IP_ALLOWLIST="ip,ip,..."`
- ルート保護
  - `src/middleware.ts` にて `/agent/workflow` および関連 API を保護
  - 未認証時は `401` + `WWW-Authenticate`、保護パスには `X-Robots-Tag: noindex,nofollow,noarchive` と `Cache-Control: no-store` を常時付与
- クライアント秘匿
  - UI は必ず `/api/agent/workflow-proxy` を利用し、API キーや内部トークンをブラウザに露出しない

## 非機能要件
- 性能
  - 同期応答の P95 レイテンシ目安: < 3s（モデル/ネットワークに依存）
  - レート制限: 500ms/トークン（簡易）
- 可用性/運用
  - CI にプレビュー/本番スモークを用意（/healthz, /agent/run または `/agent/workflow` を叩く）
  - 失敗時は通知/Issue 自動作成（任意）
- 変更容易性
  - 生成物は `src/lib/agent/**` に集約。UI はサービス抽象（`src/lib/chat/service.ts`）経由で実行先を切替可能

## UI 連携（参考）
- `/agent/workflow` ページは Chat 形式の UI。送信時に `/api/agent/workflow-proxy` を叩き、`output_text` を表示。
- デザインは既存 `globals.css` の配色に従い、noindex/no-store を付与。

## 受け入れ基準（Acceptance Criteria）
1. `pnpm build` 時に validate→generate が実行され、生成物が含まれたビルドが完成する。
2. `/api/agent/run` と `/api/agent/workflow` は認証方式（Header）を満たすと 200 を返す。
3. `/api/agent/workflow-proxy` 経由で UI から実行でき、クライアントに秘密情報が露出しない。
4. 本番で `OPENAI_API_KEY` 未設定の場合、`?mock=1` を付与しても 500 を返す。
5. 保護対象パスに `X-Robots-Tag` と `Cache-Control: no-store` が常時付与される。
6. 405/401/429/500 の各エラーパスが正しく動作し、ヘッダ（`Allow`, `WWW-Authenticate` 等）も適切。

## テスト/検証
- 単体
  - Zod スキーマの I/O 変換、トークン正規化、ヘッダー検証
- 結合
  - SDK 実行パス（モック・本番キーなし/あり）
  - `/api/agent/workflow-proxy` 経由のリクエスト/レスポンス
- E2E/スモーク
  - プレビュー/本番へデプロイ後にヘルスチェックと最低限のエージェント呼び出し

## 拡張計画（段階的）
- ストリーミング応答（SSE）: サービス層での実装差し替え
- ツール呼び出し拡張: Agent 側の関数追加とワークフローからのハンドリング
- 会話履歴の永続化: KV/Supabase で保存・再取得
- マルチモーダル: 画像/音声対応（Vision, TTS/ASR）

### マルチモーダル要件（画像/音声・ファイル添付）

結論: 可能。小さな追加で「ファイル添付→サーバで受理→OpenAIに渡す」フローを実現する。

1) UI 要件
- `ChatInput` にファイル添付ボタンを追加（`accept="image/*,audio/*"`、初期は1ファイルまで）。
- 画像はプレビュー、音声はファイル名表示（任意で再生UI）。
- 送信時は FormData で API に multipart POST。

2) API 契約（新設）
- POST `/api/agent/vision-proxy`（画像×Vision）
  - Auth: 既存ミドルウェア保護（IP/BASIC）。
  - Content-Type: `multipart/form-data`
  - Fields: `file`(required: image/*), `prompt`(optional string), `mock`(optional; 本番無効)
  - 200: `{ output_text: string }`
  - 400/401/413/415/429/500 を状況に応じて返却。

- POST `/api/agent/asr`（音声→テキスト）
  - Auth: 同上。
  - Content-Type: `multipart/form-data`
  - Fields: `file`(required: audio/*), `language`(optional)
  - 200: `{ text: string }`（転写結果）。UI はこれをそのままチャット入力として `workflow-proxy` に送るか、サーバ側で連結する別API（将来拡張）を用意。

3) 実装方針
- 依存: 既に `formidable` を導入済み。pages API で `config = { api: { bodyParser: false } }` を設定し、multipart をサーバ側でパース。
- バリデーション: MIME タイプ allowlist（image/*, audio/*）、サイズ上限（例: 10MB）を超えたら 413。
- OpenAI への渡し方:
  - 画像: 一時URL（ストレージ/S3/Supabase）または base64 `data:` で Vision 対応モデルに入力。Agents SDK/ワークフローで image input をサポートする。
  - 音声: Transcriptions API（Whisper 相当）でテキスト化→既存 `workflow-proxy` にテキストを投入。
- 永続化: 初期は保存しない（テンポラリ扱い）。将来、Supabase Storage に保存＋署名付きURLで参照に切替可。

4) セキュリティ/運用
- 既存のミドルウェア保護配下に置く（noindex/no-store ヘッダーは維持）。
- コンテンツ検査（タイプ/サイズ/拡張子一致）と、画像 EXIF の除去（任意）。
- レート制限は簡易のまま開始、必要に応じて強化。

5) 受け入れ基準
- 画像（jpg/png/webp など）を添付してプロンプトと一緒に送ると、Vision モデル経由の応答テキストが返る。
- 音声（m4a/mp3/wav など）を添付すると、テキスト転写が返り、そのままチャットに投入して応答が得られる。
- ブラウザに秘密情報は露出しない（Network タブで確認）。
- 不正な MIME/サイズ超過で 4xx を返却し、UI はエラーを表示。

## リスクと対策
- モデル/SDK 更新による互換性崩れ → 生成・ビルドフック + CI スモークで早期検知
- 秘密情報露出 → プロキシ以外の直叩き禁止・CORS/Middleware 強化
- コスト暴騰 → レート制限/クォータ/アラートの導入（将来対応）

---
### 関連ドキュメント
- Chat 要件定義: [docs/requirements/chat.md](./chat.md)
- ナレッジベース（SSD・最小構成）要件定義: [docs/requirements/kb.md](./kb.md)
