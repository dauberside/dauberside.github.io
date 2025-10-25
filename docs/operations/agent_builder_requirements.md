# 要件定義書（OpenAI Agent Builder）

最終更新: 2025-10-24

## 現状サマリ（実装ステータス）
- 実装済み（Phase 1 範囲）
  - 構成スキーマ: `src/lib/agent/configs/schema.ts`（zod v3, `.nullable()` 方針）
  - CLI: init / validate / generate（`scripts/agent-builder/*.mjs`）
    - `init.mjs`: `src/lib/agent/configs/<name>.json` を作成
    - `validate.mjs`: JSON を zod スキーマで検証
    - `generate.mjs`: 構成から `src/lib/agent/agent.generated.ts` を生成（`@openai/agents` + zod v3 対応）
  - 配線: `src/lib/agent/agent.ts` から `./agent.generated` を re-export（API はそのまま利用）
  - 一括オーケストレーション:
    - `pnpm agent:builder:all`（validate→generate→build）
    - `pnpm agent:builder:all:dev`（validate→generate→build→dev 起動→healthz 待機→/run スモーク）
      - 主要フラグ: `--port/-p`, `--token/-t`, `--input/-i`, `--mock/--no-mock`, `--health-timeout/-w`, `--host`
  - スモーク単体: `pnpm agent:builder:smoke`（起動済みサーバに対して healthz と /run 実行）
- 動作確認結果（dev 3030）
  - `GET /api/healthz` → 200 OK を確認
  - `POST /api/agent/run?mock=1`（`x-internal-token: devtoken`, body: `{ "input": "say hello" }`）→ 200 OK / `{"output":"mock:say hello"}`

## 1. 背景と目的
- 既存の Next.js プロジェクトに統合済みの AgentKit（`@openai/agents`）を、より安全・迅速・再現性高く運用するために「Agent Builder」を用意する。
- Builder は「エージェント定義（モデル/指示/ツール/ガードレール）」の作成・変更・検証・エクスポート（配置）を支援し、運用の属人化と手作業を削減する。

## 2. スコープ
- 本要件は、当リポジトリ内で利用する「Agent Builder（CLI/最小UI）」の要件を定義する。
- 初期フェーズでは CLI ベースでの構成管理・検証・コード生成を優先。将来的に Web UI を追加可能とする。

## 3. 前提・技術スタック（現行リポジトリ準拠）
- Next.js 14（pages API）/ Node 22.x / TypeScript 5.8.x
- `@openai/agents@^0.1.11` / `zod@^3.25.40`（v4 は非推奨）
- 既存エンドポイント: `POST /api/agent/run`（内部トークン必須）、`POST /api/agent/webhook/[name]`、`GET /api/healthz`
- 観測性・保護: `x-request-id` ログ、簡易レート制限（トークン単位・500ms）、モックは本番で強制無効

## 4. 用語
- エージェント: `@openai/agents` の `Agent` インスタンス。
- ツール: `tool({ name, parameters(zod), execute })` で登録する関数。
- 構成（Config）: エージェントの指示・モデル・ツール宣言（スキーマ定義含む）を記述した JSON/TS。

## 5. ユースケース
- UC1: 新規エージェントの作成（名前・指示・モデル・ツールを定義）
- UC2: 既存ツール（例: ping）を拡張/追加し、ローカルでモック検証→本番へ配置
- UC3: 複数バージョンのエージェントを切替・ロールバック
- UC4: 構成を JSON として入出力（差分レビュー・再現）

## 6. 機能要件
- R-1 構成管理
  - R-1.1 エージェントのメタ（name、instructions、model）を設定可能
  - R-1.2 ツールを宣言的に定義（name、description、parameters=zod v3、execute の雛形）
  - R-1.3 構成を JSON/TS で保存（`src/lib/agent/configs/<agentName>.json` など）
  - R-1.4 構成のバージョニング（ファイルベース、Git 管理前提）
