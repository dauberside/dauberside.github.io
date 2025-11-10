# Tasks for [FEATURE]

**Branch**: `[type]/[feature-slug]` | **Date**: [YYYY-MM-DD]
**Related**: [Link to spec.md, plan.md, ADR, or requirements doc]

---

## Overview

**Feature Goal**: [1-line summary of what this feature achieves]

**Implementation Strategy**: [Brief description of technical approach]

---

## Task List

Note: Tasks follow TDD workflow. Mark independent tasks with **[P]** for parallel execution.

### Task 1: [Task Name] **[P]** `[Size: S/M/L]`

**Goal**: [1-line description of what this task achieves]

**Deliverables**:
- [ ] File/directory to create or modify
- [ ] File/directory to create or modify
- [ ] (Add specific paths when known)

**Acceptance Criteria**:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit tests added/updated)
- [ ] `pnpm build` succeeds
- [ ] [Additional domain-specific criteria]

**Constraints/Dependencies**:
- Depends on: [Task #N or external dependency]
- Environment: [Required env vars, ports, services]
- Technical: [API limits, browser support, etc.]

**Risk/Rollback**:
- **Risk**: [Potential failure scenario]
- **Rollback**: [How to revert if this fails]

**Size Estimate**: [S (< 4hrs) | M (< 1 day) | L (1-3 days)]

---

### Task 2: [Task Name] **[P]** `[Size: S/M/L]`

**Goal**: [1-line description]

**Deliverables**:
- [ ] `src/pages/api/[endpoint].ts` - Create API endpoint
- [ ] `src/lib/[service].ts` - Implement service layer
- [ ] `src/__tests__/[service].test.ts` - Add unit tests

**Acceptance Criteria**:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes with new tests
- [ ] `pnpm build` succeeds
- [ ] API returns expected JSON schema
- [ ] Error cases return proper 4xx/5xx codes

**Constraints/Dependencies**:
- Depends on: Task 1 (data model)
- Environment: `OPENAI_API_KEY` required
- Technical: Max request size 16KB

**Risk/Rollback**:
- **Risk**: OpenAI API timeout may cause 500 errors
- **Rollback**: Remove API route, revert service layer changes

**Size Estimate**: M

---

### Task 3: [Task Name] `[Size: S/M/L]`

**Goal**: [1-line description]

**Deliverables**:
- [ ] `src/components/[Component].tsx` - Create UI component
- [ ] `src/components/[Component].test.tsx` - Add component tests
- [ ] Update `src/pages/[page].tsx` to use component

**Acceptance Criteria**:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (component tests added)
- [ ] `pnpm build` succeeds
- [ ] Component renders correctly on desktop/mobile
- [ ] Accessibility: keyboard navigation works
- [ ] No console errors/warnings

**Constraints/Dependencies**:
- Depends on: Task 2 (API endpoint)
- Browser: Chrome/Safari/Firefox latest
- Design: Must use existing `globals.css` styles

**Risk/Rollback**:
- **Risk**: Layout may break on mobile viewports
- **Rollback**: Remove component, restore previous page version

**Size Estimate**: S

---

### Task 4: Add Tests and Documentation `[Size: S]`

**Goal**: Ensure quality gates pass and documentation is updated

**Deliverables**:
- [ ] Contract tests in `src/__tests__/contract/[feature].test.js`
- [ ] Update `docs/requirements/[related].md` with new API/features
- [ ] Update `README.md` if user-facing changes
- [ ] Add JSDoc comments to public APIs

**Acceptance Criteria**:
- [ ] `pnpm test:contract` passes
- [ ] `pnpm ci` (full validation) passes
- [ ] Documentation accurately reflects implementation
- [ ] Code review checklist completed

**Constraints/Dependencies**:
- Depends on: Tasks 1-3 (all implementation complete)

**Risk/Rollback**:
- **Risk**: Documentation may become stale
- **Rollback**: N/A (documentation-only)

**Size Estimate**: S

---

### Task 5: Security & Performance Review `[Size: S]`

**Goal**: Verify security invariants and performance targets

**Deliverables**:
- [ ] Security checklist completed (no client-side secrets, CORS correct, etc.)
- [ ] Protected routes have `X-Robots-Tag: noindex` + `Cache-Control: no-store`
- [ ] Performance smoke test (P95 latency < 3s for critical paths)
- [ ] Rate limiting verified (if applicable)

**Acceptance Criteria**:
- [ ] No API keys/tokens exposed to client (verified in Network tab)
- [ ] Protected paths return 401 without auth
- [ ] CORS headers only allow `ALLOWED_ORIGINS`
- [ ] Response times meet SLA

**Constraints/Dependencies**:
- Depends on: Task 4 (all code complete)
- Tools: Browser DevTools, `curl`, `pm2 logs`

**Risk/Rollback**:
- **Risk**: Security gaps may require refactoring
- **Rollback**: Block deployment until fixed

**Size Estimate**: S

---

### Task 6: Deployment & Smoke Test `[Size: S]`

**Goal**: Deploy to staging/production and verify end-to-end

**Deliverables**:
- [ ] Deploy to staging environment
- [ ] Run smoke tests (critical user flows)
- [ ] Verify PM2 restart (if applicable): `pm2 reload next-app --update-env`
- [ ] Monitor logs for errors: `pm2 logs next-app --lines 200`

**Acceptance Criteria**:
- [ ] Staging deployment succeeds
- [ ] Smoke tests pass (HTTP 200 for key endpoints)
- [ ] No errors in PM2/server logs
- [ ] Rollback plan documented and tested

**Constraints/Dependencies**:
- Depends on: Task 5 (security/performance validated)
- Environment: Staging must match production config

**Risk/Rollback**:
- **Risk**: Production deployment may fail due to env vars
- **Rollback**: Revert git commit, redeploy previous version via Vercel dashboard

**Size Estimate**: S

---

## Quality Gates Checklist

Before marking tasks as complete, ensure:

- [ ] **Typecheck**: `pnpm typecheck` passes (no TypeScript errors)
- [ ] **Lint**: `pnpm lint` passes (ESLint rules satisfied)
- [ ] **Test**: `pnpm test` passes (all unit/integration tests)
- [ ] **Build**: `pnpm build` succeeds (no build errors)
- [ ] **Smoke**: Key endpoints/pages return 200
- [ ] **Security**: No secrets exposed, auth/CORS configured
- [ ] **Documentation**: Requirements/README/comments updated
- [ ] **Rollback Plan**: Documented and validated

---

## Implementation Notes

**Common Patterns**:
- Service layer in `src/lib/`: all business logic
- API routes in `src/pages/api/`: thin controllers
- Tests co-located: `*.test.ts` / `*.test.tsx`
- Use Zod for input validation
- Mock external APIs in tests

**Agent Builder** (if adding agent tools):
1. Edit `src/lib/agent/configs/{name}.json`
2. Run `pnpm agent:builder:generate`
3. Implement tool logic in `agent.generated.ts`
4. Run `pnpm agent:builder:smoke`

**Knowledge Base** (if adding KB sources):
1. Update `KB_SOURCES` env var
2. Run `pnpm kb:build`
3. Test search: `curl "http://localhost:3000/api/kb/search?q=test"`

**Protected Routes** (if adding admin features):
1. Update `src/middleware.ts` path matching
2. Add IP to allowlist: `pnpm ops:allowlist:add <ip>`
3. Reload PM2: `npx pm2 reload next-app --update-env`

---

## Definition of Done (DoD)

A task is complete when:

1. ✅ All deliverables created/modified
2. ✅ All acceptance criteria met
3. ✅ Quality gates pass (typecheck/lint/test/build)
4. ✅ Documentation updated
5. ✅ Code reviewed (if applicable)
6. ✅ Security/performance validated
7. ✅ Deployed and smoke tested

---

**Template Version**: 1.1
**Based on**: `docs/requirements/tasks.md` (最終更新: 2025-10-25)
