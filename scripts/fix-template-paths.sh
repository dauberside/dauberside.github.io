#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

OUT_PATCH="patches/fix-template-paths.patch"
mkdir -p patches

echo "Searching references to 'spec/templates/' outside spec/templates..."
grep -RIn --binary-files=without-match --exclude-dir={node_modules,.git,.next,dist} "spec/templates/" . \
  | grep -v "/spec/templates" > template_refs.txt || true

TOTAL_LINES=$(wc -l < template_refs.txt || echo 0)
if [ "$TOTAL_LINES" -eq 0 ]; then
  echo "No references to templates/ found outside spec/templates. Nothing to do."
  rm -f template_refs.txt
  exit 0
fi

echo "Found $TOTAL_LINES reference lines. Files affected:"
cut -d: -f1 template_refs.txt | sort -u | tee template_ref_files.txt

echo
read -p "Proceed to generate patch that replaces references to spec/templates in these files? (y/N) " CONF
CONF=${CONF:-N}
if [[ "$CONF" != "y" && "$CONF" != "Y" ]]; then
  echo "Aborted by user."
  exit 1
fi

BRANCH="chore/fix-template-paths"
git fetch origin || true
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

FILES=$(cut -d: -f1 template_refs.txt | sort -u)
for f in $FILES; do
  echo "Processing: $f"
  cp -- "$f" "$f.bak"
  perl -0777 -pe '
    s{(["'"'"'`])(?:\./)?templates/}{$1spec/templates/}g;
    s{(["'"'"'`])@/templates/}{$1@/spec/templates/}g;
    s{(\bfrom\s+["'"'"'`])(?:\./)?templates/}{$1spec/templates/}g;
    s{(\brequire\(\s*["'"'"'`])(?:\./)?templates/}{$1spec/templates/}g;
    s{(\bimport\(\s*["'"'"'`])(?:\./)?templates/}{$1spec/templates/}g;
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  git add -- "$f"
done

git diff --cached > "$OUT_PATCH" || true

if [ -s "$OUT_PATCH" ]; then
  echo "Patch written to: $OUT_PATCH"
  echo "Review with:"
  echo "  git apply --stat $OUT_PATCH"
  echo "  git apply --check $OUT_PATCH"
  echo "Then commit if acceptable."
else
  echo "No staged changes (patch empty). Reverting staged changes."
  git reset --hard
fi

echo "Done. Backups (.bak) are present for changed files."
