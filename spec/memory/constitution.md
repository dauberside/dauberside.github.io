# Project Constitution v2.1.1

This document defines the non-negotiable engineering principles used by this repo. It is referenced by the Spec Kit and governs plans, tasks, and implementation.

## 1. Simplicity First

- Max 3 projects per repo (e.g., app/api/tests). Justify any extra in Complexity Tracking.
- Prefer framework primitives over custom wrappers. Avoid patterns (Repository, UoW) unless demonstrably needed.
- One data model; DTOs only when transport differs.

## 2. Testing (Non-Negotiable)

- Enforce RED → GREEN → REFACTOR. Commit history should show failing tests before implementation.
- Test order: Contract → Integration → E2E → Unit.
- Use real dependencies for integration (actual DB/services) whenever feasible.
- New libraries, contract changes, and shared schemas REQUIRE integration tests.
- Prohibited: skipping RED, implementing before tests.

## 3. Observability

- Structured logs with request correlation where applicable.
- Frontend logs should flow to backend or unified sink when possible.
- Include actionable error context and metrics hooks for rate limit and size-limit events.

## 4. Performance & Constraints

- Declare performance goals and constraints in plans. Validate via quickstart or tests when critical.
- Keep p95 latency and memory budgets explicit where user-facing.

## 5. Versioning & Change Management

- Maintain a MAJOR.MINOR.BUILD version. Increment BUILD on every merged change that affects behavior or public docs.
- Breaking changes require parallel tests and a migration note.

## 6. Documentation

- Each feature must include spec, plan, research, data-model, quickstart, and tasks.
- Keep docs concise and executable (commands, scripts). Prefer repository-root quickstart parity.

## 7. Plans & Tasks

- /plan stops at Phase 2 description; /tasks generates tasks.md.
- Plans must include Constitution checks and document deviations in Complexity Tracking.

## Appendix

- Update checklist: see `spec/memory/constitution_update_checklist.md` for release steps.
- Operational constraints: see README (e.g., body size 16KB, message 140 chars).
