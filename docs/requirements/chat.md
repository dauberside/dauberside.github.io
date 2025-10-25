# CHAT 機能 要件定義（レイアウト固定版）

- 目的: 既存サイトの配色/レイアウトを維持しつつ、人間⇄エージェントの会話UIを提供する。
- スコープ: 会話UI（ChatBox/ChatInput）、サーバ内プロキシ `/api/agent/workflow-proxy` 実行、ユーザー名のローカル保持、アクセス保護（IP/BASIC 複数ユーザー対応）、noindex/no-store。

## 画面/UX
- Header/Footer/Container を既存のまま利用。
- 背景/文字色は `src/styles/globals.css` に従い、ページ側で上書きしない。
- ChatBox: 自動スクロール。ChatInput: ユーザー名/メッセージ入力。開発時のみ mock トグル可（本番では無効）。
- メッセージ操作（コンテキストメニュー）:
  - 表示トリガー: PC=右クリック、モバイル=長押し(≥500ms)。
  - 項目: リプライ相当/コピー/削除/キャンセル。
    - 用語ポリシー: バブル内のラベルに「返信」という文言は表示しない（ヘッダーの小ボタンは非表示）。
    - 入力欄上のプレビュー見出しは「引用」。キャンセルは「引用をキャンセル」。
  - 削除は「自分の投稿」かつ呼び出し元から `onDeleteMessage` が提供されている場合のみ表示/実行可。

## 機能要件
1) 送信: 空白を拒否し、ユーザーバブルを楽観表示。
2) 実行: `/api/agent/workflow-proxy` に POST、`output_text` を Agent バブルで表示。失敗はエラーバブル。
3) mock 切替: `?mock=1`（開発のみ）。
4) ユーザー名: localStorage 保持/復元。
5) 自動スクロール: 追記時に最下部へ。
6) レート制限耐性: 429 をUIで提示（初期は自動リトライなし）。
7) 引用（リプライ相当）: コンテキストメニューから対象を選び、入力欄上に引用プレビューを表示。送信時に UI メタとして `replyTo` をユーザーメッセージへ付与（現状サーバ送信はしない）。

## 非機能要件
- セキュリティ: OPENAI_API_KEY はサーバ側のみ。UIはプロキシ経由。
- プロバイダ: OpenAI API のみ（`@openai/agents` 経由）。他ランタイム（LangChain 等）は現時点では対象外（Deferred）。
- 保護: `ADMIN_ENABLE_PROTECTION=1` で IP/BASIC ガード。`ADMIN_BASIC_USERS="user:pass,..."` で複数ユーザー対応。
- インデクス/キャッシュ抑止: `X-Robots-Tag=noindex,nofollow,noarchive` と `Cache-Control=no-store` を常時付与（middleware と meta）。
- パフォーマンス: レイテンシ P95 < 3s 目安。
- 互換性: PC/モバイル（縦長）。

## API 契約
- POST `/api/agent/workflow-proxy`
  - Headers: `Content-Type: application/json`
  - Body: `{ input_as_text: string }`
  - Query: `?mock=1`（開発）
  - 200: `{ output_text: string, ... }`
  - 400/401/429/500: 状況に応じて返却。

## データモデル
- `Message`: `{ id:number, created_at:string, content:string, user_id:string, username?:string, replyTo?: { id:number, username?:string, content:string } }`

## 受け入れ基準
- 既存レイアウト/配色で動作。
- 送信→Agent 応答が表示。
- 実行経路は `/api/agent/workflow-proxy`（OpenAI Agents SDK 経由）であること。LangChain 経路は使用しない。
- 本番で OPENAI_API_KEY 未設定時は 500、UIはエラー表示。
- mock=1 は開発のみ有効。
- 401/429/500 がUIから判断可能。
- 秘密情報のブラウザ露出なし。
- `X-Robots-Tag` と `no-store` が付与。
- 保護有効時は IP または BASIC（複数ユーザー定義）でのみアクセス可能。
- コンテキストメニューが PC/モバイル双方で動作し、引用プレビューに「引用」ラベルが表示される（「返信」の語をUIに表示しない）。

## 拡張方針（段階的）
- Step1: 非ストリーミング（現状）
- Step2: レスポンスストリーミング（SSE）に差し替え（ChatService を置換）
- Step3: 会話履歴の永続化（KV/Supabase）
- Step4: 添付/ツール呼び出し、ロール/権限

---
ドキュメント最終更新日: 2025-10-25

### 関連ドキュメント
- OpenAI Agents SDK 要件定義: [docs/requirements/openai-agents-sdk.md](./openai-agents-sdk.md)
- ナレッジベース（SSD・最小構成）要件定義: [docs/requirements/kb.md](./kb.md)
