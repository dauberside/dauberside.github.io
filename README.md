# DauberSide Project

Welcome to the DauberSide Project. This project runs on Next.js and deploys via
Vercel (Git integration).

## Table of Contents


## LINE 予定登録トラブルシュート（日時ピッカーが反応しない時）

一部端末・クライアントで LINE の datetimepicker が無反応になることがあります。以下のいずれかの方法で回避できます。

- うまく開かない → 日付だけ選ぶ → 時間ボタンを選ぶ（09:00/10:00/13:00/15:00/19:00 など）
  - 日付確定後に時間クイックボタンを押すと、KV に pending(start/end) が保存され、件名入力→登録確認に進めます。
  - サーバーログ目印: `[CID] pick_date`, `pending:set path: "pick_date_time"` → `[LINE] replyQuick ok { cid }`
- うまく開かない → 今から1時間 / 今夜(19-20) / 明日午前(10-11)
  - 即時に pending が保存され、確認導線が出ます。
  - サーバーログ目印: `[CID] pending:set path: "pick_datetime_manual"`
- テキストで送る（例）
  - `9/25 18:00-19:00 打合せ @渋谷`
  - 件名・場所（@の後）を含めると確認画面まで自動誘導します。
  - サーバーログ目印: 受信テキスト → 確認テンプレ送信

補足:

- 返信ログには相関ID(CID)が付与されます。`[CID] start …` と `[LINE] reply… ok { cid: "..." }` が同一 ID で紐づきます。
- 選択後に無反応な場合、サーバーログに postback が来ていない可能性があります。`[CID] postback raw` が出ていないかをご確認ください。
- グループ制限を有効化している場合は `ALLOW_GROUP_IDS` に対象グループIDが含まれている必要があります。

## Installation

   ```sh
   git clone https://github.com/dauberside/dauberside.github.io.git
   ```
2. Navigate to the project directory:
   ```sh
   cd dauberside.github.io
   ```
3. Install dependencies (pnpm recommended):
   ```sh
   pnpm install
   ```

## Development

Start dev server:

```sh
pnpm dev
```

Helpful scripts:

- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Format: `pnpm format`

## Deployment

- Hosting: Vercel Project (Git Integration)
- Production branch: `master`
- Deploy flow: push/merge to `master` → Vercel builds and deploys Production
- Preview: pull request branches automatically build as Preview deployments
- Domains: `www` is primary, apex domain redirects to `www`

Tips:

- Force re-deploy: Vercel Dashboard → Deployments → “Redeploy” (Production)
- Link domain to the correct Vercel project; if 404, check domain assignment and
  “Production Branch”
- Environment variables must be set per environment
  (Development/Preview/Production) in Vercel

## Operations

- Daily development
  - Work on feature branches, open PRs. CI runs lint/type/test/build.
  - Merge to `master` for Production release (auto-deploy via Vercel).
- Environment management
  - Manage secrets in Vercel Project Settings → Environment Variables.
  - Use distinct values for Production vs. Preview when needed.
- Contact form protection
  - Rate limit: 1 IP/min using Vercel KV if configured (graceful fallback if not
    present).
  - reCAPTCHA v3/Enterprise optional: enabled when keys are set (see vars
    below).
  - Honeypot field blocks simple bots silently.
- Domain
  - Primary: `www` subdomain; apex redirects to `www`.
  - DNS is managed at your registrar; verify CNAME and A/ALIAS as documented by
    Vercel.

## LINE AI shortcuts

Use AI-powered shortcuts directly in LINE without typing long commands.

- How to open the menu / メニューの開き方
  - Send "/ai" (with no arguments) in a 1:1 or allowed group chat. The bot returns an "AIメニュー" buttons template.
  - 1:1 または許可グループのトークで「/ai」を送信すると、AIメニュー（ボタン）が表示されます。
