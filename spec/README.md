# SpecKit usage

This repository includes a lightweight SpecKit.

- Source of truth lives under `spec/specs/*` (plan, research, spec, tasks)
- Contracts under `spec/specs/*/contracts/*.openapi.yml`
- Scripts under `spec/scripts/*`

## Local commands

- `pnpm spec:validate` — validate spec templates presence
- `pnpm spec:openapi:lint` — lint booking OpenAPI
- `pnpm spec:openapi:types` — generate TS types at
  `src/types/generated/booking-api.ts`
- `pnpm test:contract` — run only contract tests

Run CI pipeline locally:

```zsh
pnpm -s format:check && pnpm -s lint && pnpm -s typecheck && pnpm -s test && pnpm -s build
```

## CI

- `.github/workflows/ci.yml` runs quality and spec validator on PRs
- `.github/workflows/spec-templates.yml` keeps templates in sync and validates

# spec/ — Spec Kit templates and scripts

Purpose: contain Spec Kit templates, helper scripts, and minimal operational
docs so teams can author feature specs, plans, and tasks without needing the
external `uvx` CLI to be available.

Quick commands

- Validate required templates exist:
  - `spec/scripts/validate-spec.sh`

- Check prerequisites for task generation (example):
  - `bash spec/scripts/check-task-prerequisites.sh --json`

If you removed or merged duplicate Spec Kit files, run the validator above
before opening PRs. If templates are missing, restore them from your upstream or
recreate using `spec/spec/templates/*.md` as a reference.

Workflow (minimal)

1. Create a feature branch named like `001-feature-short-name`.
2. Add `specs/<branch>/spec.md` describing the feature.
3. Copy `spec/spec/templates/plan-template.md` to `specs/<branch>/plan.md` and
   fill Phase 0/1 content.
4. Run `spec/scripts/check-task-prerequisites.sh --json` to inspect available
   docs.
5. Create `specs/<branch>/tasks.md` (or run tooling when `uvx` is available).
