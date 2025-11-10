# Implementation Plan: [FEATURE]

**Branch**: `[type]/[feature-slug]` | **Date**: [YYYY-MM-DD] | **Spec**: [Link to spec.md]
**Input**: Feature specification from `[path/to/spec.md]`
**Status**: [Planning | In Progress | Completed]

---

## Summary

[1-2 sentence summary of primary requirement + technical approach]

**Problem**: [Brief problem statement]
**Solution**: [High-level solution approach]
**Impact**: [Expected outcome/benefit]

---

## Execution Flow

This plan follows a phased approach optimized for TDD and incremental delivery:

1. **Phase 0: Research & Design** → Clarify unknowns, document findings
2. **Phase 1: Contracts & Foundation** → Define API contracts, data models, write failing tests
3. **Phase 2: Implementation** → Build services to pass tests, add UI
4. **Phase 3: Validation** → Security, performance, documentation
5. **Phase 4: Deployment** → Staging → Production with smoke tests

**Important**: This plan (created via `/plan`) stops at Phase 2 planning. Tasks are generated separately via `/tasks` command or by copying `templates/tasks-template.md`.

---

## Technical Context

**Language/Version**: TypeScript 5.8, Node.js 22.x
**Primary Framework**: Next.js 14 (pages router)
**Primary Dependencies**: [e.g., @openai/agents, zod, @vercel/kv]
**Storage**: [e.g., Vercel KV, JSON index, N/A]
**Testing**: Jest (unit/integration), contract tests
**Target Platform**: Vercel (serverless) / PM2 (self-hosted)

**Project Type**: [single | web (frontend+backend) | mobile (app+api)]

**Performance Goals**:
- P95 latency: [< X seconds]
- Throughput: [Y req/sec]
- Memory: [< Z MB]

**Constraints**:
- [Technical constraint 1]
- [Technical constraint 2]
- [Regulatory/compliance constraint]

**Scale/Scope**:
- Users: [Expected concurrent users]
- Data: [Expected data volume]
- Duration: [Development timeline: S/M/L weeks]

---

## Constitution Check

Reference: `docs/requirements/README.md` (不変条件) and `docs/requirements/tasks.md`

### Simplicity
- [ ] Feature adds minimal complexity (prefer composition over abstraction)
- [ ] No premature optimization (profile before optimizing)
- [ ] Dependencies justified (no unnecessary packages)

### Architecture
- [ ] Follows service layer pattern (`src/lib/` for business logic)
- [ ] API routes are thin controllers
- [ ] Respects middleware boundaries (auth, CORS, security headers)
- [ ] Adheres to security invariants (noindex, no client secrets, server proxy)

### Testing
- [ ] Contract tests defined for all public APIs
- [ ] Unit tests for business logic
- [ ] Integration tests for critical flows
- [ ] Smoke tests for deployment verification

### Observability
- [ ] Structured logging with correlation IDs
- [ ] Metrics for latency, errors, throughput
- [ ] Clear error messages with actionable guidance

### Versioning
- [ ] Breaking changes documented
- [ ] Backward compatibility maintained (or migration plan exists)
- [ ] API versioning if needed

**Violations**: [Document any justified exceptions]

---

## Project Structure

```
spec/specs/[###-feature]/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (unknowns, decisions, alternatives)
├── data-model.md        # Phase 1 output (entities, validation, relationships)
├── quickstart.md        # Phase 1 output (how to run tests and smoke)
├── contracts/           # Phase 1 output (OpenAPI schemas, Zod schemas)
│   └── *.openapi.yml
└── tasks.md             # Phase 2 output (generated via /tasks or template)

[repo-root]/
├── src/lib/[feature]/   # Service layer implementation
├── src/pages/api/[feature]/ # API routes
├── src/components/[Feature]/ # UI components (if applicable)
└── src/__tests__/contract/  # Contract tests
```

---

## Phase 0: Outline & Research

**Goal**: Clarify unknowns, validate assumptions, document key decisions

