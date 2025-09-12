#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Searching for references to 'spec/templates/' (excluding spec/templates) in repo..."
# show all matches (for visibility) and then show only those outside spec/templates
echo "--- All matches ---"
grep -RIn --binary-files=without-match --exclude-dir={node_modules,.git,.next,dist} "spec/templates/" "$ROOT_DIR" || true

echo ""
echo "--- Matches outside spec/templates ---"
# exclude lines that refer to spec/templates
grep -RIn --binary-files=without-match --exclude-dir={node_modules,.git,.next,dist} "spec/templates/" "$ROOT_DIR" \
  | grep -v "/spec/templates" || echo "No references outside spec/templates found."

echo ""
echo "Done."