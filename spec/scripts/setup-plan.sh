#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(resolve_repo_root)"
SPEC_DIR="$REPO_ROOT/spec"

usage() {
	echo "Usage: $(basename "$0") <feature-path-under-specs>" >&2
}

if [ $# -lt 1 ]; then usage; exit 2; fi

FEATURE_PATH="$1"
FEATURE_DIR="$SPEC_DIR/specs/$FEATURE_PATH"

if [ ! -d "$FEATURE_DIR" ]; then
	echo "ERROR: Feature directory not found: $FEATURE_DIR" >&2
	exit 1
fi

PLAN_TPL="$SPEC_DIR/templates/plan-template.md"
DATE="$(today_iso)"

if [ ! -f "$PLAN_TPL" ]; then
	echo "ERROR: Missing plan template: $PLAN_TPL" >&2
	exit 2
fi

sed -e "s/\[FEATURE\]/${FEATURE_PATH#*-}/g" -e "s/\[DATE\]/${DATE}/g" -e "s/\[###-feature-name\]/${FEATURE_PATH}/g" "$PLAN_TPL" > "$FEATURE_DIR/plan.md"

echo "Wrote plan.md to $FEATURE_DIR"

# ensure contracts dir exists
mkdir -p "$FEATURE_DIR/contracts"

