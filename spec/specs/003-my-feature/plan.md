# Implementation Plan: my-feature

**Branch**: `003-my-feature` | **Date**: 2025-09-12 | **Spec**: ./spec.md
**Input**: Feature specification from `./spec.md`

## Execution Flow (/plan command scope)

1. Load feature spec from Input path → If not found: ERROR "No feature spec at
   {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   - Detect Project Type from context (web=frontend+backend, mobile=app+api)
   - Set Structure Decision based on project type
3. Evaluate Constitution Check below
   - If violations: document in Complexity Tracking; if unjustified: ERROR
   - Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md; if NEEDS CLARIFICATION remain: ERROR
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific
   file
6. Re-evaluate Constitution Check; refactor if violations appear
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command

IMPORTANT: /plan stops at step 7; /tasks creates tasks.md

## Summary

Self-serve calendar booking: show real-time available slots on-site and let
visitors confirm in two clicks. Integrate with Google Calendar for slot sourcing
and event creation; reuse existing Next.js pages and gcal utility.

## Technical Context

- Language/Version: TypeScript 5.8.x, Node 22
- Primary Dependencies: Next.js 14 (pages), Tailwind, Radix/shadcn, googleapis,
  nodemailer, @vercel/kv
- Storage: Vercel KV（rate-limit 用。予約データはGCalを単一正とする）
- Testing: Jest + Testing Library（契約/統合優先）
- Target Platform: Vercel
- Project Type: single (web app: pages/api + frontend)
- Performance Goals: p95 API < 400ms（Get slots/Book）
- Constraints: Body 16KB / message 140 文字制限（既存仕様）、A11y
  準拠、レート制限 1 IP/分
- Scale/Scope: 初期はカレンダー1つ、スロット粒度は15/30分で検証

## Constitution Check

- Simplicity: 単一プロジェクト構成を維持。予約の正は GCal に集約（DB追加しない）
- Architecture: 既存 pages/api に `/api/slots` と `/api/book`
  を追加。lib/gcal.ts を再利用
- Testing: まず契約テスト→統合テスト。RED→GREEN→REFACTOR を遵守
- Observability:
  既存のログ/インシデント記録（413/415/429）スタイル踏襲。失敗時の構造化ログを追加
- Versioning: 破壊的変更なし。BUILD を変更時に上げる

## Project Structure

Documentation under `specs/[###-feature]/` with
plan/research/data-model/quickstart/contracts. Source under repo root as single
project by default.

## Phase 0: Outline & Research

Describe unknowns → research tasks → consolidate findings in research.md
(Decision/Rationale/Alternatives).

## Phase 1: Design & Contracts

Extract entities → data-model.md. Generate API contracts → /contracts. Generate
contract tests (failing). Extract test scenarios. Update agent file.

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
