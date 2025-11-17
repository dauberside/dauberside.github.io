# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Last updated: November 9, 2025

---

## Essential Commands

### Development
```bash
pnpm dev              # Start dev server (default port 3000)
pnpm dev -p 3001      # Use alternate port (recommended if 3030 is in use)
pnpm agent:dev        # Start agent-specific dev server on port 3030
```

### Quality Gates (run before committing)
```bash
pnpm typecheck        # TypeScript validation (strict mode)
pnpm lint             # ESLint check
pnpm test             # Run all Jest tests
pnpm test:watch       # Run tests in watch mode
pnpm build            # Full build with agent generation
pnpm ci               # Run all checks: lint + typecheck + test + build
```

### Testing
```bash
pnpm test                              # Run all tests
pnpm test:watch                        # Watch mode
pnpm test:coverage                     # Coverage report
pnpm test:contract                     # Contract tests only (API compatibility)
jest path/to/file.test.ts              # Run single test file
jest -t "test name pattern"            # Run tests matching pattern
```

### Agent Builder (Critical Build Dependency)
```bash
pnpm agent:builder:validate            # Validate agent config JSON
pnpm agent:builder:generate            # Generate src/lib/agent/agent.generated.ts
pnpm agent:builder:smoke               # End-to-end agent test
```

### Knowledge Base
```bash
pnpm kb:build                          # Build embeddings index from docs/
pnpm kb:smoke:api                      # Test standalone KB API service
pnpm kb:smoke:next                     # Test KB via Next.js proxy
```

### Operations
```bash
pnpm ops:allowlist:list                # List IP allowlist
pnpm ops:allowlist:add <ip>            # Add IP to allowlist
pnpm ops:basic:add <user> <pass>       # Add BASIC auth credentials
```

### PM2 (Production)
```bash
npx pm2 start services/ecosystem.config.cjs   # Start all services
npx pm2 restart next-app                      # Restart main app
npx pm2 reload next-app --update-env          # Reload with env updates
npx pm2 logs next-app --lines 200             # View logs
npx pm2 status                                # Check process status
```

---

## High-Level Architecture

### Technology Stack
- **Framework**: Next.js 14 (pages router) + React 18 + TypeScript 5.8
- **Runtime**: Node.js 22, pnpm package manager
- **AI/Agents**: OpenAI Agents SDK (`@openai/agents`), direct Claude integration
- **Storage**: Vercel KV (Redis), JSON-based KB index
- **Integrations**: LINE Messaging API, Google Calendar, Obsidian vault, n8n workflows
- **Infrastructure**: PM2 process manager, Docker Compose, Tailscale VPN

### Key Architectural Patterns

#### 1. Agent Builder System (Code Generation)
**Unique to this codebase.** The agent builder generates TypeScript code from JSON configurations:

- **Config Location**: `src/lib/agent/configs/{name}.json`
- **Generated Output**: `src/lib/agent/agent.generated.ts` (DO NOT EDIT - auto-generated)
- **Build Integration**: Pre-build hooks validate and generate agent code
- **Schema**: Zod-based validation in `src/lib/agent/configs/schema.ts`

**Critical**: Every build runs `pnpm agent:builder:validate && pnpm agent:builder:generate`. If you modify agent configs, regenerate before testing.

**Config Structure**:
```json
{
  "name": "agent_name",
  "instructions": "System prompt",
  "model": null,
  "tools": [
    {
      "name": "tool_name",
      "description": "What it does",
      "params": [
        {"name": "param1", "type": "string", "nullable": false}
      ]
    }
  ]
}
```

#### 2. Dual Agent Execution Paths

**Direct Path** (`/api/agent/direct`):
- In-process execution via OpenAI Agents SDK
- Low latency, app-integrated
- Supports KB search injection and file previews
- Use for: Quick chat interactions, KB-augmented queries

**Workflow Path** (`/api/agent/workflow`, `/api/agent/chat`):
- Proxied execution through n8n webhooks
- Supports complex multi-step workflows
- Protected by IP allowlist + BASIC auth
- Use for: Complex orchestrations, multi-service workflows

**Key Distinction**: Direct path is hot/fast, workflow path is for complex/experimental flows.

