# Context Capsule (携行用要約)

最終更新: 2025-11-17 | 目的: 会話履歴が長くなるのを防ぐため、本要約のみを常時コンテキストに同梱する。

## 1) 目的とスコープ
- 目的: UI から安全にエージェントを実行し、MCP/Obsidian/KB統合による効率的な開発環境を提供
- スコープ: Chat UI、MCP統合（GitHub/Vercel/n8n/Obsidian）、KB（Obsidian vault取り込み）、段階的拡張
- 非スコープ: 公開ディレクトリ/マスアクセス、クライアント側トークン保持

## 2) 不変条件（MUST/禁止）
- 本番でmockは常に無効。OPENAI_API_KEY未設定は500エラー
- `/agent/workflow`と関連APIはミドルウェアで保護（IP許可またはBasic認証）
- 検索避けヘッダ強制（X-Robots-Tag: noindex、Cache-Control: no-store）
- クライアントは内部トークン非保持。サーバプロキシ経由実行

## 3) アーキテクチャ概要

### 基盤
- 技術: Next.js 14 (pages), TypeScript 5.8, pnpm, Node 22
- 主要依存: @openai/agents v0.1.x, Zod v3
- LLMプロバイダ: OpenAI API

### MCP統合（Model Context Protocol）
- **4つのMCPサーバー**:
  - GitHub: Issues/PRs管理
  - Vercel: デプロイメント管理
  - n8n: ワークフロー自動化
  - Obsidian: Vault直接アクセス
- **設定**: `.mcp.json`（チーム共有）、`.mcp.local.json`（個人用、Git除外）
- **Claude Code統合**: 直接連携で開発効率向上

### Obsidian統合（二層アーキテクチャ）
- **REST API統合**: KB取り込み専用（読み取りのみ、ポート8443）
  - `src/lib/obsidian.ts` - クライアント
  - `/api/obsidian/ingest` - 取り込みエンドポイント
  - Delta検出（SHA256）による差分更新
- **MCP統合**: ノート編集・管理（読み書き可能）
  - ファイル直アクセス（REST API Plugin不要）
  - セクション・ブロック・frontmatter単位の編集
  - 定期ノート（Daily/Weekly/Monthly）処理
- **Vault情報**:
  - ID: `2742690dfebfe8dc`
  - パス: `/Users/krinkcrank/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault`
- **ベストプラクティス**: 編集はMCP、検索はKB

### KB（Knowledge Base）
- **埋め込みモード**:
  - OpenAI（本番）: `text-embedding-3-small`
  - Hash（開発/フォールバック）: ローカル決定的ハッシュ、API不要
- **ソース**: `docs/`, Obsidian vault（`KB_SOURCES`環境変数）
- **Delta検出**: SHA256ハッシュによる差分更新（増分ビルド）
- **インデックス**: `kb/index/embeddings.json`
- **検索**: Cosine類似度、Top-K取得

### Chat UI
- `/agent/workflow`: ChatBox/ChatInput
- メッセージ操作: 右クリック/長押しコンテキストメニュー
  - 引用（リプライ相当）、コピー、削除（自分の投稿のみ）
  - 表記: 「引用」（「返信」は使用しない）

## 4) 公開契約（現状）
- GET `/api/healthz`: ヘルスチェック
- POST `/api/agent/run`: 直接実行（内部向け）
- POST `/api/agent/workflow`: Zod検証付きワークフロー実行
- POST `/api/agent/workflow-proxy`: UI用サーバプロキシ
- POST `/api/obsidian/ingest`: Obsidian vault取り込み
- GET `/api/kb/search`: KB検索（クエリ、Top-K指定）
- ページ `/agent/workflow`: Chat UI（meta robots noindex）

## 5) セキュリティ/運用ポリシー
- ルート保護: `/agent/workflow`, `/api/agent/*` - IP/Basic + noindex/no-store
- CORS: 必要最小限（`ALLOWED_ORIGINS`環境変数）
- Obsidian API Key: `.mcp.local.json`/環境変数のみ、Git除外
- 個人運用前提: URL直接アクセス、Tailscale（ゼロトラストVPN）推奨

## 6) 正本と参照
- **要件定義**:
  - `docs/requirements/chat.md`
  - `docs/requirements/kb.md`
  - `docs/requirements/openai-agents-sdk.md`
  - `docs/requirements/obsidian.md`
- **運用ガイド**:
  - `docs/operations/mcp-obsidian-spec.md`
  - `docs/operations/mcp-obsidian-workflows.md`
  - `docs/operations/kb-setup.md`
- **ADR**: `docs/decisions/ADR-*.md`
- **Vault情報**: Obsidian vault内 `specs/obsidian-vault-info.md`
- **本カプセル**: 会話携行用短縮版（800トークン目安）

## 7) 既決事項（抜粋）
- UIはサーバプロキシ経由実行、クライアント非トークン保持
- 本番でmock不可、キー未設定は500返却
- Chat UIは既存配色に合わせ、固定色排除
- 型安全: Zod入力検証
- メッセージ操作: コンテキストメニュー、用語「引用」
- MCP統合: GitHub/Vercel/n8n/Obsidian（2025-11-17）
- Obsidian二層統合: REST（KB）+ MCP（編集）
- KB埋め込み: OpenAI（本番）/Hash（開発）二重モード
- ポート標準化: Obsidian REST API 8443（HTTP）、8445（HTTPS推奨）

## 8) 進行中のイニシアティブ
- KB自動再取り込み: Obsidian MCP編集後のKB ingestトリガー
- 定期ノート自動処理: 週次/月次レビュー生成
- n8n連携拡張: 更新イベント通知、自動処理
- SSE実装: 逐次レスポンス表示（未決: EventSource vs ReadableStream）

## 9) 更新手順（スレッド切替プロトコル）
1. 仕様/方針変更時、まず正本（requirements/ADR）を更新
2. 本カプセルを800トークン以下で更新、「最終更新日」更新
3. 新スレッド開始時、本カプセルのみ貼付（長文履歴非持込）
4. 重要決定はADRとして記録（docs/decisions/）

---
注: 本文は携行用要約。詳細は正本ドキュメント参照。
