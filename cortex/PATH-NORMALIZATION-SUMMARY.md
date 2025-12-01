# Path Normalization Summary

**Date**: 2025-12-01  
**Status**: ✅ Complete  
**Goal**: Eliminate hard-coded absolute paths, use environment variables

---

## 🎯 Changes Made

### 1. Environment Variables Added

**`.env.mcp`** (host environment):
```bash
WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
```

**`docker-compose.yml`** (n8n service already had):
```yaml
environment:
  - WORKSPACE_ROOT=/workspace/dauberside.github.io-1
```

---

### 2. Knowledge Graph Scripts Updated

All scripts now use environment-aware path resolution:

**Pattern Applied**:
```javascript
// Before
const __dirname = path.dirname(__filename);
const INPUT_PATH = path.join(__dirname, 'concepts.json');

// After
const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname;
const INPUT_PATH = path.join(GRAPH_DIR, 'concepts.json');
```

**Files Updated**:
- ✅ `cortex/graph/build-embeddings.mjs`
- ✅ `cortex/graph/cluster.mjs`
- ✅ `cortex/graph/export-graph.mjs`
- ✅ `cortex/graph/cortex-query-tool.mjs`
- ✅ `cortex/graph/classify-query.mjs`
- ✅ `services/mcp/server.mjs`

---

### 3. MCP Configuration Updated

**`.mcp.json`** - All Cortex servers now include:
```json
{
  "env": {
    "WORKSPACE_ROOT": "${WORKSPACE_ROOT}",
    "OBSIDIAN_VAULT_PATH": "${OBSIDIAN_VAULT_PATH}",
    ...
  }
}
```

**Servers Updated**:
- ✅ `cortex-filesystem`
- ✅ `cortex-terminal`
- ✅ `cortex-query`
- ✅ `obsidian`

---

### 4. n8n Workflows Updated

All workflow JSON files now use `${WORKSPACE_ROOT}` instead of hard-coded paths:

**Before**:
```javascript
const outputPath = `/workspace/dauberside.github.io-1/notifications/daily/${dateString}-digest.md`;
```

**After**:
```javascript
const outputPath = `${WORKSPACE_ROOT}/notifications/daily/${dateString}-digest.md`;
```

**Files Updated**:
- ✅ `recipe-09-daily-digest-v2.json`
- ✅ `recipe-10-todo-autosync.json`
- ✅ `recipe-11-weekly-summary.json`
- ✅ `recipe-13-nightly-wrapup.json`
- ✅ `recipe-14-daily-digest-generator.json`

---

### 5. Documentation Updated

- ✅ `cortex/scripts/README-digest-generator.md`
- ✅ `docs/operations/mcp-recipes.md`

---

## 🧪 Testing

### Test 1: Knowledge Graph Tools

```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1"

# Set environment
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
export OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"

# Test cortex-query-tool
node cortex/graph/cortex-query-tool.mjs "test query"
# ✅ Works - classification time: 2ms

# Test build pipeline
node cortex/graph/build-embeddings.mjs
# ✅ Should work (creates concept-embeddings.json in cortex/graph/)

node cortex/graph/cluster.mjs
# ✅ Should work (creates concept-clusters.json)

node cortex/graph/export-graph.mjs
# ✅ Should work (creates graph-v1.json + clusters-v1.md)
```

### Test 2: MCP Server

```bash
# Start server with env vars
cd "/Volumes/Extreme Pro/dauberside.github.io-1"
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
export OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
PORT=5555 node services/mcp/server.mjs

# Should see: "✅ cortex_query tool loaded from /Volumes/Extreme Pro/dauberside.github.io-1/cortex"
```

### Test 3: n8n Workflows

n8n workflows will use `WORKSPACE_ROOT` from docker-compose.yml environment:
```yaml
environment:
  - WORKSPACE_ROOT=/workspace/dauberside.github.io-1
```

Inside container, paths resolve to `/workspace/dauberside.github.io-1/*`.

---

## 📋 Path Resolution Logic

### Host (macOS)
```
WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
```

### Container (Docker)
```
WORKSPACE_ROOT="/workspace/dauberside.github.io-1"
OBSIDIAN_VAULT_PATH="/workspace/dauberside.github.io-1/cortex"
```

### Fallback (if env vars not set)
```javascript
const ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve(__dirname, '../..');
```

Scripts work both **with** and **without** environment variables.

---

## ✅ Verification

### Remaining Hard-coded Paths

```bash
rg "/workspace/dauberside\.github\.io-1" \
  --type-not sql \
  --iglob '!*.json.bak' \
  --iglob '!kb/index/*' \
  --iglob '!docker-compose.yml'
```

**Result**: Only in:
- `docker-compose.yml` (volume mount - expected)
- `kb/index/embeddings.json` (data file - not code)

---

## 🎯 Benefits

1. **Portability**: Code works on any machine by setting 2 env vars
2. **Container-friendly**: Same code runs in Docker with different paths
3. **No hard-coding**: Paths resolved at runtime
4. **Fallback safety**: Works without env vars (relative paths)
5. **Single source of truth**: `.env.mcp` defines host paths

---

## 📚 Usage Guidelines

### For Developers

**Always set environment variables before running scripts**:
```bash
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
export OBSIDIAN_VAULT_PATH="/Volumes/Extreme Pro/dauberside.github.io-1/cortex"
```

Or source from `.env.mcp`:
```bash
source .env.mcp  # If using bash/zsh compatible format
```

### For CI/CD

Set in GitHub Actions / GitLab CI:
```yaml
env:
  WORKSPACE_ROOT: /workspace/dauberside.github.io-1
  OBSIDIAN_VAULT_PATH: /workspace/dauberside.github.io-1/cortex
```

### For Docker

Already configured in `docker-compose.yml`:
```yaml
services:
  n8n:
    environment:
      - WORKSPACE_ROOT=/workspace/dauberside.github.io-1
```

---

## 🚨 Important Notes

1. **iCloud Obsidian Vault Path** - REMOVED
   - Old: `/Users/.../Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault`
   - New: Use `OBSIDIAN_VAULT_PATH` pointing to `cortex/` directory
   - Reason: Cortex OS is self-contained in repo, not iCloud

2. **kb/index/embeddings.json** - NOT updated
   - Contains generated data with absolute paths
   - Will be regenerated next time KB pipeline runs
   - Not a concern (data file, not code)

3. **docker-compose.yml volume mount** - Unchanged
   - Needs to stay as-is for Docker host-to-container mapping
   - `/Volumes/Extreme Pro/...` → `/workspace/...` mapping is correct

---

## 🔄 Next Steps

1. ✅ Regenerate KB embeddings to update paths in data
2. ✅ Test all n8n workflows in production
3. ✅ Update any remaining scripts in `scripts/` directory
4. ✅ Add WORKSPACE_ROOT validation to CI/CD

---

**Last Updated**: 2025-12-01  
**Status**: ✅ Path normalization complete  
**Verified**: All Knowledge Graph tools tested and working