### Unknowns / Questions
1. [Unknown 1]: [What we need to find out]
   - **Research Task**: [How we'll investigate]
   - **Decision Criteria**: [What factors matter]

2. [Unknown 2]: [What we need to find out]
   - **Research Task**: [How we'll investigate]
   - **Decision Criteria**: [What factors matter]

### Research Tasks
- [ ] Investigate [technology/approach A]
- [ ] Prototype [proof of concept B]
- [ ] Review [existing implementation C]
- [ ] Benchmark [performance of approach D]

### Output: `research.md`
Document findings in structured format:
- **Decision**: [What we decided]
- **Rationale**: [Why we decided it]
- **Alternatives Considered**: [What else we looked at]
- **Tradeoffs**: [Pros/cons of chosen approach]

**Phase 0 Complete When**:
- [ ] All NEEDS CLARIFICATION items resolved
- [ ] research.md written with decisions and rationale
- [ ] No blocking unknowns remain

---

## Phase 1: Design & Contracts

**Goal**: Define contracts, data models, and write failing tests (TDD)

### Step 1.1: Extract Entities
Based on spec.md, identify core entities:

**Entity 1: [EntityName]**
```typescript
interface EntityName {
  id: string;
  field1: string;
  field2: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

**Validation Rules**:
- `field1`: min 1 char, max 100 chars
- `field2`: integer, range 0-999

**Relationships**:
- Has many: [RelatedEntity]
- Belongs to: [ParentEntity]

### Step 1.2: Generate API Contracts
Based on entities and user stories, define API contracts:

**Contract 1: POST /api/[feature]/[action]**
- **Request Schema**: (Zod)
  ```typescript
  const RequestSchema = z.object({
    field1: z.string().min(1).max(100),
    field2: z.number().int().min(0).max(999)
  });
  ```
- **Response Schema**: (Zod)
  ```typescript
  const ResponseSchema = z.object({
    ok: z.boolean(),
    data: EntityNameSchema.optional(),
    error: z.string().optional()
  });
  ```
- **Error Codes**: 400 (validation), 401 (auth), 429 (rate limit), 500 (internal)

**Output**: `contracts/*.openapi.yml` (OpenAPI 3.0 spec)

### Step 1.3: Write Failing Contract Tests
```typescript
// src/__tests__/contract/[feature].test.js
describe('POST /api/[feature]/[action]', () => {
  it('returns 200 with valid input', async () => {
    const response = await fetch('/api/[feature]/[action]', {
      method: 'POST',
      body: JSON.stringify({ field1: 'test', field2: 42 })
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('returns 400 with invalid input', async () => {
    const response = await fetch('/api/[feature]/[action]', {
      method: 'POST',
      body: JSON.stringify({ field1: '', field2: -1 })
    });
    expect(response.status).toBe(400);
  });
});
```

### Step 1.4: Extract Test Scenarios
From user stories and acceptance criteria:
- [ ] Happy path: [Scenario description]
- [ ] Error case 1: [Invalid input]
- [ ] Error case 2: [Auth failure]
- [ ] Edge case: [Boundary condition]

### Output: Phase 1 Deliverables
- [ ] `data-model.md` - Entity definitions, validation, relationships
- [ ] `quickstart.md` - How to run tests, how to smoke test feature
- [ ] `contracts/` - OpenAPI schemas
- [ ] Contract tests (failing) in `src/__tests__/contract/`

**Phase 1 Complete When**:
- [ ] All entities documented
- [ ] All API contracts defined (OpenAPI + Zod)
- [ ] Contract tests written (currently failing)
- [ ] Constitution check passed (no unjustified violations)

---

## Phase 2: Task Planning Approach

**Goal**: Break down implementation into concrete, parallelizable tasks

### Task Generation Strategy
1. Load `/templates/tasks-template.md`
2. Generate tasks based on Phase 1 deliverables (contracts, data model)
3. Order by dependency (TDD: tests → implementation → UI)
4. Mark independent tasks with **[P]** for parallel execution
5. Assign size estimates (S/M/L)

### Task Categories
1. **Foundation** (can run in parallel)
   - Create data models and validators
   - Write contract tests
   - Setup quickstart documentation

2. **Service Layer** (depends on foundation)
   - Implement services to satisfy contract tests
   - Add business logic
   - Add error handling

3. **API Layer** (depends on service layer)
   - Create API endpoints
   - Wire up middleware (auth, validation, error handling)
   - Add integration tests

4. **UI Layer** (depends on API layer, if applicable)
   - Create UI components
   - Add accessibility features
   - Add UI tests

5. **Validation** (depends on all implementation)
   - Security review
   - Performance testing
   - Documentation updates

6. **Deployment** (final phase)
   - Staging deployment
   - Smoke tests
   - Production rollout

### Example Task Outline
```markdown
1. [P] Create data model and Zod schemas (S)
2. [P] Write contract tests for API endpoints (S)
3. [P] Setup quickstart.md with test commands (XS)
4. Implement service layer to pass contract tests (M)
5. Create API routes and wire up services (M)
6. Add UI components (if applicable) (L)
7. Security and performance review (S)
8. Update documentation (S)
9. Deploy to staging and run smoke tests (S)
```

**DO NOT create tasks.md here** - This will be done separately via `/tasks` command or by copying and filling `templates/tasks-template.md`.

---

## Progress Tracking

**Phase 0: Research**
- [ ] Unknowns identified
- [ ] Research completed
- [ ] Decisions documented in research.md

**Phase 1: Design & Contracts**
- [ ] Entities extracted and documented
- [ ] API contracts defined (OpenAPI + Zod)
- [ ] Contract tests written (failing)
- [ ] data-model.md complete
- [ ] quickstart.md complete
- [ ] Constitution check passed

**Phase 2: Task Planning**
- [ ] Task generation approach defined
- [ ] Tasks prioritized and sized
- [ ] Dependencies identified
- [ ] Ready for tasks.md creation

**Phase 3-4: Implementation & Deployment**
- [ ] (Tracked in tasks.md once created)

---

## Dependencies & Risks

### Internal Dependencies
- [System/Service A]: [Why we need it, how we'll integrate]
- [Library/Package B]: [Version, what we use it for]

### External Dependencies
- [Third-party API]: [SLA, fallback plan if unavailable]
- [External service]: [Required for feature, mitigation if down]

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | [L/M/H] | [L/M/H/Critical] | [How we'll mitigate] |
| [Risk 2] | [L/M/H] | [L/M/H/Critical] | [How we'll mitigate] |

---

## Success Criteria

**Technical Success**:
- [ ] All contract tests pass
- [ ] `pnpm ci` (lint + typecheck + test + build) passes
- [ ] Performance targets met (P95 < X seconds)
- [ ] Security review passed (no secrets exposed, auth works)

**User Success**:
- [ ] User stories satisfied (acceptance criteria met)
- [ ] Smoke tests pass in staging and production
- [ ] Documentation complete and accurate

**Operational Success**:
- [ ] Monitoring/alerting configured
- [ ] Rollback plan tested
- [ ] Team trained on new feature

---

## Next Steps

1. **Complete Phase 0**: Fill in research.md with unknowns, decisions, alternatives
2. **Complete Phase 1**: Create data-model.md, contracts/, quickstart.md, write contract tests
3. **Re-evaluate Constitution**: Check for complexity violations, refactor if needed
4. **Generate Tasks**: Use `/tasks` command or copy `templates/tasks-template.md` and fill in specific tasks based on Phase 1 deliverables
5. **Begin Implementation**: Start with parallel foundation tasks, then proceed through service/API/UI layers

---

## References

**Requirements**:
- Feature spec: [Link to spec.md]
- Requirements doc: `docs/requirements/[feature].md`
- Tasks doc (after creation): `spec/specs/[###-feature]/tasks.md`

**Templates**:
- Tasks template: `/templates/tasks-template.md`
- Spec template: `/templates/spec-template.md`

**Standards**:
- Constitution: `docs/requirements/README.md` (不変条件)
- Task requirements: `docs/requirements/tasks.md`
- Dev environment: `docs/requirements/dev-environment.md`

---

**Plan Version**: 1.1
**Based on**: Constitution v2.1.1, `docs/requirements/tasks.md`, `docs/requirements/README.md`
**Last Updated**: [YYYY-MM-DD]