#### 3. Knowledge Base (KB) System

**Architecture**: Minimal RAG (Retrieval-Augmented Generation) with dual embedding modes

**Index Structure**: `kb/index/embeddings.json`
- Pre-computed embeddings for all chunks
- Cosine similarity search at runtime
- Source tracking for citations

**Embedding Modes**:
- **OpenAI Mode** (production): Uses `text-embedding-3-small` API
- **Hash Mode** (dev/fallback): Local deterministic hashing, no API calls

**Build Process**:
1. `scripts/kb/build.mjs` scans `docs/` (configurable via `KB_SOURCES`)
2. Chunks text (1200 chars, 200 overlap)
3. Generates embeddings (OpenAI or hash)
4. Writes `embeddings.json`

**Search Flow**:
```
User query → /api/kb/search → Embed query → Cosine similarity → Top-K hits → Inject into agent context
```

**Delta Detection**: SHA256 hashing ensures only changed files are re-embedded (incremental builds).

#### 4. Protected Routes & Middleware

**Protected Paths** (in `src/middleware.ts`):
- `/agent/workflow`
- `/api/agent/workflow`
- `/api/agent/workflow-proxy`

**Protection Mechanisms**:
- **IP Allowlist**: `ADMIN_IP_ALLOWLIST` (comma-separated IPs)
- **BASIC Auth**: `ADMIN_BASIC_USERS="user1:pass1,user2:pass2"` (multi-user support)
- **Security Headers**: `X-Robots-Tag: noindex`, `Cache-Control: no-store`

**Enable Protection**: Set `ADMIN_ENABLE_PROTECTION=1`

**Key Pattern**: Middleware applies CORS, auth, and security headers globally. Protected paths have layered security (IP + BASIC fallback).

#### 5. Service Layer Pattern

**All business logic lives in `src/lib/`**, organized by domain:
- **Core**: `src/lib/core/index.ts` (central exports)
- **Scheduling**: `src/lib/scheduling/index.ts` (calendar, reminders)
- **Sessions**: `src/lib/sessions/index.ts` (state management)
- **Integrations**: `src/lib/integrations/index.ts` (LINE, GCal, Obsidian)
- **Features**: `src/lib/features/index.ts` (NLP, clarification, multi-intent)
- **NLP**: `src/lib/nlp/index.ts` (natural language processing)
- **Preferences**: `src/lib/preferences/index.ts` (user settings)
- **Chat**: `src/lib/chat/service.ts` (chat service layer)
- **Agent**: `src/lib/agent/` (agent configs and workflows)
- **KB**: `src/lib/kb/` (knowledge base embedding and search)

**API routes are thin controllers** - they handle HTTP concerns (validation, auth, serialization) and delegate to service layer.

#### 6. Vercel KV Patterns

**Key Patterns**:
- `session:<sessionId>` - Edit session state (TTL: 1 hour)
- `user:prefs:<userId>` - User preferences (persistent)
- `reminders:z` - Global reminder schedule (sorted set by timestamp)
- `pb:<postbackId>` - Postback payload stash (TTL: 10 min)
- `gcal:<groupId>:events` - Recent event references

**Functions**: `src/lib/kv.ts` provides typed wrappers for KV operations.

**Graceful Degradation**: All KV operations handle missing KV gracefully (checks via `kvAvailable()`).

---

## Important Conventions & Gotchas

### 1. Build Pipeline Dependencies

**Pre-build** (runs before `next build`):
```bash
pnpm agent:builder:validate
pnpm agent:builder:generate
```

**Post-build** (`scripts/postbuild.mjs`):
- Optionally reloads PM2 (`pm2 reload next-app --update-env`)
- Disabled with `POSTBUILD_PM2_RELOAD=0`

**Critical**: If you modify `src/lib/agent/configs/*.json`, you MUST run generate before building.

### 2. Environment Variables

**Security Invariants** (from `docs/requirements/README.md`):
- **Indexing Suppression**: Site-wide `X-Robots-Tag: noindex` + `robots.txt: Disallow: /`
- **No Mock in Production**: `KB_API_MOCK=1` fails on `NODE_ENV=production`
- **Token Secrecy**: Never expose `OPENAI_API_KEY`, `CHANNEL_ACCESS_TOKEN`, etc. to client
- **Server Proxy Required**: All AI calls go through server-side proxies

