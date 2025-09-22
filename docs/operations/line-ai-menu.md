# LINE AI メニュー運用ガイド

このドキュメントは、LINE の AI メニュー機能（予定登録/予定確認/予定変更）を運用するための手順と注意点をまとめたものです。

## 前提条件（環境変数）

必須:
- CHANNEL_ACCESS_TOKEN — LINE Messaging API トークン
- CHANNEL_SECRET — LINE チャネルシークレット
- ALLOW_GROUP_IDS — 利用を許可するグループ ID（カンマ区切り）
- CALENDAR_ID — 予定を登録/参照する Google カレンダー ID（未設定時は primary）
- OPENAI_API_KEY — OpenAI API キー

任意/推奨:
- OPENAI_MODEL — 既定: gpt-4o-mini
- OPENAI_BASE_URL — 既定: https://api.openai.com/v1
- OPENAI_TIMEOUT_MS — AI 呼び出しのタイムアウト（ms）。デフォルト: 6000ms（テスト/CI でのハング防止）

関連ファイル: `src/pages/api/webhook.ts`, `src/lib/ai.ts`, `src/lib/line.ts`

## メニュー構成（現行）

- 予定登録（create_schedule）
  - 押下時はガイドを返信。続けて自然文で送ると登録フローに入ります。
  - 例: `8/23 20:30-21:00 食事 @渋谷`、`10/3 19:00-20:00 ミーティング @表参道`
  - 代替: `/ai 予約 10/3 19:00-20:00 ミーティング @表参道`
- 予定確認（check_schedule）
  - 既存の確認フローへ。範囲が曖昧な場合は 30 日先までを既定に拡張します。
- 予定変更（edit_schedule）
  - 既存の変更クイックリプライフローへ。

廃止済み（postback 受信時は無効化メッセージを返答）:
- 要約（summary）/ 今日の空き（slots_today）/ 使い方（howto）

実装箇所: `replyAiMenu()` と `action=ai` ハンドラ（`src/pages/api/webhook.ts`）

## スモークテスト（ステージング/本番）

1) チャットで `/ai` を送信
   - ボタンが「予定登録 / 予定確認 / 予定変更」の 3 つのみ表示される
2) 予定登録
   - 押下 → ガイドが返信 → 自然文例を送る → 登録確認/完了メッセージが返る
3) 予定確認
   - 押下 → 近日の予定一覧が返るか、既存の確認フローが開始される
4) 予定変更
   - 押下 → 変更対象の選択クイックリプライが表示される
5) 旧ボタンの postback（残存していた場合）
   - 「現在無効」の案内が返る

期待されるレスポンスが得られない場合は「トラブルシュート」を参照。

## トラブルシュート

- `/ai` でメニューが出ない
  - 該当グループ ID が `ALLOW_GROUP_IDS` に含まれているか確認
  - Webhook の署名検証エラー（ローカル検証時は `SKIP_LINE_SIGNATURE=true` で回避）
- 予定登録が失敗する
  - 入力の日時が曖昧/不足。例の形式で再送（`M/D HH:MM-HH:MM タイトル @場所`）
  - `CALENDAR_ID` が無効/権限不足。サービスアカウントまたは OAuth 設定を再確認
- AI 応答が遅い/ハング
  - `OPENAI_TIMEOUT_MS` を短く設定（例: 4000）。ネットワークや API ステータスも確認
- 旧メニューのままに見える
  - デプロイが最新か確認。キャッシュ/再デプロイ（Vercel の Redeploy）を実施

## ロールバック

過去のメニューに戻すには `src/pages/api/webhook.ts` の `replyAiMenu()` を以前のボタン構成へ差し戻します。`action=ai` ハンドラ側の分岐（`kind`）も一致する必要があります。

## 変更履歴
- 2025-09-22: メニューを 3 項目（予定登録/予定確認/予定変更）へ統一。旧項目は無効化。
