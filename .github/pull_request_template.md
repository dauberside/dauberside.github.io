# PR タイトル（簡潔に）

## 概要（Summary）
- 変更の目的と背景を1〜3行で。

## 変更内容（What/How）
- 主な変更点の箇条書き。
- 公開契約（API/スキーマ/エンドポイント）に影響がある場合は明示。

## スクリーンショット / 動作確認（任意）
- UI 変更がある場合は画像/GIF。

---

## チェックリスト（ADR-0001: 正本+カプセル運用）

- 正本・携行用
  - [ ] 要件（`docs/requirements/*`）または憲法（`spec/memory/constitution.md`）の変更があれば更新済み
  - [ ] ADR を追加/更新済み（該当: `docs/decisions/ADR-xxxx-*.md`） → ID: `ADR-____`
  - [ ] 携行用カプセル（`docs/memory/context-capsule.md`）を更新（800 tokens 以下、最終更新日更新）

- 公開契約 / スキーマ
  - [ ] API 契約変更は `docs/requirements/*` と型/Zodスキーマに反映
  - [ ] GET での使用ガイド/ヘルス確認の挙動に破壊的変更がない、または記載

- セキュリティ/運用
  - [ ] 保護対象ルート（`/agent/workflow`, `/api/agent/workflow`, `/api/agent/workflow-proxy` 他）に変更があれば `src/middleware.ts` を更新
  - [ ] X-Robots-Tag: noindex/noarchive/nofollow と Cache-Control: no-store が維持されることを確認
  - [ ] クライアントで内部トークンを保持していない（サーバプロキシ経由で実行）
  - [ ] CORS 設定/許可リストの見直し（必要な場合）
  - [ ] 環境変数: `ADMIN_ENABLE_PROTECTION`, `ADMIN_BASIC_USERS` などの運用影響を明記

- 本番セマンティクス
  - [ ] 本番で mock は無効のまま（`OPENAI_API_KEY` 未設定時は 500）
  - [ ] 失敗経路のログ/エラーメッセージが有用である

- CI/品質
  - [ ] Typecheck / Build がローカルまたは CI で成功
  - [ ] プレビュー/本番スモークに影響があれば修正（ワークフロー/スクリプト）
  - [ ] 単体テストを追加/更新、または N/A の理由を記載

- 互換性/移行
  - [ ] 破壊的変更はない、または Migration 手順を記載

- ドキュメント
  - [ ] README/使用手順/開発者向けドキュメントの更新（必要な場合）

## リスクとロールバック
- 想定リスク、ロールバック戦略、Feature Flag の有無。

## 動作確認手順（QA/Smoke）
- 手順を箇条書き（保護ルート、エラー経路、本番セマンティクスを含む）。

## 関連リンク
- Issues/ADR/Spec/PR など。
