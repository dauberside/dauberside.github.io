# Context Capsule (携行用要約)

最終更新: 2025-11-14 | 目的: 会話履歴が長くなるのを防ぐため、本要約のみを常時コンテキストに同梱する。

## 1) 目的とスコープ
- 目的: UI から安全にエージェントを実行できる個人用サイト運用。
- スコープ: Chat 形式のワークフロー実行と段階的拡張（SSE、履歴、マルチモーダル、観測）。
- 非スコープ: 公開ディレクトリ/マスアクセス前提の運用、クライアント側での内部トークン保持。

## 2) 不変条件（MUST/禁止）
- 本番で mock は常に無効。OPENAI_API_KEY 未設定の本番呼び出しは 500（仕様）。
- `/agent/workflow` と関連 API はミドルウェアで保護（IP 許可または Basic 認証）。
- 検索避けヘッダとキャッシュ抑止を強制（X-Robots-Tag: noindex/noarchive/nofollow、Cache-Control: no-store）。
- クライアントは内部トークンを保持しない。サーバ側プロキシ経由で実行。

## 3) アーキテクチャ概要
- 技術: Next.js 14 (pages), TypeScript 5.x, pnpm, Node 22。
- 主要依存: @openai/agents v0.1.x, Zod v3。
- LLMプロバイダ: OpenAI API（許可）。LangChain ルートは暫定スタブのみ・運用は Deferred（不使用）。
- エージェント実行: 2系統併存（ストラングラーパターン）
  - **Direct Path** (`/api/agent/direct`): アプリ内で完結する高速実行（KB検索+添付プレビュー+LLM直接呼び出し、レイテンシ重視）
  - **Workflow Path** (n8n経由): 多段ワークフロー、GUI編集、実験的パイプライン向け
- UI: ChatBox/ChatInput を用いた `/agent/workflow` ページ。メッセージは右クリック/長押しのコンテキストメニューから「引用（リプライ相当）」・コピー・削除（自分の投稿のみ）を提供。UI 上は「返信」という語を表示しない（見出しは「引用」）。
- 抽象化: `src/lib/chat/service.ts`（sendToAgent）と `config.ts`（エンドポイント）で将来の SSE/リトライ差し替えに備える。

## 4) 公開契約（現状）
- GET `/api/healthz`: ヘルスチェック。
- POST `/api/agent/run`: 直接実行（内部向け）。認証正規化、簡易レート制限、GET は使用ガイド返却。
- POST `/api/agent/direct`: Direct Path 実行（JSON+multipart、添付プレビュー、KB検索、LLM直接呼び出し）。
- POST `/api/agent/workflow`: Zod 検証付きワークフロー実行。GET は使用ガイド返却。
- POST `/api/agent/workflow-proxy`: UI 用サーバプロキシ。クライアントは内部トークン非保持。
- ページ `/agent/workflow`: Chat UI（meta robots noindex）。
- 予定（設計済）: SSE ストリーミング、`/api/agent/asr`（音声, multipart）、`/api/agent/vision-proxy`（画像, multipart）。

共通仕様メモ:
- 本番: mock 無効。OPENAI_API_KEY 未設定時は 500 で失敗させる設計。
- 認証: ミドルウェアで IP 許可/Basic 認証（`ADMIN_BASIC_USERS` による複数ユーザ対応）。

## 5) セキュリティ/運用ポリシー
- ルート保護: `/agent/workflow`, `/api/agent/workflow`, `/api/agent/workflow-proxy` を対象に IP/Basic + noindex/no-store。
- Direct Path セキュリティ（ADR-0002）:
  - 添付ファイル: 20MB上限、MIME spoofing対策（Content-Type + Magic Number二重チェック）、テキストのみ抽出
  - 入力サニタイゼーション: HTML/スクリプト除去、制御文字削除、長さ制限（本文50k、添付10k文字）
  - Rate Limiting推奨: IP 60req/min、ユーザー 20req/min、グローバル 1000req/min
- CORS 許可は必要最小限。
- 個人運用前提（URL 直接アクセス、サイトナビからは非露出）。
 - リモートアクセスは Tailscale（ゼロトラストVPN）推奨。tailnet 内アクセスを基本とし、公開インターネット直露出を避ける（代替: Cloudflare Tunnel/Access）。

## 6) 正本と参照
- 正本: `docs/requirements/*` と ADR 群（`docs/decisions/ADR-*.md`）。
  - ADR-0001: Context Capsule と ADR 運用プロセス（正本の境界を定義：API契約、セキュリティ、エージェント不変条件等）
  - ADR-0002: Direct Agent Path 導入（パス選択基準、セキュリティ強化）
- 参考（保留中）: `docs/requirements/langchain.md`（状態: Deferred）
- 直近計画: `.github/copilot-instructions.md` の RECENT-PLANS セクション。
- 本カプセル: 会話携行用の短縮版（400–800 tokens 目安）。

## 7) 既決事項（抜粋）
- UI はサーバプロキシ経由で実行し、クライアントに内部トークンを渡さない。
- 本番で mock は不可。キー未設定は 500 を返すことで誤運用を検出。
- エージェント実行は Direct Path / Workflow Path の2系統併存（ストラングラーパターン）。
  - レイテンシ重視・アプリ内完結 → Direct Path
  - 多段ワークフロー・GUI編集 → Workflow Path
- Chat UI はサイト既存配色に合わせ、余計な固定色は排除。
- 型安全は Zod による入力検証で担保。
 - メッセージ操作はコンテキストメニューで提供し、用語は「引用」を用いる（「返信」表記は避ける）。

## 8) 未決・次の3手
- 未決: SSE 実装方式（EventSource vs fetch+ReadableStream）, 会話履歴の保存層, Direct Path の Rate Limiting実装タイミング。
- 次の3手:
  1) Direct Path の可観測性強化（p50/p95、KB ヒット率、OpenAI 失敗率の定常可視化）。
  2) sendToAgent を SSE 対応に拡張（UI は逐次追記、体感速度改善）。
  3) 非テキスト添付（PDF/OCR）プレビューの安全な導入とサンドボックス検討。

## 9) 更新手順（スレッド切替プロトコル）
1. 仕様/方針の変更があれば、まず正本（requirements/constitution/ADR）を更新。
2. 本カプセルを 800 tokens 以下で更新し「最終更新日」を更新。
3. 新スレッドを開始し、最初に本カプセルのみを貼り付ける（長文履歴は持ち込まない）。

---
注: 本文は携行用の要約です。詳細は正本ドキュメントを参照してください。