**Key Variables**:
- `OPENAI_API_KEY` - Required for embeddings and agent calls
- `ADMIN_ENABLE_PROTECTION` - Enable IP/BASIC auth (default: `0` in dev, `1` in prod)
- `NEXT_PUBLIC_HIDE_SPEC_OUTPUT` - Hide spec/ADR output in UI (default: `1`)
- `KB_SOURCES` - Comma-separated paths for KB ingestion (default: `docs`)
- `KB_EMBED_MODE` - `openai` or `hash` (default: `openai`)

**Vercel-Specific Variables** (required for Vercel deployment):
- `POSTBUILD_PM2_RELOAD=0` - **CRITICAL**: Disables PM2 reload in postbuild script (Vercel has no PM2)
  - Without this, the postbuild script attempts to reload PM2, which will fail on Vercel's serverless environment
  - Add via Vercel CLI: `echo "0" | vercel env add POSTBUILD_PM2_RELOAD production`
  - Must be set for all environments: production, preview, development

### 3. Port Management

**Standard Ports**:
- `3030` - Production PM2 (Next.js)
- `3000` - Development default
- `3001` - Recommended dev port (avoids PM2 conflicts)
- `4040` - KB API service (optional)
- `5050` - MCP server (optional)
- `5678` - n8n workflows (optional)

**PM2 Conflict**: If PM2 is running on 3030, use `pnpm dev -p 3001` for development.

### 4. Testing Philosophy

**Contract Tests** (`src/__tests__/contract/`):
- Validate API compatibility
- Run with `pnpm test:contract`
- Critical for backwards compatibility

**Unit Tests**:
- Co-located with source: `*.test.ts`
- Focus on business logic, not implementation
- Mock external dependencies (LINE API, Google Calendar, OpenAI)

### 5. Obsidian Integration

**External Dependency**: Requires Obsidian Local REST API plugin running

**Environment Setup**:
```bash
OBSIDIAN_API_URL=http://127.0.0.1:8443
OBSIDIAN_API_KEY=<from-plugin>
```

**Client**: `src/lib/obsidian.ts` provides typed API wrapper

**Ingestion**: `/api/obsidian/ingest` with delta detection (SHA256 hashes)

### 6. LINE Messaging API

**Webhook**: `/api/webhook` handles all LINE events

**Signature Verification**: HMAC-SHA256 validation via `x-line-signature` header

**Event Types**:
- Text messages → Intent detection → Action execution
- Postback messages → Callback handling (buttons, quick replies)
- Join/leave → Group management

**Key Pattern**: All LINE message text is length-limited (60 chars for buttons, 240 for confirm dialogs). Use `clampText()` helper in `src/lib/line.ts`.

### 7. TypeScript Strictness

**`tsconfig.json` is in strict mode**:
- All `any` types must be justified with `@typescript-eslint/no-explicit-any` suppression
- Null safety enforced
- No implicit returns

**Path Aliases**: `@/*` → `src/*`

### 8. Chat UI Display Flags

**Environment Variables**:
- `NEXT_PUBLIC_SHOW_KB_REFS=1` - Show KB citations in chat UI
- `NEXT_PUBLIC_HIDE_SPEC_OUTPUT=1` - Hide spec/ADR outputs from chat display

**Default**: KB refs hidden, spec output hidden

---

## Documentation Map

**Requirements** (`docs/requirements/`):
- `README.md` - Requirements index with invariants
- `dev-environment.md` - Local dev setup, ports, PM2, KB
- `chat.md` - Chat feature requirements
- `kb.md` - Knowledge base requirements
- `hot-path-optimization.md` - Direct agent path (low-latency)
- `tasks.md` - Task definition and workflow conventions
- `services.md` - Service architecture (PM2, Docker, ports)

**Operations** (`docs/operations/`):
- `deploy-and-smoke.md` - Deployment and verification guide
- `line-ai-menu.md` - LINE AI menu admin operations
- `kb-setup.md` - Knowledge base setup guide

**Decisions** (`docs/decisions/`):
- `ADR-*.md` - Architectural decision records

