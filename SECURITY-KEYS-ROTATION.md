# Secrets Rotation Playbook

This repo contains local-only `.env.local` with many credentials. Use this playbook to rotate any leaked or shared secrets and to standardize handling.

## Immediate Hygiene
- Ensure `.env*` is ignored by git (already configured).
- Prefer storing production secrets in Vercel: Project → Settings → Environment Variables.
- Never expose secrets to the browser. Only variables prefixed with `NEXT_PUBLIC_` are safe for client.

## Keys to Rotate (and where)

- Gmail SMTP App Password
  - What: `SMTP_PASS`
  - Where: Google Account → Security → App passwords → Generate new (for Gmail)
  - Update: Vercel env (Production/Preview/Development) + `.env.local`

- Vercel
  - What: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`
  - Where: Vercel → Account Settings → Tokens; Project/Org IDs from dashboard
  - Update: Local CI or scripts only; avoid storing tokens in repo

- Database (Supabase Postgres)
  - What: `DATABASE_URL`
  - Where: Supabase → Project → Settings → Database → Connection string, rotate password
  - Update: Vercel env + `.env.local`

- CORS
  - What: `ACCESS_CONTROL_ALLOW_ORIGIN`
  - Where: Vercel → Project → Env vars; keep consistent with `src/middleware.ts`

- Google OAuth (Console)
  - What: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Where: Google Cloud Console → Credentials → OAuth client → Regenerate secret
  - Update: Vercel env + `.env.local`

- Google Calendar (Service / OAuth)
  - What: `GC_CLIENT_ID`, `GC_CLIENT_SECRET`, `GC_REFRESH_TOKEN`, `CALENDAR_ID`
  - Where: Google Cloud Console + OAuth Playground (refresh token), or service account
  - Update: Vercel env + `.env.local`

- LINE Messaging API
  - What: `CHANNEL_ACCESS_TOKEN`, `CHANNEL_SECRET`, `ALLOW_GROUP_IDS`
  - Where: LINE Developers Console → Messaging API → Channel settings
  - Update: Vercel env + `.env.local`

- Cloudflare
  - What: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
  - Where: Cloudflare Dashboard → My Profile → API Tokens
  - Update: Vercel env + `.env.local`

- Upstash / Vercel KV
  - What: `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `REDIS_URL`
  - Where: Upstash Console → Redis database → Settings / Tokens
  - Update: Vercel env + `.env.local`

- Internal tokens
  - What: `INTERNAL_API_TOKEN`, `REMINDER_TICK_TOKEN`
  - Where: Internal policy (rotate at source of generation)
  - Update: Vercel env + `.env.local`

- OpenAI
  - What: `OPENAI_API_KEY`, optionally `OPENAI_PROJECT`, `OPENAI_BASE_URL`
  - Where: https://platform.openai.com/api-keys → Create new key
  - Update: Local shell (`~/.zshrc`) and Vercel env if used in server code

## Rotation Steps (per secret)
1. Generate new secret/token in the provider console.
2. Update Vercel env for Production/Preview/Development; redeploy.
3. Update `.env.local` for local dev.
4. Invalidate/revoke the old secret in the provider.
5. Record in your internal vault (1Password, Bitwarden, etc.).

## History and Scanning
- If any real secret was pushed to git history, consider scrubbing:
  - `git filter-repo` (recommended) or `git filter-branch` to remove blobs
  - Force-push and rotate the secret at the provider
- Run secret scanning locally:
  - `gitleaks detect --no-banner --redact`

## Notes
- Client-side code must not read server secrets; use API routes.
- Prefer least privilege tokens (read-only for read paths).
- Use separate env sets for dev/preview/prod to minimize blast radius.
