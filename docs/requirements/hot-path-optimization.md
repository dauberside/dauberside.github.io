# 要件定義: ホットパス最適化（Direct Agent Path）

最終更新: 2025-10-29

## 概要（目的）
- 既存の n8n 経由のエージェント実行パス（/api/agent/chat → n8n → OpenAI/MCP）に対し、アプリ内で完結する低遅延の「ダイレクト実行パス（hot path）」を追加する。
- 目的は応答レイテンシの継続的な削減と制御性の向上（回帰影響の少ない範囲で）

## 背景
- 現行の n8n ワークフローは機能追加・検証に適しているが、実行オーバーヘッドや失敗面の可観測性に制約がある。
- 実測で p50≈20s 程度のケースがあり（会話履歴・ツール連携・外部I/Oの影響を受ける）、UX 改善の余地がある。

## 用語
- ダイレクト実行パス（Direct Path / Hot Path）: Next.js API 内で LLM/MCP（HTTP）に直接アクセスする実装。
- 既存ワークフローパス（Workflow Path）: n8n の Webhook を介した実装。

## スコープ
- 新規 API: `POST /api/agent/direct`
  - 入力: JSON または multipart/form-data
    - メッセージ: `message`（別名 `text`/`input`）
    - 添付: multipart のファイル、または JSON の `files: [{name,mime,data(base64)}]`
    - オプション: `tool` と `Tool_Parameters`（JSON 文字列 or オブジェクト）。`tool=kb_search` 時にナレッジ検索を使用
    - クエリ: `?use_kb=1` で明示的に KB 検索を有効化
  - 出力: `{ ok: boolean, reply: string, usedKb: boolean, previews: number }`
  - 環境変数:
    - `OPENAI_API_KEY`（必須）、`OPENAI_BASE_URL`、`OPENAI_MODEL`（既定: gpt-4o-mini）
    - `MCP_BASE_URL` または `MCP_PORT`（既定: http://127.0.0.1:5050）、`MCP_API_TOKEN`（必要時）
- 添付ファイルのプレビュー抽出（テキスト系のみ）
  - 判定: `text/*` と一部 `application/*`（json/xml/yaml/csv 等）/ 拡張子（md/txt/csv/json/xml/yaml/yml）
  - 制限: 最大3ファイル・結合 3000 文字までにトリム（1ファイル最大約32KB読込）
- KB 検索（MCP HTTP アダプタ）
  - エンドポイント（例）: `POST {MCP_BASE_URL}/kb/search` （`{ query, topK }`）
  - 取得した上位スニペットをプロンプト末尾に同梱
- システムメッセージ（日本語）
  - 簡潔要約・手順・出典・不確実点の提示を促すガイドライン

## 非スコープ（今回含めない）
- 非テキスト添付（PDF/OCR/表計算）の内容抽出
- ストリーミング応答（SSE/Chunked）
- n8n ワークフローの廃止・完全置換
- 既存の UI 表示の変更（既存の Chat 要件定義に準拠）

## 成功基準（Success Criteria）
- 正常系: API が 200 と `reply` を返す（JSON/multipart ともに）
- エラー系: 入力不備で 400、内部失敗で 500（エラー整形を含む）
- レイテンシ: 既存ワークフローパスと比較して p50 の改善を確認（具体値は計測後に確定）
- 可観測性: 主要分岐（multipart/JSON, KB 使用有無）ごとに最低限のログ/メトリクス設置方針を文書化

## インターフェース詳細
### リクエスト（JSON）
```
POST /api/agent/direct
Content-Type: application/json
{
  "message": "質問…",            // 別名: text/input
  "tool": "kb_search",           // 任意
  "Tool_Parameters": {"query":"…"}, // 任意: JSON 文字列でも可
  "files": [                      // 任意: base64 で送る場合
    {"name":"memo.md","mime":"text/markdown","data":"...base64..."}
  ]
}
```

### リクエスト（multipart/form-data）
- フィールド: `message`（または `text`/`input`）、`tool`、`Tool_Parameters`（JSON文字列）
- ファイル: 任意のフィールド名で複数可

### レスポンス
```
200 { "ok": true, "reply": "…", "usedKb": true|false, "previews": 0..3 }
400 { "error": "missing_message" }
500 { "error": "direct_agent_error", "message": "…" }
```

## セキュリティ/制限
- 添付は 20MB/リクエスト上限（formidable 設定）。
- テキスト抽出は UTF-8 想定。JSON は整形して注入。
- 内部トークン/キーはクライアントへ露出させない（サーバ側で環境変数を使用）。

## ロールアウト/併存方針（棲み分け）
- 併存: 既存 `/api/agent/chat`（n8n 経由）を維持しつつ、`/api/agent/direct` を並走導入。
- ルーティング/利用指針:
  - 低遅延が重要・機能が直書きされている部分は Direct Path を優先。
  - 迅速なワークフロー実験や GUI 編集が必要な場合は n8n パスを使用。
- 契約整合性:
  - フィールド名の互換（`message|text|input`）とファイル取扱いは共通思想。
  - ツールパラメータは JSON 文字列/オブジェクトの両受けに統一。

## 関連ドキュメントとの整合性
- Chat 要件（`docs/requirements/chat.md`）
  - UI/UX/表示方針は既存定義に従う。Direct Path は「サーバ側の実行経路差」であり、UI 契約は不変。
- KB 要件（`docs/requirements/kb.md`）
  - KB 検索のトップK, スキーマ, 認証は KB 側定義に準拠。Direct Path は HTTP クライアントを実装するのみ。
- Services（`docs/requirements/services.md`）
  - MCP/KB サービスのポート/起動/認証は既定ポリシーに従う。
- Operations（`docs/operations/deploy-and-smoke.md`）
  - デプロイ後スモークに Direct Path を追加（本ドキュメントに従い JSON/multipart の最小疎通を確認）。

## 計測/監視（推奨）
- 計測ポイント: 受信→添付抽出→KB 検索→LLM 呼び出し→応答生成 の区間計測。
- 主要メトリクス: p50/p95 レイテンシ、KB ヒット率、添付プレビュー採用率、OpenAI 失敗率。
- ログ: `rid`（相関ID）を全区間で引き回し。

## リスク/課題
- 既存 TypeScript エラーにより CI 全体の型チェックが落ちる場合がある（Direct Path 自体はビルド可）。
- 将来的な PDF/OCR 等の拡張時は、処理時間増と依存追加に伴う攻撃面拡大に注意。

## 将来拡張（別チケット）
- ストリーミング応答（SSE/Chunked）
- 非テキスト添付のプレビュー（PDF→テキスト/OCR、表→csv/markdown）
- 複数 MCP ツールの選択/合成（search + fetch + summarize）
