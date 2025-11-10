# spec/ — Spec Kit templates and scripts

Purpose: contain Spec Kit templates, helper scripts, and minimal operational docs so teams can author feature specs, plans, and tasks without needing the external `uvx` CLI to be available.

Quick commands

- Validate required templates exist:
  - `spec/scripts/validate-spec.sh`

- Check prerequisites for task generation (example):
  - `bash spec/scripts/check-task-prerequisites.sh --json`

If you removed or merged duplicate Spec Kit files, run the validator above before opening PRs. If templates are missing, restore them from your upstream or recreate using `spec/spec/templates/*.md` as a reference.

Workflow (minimal)

1. Create a feature branch named like `001-feature-short-name`.
2. Add `specs/<branch>/spec.md` describing the feature.
3. Copy `spec/spec/templates/plan-template.md` to `specs/<branch>/plan.md` and fill Phase 0/1 content.
4. Run `spec/scripts/check-task-prerequisites.sh --json` to inspect available docs.
5. Create `specs/<branch>/tasks.md` (or run tooling when `uvx` is available).
