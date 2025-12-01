#!/bin/bash
# validate-paths.sh - Verify path normalization is complete
#
# Usage: ./scripts/validate-paths.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 Validating path normalization..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

# Check 1: Environment variables in .env.mcp
echo "📋 Check 1: Environment variables in .env.mcp"
if grep -q "WORKSPACE_ROOT=" .env.mcp && grep -q "OBSIDIAN_VAULT_PATH=" .env.mcp; then
  echo -e "${GREEN}✅ WORKSPACE_ROOT and OBSIDIAN_VAULT_PATH defined${NC}"
else
  echo -e "${RED}❌ Missing environment variables in .env.mcp${NC}"
  ((ERRORS++))
fi
echo ""

# Check 2: Hard-coded /workspace paths (excluding allowed files)
echo "📋 Check 2: Hard-coded /workspace paths"
WORKSPACE_PATHS=$(rg "/workspace/dauberside\.github\.io-1" \
  --type-not sql \
  --iglob '!*.json.bak' \
  --iglob '!kb/index/*' \
  --iglob '!docker-compose.yml' \
  --iglob '!*.md' \
  -l 2>/dev/null | wc -l)

if [ "$WORKSPACE_PATHS" -eq 0 ]; then
  echo -e "${GREEN}✅ No hard-coded /workspace paths in code${NC}"
else
  echo -e "${YELLOW}⚠️  Found $WORKSPACE_PATHS files with /workspace paths${NC}"
  rg "/workspace/dauberside\.github\.io-1" \
    --type-not sql \
    --iglob '!*.json.bak' \
    --iglob '!kb/index/*' \
    --iglob '!docker-compose.yml' \
    --iglob '!*.md' \
    -l 2>/dev/null || true
  ((WARNINGS++))
fi
echo ""

# Check 3: Hard-coded Extreme Pro paths
echo "📋 Check 3: Hard-coded Extreme Pro paths"
EXTREME_PRO_PATHS=$(rg "/Volumes/Extreme Pro/dauberside\.github\.io-1" \
  --type js \
  --type javascript \
  --iglob '!*.json' \
  --iglob '!*.json.bak' \
  -l 2>/dev/null | wc -l)

if [ "$EXTREME_PRO_PATHS" -eq 0 ]; then
  echo -e "${GREEN}✅ No hard-coded Extreme Pro paths in scripts${NC}"
else
  echo -e "${YELLOW}⚠️  Found $EXTREME_PRO_PATHS files with hard-coded paths${NC}"
  rg "/Volumes/Extreme Pro/dauberside\.github\.io-1" \
    --type js \
    --type javascript \
    --iglob '!*.json' \
    --iglob '!*.json.bak' \
    -l 2>/dev/null || true
  ((WARNINGS++))
fi
echo ""

# Check 4: iCloud Obsidian Vault paths
echo "📋 Check 4: iCloud Obsidian Vault paths"
ICLOUD_PATHS=$(rg "Library/Mobile Documents/iCloud.*Obsidian Vault" \
  --type js \
  --type javascript \
  -l 2>/dev/null | wc -l)

if [ "$ICLOUD_PATHS" -eq 0 ]; then
  echo -e "${GREEN}✅ No iCloud Obsidian Vault paths in scripts${NC}"
else
  echo -e "${YELLOW}⚠️  Found $ICLOUD_PATHS files with iCloud paths${NC}"
  rg "Library/Mobile Documents/iCloud.*Obsidian Vault" \
    --type js \
    --type javascript \
    -l 2>/dev/null || true
  ((WARNINGS++))
fi
echo ""

# Check 5: Knowledge Graph scripts
echo "📋 Check 5: Knowledge Graph scripts use env-aware paths"
GRAPH_SCRIPTS=(
  "cortex/graph/build-embeddings.mjs"
  "cortex/graph/cluster.mjs"
  "cortex/graph/export-graph.mjs"
  "cortex/graph/cortex-query-tool.mjs"
  "cortex/graph/classify-query.mjs"
)

for script in "${GRAPH_SCRIPTS[@]}"; do
  if grep -q "OBSIDIAN_VAULT_PATH" "$script" || grep -q "WORKSPACE_ROOT" "$script"; then
    echo -e "${GREEN}✅ $script uses environment variables${NC}"
  else
    echo -e "${RED}❌ $script missing environment variable usage${NC}"
    ((ERRORS++))
  fi
done
echo ""

# Check 6: .mcp.json has env vars
echo "📋 Check 6: .mcp.json includes environment variables"
if grep -q '"\${WORKSPACE_ROOT}"' .mcp.json && grep -q '"\${OBSIDIAN_VAULT_PATH}"' .mcp.json; then
  echo -e "${GREEN}✅ .mcp.json uses WORKSPACE_ROOT and OBSIDIAN_VAULT_PATH${NC}"
else
  echo -e "${RED}❌ .mcp.json missing environment variable references${NC}"
  ((ERRORS++))
fi
echo ""

# Check 7: n8n workflows use ${WORKSPACE_ROOT}
echo "📋 Check 7: n8n workflows use \${WORKSPACE_ROOT}"
N8N_FIXED=$(grep -h "WORKSPACE_ROOT" services/n8n/workflows/recipe-*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$N8N_FIXED" -gt 0 ]; then
  echo -e "${GREEN}✅ n8n workflows use \${WORKSPACE_ROOT} ($N8N_FIXED occurrences)${NC}"
else
  echo -e "${YELLOW}⚠️  No \${WORKSPACE_ROOT} usage in n8n workflows${NC}"
  ((WARNINGS++))
fi
echo ""

# Summary
echo "═══════════════════════════════════════"
echo "📊 Validation Summary"
echo "═══════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Path normalization is complete.${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warnings found (non-critical)${NC}"
  echo "Path normalization is mostly complete, but some cleanup may be needed."
  exit 0
else
  echo -e "${RED}❌ $ERRORS errors and $WARNINGS warnings found${NC}"
  echo "Path normalization is incomplete. Please fix the errors above."
  exit 1
fi
