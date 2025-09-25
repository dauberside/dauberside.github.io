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
  - 押下時に Quick Reply の日時ピッカー（mode=datetime）が表示されます。初期値は現在時刻を5分丸めでJSTに合わせています。
  - 日時を選択すると、サーバーが開始/終了（+60分）を KV に10分間だけ「pending」として保存し、ユーザーに「件名を入力してください」と促します。
  - ユーザーがテキストを送ると、その本文を件名として解釈し（`@場所` を含むと場所として抽出）、確認テンプレートを返します。
  - 確認メッセージには「Googleカレンダーで編集（TEMPLATE）」リンクも同梱。直接ブラウザで編集→保存が可能です。
  - 確認や案内の Quick Reply には Google カレンダーの直接リンク（TEMPLATE/日ビュー）を含めます。必要に応じて「Webカレンダー（サイト）」(`/booking`) も併記します。
  - 旧来の自然文だけの登録も引き続きサポートしています。
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
  - 押下 → Quick Reply で日時ピッカーが表示 → 日時を選ぶ
  - 件名入力のプロンプトが届く → 例: 「打合せ @渋谷」と送信
  - 確認テンプレートが届く（JST表示）→ 承認で作成される
  - 返信内リンク「Googleカレンダーで編集」が正しくテンプレート画面を開く
  - Quick Reply の Google カレンダーリンク（TEMPLATE/日ビュー）が正しく開く（ctz=Asia/Tokyo, cid=CALENDAR_ID）。必要に応じて「Webカレンダー（サイト）」が /booking を開く
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

- Invalid reply token が出る
  - /ai 無入力時の二重返信が原因となるケースがありました（修正済み: replyMessages にて1回でテンプレ＋ガイダンスを送信）。ログに複数の reply 呼び出しが無いか確認してください。

- Session retrieval error: Cannot read properties of null (reading 'expiresAt') が出る
  - 旧式セッション取得パスで null/parse ガードを追加済みです。最新デプロイで収まらない場合は KV の該当キーの破損データを削除し、再試行してください。

## ロールバック

過去のメニューに戻すには `src/pages/api/webhook.ts` の `replyAiMenu()` を以前のボタン構成へ差し戻します。`action=ai` ハンドラ側の分岐（`kind`）も一致する必要があります。

## 変更履歴
- 2025-09-22: メニューを 3 項目（予定登録/予定確認/予定変更）へ統一。旧項目は無効化。
- 2025-09-22: 予定登録に LINE 日時ピッカー（ロールUI）導入。選択後は「件名入力→確認」へ誘導。GCAL テンプレート/サイト導線を追加。
 - 2025-09-24: /ai の二重返信を解消（Invalid reply token 対策）。セッション取得に null/parse ガードを追加。Google カレンダーの直接リンク（TEMPLATE/日ビュー）を明文化。