- Available actions (3 only) / 利用可能アクション（3項目のみ）
  - 予定登録 (Create schedule):
    - Quick Reply に日時ピッカー（ロールUI）が表示されます。まず日時を選択してください。
    - 選択後、件名の入力を促すメッセージが届きます。メッセージ本文をそのまま件名として解釈します（例: 「打合せ @渋谷」→ 件名=打合せ, 場所=渋谷）。
    - 返信内に「Googleカレンダーで編集（テンプレート）」リンクも表示され、ブラウザで直接編集→保存も可能です。
  - Google カレンダーの直接リンク（TEMPLATE/日ビュー）を案内します。必要に応じて「Webカレンダー（サイト）」(/booking) も併記します。
  - 予定確認 (Check schedule): Show upcoming schedule via the existing flow.
  - 予定変更 (Edit schedule): Start the schedule-edit quick reply flow.
- Free conversation / 自由入力での登録
  - You can directly send a natural sentence to register: e.g. "8/23 20:30-21:00 食事 @渋谷" or "10/3 19:00-20:00 ミーティング @表参道".
  - 自然文の送信だけでも登録できます（例: "8/23 20:30-21:00 食事 @渋谷"、"10/3 19:00-20:00 ミーティング @表参道"）。
  - The classic format also works: "/ai 予約 10/3 19:00-20:00 ミーティング @表参道".
  - 旧来の書式（例: "/ai 予約 10/3 19:00-20:00 ミーティング @表参道"）も利用可能です。
- Notes / 注意事項
  - Group chats must be allowed via `ALLOW_GROUP_IDS`.
  - グループで使う場合は `ALLOW_GROUP_IDS` に対象グループ ID を設定してください。
  - 日時ピッカー選択後の「件名待ち」は KV に10分間だけ保持されます。タイムアウトしたら再度「予定登録」からやり直してください。
  - If AI responses seem slow in tests/CI, consider tuning `OPENAI_TIMEOUT_MS` (see Environment Variables).
  - テスト/CI で応答が遅い場合は `OPENAI_TIMEOUT_MS` を短めに調整してください（環境変数参照）。
  - Older buttons like "要約"、"今日の空き"、"使い方" are disabled and will respond with a notice.
  - 旧ボタン（要約/今日の空き/使い方）は無効化されており、押下時は案内メッセージが返ります。

For admin operations and smoke tests, see: `docs/operations/line-ai-menu.md`.
（運用者向け手順とスモークテストは `docs/operations/line-ai-menu.md` を参照）

## Deploy & Smoke Test

- How to deploy and verify production quickly:
  - See `docs/operations/deploy-and-smoke.md` for a concise, step-by-step guide.
  - 本番反映とスモークテストの手順は `docs/operations/deploy-and-smoke.md` を参照してください。

## Security: Trusted builds

依存パッケージのインストールスクリプトは原則ブロックし、必要最小限のみ許可しています。

- 設定ファイル: `pnpm-workspace.yaml` の `onlyBuiltDependencies`
- 現在の許可: `unrs-resolver`
- 運用と監査の詳細: `docs/security/trusted-builds.md`

## Environment Variables

Set these in Vercel (Project Settings → Environment Variables). For local dev,
you can use a `.env.local` file.

### Contact form & mail (required to send email)

- `SMTP_HOST` (required) — SMTP server host
- `SMTP_PORT` (required) — SMTP port (e.g. 465 for SSL, 587 for STARTTLS)
- `SMTP_USER` (required) — SMTP auth user / sender
- `SMTP_PASS` (required) — SMTP auth password
- `CONTACT_EMAIL` (optional) — Destination address; defaults to `SMTP_USER` if
  omitted

Used by: `src/pages/api/send.js`

Notes:

- Request body size limit: 16KB (JSON). Requests larger than this will be
  rejected with 413.
- Message length limit: 140 characters (UI and API both enforce this).

### reCAPTCHA (optional)

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (optional, public) — Site key for v3 or
  Enterprise
