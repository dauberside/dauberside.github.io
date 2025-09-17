# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: ./spec.md
**Input**: Feature specification from `./spec.md`

## Execution Flow (/plan command scope)

1. Load feature spec from Input path → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   - Detect Project Type from context (web=frontend+backend, mobile=app+api)
   - Set Structure Decision based on project type
3. Evaluate Constitution Check below
   - If violations: document in Complexity Tracking; if unjustified: ERROR
   - Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md; if NEEDS CLARIFICATION remain: ERROR
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific file
6. Re-evaluate Constitution Check; refactor if violations appear
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command

IMPORTANT: /plan stops at step 7; /tasks creates tasks.md

## Summary

[Primary requirement + technical approach]

## Technical Context

- Language/Version: [e.g., TypeScript 5.x]
- Primary Dependencies: [e.g., Next.js, Tailwind]
- Storage: [e.g., KV, Postgres, N/A]
- Testing: [e.g., Jest]
- Target Platform: [e.g., Vercel]
- Project Type: [single/web/mobile]
- Performance Goals: [domain specific]
- Constraints: [domain specific]
- Scale/Scope: [domain specific]

## Constitution Check

Simplicity / Architecture / Testing / Observability / Versioning checkpoints. See repo constitution.

## Project Structure

Documentation under `specs/[###-feature]/` with plan/research/data-model/quickstart/contracts. Source under repo root as single project by default.

## Phase 0: Outline & Research

Describe unknowns → research tasks → consolidate findings in research.md (Decision/Rationale/Alternatives).

## Phase 1: Design & Contracts

Extract entities → data-model.md. Generate API contracts → /contracts. Generate contract tests (failing). Extract test scenarios. Update agent file.

## Phase 2: Task Planning Approach

- Load `/templates/tasks-template.md`
- Generate tasks from Phase 1 docs
- Order by TDD and dependency; mark [P] for parallel
- Do NOT create tasks.md here

## Progress Tracking

- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 planned
- [ ] Tasks generated
- [ ] Implementation complete
- [ ] Validation passed

Based on Constitution v2.1.1 - See `/spec/memory/constitution.md`
