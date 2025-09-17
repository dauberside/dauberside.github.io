#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(resolve_repo_root)"
SPEC_DIR="$REPO_ROOT/spec"

usage() {
	cat <<USAGE
Usage: $(basename "$0") <feature-id> <feature-name>
	feature-id   Numeric or short code (e.g., 123)
	feature-name Kebab case (e.g., add-login)

Creates: spec/specs/<id>-<name> with plan.md (from template) and empty stubs.
USAGE
}

if [ $# -lt 2 ]; then
	usage; exit 2;
fi

FEATURE_ID="$1"; shift
FEATURE_NAME="$1"; shift || true
FEATURE_DIR="$SPEC_DIR/specs/${FEATURE_ID}-${FEATURE_NAME}"

mkdir -p "$FEATURE_DIR/contracts"

# Templates
PLAN_TPL="$SPEC_DIR/templates/plan-template.md"
SPEC_TPL="$SPEC_DIR/templates/spec-template.md"

if [ ! -f "$PLAN_TPL" ] || [ ! -f "$SPEC_TPL" ]; then
	echo "ERROR: Missing templates under spec/templates/. Run spec/scripts/validate-spec.sh" >&2
	exit 2
fi

DATE="$(today_iso)"
OWNER="${FEATURE_OWNER:-}"
if [ -z "$OWNER" ]; then
	OWNER="$(git config user.name || echo "")"
fi

# Create files if not exist
if [ ! -f "$FEATURE_DIR/spec.md" ]; then
	sed -e "s/\[FEATURE\]/${FEATURE_NAME}/g" \
			-e "s/\[###\]/${FEATURE_ID}/g" \
			-e "s/\[YYYY-MM-DD\]/${DATE}/g" \
			-e "s/\[name\]/${OWNER}/g" \
		"$SPEC_TPL" > "$FEATURE_DIR/spec.md"
fi

if [ ! -f "$FEATURE_DIR/plan.md" ]; then
	sed -e "s/\[FEATURE\]/${FEATURE_NAME}/g" \
			-e "s/\[DATE\]/${DATE}/g" \
			-e "s/\[###-feature-name\]/${FEATURE_ID}-${FEATURE_NAME}/g" \
		"$PLAN_TPL" > "$FEATURE_DIR/plan.md"
fi

touch "$FEATURE_DIR/research.md" "$FEATURE_DIR/data-model.md" "$FEATURE_DIR/quickstart.md"

echo "Created feature scaffold at $FEATURE_DIR"

