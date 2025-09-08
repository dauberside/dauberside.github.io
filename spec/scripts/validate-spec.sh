#!/usr/bin/env bash
set -euo pipefail

# Lightweight validator for the spec/ directory templates and core files.
# Exits 0 when all required files exist, non-zero otherwise.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC_DIR="$REPO_ROOT/spec"

required=(
  "spec/templates/plan-template.md"
  "spec/templates/spec-template.md"
  "spec/templates/tasks-template.md"
  "memory/constitution.md"
)

missing=()
for p in "${required[@]}"; do
  if [ ! -e "$SPEC_DIR/$p" ]; then
    missing+=("$p")
  fi
done

if [ ${#missing[@]} -eq 0 ]; then
  echo "OK: spec basic templates present"
  exit 0
else
  echo "MISSING: the following spec files are required in spec/"
  for m in "${missing[@]}"; do
    echo "  - $m"
  done
  echo "Run: 'git restore --source=HEAD spec/ --' if you accidentally deleted templates, or recreate them from spec/spec/templates/.* templates." >&2
  exit 2
fi