- R-2 検証
  - R-2.1 zod v3 によるスキーマ検証（`.nullable()` の方針に沿う）
  - R-2.2 型チェック（`pnpm typecheck` 連携）
  - R-2.3 モック実行（`AGENT_MOCK_MODE` 有効時）
- R-3 コード生成/配置
  - R-3.1 構成から `src/lib/agent/agent.ts` を安全に生成/更新（既存の注意点: 推論型の公開回避・TS2742 対策）
  - R-3.2 生成後に `pnpm build` でビルド検証
  - R-3.3 既存 API（`/api/agent/run` 等）にそのまま載る形を維持
- R-4 インポート/エクスポート
  - R-4.1 構成を JSON/TS で入出力（テンプレート/サンプルの配布）
- R-5 アクセス制御（初期）
  - R-5.1 ローカル/内部開発者向け（CLI 優先）。将来 UI 時は簡易認証 or IP 制限を想定
- R-6 監査・履歴（初期最低限）
  - R-6.1 変更履歴は Git ログ + 生成スクリプトのログを残す

## 7. 非機能要件
- セキュリティ
  - NF-1 `/api/agent/run` は `x-internal-token` 必須（既存仕様踏襲）。`INTERNAL_API_TOKEN` と一致時のみ 200。
  - NF-2 機密（API キー等）は `.env.local` 等のセキュアストアで管理。生成コードに直書き禁止。
  - NF-3 本番ではモック強制無効。
- 観測性/運用
  - NF-4 `x-request-id` ログ、`/api/healthz` の正常応答
  - NF-5 簡易レート制限（500ms 窓・トークン単位）を維持。将来 Redis/Upstash 化を検討。
- パフォーマンス/可用性
  - NF-6 生成後ビルドが 1 分以内で完了すること（目安）。

## 8. アーキテクチャ/構成
- A-1 構成ファイル: `src/lib/agent/configs/<agentName>.json`
- A-2 生成ターゲット: `src/lib/agent/agent.generated.ts`（生成物）
  - ランタイム入口は `src/lib/agent/agent.ts` で、生成物を `export { agent } from './agent.generated'` で再エクスポート（TS の推論型公開問題（TS2742）を回避しつつ既存 API から透過的に利用）
- A-3 CLI（例）
  - `pnpm agent:builder:init <name>`: 雛形の構成 JSON を作成
  - `pnpm agent:builder:validate <name>`: zod/型チェック/モックでの乾式検証
  - `pnpm agent:builder:generate <name>`: 生成（出力は `agent.generated.ts`）
  - `pnpm agent:builder:all`: validate→generate→build を一気に実行
  - `pnpm agent:builder:all:dev`: validate→generate→build→dev 起動→healthz/スモーク
    - 主要フラグ: `--port/-p`, `--token/-t`, `--input/-i`, `--mock/--no-mock`, `--health-timeout/-w`, `--host`
  - `pnpm agent:builder:smoke`: 既存起動中サーバに対して healthz/スモークのみ実施（同フラグ対応）
  - 既存エイリアス: `pnpm agent:build`, `pnpm agent:dev:3030`, `pnpm agent:start:3030`
- 注: 初期は CLI で充分。Phase 2 で Web UI（/builder）検討。

## 9. API・データ契約（初期）

### 9.1 実行 API（内部・開発者向け）

- `POST /api/agent/run`
  - 認証: `x-internal-token`（または `Authorization: Bearer`）必須（`INTERNAL_API_TOKEN` と一致）
  - レート制限: トークン単位 500ms 窓
  - モック: 本番では強制無効（開発では `AGENT_MOCK_MODE=1` または `?mock=1`）
  - 入力: `{ input: string }`（簡易）
  - 出力: `{ output: string }`

- `POST /api/agent/workflow`（新規）
  - 目的: Zod で型安全な入出力のワークフロー実行（既存の生成済み `agent` を利用）
  - 認証/レート/モック: 上記 `/api/agent/run` と同一ポリシー（本番モック無効、500ms 窓）
  - 入力スキーマ（Zod v3）: `TextWorkflowInput = { input_as_text: string(min:1,max:2000) }`
  - 出力スキーマ（Zod v3）: `TextWorkflowOutput = { output_text: string }`
  - GET アクセス時はガイド JSON を 200 で返し、使い方/スキーマを表示

