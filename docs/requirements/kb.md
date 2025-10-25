# ナレッジベース（SSD常駐・最小構成）要件定義

最終更新: 2025-10-25 | 対象範囲: ローカルSSD上に小規模RAG用のKBを構成し、UI/エージェントから再利用できる状態にする。

## 1. 目的とスコープ
- 目的: ドキュメント群（Markdown中心）をSSD上にインデックス化し、クエリに応じて近傍スニペットを取得できる最小のKBを用意する。
- スコープ:
  - チャンク分割→埋め込み生成→索引(JSON)の作成
  - シンプルな検索ユーティリティ（コサイン類似度）
  - UI/エージェントから呼び出せる拡張ポイント（RAG統合の前段）
- 非スコープ（将来拡張）:
  - 本格的なベクタDB（Qdrant/pgvector）運用
  - PDF/HTMLなどの多様な抽出パイプライン
  - ストリーミング大量投入、オンライン更新、アクセス制御UI

## 2. アーキテクチャ概要
- データ配置: リポジトリ配下のSSD上に `kb/index/embeddings.json` を生成（パスは環境変数で変更可）。
- インデクサ: `scripts/kb/build.mjs`（Node）
  - 対象: 既定は `docs/` の `.md/.mdx`（`KB_SOURCES` で上書き可）
  - チャンク: 1200文字、200文字オーバーラップ（簡易）
  - 埋め込み: OpenAI Embeddings（`text-embedding-3-small` 既定）
- 検索ユーティリティ: `src/lib/kb/index.ts`
  - JSONインデックスを読み込み、クエリを埋め込み→コサイン類似度で上位K件返却
- UI/エージェント連携: `searchKB()` で得たスニペットをプロンプトへ差し込む（RAG）構成を想定（別途実装）

## 3. 環境変数/実行
- 必須
  - `OPENAI_API_KEY`: 埋め込み生成・クエリ埋め込みに使用
- 任意
  - `KB_EMBEDDING_MODEL`（既定: `text-embedding-3-small`）
  - `KB_SOURCES`（既定: `docs,spec`）
  - `KB_INDEX_PATH`（既定: `<repo>/kb/index/embeddings.json`）

- スクリプト
  - `pnpm -s kb:build` … インデックスを再生成

- 参考ドキュメント
  - `docs/operations/kb-setup.md` … セットアップ/注意点

## 4. データモデル
- JSONインデックスフォーマット（簡易）
  - ヘッダ: `{ model, created_at, root, files, chunks }`
  - データ: `data: Array<{ id, source, chunk_index, text, embedding }>`
- 検索結果: `Array<{ id, source, text, score }>`

## 5. 非機能/制約
- 規模: 小規模前提（1万チャンク程度目安）。巨大化時はベクタDBへ移行必須。
- パフォーマンス: SSDを前提とし、I/Oの安定性を重視。大規模時はHNSW等（DB側）で最適化。
- デプロイ: Vercel Serverless ではローカルSSDへ直接保存不可。デプロイ運用は外部DB/ストレージ利用を基本とする。
- セキュリティ: APIキーはサーバ側の秘密。UIからは直接使用しない（現行方針を踏襲）。
 - アクセス: リモートからの安全アクセスは Tailscale（ゼロトラストVPN）を推奨。tailnet 内のみ到達可能とし、公開インターネットには直接露出しない（代替: Cloudflare Tunnel/Access）。

## 6. 受け入れ基準
- `pnpm -s kb:build` が成功し、`kb/index/embeddings.json` が生成される。
- `searchKB('任意のクエリ')` が上位K件を返却する。
- UI/エージェントからの呼び出し点（RAG統合の拡張ポイント）が提示されている。
- 機密キーのブラウザ露出が無い（UIはキー未保持）。
 - 運用方針として「Tailscale（ゼロトラストVPN）により tailnet 内アクセスに限定する」ことが文書化されている。

## 7. 運用/拡張計画
- ステップアップ
  1) PDF/HTML抽出の追加（別バッチ/ワーカー）
  2) ベクタDB（Qdrant/pgvector）への移行（オンライン更新/高スループット）
  3) KB API の独立（VPN/Tunnel/ゼロトラスト運用）
  4) ローカル埋め込み（e5/bge + sentence-transformers/Ollama）で低コスト化
- バックアップ/保全
  - SSDのスナップショット/定期バックアップ、暗号化（FileVault/LUKS）

## 8. 用語ポリシー/連携
- Chat UI での引用（リプライ相当）は「返信」という語を使わず「引用」で表示（UI要件）。
- KBスニペットをプロンプトに差し込む際は、出典（`source`）と引用範囲をメタに保持し、UIに明示可能とする（将来対応）。