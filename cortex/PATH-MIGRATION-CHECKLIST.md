# Path Normalization - Migration Checklist

**Date**: 2025-12-01  
**Status**: ✅ Complete

---

## ✅ Completed Tasks

### 1. Environment Configuration
- [x] Added `WORKSPACE_ROOT` to `.env.mcp`
- [x] Added `OBSIDIAN_VAULT_PATH` to `.env.mcp`
- [x] Verified `WORKSPACE_ROOT` in `docker-compose.yml` (n8n service)
- [x] Documented container vs host path differences

### 2. Knowledge Graph Scripts
- [x] Updated `cortex/graph/build-embeddings.mjs`
- [x] Updated `cortex/graph/cluster.mjs`
- [x] Updated `cortex/graph/export-graph.mjs`
- [x] Updated `cortex/graph/cortex-query-tool.mjs`
- [x] Updated `cortex/graph/classify-query.mjs`
- [x] All scripts use env-aware path resolution with fallback

### 3. MCP Services
- [x] Updated `services/mcp/server.mjs`
- [x] Updated `.mcp.json` (cortex-filesystem)
- [x] Updated `.mcp.json` (cortex-terminal)
- [x] Updated `.mcp.json` (cortex-query)
- [x] Updated `.mcp.json` (obsidian)

### 4. n8n Workflows
- [x] Updated `recipe-09-daily-digest-v2.json`
- [x] Updated `recipe-10-todo-autosync.json`
- [x] Updated `recipe-11-weekly-summary.json`
- [x] Updated `recipe-13-nightly-wrapup.json`
- [x] Updated `recipe-14-daily-digest-generator.json`
- [x] All workflows use `${WORKSPACE_ROOT}`

### 5. Documentation
- [x] Updated `cortex/scripts/README-digest-generator.md`
- [x] Updated `docs/operations/mcp-recipes.md`
- [x] Created `cortex/PATH-NORMALIZATION-SUMMARY.md`
- [x] Created `cortex/PATH-MIGRATION-CHECKLIST.md` (this file)

### 6. Validation
- [x] Created `scripts/validate-paths.sh`
- [x] All validation checks pass ✅
- [x] Tested cortex-query-tool with env vars
- [x] No hard-coded paths in code (only data/docs)

---

## 🧪 Testing Checklist

### Pre-Deployment Tests

- [x] **Knowledge Graph Pipeline**
  ```bash
  export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
  export OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
  
  node cortex/graph/cortex-query-tool.mjs "test"
  # ✅ Works - 2ms classification time
  ```

- [ ] **Build Pipeline** (optional - data already exists)
  ```bash
  node cortex/graph/build-embeddings.mjs
  node cortex/graph/cluster.mjs
  node cortex/graph/export-graph.mjs
  ```

- [x] **MCP Server**
  ```bash
  PORT=5555 node services/mcp/server.mjs
  # ✅ Logs: "cortex_query tool loaded from /Volumes/Extreme Pro/..."
  ```

- [ ] **n8n Workflows**
  - Test daily digest generation
  - Test weekly summary
  - Test TODO autosync
  - Verify all use `${WORKSPACE_ROOT}` correctly

### Post-Deployment Verification

- [ ] Run `scripts/validate-paths.sh` on production
- [ ] Check MCP server logs for correct path resolution
- [ ] Monitor n8n workflow execution logs
- [ ] Verify Knowledge Graph data generated in correct location

---

## 📋 Environment Setup Guide

### For Local Development (macOS)

Add to your shell rc file (`~/.zshrc` or `~/.bashrc`):

```bash
# Cortex OS environment
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
export OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
```

Or source from `.env.mcp`:
```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1"
set -a
source .env.mcp
set +a
```

### For Docker/n8n

Already configured in `docker-compose.yml`:
```yaml
services:
  n8n:
    environment:
      - WORKSPACE_ROOT=/workspace/dauberside.github.io-1
```

### For CI/CD (Future)

GitHub Actions example:
```yaml
jobs:
  build:
    env:
      WORKSPACE_ROOT: ${{ github.workspace }}
      OBSIDIAN_VAULT_PATH: ${{ github.workspace }}/cortex
```

---

## 🚨 Breaking Changes

### None! 

All scripts have fallback logic:
```javascript
const ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(__dirname, '../..');
```

**Without env vars**: Scripts still work (use relative paths)  
**With env vars**: Scripts use specified paths (container-friendly)

---

## 📚 Related Documentation

- `cortex/PATH-NORMALIZATION-SUMMARY.md` - Complete technical details
- `cortex/graph/v1.3-COMPLETION-SUMMARY.md` - Knowledge Graph system
- `cortex/graph/CLAUDE-INTEGRATION.md` - LLM integration guide
- `scripts/validate-paths.sh` - Automated validation script

---

## 🎯 Benefits Achieved

1. ✅ **Portability** - Works on any machine with 2 env vars
2. ✅ **Container-friendly** - Same code, different runtime paths
3. ✅ **No hard-coding** - Paths resolved dynamically
4. ✅ **Safe fallback** - Works without env vars
5. ✅ **Single source** - `.env.mcp` defines canonical paths
6. ✅ **Validated** - Automated checks ensure consistency

---

## 🔄 Rollback Plan

If issues arise:

1. Git checkout previous commit before path normalization
2. Or manually revert by replacing `${WORKSPACE_ROOT}` with hard-coded paths
3. Validation script will catch any regressions

**Risk Level**: Low (all changes are additive with fallbacks)

---

**Migration Status**: ✅ Complete  
**Validation Status**: ✅ All checks passed  
**Ready for**: Production deployment

**Date Completed**: 2025-12-01  
**Next Review**: After first production run
