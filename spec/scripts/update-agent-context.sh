#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(resolve_repo_root)"

usage() {
	cat >&2 <<USAGE
Usage: $(basename "$0") <assistant> [feature-path-under-specs] [--append] [--max-lines N]
	assistant: claude|gemini|copilot
	--append:   Append only new content between markers (diff mode)
	--max-lines N: Clamp inserted content to N lines (default 200)
USAGE
}

if [ $# -lt 1 ]; then usage; exit 2; fi
ASSISTANT="$1"; shift || true
FEATURE_PATH=""
APPEND_ONLY=0
MAX_LINES=200

while [ $# -gt 0 ]; do
	case "$1" in
		--append) APPEND_ONLY=1; shift ;;
		--max-lines) MAX_LINES="${2:-200}"; shift 2 ;;
		*) FEATURE_PATH="${FEATURE_PATH:-$1}"; shift ;;
	esac
done

case "$ASSISTANT" in
	claude) OUT_FILE="$REPO_ROOT/CLAUDE.md" ;;
	gemini) OUT_FILE="$REPO_ROOT/GEMINI.md" ;;
	copilot) OUT_FILE="$REPO_ROOT/.github/copilot-instructions.md" ;;
	*) echo "Unknown assistant: $ASSISTANT" >&2; exit 2 ;;
esac

mkdir -p "$(dirname "$OUT_FILE")"

HEADER="<!-- AUTO-GENERATED: Do not edit between markers -->"
BEGIN_MARK="<!-- BEGIN:RECENT-PLANS -->"
END_MARK="<!-- END:RECENT-PLANS -->"

recent() {
	# Show last 3 plan.md files briefly
	local spec_dir="$REPO_ROOT/spec/specs"
	if [ -d "$spec_dir" ]; then
		find "$spec_dir" -name plan.md -type f -print0 | xargs -0 ls -t | head -n 3 | while read -r f; do
			echo "## $(basename "$(dirname "$f")")"
			sed -n '1,40p' "$f" | sed 's/^/> /'
			echo ""
		done
	fi
}

RAW_BLOCK="$(recent)"

# clamp lines
CLAMPED_BLOCK="$(printf "%s" "$RAW_BLOCK" | awk -v max="$MAX_LINES" 'NR<=max')"

CONTENT="$HEADER
$BEGIN_MARK
$CLAMPED_BLOCK
$END_MARK"

if [ -n "$FEATURE_PATH" ] && [ -f "$REPO_ROOT/spec/specs/$FEATURE_PATH/plan.md" ]; then
	: # placeholder for future incremental merging
fi

if [ -f "$OUT_FILE" ]; then
	if [ $APPEND_ONLY -eq 1 ]; then
		# Extract existing block
		EXISTING_BLOCK="$(awk -v b="$BEGIN_MARK" -v e="$END_MARK" 'f{print} $0~b{f=1} $0~e{f=0}' "$OUT_FILE" | sed "1d;$d")"
		DIFF_BLOCK="$(printf "%s" "$CLAMPED_BLOCK" | grep -Fvxf <(printf "%s" "$EXISTING_BLOCK" || true) || true)"
		if [ -z "$DIFF_BLOCK" ]; then
			echo "No new content to append between markers.";
			exit 0
		fi
		NEW_BLOCK="$EXISTING_BLOCK
$DIFF_BLOCK"
		# Replace with merged block
		awk -v begin="$BEGIN_MARK" -v end="$END_MARK" -v header="$HEADER" -v block="$NEW_BLOCK" '
			{
				if($0==begin){print header; print begin; printing=1; next}
				if($0==end){print block; print end; printing=0; next}
				if(!printing) print $0
			}
		' "$OUT_FILE" > "$OUT_FILE.tmp" && mv "$OUT_FILE.tmp" "$OUT_FILE"
	else
		# replace between markers
		awk -v begin="$BEGIN_MARK" -v end="$END_MARK" -v repl="$CONTENT" '
			BEGIN{printed=0}
			{
				if(index($0, begin)) {print repl; skip=1; next}
				if(skip && index($0, end)) {skip=0; next}
				if(!skip) print $0
			}
		' "$OUT_FILE" > "$OUT_FILE.tmp" && mv "$OUT_FILE.tmp" "$OUT_FILE"
	fi
else
	printf "%s\n" "$CONTENT" > "$OUT_FILE"
fi

echo "Updated $OUT_FILE"

