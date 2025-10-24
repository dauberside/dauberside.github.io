## デプロイとスモークテスト手順

このドキュメントは、LINE AI メニューの最新修正を本番へ反映し、最低限のスモークテストで正常性を確認するための運用手順です。

### 前提条件

- Vercel プロジェクトが Git 連携済み（Production ブランチ: master）
- Production 環境変数が設定済み
  - LINE: CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, ALLOW_GROUP_IDS
  - Google Calendar: CALENDAR_ID（または GC_CALENDAR_ID）, GC_*（OAuth/ServiceAccount 経由の場合）
  - KV: KV_REST_API_URL, KV_REST_API_TOKEN（任意）
  - OpenAI: OPENAI_API_KEY（既定モデルは gpt-4o-mini）
  - 安全弁（Mock）: 本番では `AGENT_MOCK_MODE` は未設定（または `0`）。`?mock=1` も無効化される（サーバ側で強制無効）。

### デプロイ手順（いずれか）

1) Git 経由の通常デプロイ
- master ブランチにマージ/プッシュ → Vercel が自動で Production Deploy

2) 手動リデプロイ
- Vercel Dashboard → プロジェクト → Deployments → 最新の Production を「Redeploy」

補足:
- 環境変数の反映はデプロイ単位。値を更新した場合は必ず再デプロイしてください。
- ドメイン/ブランチの紐付けが正しいかを Production Settings で確認してください。

### ポストデプロイ健全性チェック（1分）

- API 稼働確認: /api/diagnostics が 200 を返す（Vercel Logs に INFO が出力される）
- 内部API（開発/ステージングのみ）: /api/agent/run は `x-internal-token` 付与時に 200/`{output}` を返す
  - 本番では Mock は無効。OpenAI キー未設定やネットワーク問題時は 500 を返す
- Vercel Logs を開き、以下のエラーが無いことを確認
  - Invalid reply token（修正済み: /ai 無入力時の二重返信を排除）
  - Session retrieval error: Cannot read properties of null (reading 'expiresAt')（修正済み: セッション取得時の null/parse ガード）

期待ログ例:
- [LINE] replyMessages ok { count: 2 }（/ai でテンプレ＋ガイダンスを1回の返信で送信）
- [WEBHOOK] cid=... action=pick_datetime / create / confirm などの相関ID付きログ

### スモークテスト手順（3〜5分）

準備: テスト用 1:1 または許可済みグループで実施。各操作で相関ID（cid）をメモしておくとログ追跡が容易です。

1) メニュー表示
- メッセージ: `/ai`
- 期待: 「AIメニュー」（予定登録/予定確認/予定変更）ボタン＋使い方テキストが1回の返信で届く
- ログ: replyMessages ok { count: 2 }、Invalid reply token が無い

2) 予定登録（日時ピッカー）
- メニュー「予定登録」→ Quick Reply の日時ピッカーから日時選択
- 期待: 件名入力の案内が届く（KV に pending を10分保持）
- メッセージ: 例「打合せ @渋谷」
- 期待: 確認テンプレート（JST表示）と Quick Reply に Google カレンダーのリンク群（TEMPLATE/日ビュー/サイト）が届く
- リンク検証: TEMPLATE が正しく新規作成画面、日ビューが当日の正しい日付（ctz=Asia/Tokyo, cid=CALENDAR_ID）で開く

3) 予定登録（フォールバック）
- デスクトップ版 LINE 等で日時ピッカーが出ない場合、用意されたプリセット（+30分、+2時間 など）から選択→同様に件名案内→確認テンプレート

4) 予定確認 / 予定変更
- 「予定確認」: 近日予定の提示または既存の確認フロー開始
- 「予定変更」: 対象選択のクイックリプライが表示

5) キャンセル動作
- 自然文「この前の打合せキャンセルして」など → 候補提示→確定で削除、または1件なら即削除
- 期待: 🗑 予定をキャンセルしました の返信、該当イベントのリマインダーが削除される

### ログ観測のポイント

- cid=... を軸に postback → pending:stash → confirm-sent → create:done の順でトレース
- 返信成功ログ（replyMessages ok）と、二重返信エラーが出ていないこと
- セッション取得時の warn/error が出ていないこと（null/parse ガードにより抑止済み）

### ロールバック

- 直前の Production デプロイを Vercel で選択し「Promote to Production」
- もしくは master を前バージョンへ Revert して再デプロイ

### 既知事項 / 注意

- 一部テストではモックにより console.warn/console.error を意図的に出力しています（CIログ）。本番ログと混同しないようにしてください。
- LINE のボタン本文は文字数制限が厳しいため、文面は短縮表示されます。
 - モックモード（`AGENT_MOCK_MODE=1` や `?mock=1`）は開発/検証専用です。本番ではサーバ側で無効化されます。