- `RECAPTCHA_SECRET_KEY` (optional) — Secret key for v3 or Enterprise
  verification (server)
- `RECAPTCHA_SITE_KEY` (optional, server) — For Enterprise: resource name like
  `projects/PROJECT_ID/keys/KEY_ID`
- `RECAPTCHA_API_KEY` (optional, server) — For Enterprise REST API calls

Client uses `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; server verifies with
`RECAPTCHA_SECRET_KEY`. For Enterprise, also set `RECAPTCHA_SITE_KEY` and
`RECAPTCHA_API_KEY`.

### Rate limiting via Vercel KV (optional)

- `KV_URL` or `KV_REST_API_URL` — KV connection URL
- `KV_REST_API_TOKEN` — KV token with write access (for `INCR`/`EXPIRE`)

If KV is not configured, contact form still works but without per-IP throttling.

### Minimal incident logging / external monitoring (optional)

- `MONITORING_WEBHOOK_URL` — If set, the API will POST minimal incident events
  (code 415/413/429) as JSON
- `MONITORING_WEBHOOK_TOKEN` — Optional bearer token for the webhook

Incidents are also printed to Vercel logs as
`console.warn("incident", payload)`.

### API middleware CORS (optional)

- `ALLOWED_ORIGINS` — Comma-separated list of allowed origins; if unset,
  defaults to strict in production

Used by: `src/pages/api/middleware.ts`

### LINE webhook (optional feature)

- `CHANNEL_ACCESS_TOKEN` — LINE Messaging API token
- `CHANNEL_SECRET` — LINE channel secret
- `ALLOW_GROUP_IDS` — Comma-separated group IDs allowed to interact
- `SKIP_LINE_SIGNATURE` — `true` only for local testing (disables signature
  verification)

Used by: `src/pages/api/webhook.ts`, `src/lib/line.ts`

### Google Calendar integration (optional feature)

- `GC_CLIENT_ID`
- `GC_CLIENT_SECRET`
- `GC_REFRESH_TOKEN`
- `GC_REDIRECT_URI` — OAuth redirect URI
- `CALENDAR_ID` — Target calendar ID (defaults to `primary`)

Used by: `src/lib/gcal.ts`, `src/pages/api/webhook.ts`

### OpenAI (default)

- `OPENAI_API_KEY` — Required
- `OPENAI_MODEL` — Default `gpt-4o-mini` if not set
- `OPENAI_BASE_URL` — Default `https://api.openai.com/v1` if not set
- `OPENAI_PROJECT` — Optional
- `OPENAI_TIMEOUT_MS` — Optional; fetch timeout for AI calls (default: 6000ms)

Used by: `src/lib/ai.ts`

### Cloudflare AI (optional / legacy)

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CF_AI_MODEL` — Default `@cf/meta/llama-3.1-8b-instruct` if not set

Note: The current implementation uses OpenAI by default. Cloudflare Workers AI
settings are kept for legacy compatibility but are not required.

Used by: (legacy paths only)

### Misc

- `LOG_DIR` — Log directory for local runs (default: `./logs`)
- `NEXT_PUBLIC_ENABLE_CHAT` — Feature flag for UI

Note: Supabase is disabled in this build. The stub at
`src/utils/supabaseClient.ts` prevents compile errors; do not set Supabase keys
unless you re-enable it.

### Example `.env.local`

```env
# Mail
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=postmaster@example.com
SMTP_PASS=app-password
CONTACT_EMAIL=owner@example.com

# reCAPTCHA (v3)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=site_key_here
RECAPTCHA_SECRET_KEY=secret_key_here

# Vercel KV (optional)
KV_REST_API_URL=https://kv.example.vercel-storage.com
KV_REST_API_TOKEN=vercel_kv_token

# CORS (optional)
ALLOWED_ORIGINS=https://www.example.com,https://example.com
```

## Contributing

Feel free to open issues and pull requests.

## License

MIT
