# Cortex OS - Quick Context (for Cursor AI)

**Version**: v1.3 "Self-Aware"  
**Status**: ✅ Production Ready  
**Updated**: 2025-12-01

---

## 🎯 What This Is

**Cortex OS** = Self-aware knowledge management system combining:
- Obsidian vault (PKM)
- Knowledge Graph (184 concepts → 5 clusters)
- LLM memory priming (92.5% accuracy)
- MCP integration
- Environment-agnostic codebase

---

## 📁 Key Locations

```
WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
OBSIDIAN_VAULT_PATH="${WORKSPACE_ROOT}/cortex"

Important directories:
├── cortex/graph/          # Knowledge Graph system ⭐
├── cortex/daily/          # Daily notes
├── cortex/scripts/        # Automation
├── services/mcp/          # MCP servers ⭐
├── services/n8n/workflows/# n8n automation
└── .env.mcp               # Environment config ⭐
```

---

## 🧠 Knowledge Graph Quick Reference

### Components
- `concepts.json` (184 concepts) ← Input
- `concept-embeddings.json` (256-dim) ← Embeddings
- `concept-clusters.json` (5 clusters) ← Clustering
- `graph-v1.json` (70KB) ← Machine output
- `cluster-summaries.json` (10KB) ← Compressed memory ⭐

### Clusters
0. MCP Technical Core (136, 73.9%)
1. Daily Practice (21, 11.4%)
2. Strategic Context (13, 7.1%)
3. ADR (8, 4.3%)
4. Achievements (6, 3.3%)

### Main Tools
- `cortex-query-tool.mjs` - Query knowledge graph (CLI + module)
- `classify-query.mjs` - Classify queries (92.5% accuracy)
- `/cortex/query` - HTTP endpoint (MCP server)

---

## 🚀 Common Commands

```bash
# 1. Set env (required)
export WORKSPACE_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"
export OBSIDIAN_VAULT_PATH="${WORKSPACE_ROOT}/cortex"

# 2. Query knowledge graph
node cortex/graph/cortex-query-tool.mjs "your question"

# 3. Start MCP server
PORT=5555 node services/mcp/server.mjs

# 4. Validate paths
./scripts/validate-paths.sh

# 5. Regenerate graph
cd cortex/graph
node build-embeddings.mjs && node cluster.mjs && node export-graph.mjs
```

---

## 🔧 Code Patterns (IMPORTANT)

### ✅ Always Use Environment-Aware Paths

```javascript
// CORRECT ✅
const GRAPH_DIR = process.env.OBSIDIAN_VAULT_PATH
  ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'graph')
  : __dirname; // Fallback

const INPUT_PATH = path.join(GRAPH_DIR, 'concepts.json');

// WRONG ❌
const INPUT_PATH = '/Volumes/Extreme Pro/dauberside.github.io-1/cortex/graph/concepts.json';
```

### ✅ Use ES Modules

```javascript
// CORRECT ✅
import fs from 'node:fs/promises';
import path from 'node:path';

// WRONG ❌
const fs = require('fs').promises;
```

### ✅ Make It Deterministic

Same input → same output (no randomness, no timestamps in core logic)

---

## 📊 Current Metrics

| What | Target | Actual |
|------|--------|--------|
| Classification | <10ms | **3ms** ✅ |
| Response | <50ms | **<50ms** ✅ |
| Accuracy | ≥80% | **92.5%** ✅ |
| Context Reduction | >70% | **83%** ✅ |

---

## 🚨 Quick Troubleshooting

**Paths not working?**
→ Check `echo $WORKSPACE_ROOT` and `echo $OBSIDIAN_VAULT_PATH`

**Classification wrong?**
→ Run `node cortex/graph/classify-query.mjs "your query"`

**Server won't start?**
→ Check port: `lsof -i:5555` and kill if needed

**Validation fails?**
→ Run `./scripts/validate-paths.sh` to see what's wrong

---

## 📚 Full Documentation

- `CURSOR-CONTEXT.md` - Complete context (this summary's big brother)
- `v1.3-COMPLETION-SUMMARY.md` - What we built
- `v1.3-QUICK-REFERENCE.md` - Quick start guide
- `MEMORY-PRIMING-GUIDE.md` - Memory system usage

---

## 🎯 What to Work On Next

**Immediate**:
- [ ] Test with Claude Desktop
- [ ] Validate n8n workflows
- [ ] Monitor classification in production

**v1.4 "Self-Improvement"**:
- [ ] Semantic classification (embedding-based)
- [ ] Temporal tracking (recent vs historical)
- [ ] Concept drift detection
- [ ] Interactive visualization

---

## ✅ Quick Health Check

```bash
# All should pass
./scripts/validate-paths.sh

# Should return cluster in ~3ms
node cortex/graph/cortex-query-tool.mjs "test"

# Should start and log "cortex_query tool loaded"
PORT=5555 node services/mcp/server.mjs
```

---

**Status**: 🟢 All systems operational  
**Last Updated**: 2025-12-01 11:20 UTC

**→ See `CURSOR-CONTEXT.md` for complete details**
