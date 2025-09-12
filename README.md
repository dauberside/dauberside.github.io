# DauberSide Project

Welcome to the DauberSide Project. This project runs on Next.js and deploys via Vercel (Git integration).

## Table of Contents

- [Installation](#installation)
- [Development](#development)
- [Deployment](#deployment)
- [Operations](#operations)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
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
- Link domain to the correct Vercel project; if 404, check domain assignment and “Production Branch”
- Environment variables must be set per environment (Development/Preview/Production) in Vercel

## Operations

- Daily development
  - Work on feature branches, open PRs. CI runs lint/type/test/build.
  - Merge to `master` for Production release (auto-deploy via Vercel).
- Environment management
  - Manage secrets in Vercel Project Settings → Environment Variables.
  - Use distinct values for Production vs. Preview when needed.
- Contact form protection
  - Rate limit: 1 IP/min using Vercel KV if configured (graceful fallback if not present).
  - reCAPTCHA v3/Enterprise optional: enabled when keys are set (see vars below).
  - Honeypot field blocks simple bots silently.
- Domain
  - Primary: `www` subdomain; apex redirects to `www`.
  - DNS is managed at your registrar; verify CNAME and A/ALIAS as documented by Vercel.

## Environment Variables

Set these in Vercel (Project Settings → Environment Variables). For local dev, you can use a `.env.local` file.

### Contact form & mail (required to send email)

- `SMTP_HOST` (required) — SMTP server host
- `SMTP_PORT` (required) — SMTP port (e.g. 465 for SSL, 587 for STARTTLS)
- `SMTP_USER` (required) — SMTP auth user / sender
- `SMTP_PASS` (required) — SMTP auth password
- `CONTACT_EMAIL` (optional) — Destination address; defaults to `SMTP_USER` if omitted

Used by: `src/pages/api/send.js`

### reCAPTCHA (optional)

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (optional, public) — Site key for v3 or Enterprise
- `RECAPTCHA_SECRET_KEY` (optional) — Secret key for v3 or Enterprise verification (server)
- `RECAPTCHA_SITE_KEY` (optional, server) — For Enterprise: resource name like `projects/PROJECT_ID/keys/KEY_ID`
- `RECAPTCHA_API_KEY` (optional, server) — For Enterprise REST API calls

Client uses `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; server verifies with `RECAPTCHA_SECRET_KEY`. For Enterprise, also set `RECAPTCHA_SITE_KEY` and `RECAPTCHA_API_KEY`.

### Rate limiting via Vercel KV (optional)

- `KV_URL` or `KV_REST_API_URL` — KV connection URL
- `KV_REST_API_TOKEN` — KV token with write access (for `INCR`/`EXPIRE`)

If KV is not configured, contact form still works but without per-IP throttling.

### API middleware CORS (optional)

- `ALLOWED_ORIGINS` — Comma-separated list of allowed origins; if unset, defaults to strict in production

Used by: `src/pages/api/middleware.ts`

### LINE webhook (optional feature)

- `CHANNEL_ACCESS_TOKEN` — LINE Messaging API token
- `CHANNEL_SECRET` — LINE channel secret
- `ALLOW_GROUP_IDS` — Comma-separated group IDs allowed to interact
- `SKIP_LINE_SIGNATURE` — `true` only for local testing (disables signature verification)

Used by: `src/pages/api/webhook.ts`, `src/lib/line.ts`

### Google Calendar integration (optional feature)

- `GC_CLIENT_ID`
- `GC_CLIENT_SECRET`
- `GC_REFRESH_TOKEN`
- `GC_REDIRECT_URI` — OAuth redirect URI
- `CALENDAR_ID` — Target calendar ID (defaults to `primary`)

Used by: `src/lib/gcal.ts`, `src/pages/api/webhook.ts`

### Cloudflare AI (optional)

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CF_AI_MODEL` — Default `@cf/meta/llama-3.1-8b-instruct` if not set

Used by: `src/lib/ai.ts`

### Misc

- `LOG_DIR` — Log directory for local runs (default: `./logs`)
- `NEXT_PUBLIC_ENABLE_CHAT` — Feature flag for UI

Note: Supabase is disabled in this build. The stub at `src/utils/supabaseClient.ts` prevents compile errors; do not set Supabase keys unless you re-enable it.

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