注: 将来的に `/api/agent/builder/*` を追加する場合は CSRF/認証/レートを適用する。

## 10. 環境変数
- `OPENAI_API_KEY`: OpenAI 実キー（本番/実行時必須）
- `INTERNAL_API_TOKEN`: 内部 API トークン（`/api/agent/run` 用）
- `AGENT_MOCK_MODE`: 開発/検証のみ 1（本番は未設定/0、サーバ側で強制無効）
- `ALLOWED_ORIGINS`: CORS 許可（カンマ区切り）。未設定時は dev 既定を使用。

## 11. セキュリティ/運用ガイド
- 本番ではモックを強制無効、Secrets は環境変数で注入、構成差分は PR レビュー必須。
- Request-ID をヘッダで受けてログ相関。レート制限は最小限だが、攻撃面では WAF/プラットフォーム側の制御と併用。

## 12. 受け入れ条件（Acceptance Criteria）
- [x] `pnpm agent:builder:init sample` で `src/lib/agent/configs/sample.json` が生成される。
- [x] `pnpm agent:builder:validate sample` でスキーマ検証が PASS（zod v3）。
- [x] `pnpm agent:builder:generate sample` 実行で `src/lib/agent/agent.generated.ts` が生成され、`pnpm build` が SUCCESS。
- [x] `pnpm agent:dev:3030` 起動後、`GET /api/healthz` が `200 OK`。
- [x] `POST /api/agent/run?mock=1` に `x-internal-token` を付与して `200 OK` / `output` が返る（dev 環境）。
- [x] 本番環境ではモックが無効（未設定/`0`）である（E2E 確認済み: `?mock=1` でも 500=OPENAI_API_KEY 未設定）。
- [x] 短時間連打で `429` が返る（レート制限有効）（E2E 確認済み: 1発目 500→直後 429）。
- [x] `POST /api/agent/workflow` が Zod スキーマで入力検証され、200（正常）または 500（本番で OPENAI_API_KEY 未設定時）を返す。
  - [x] 認証トークン不一致は 401（`WWW-Authenticate` 応答つき）
  - [x] `GET /api/agent/workflow` は 200 で使い方/スキーマガイドを返す

### 付記（便利スクリプト）
- 一括: `pnpm agent:builder:all`（validate→generate→build）
- 一括+起動+スモーク: `pnpm agent:builder:all:dev -- --port 3040 --token mytoken --input 'hi' --no-mock`
- スモークのみ: `pnpm agent:builder:smoke -- --port 3030 --token devtoken --input 'smoke hi'`

## 13. マイルストーン/実装フェーズ
- Phase 0: 設計/雛形作成（本ドキュメント、構成 JSON スキーマ、コード生成方針）
- Phase 1: CLI 実装（init/validate/generate）+ ドキュメント + 簡易 E2E スモーク
- Phase 2: Web UI（/builder）最小版 + 内部 API（認証/CSRF/レート）
- Phase 3: バージョニング/ロールバック、Secrets 管理連携、分散レート制御

## 14. リスク/制約
- `zod@v3` 前提（v4 は peer 警告/非互換の可能性）。
- ツールの推論型公開（TS2742）を避けるため、生成コードは型露出に注意。
- Serverless 実行時間の制約（Vercel 等）→ 長時間処理は非推奨。

## 15. スコープ外（初期）
- 外部 SaaS 連携の OAuth 設定フロー（将来のツール実装時に別要件化）
- 大規模マルチテナント/RBAC の完全実装（将来検討）

## 16. 参考/既存仕様との整合
- 既存: `docs/operations/agentkit_requirements.md`（モック方針/healthz/レート制限 など）
- 既存: `/api/agent/run`・`/api/agent/webhook/[name]`・`/api/healthz` は継続利用
- 既存: `agent.ts` の実装方針（`.nullable()` 使用、型公開の回避）