**Security**:
- `SECURITY-KEYS-ROTATION.md` - Key rotation procedures
- `docs/security/trusted-builds.md` - Dependency build security

---

## Critical Security Notes

1. **No Client-Side Secrets**: All API keys, tokens, and credentials MUST remain server-side
2. **Protected Routes**: `/agent/workflow` paths are IP-restricted in production
3. **Mock Modes**: Only available in development (`NODE_ENV=development`)
4. **CORS**: Strict origin checking via `ALLOWED_ORIGINS`
5. **Signature Verification**: LINE webhooks validate signatures before processing
6. **Noindex Enforcement**: All pages have `X-Robots-Tag: noindex` (site-wide policy)

---

## Common Workflows

### Adding a New Agent Tool
1. Edit `src/lib/agent/configs/{name}.json`
2. Add tool definition with name, description, params
3. Run `pnpm agent:builder:generate`
4. Implement tool logic in `src/lib/agent/agent.generated.ts` (replace TODO)
5. Run `pnpm agent:builder:smoke` to verify
6. Run `pnpm build` to validate full integration

### Adding KB Sources
1. Update `KB_SOURCES` env var (e.g., `KB_SOURCES="docs,/path/to/obsidian/vault"`)
2. Run `pnpm kb:build`
3. Verify `kb/index/embeddings.json` was updated
4. Test search: `curl "http://localhost:3000/api/kb/search?q=test&topK=3"`

### Modifying Protected Routes
1. Update `src/middleware.ts` for path matching
2. Update IP allowlist: `pnpm ops:allowlist:add <ip>` (writes to `services/.env`)
3. Reload PM2: `npx pm2 reload next-app --update-env`
4. Verify protection: `curl -v http://localhost:3030/agent/workflow` (should 401)

### Running a Single Test File
```bash
# Run specific test file
jest src/lib/__tests__/smart-reminder-engine.test.ts

# Run tests matching pattern
jest -t "should calculate optimal time"

# Run in watch mode for specific file
jest --watch src/lib/__tests__/enhanced-nlp.test.ts
```

---

## Architecture Quick Reference

**Request Flow (Chat)**:
```
User → /agent/workflow (UI) → /api/agent/workflow-proxy (server) → OpenAI Agents SDK → Response
                                         ↓ (optional)
                                   /api/kb/search (KB augmentation)
```

**Request Flow (LINE)**:
```
LINE Webhook → /api/webhook → Intent Detection → Action (create/edit/delete schedule)
                                                    ↓
                                              Google Calendar API
                                                    ↓
                                              LINE Reply Message
```

**KB Build Flow**:
```
docs/ or Obsidian vault → scripts/kb/build.mjs → Chunk → Embed → embeddings.json
```

**Agent Builder Flow**:
```
src/lib/agent/configs/{name}.json → validate.mjs → generate.mjs → agent.generated.ts
```

---

## Key Files to Understand

1. **`src/middleware.ts`** - Request middleware (auth, CORS, security headers)
2. **`src/lib/agent/agent.generated.ts`** - Auto-generated agent (DO NOT EDIT)
3. **`src/lib/agent/workflows/text-workflow.ts`** - Agent execution workflow
4. **`src/lib/kb/index.ts`** - KB index loading and search
5. **`src/pages/api/webhook.ts`** - LINE webhook handler (main integration point)
6. **`services/ecosystem.config.cjs`** - PM2 configuration
7. **`next.config.js`** - Next.js config (headers, CORS, images)
8. **`docs/requirements/README.md`** - Requirements invariants

---

## Development Tips

1. **Always run `pnpm typecheck` before committing** - Strict TypeScript catches errors early
2. **Use `pnpm ci` for full validation** - Runs lint + typecheck + test + build
3. **Check `pm2 logs` when debugging PM2 issues** - Logs show runtime errors
4. **Use `pnpm dev -p 3001` to avoid port conflicts** - PM2 runs on 3030
5. **Regenerate agent after config changes** - Run `pnpm agent:builder:generate`
6. **Test KB changes with smoke tests** - Use `pnpm kb:smoke:next`
7. **Verify protected routes with curl** - Check auth before deploying

---

**Last Updated**: November 9, 2025
