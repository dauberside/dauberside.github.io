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

### 追加スモーク（Direct Agent Path）

目的: n8n を介さないダイレクト経路（低遅延パス）の外形確認。

1) JSON リクエスト
- `POST /api/agent/direct` に `{"message":"3行で要約して"}` を送信 → 200 と `reply` 文字列を返す

2) multipart（テキスト添付）
- `message: "この添付を要約"` と `memo.md`（text/markdown, 数十行）を添付 → 200 と `reply`、`previews >= 1`

3) KB 検索つき
- `POST /api/agent/direct?use_kb=1` に `{"message":"プロジェクトの設計方針は？"}` → `usedKb=true` を返す（MCP/KB が起動・認証済みの場合）

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

---

## 自動スモーク（Production）

本番デプロイの外形監視として、GitHub Actions のワークフロー `production-smoke` を追加しています。

- ファイル: `.github/workflows/prod-smoke.yml`
- トリガー:
  - `push` to `main`/`master`
  - 手動実行（`workflow_dispatch`）
  - 定期実行（`cron: 0 */4 * * *`）
- チェック内容:
  1) `GET /api/healthz` が 200
  2) `POST /api/agent/run` に `x-internal-token` を付与して 200（既定）
     - 既定は「200 のみ成功」。手動実行時に `allow500=true` を指定した場合のみ 500 も成功扱い（本番で OPENAI_API_KEY を敢えて未設定にしているケースを許容）
     - 401/429 は失敗（トークン不一致 or レート制限）。429 は 1 回自動リトライ。

必要なシークレット:

- `INTERNAL_API_TOKEN`: 本番サーバと一致する内部トークン
- （任意）`SLACK_WEBHOOK_URL`: 失敗時に Slack 通知を投げる先（Incoming Webhook）

任意設定:

- ワークフロー入力 `base`: 本番ベース URL を上書き可能（未指定時は `https://www.xn--rn8h03a.st`）

実行方法（手動）:

1) GitHub → Actions → `production-smoke` → `Run workflow`
2) 必要なら `base` に `https://example.com` を入力
  - OPENAI_API_KEY を未設定にしている本番で 500 を許容したい場合は `allow500=true` を選択
3) 実行後、`Health check` と `Run /api/agent/run` のステップ結果を確認

トラブルシュート:

- 401: `INTERNAL_API_TOKEN` が一致していません（Vercel Production の値と GitHub Secret の値を確認）
- 429: リクエストが近接しすぎ。ワークフロー内部で 1 回リトライしますが、継続する場合は間隔を延ばす
- タイムアウト: ネットワーク要因の可能性。数分後に再実行、またはダッシュボードから Redeploy 後に実施

通知/アラート:

- 失敗時に `SLACK_WEBHOOK_URL` が設定されていれば Slack に通知します。
- 失敗時には自動で GitHub Issue（labels: ops/smoke/production）を起票します。
