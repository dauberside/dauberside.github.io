#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SPEC_TPL_DIR="spec/templates"
ROOT_TPL_DIR="templates"

mkdir -p "$SPEC_TPL_DIR"
mkdir -p "$ROOT_TPL_DIR"

# Policy: single source of truth is spec/templates/*
# - If files exist only at root/templates, copy them into spec/templates
# - If files exist at both but differ, overwrite root/templates with spec/templates and inform

sync_file() {
	local name="$1"
	local spec_file="$SPEC_TPL_DIR/$name"
	local root_file="$ROOT_TPL_DIR/$name"

	if [ -f "$spec_file" ] && [ -f "$root_file" ]; then
		if ! cmp -s "$spec_file" "$root_file"; then
			echo "Updating root template from spec: $name"
			cp -f "$spec_file" "$root_file"
			return 2
		fi
		return 0
	elif [ -f "$spec_file" ] && [ ! -f "$root_file" ]; then
		echo "Copying to root/templates: $name"
		cp -f "$spec_file" "$root_file"
		return 2
	elif [ ! -f "$spec_file" ] && [ -f "$root_file" ]; then
		echo "Copying from root to spec/templates: $name"
		cp -f "$root_file" "$spec_file"
		return 2
	else
		return 0
	fi
}

changed=0
for f in plan-template.md spec-template.md tasks-template.md; do
	if sync_file "$f"; then :; else :; fi
	rc=$?
	if [ $rc -eq 2 ]; then changed=1; fi
done

if [ $changed -eq 1 ]; then
	echo "Templates synced; changes were made."
	exit 0
else
	echo "Templates already in sync."
	exit 0
fi

