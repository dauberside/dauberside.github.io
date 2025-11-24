<!-- AUTO-GENERATED: Do not edit between markers -->
<!-- BEGIN:RECENT-PLANS -->

## 002-another-feature

> # Implementation Plan: another-feature
>
> **Branch**: `002-another-feature` | **Date**: 2025-09-12 | **Spec**: [link]
> **Input**: Feature specification from `/specs/002-another-feature/spec.md`
>
> ## Execution Flow (/plan command scope)
>
> 1. Load feature spec from Input path → If not found: ERROR "No feature spec at {path}"
> 2. Fill Technical Context (scan for NEEDS CLARIFICATION)
>    - Detect Project Type from context (web=frontend+backend, mobile=app+api)
>    - Set Structure Decision based on project type
> 3. Evaluate Constitution Check below
>    - If violations: document in Complexity Tracking; if unjustified: ERROR
>    - Update Progress Tracking: Initial Constitution Check
> 4. Execute Phase 0 → research.md; if NEEDS CLARIFICATION remain: ERROR
> 5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific file
> 6. Re-evaluate Constitution Check; refactor if violations appear
> 7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
> 8. STOP - Ready for /tasks command
>
> IMPORTANT: /plan stops at step 7; /tasks creates tasks.md
>
> ## Summary
>
> [Primary requirement + technical approach]
>
> ## Technical Context
>
> - Language/Version: [e.g., TypeScript 5.x]
> - Primary Dependencies: [e.g., Next.js, Tailwind]
> - Storage: [e.g., KV, Postgres, N/A]
> - Testing: [e.g., Jest]
> - Target Platform: [e.g., Vercel]
> - Project Type: [single/web/mobile]
> - Performance Goals: [domain specific]
> - Constraints: [domain specific]
> - Scale/Scope: [domain specific]
>
> ## Constitution Check

## 001-sample-feature

> # Implementation Plan: sample-feature
>
> **Branch**: `001-sample-feature` | **Date**: 2025-09-12 | **Spec**: [link]
> **Input**: Feature specification from `/specs/001-sample-feature/spec.md`
>
> ## Execution Flow (/plan command scope)
>
> 1. Load feature spec from Input path → If not found: ERROR "No feature spec at {path}"
> 2. Fill Technical Context (scan for NEEDS CLARIFICATION)
>    - Detect Project Type from context (web=frontend+backend, mobile=app+api)
>    - Set Structure Decision based on project type
> 3. Evaluate Constitution Check below
>    - If violations: document in Complexity Tracking; if unjustified: ERROR
>    - Update Progress Tracking: Initial Constitution Check
> 4. Execute Phase 0 → research.md; if NEEDS CLARIFICATION remain: ERROR
> 5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific file
> 6. Re-evaluate Constitution Check; refactor if violations appear
> 7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
> 8. STOP - Ready for /tasks command
>
> IMPORTANT: /plan stops at step 7; /tasks creates tasks.md
>
> ## Summary
>
> [Primary requirement + technical approach]
>
> ## Technical Context
>
> - Language/Version: [e.g., TypeScript 5.x]
> - Primary Dependencies: [e.g., Next.js, Tailwind]
> - Storage: [e.g., KV, Postgres, N/A]
> - Testing: [e.g., Jest]
> - Target Platform: [e.g., Vercel]
> - Project Type: [single/web/mobile]
> - Performance Goals: [domain specific]
> - Constraints: [domain specific]
> - Scale/Scope: [domain specific]
>
> ## Constitution Check

<!-- END:RECENT-PLANS -->

# Copilot Instructions – MCP & Secrets

## MCP config (.mcp.json / .mcp.json.example)
- NEVER hardcode secrets or tokens.
- ALWAYS use environment variables like `${MCP_OBSIDIAN_API_KEY}`, `${MCP_GITHUB_TOKEN}`, `${MCP_N8N_API_KEY}`.
- When adding a new MCP server:
	- Limit `allowedTools` to 5 or fewer.
	- Add `metadata.priority`, `metadata.autoStart`, and a short `metadata.description`/`tokenUsage` note.
	- Default host for desktop/Docker is `host.docker.internal` instead of `localhost`.

## Env files
- `.env.mcp` and `.env.mcp.local` stay untracked; only `.env.mcp.example` belongs in git.
- All new environment variables should follow the existing `MCP_*` naming pattern and be documented in `.env.mcp.example`.

## Security & context hygiene
- `.mcp.json` must remain free of inline secrets and keep token usage lean.
- Prefer `autoStart: true` only for essential servers (obsidian/github); keep automation servers (n8n, slack, etc.) on lazy load with `autoStart: false`.
- Do not add extra tools unless explicitly required—lean `allowedTools` keeps context usage low.
