#!/usr/bin/env bash
set -euo pipefail

# Common helpers for Spec Kit scripts

resolve_repo_root() {
	if git rev-parse --show-toplevel >/dev/null 2>&1; then
		git rev-parse --show-toplevel
	else
		# Fallback: ascend until .git found
		local d
		d="$(pwd)"
		while [ "$d" != "/" ]; do
			if [ -d "$d/.git" ]; then
				echo "$d"
				return 0
			fi
			d="$(dirname "$d")"
		done
		echo "ERROR: Could not resolve repo root" >&2
		return 1
	fi
}

require_cmd() {
	local c
	c="$1"
	command -v "$c" >/dev/null 2>&1 || { echo "Missing command: $c" >&2; exit 127; }
}

today_iso() { date +%F; }

