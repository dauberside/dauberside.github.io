# LLM Memory Priming System - Usage Guide

**Status**: v1.0 - Production Ready  
**Date**: 2025-12-01  
**Part of**: Cortex OS v1.3 "Self-Aware"

---

## 🎯 Purpose

This system enables LLMs to **selectively load relevant knowledge** from your Knowledge Graph based on the question being asked.

Instead of:
- ❌ Loading all 184 concepts (too much context)
- ❌ Guessing which documents to read (unreliable)

We now:
- ✅ Automatically classify questions → identify relevant clusters
- ✅ Load compact summaries (400-600 tokens per cluster)
- ✅ Provide targeted context for better reasoning

---

## 📁 System Components

### 1. `cluster-summaries.json` (10KB)
**Ultra-compressed memory representations** of all 5 cognitive territories:
- Cluster 0: MCP Technical Core (73.9%)
- Cluster 1: Daily Practice & Reflection (11.4%)
- Cluster 2: Strategic Context & Versioning (7.1%)
- Cluster 3: Architecture Decision Records (4.3%)
- Cluster 4: Achievements & Momentum (3.3%)

Each summary includes:
- Core concepts (with frequencies)
- Use-when conditions
- Key documents
- Interpretation/purpose

### 2. `classify-query.mjs` (7.5KB)
**Query classifier** that maps questions to clusters:
- Keyword-based matching (fast, deterministic)
- Pattern matching (regex for complex queries)
- Returns top 1-2 most relevant clusters
- Defaults to Cluster 0 (MCP Core) if no match

### 3. `MEMORY-PRIMING-GUIDE.md` (this file)
Usage documentation and integration patterns.

---

## 🚀 Quick Start

### Test the classifier:

```bash
cd cortex/graph

# MCP technical question
node classify-query.mjs "How do I debug MCP stdio connections?"
# → Returns: cluster-0 (MCP Technical Core)

# Weekly retrospective
node classify-query.mjs "What did I accomplish this week?"
# → Returns: cluster-4 (Achievements & Momentum)

# ADR lookup
node classify-query.mjs "Why did we choose hash embeddings?"
# → Returns: cluster-3 (ADR), cluster-0 (MCP Core)

# Strategic question
node classify-query.mjs "Where are we on the v1.2 roadmap?"
# → Returns: cluster-2 (Strategic Context)
```

---

## 🧠 Integration Patterns

### Pattern 1: CLI Agent (MCP Server)

```javascript
import { buildMemoryContext, formatAsPrompt } from './cortex/graph/classify-query.mjs';

async function handleQuery(userQuery) {
  // 1. Classify query and build memory context
  const memoryContext = await buildMemoryContext(userQuery);
  
  // 2. Format as compact prompt
  const contextPrompt = formatAsPrompt(memoryContext);
  
  // 3. Inject into LLM system prompt
  const systemPrompt = `
${contextPrompt}

You are an assistant with access to the user's knowledge graph.
Use the context above to answer questions accurately.
`;

  // 4. Call LLM with primed memory
  const response = await llm.complete({
    system: systemPrompt,
    user: userQuery
  });
  
  return response;
}
```

### Pattern 2: Daily Digest Generation

```javascript
import { getClusterSummary } from './cortex/graph/classify-query.mjs';

async function generateDailyDigest() {
  // Load Daily Practice cluster (cluster-1)
  const dailyCluster = await getClusterSummary('cluster-1');
  
  const prompt = `
Based on this knowledge structure:
${JSON.stringify(dailyCluster, null, 2)}

Generate today's digest by:
1. Reviewing yesterday's summary
2. Extracting key learnings
3. Planning today's tasks
4. Identifying cross-document patterns
`;

  return await llm.complete({ user: prompt });
}
```

### Pattern 3: Multi-Cluster Reasoning

```javascript
async function answerArchitecturalQuestion(question) {
  // Load both ADR cluster and MCP Core
  const adrContext = await getClusterSummary('cluster-3');
  const mcpContext = await getClusterSummary('cluster-0');
  
  const prompt = `
You have access to two knowledge regions:

1. Architecture Decision Records:
${adrContext.summary}
Key docs: ${adrContext.keyDocuments.join(', ')}

2. MCP Technical Core:
${mcpContext.summary}
Key docs: ${mcpContext.keyDocuments.join(', ')}

Question: ${question}

Provide a comprehensive answer that references specific ADRs and technical details.
`;

  return await llm.complete({ user: prompt });
}
```

---

## 📊 Classification Rules

### Cluster 0: MCP Technical Core
**Triggers**: mcp, protocol, stdio, jsonrpc, primitive, obsidian integration, kb, embedding, agent, troubleshoot, ADR-0003/0004/0005/0006

**Example queries**:
- "How do I set up MCP stdio bridge?"
- "What are the 5 MCP primitives?"
- "Debug Obsidian MCP connection"
- "Explain KB embedding pipeline"

### Cluster 1: Daily Practice & Reflection
**Triggers**: daily, today, yesterday, plan, task, reflection, digest, learning, workflow

**Example queries**:
- "What's on my plan for today?"
- "Summarize yesterday's work"
- "Extract key learnings from this week"
- "Show my daily reflection pattern"

### Cluster 2: Strategic Context & Versioning
**Triggers**: roadmap, version, v1.1, v1.2, milestone, strategic, vision, backlog, big picture

**Example queries**:
- "Where are we on the v1.2 roadmap?"
- "What are the 3 pillars of v1.2?"
- "Show project milestones"
- "What's in the backlog?"

### Cluster 3: Architecture Decision Records
**Triggers**: adr, decision, rationale, alternative, consequence, why did we, architecture decision

**Example queries**:
- "Why did we choose X over Y?"
- "What were the alternatives for Z?"
- "Show ADR for MCP integration"
- "What are the consequences of decision X?"

### Cluster 4: Achievements & Momentum
**Triggers**: weekly, highlight, achievement, win, accomplish, challenge, W47, W48, progress report

**Example queries**:
- "What did I accomplish this week?"
- "Show weekly highlights"
- "What challenges did I face?"
- "Generate weekly summary"

---

## 🔧 Advanced Usage

### Get JSON output for programmatic use:

```bash
node classify-query.mjs "your question" --json
```

### Use as ES module:

```javascript
import { 
  classifyQuery,
  buildMemoryContext,
  formatAsPrompt,
  getClusterSummary 
} from './cortex/graph/classify-query.mjs';

// Just classification
const clusters = classifyQuery("How do I debug MCP?");
// → ["cluster-0"]

// Full memory context
const context = await buildMemoryContext("Show weekly wins");
// → { query, selectedClusters, context }

// Formatted prompt
const prompt = formatAsPrompt(context);
// → Ready-to-use LLM prompt with context
```

---

## 📈 Performance Characteristics

- **Classification speed**: <10ms (keyword/regex matching)
- **Memory footprint**: ~10KB for summaries (vs 634KB for full embeddings)
- **Context size**: 400-600 tokens per cluster (vs 184 full concepts)
- **Deterministic**: Same query → same clusters (always)

---

## 🎯 Next Steps

### Immediate (v1.3 "Self-Aware"):
1. ✅ Cluster summaries created
2. ✅ Query classifier implemented
3. ✅ Integration guide documented
4. 🔄 Integrate with MCP server (Recipe 5?)
5. 🔄 Add to daily digest automation

### Future (v1.4+):
- [ ] Upgrade to embedding-based classification (semantic similarity)
- [ ] Add cluster-to-cluster relationship mapping
- [ ] Build temporal awareness (recent vs historical concepts)
- [ ] Create cluster update detection (concept drift monitoring)
- [ ] Generate cluster visualizations (force-directed graph)

---

## 🧩 Integration with Cortex OS

This memory priming system is the **cognitive substrate** for:

1. **MCP Server** (`cortex-mcp-server`)
   - `/graph/query` resource → returns primed context
   - `cortex_query` tool → uses classifier internally

2. **Daily Automation** (n8n workflows)
   - Morning digest → loads cluster-1 + cluster-2
   - Weekly summary → loads cluster-4 + cluster-1
   - ADR review → loads cluster-3

3. **Chat Interface** (future)
   - Real-time query classification
   - Context injection before LLM call
   - Cluster-aware conversation history

4. **Agent SDK** (future)
   - `agent.primeMemory(query)` → auto-loads relevant clusters
   - `agent.getCluster(name)` → direct cluster access
   - `agent.findRelated(concept)` → graph traversal

---

## 📚 Related Documents

- `cortex/graph/IMPLEMENTATION-PLAN.md` - Original pipeline design
- `cortex/graph/clusters-v1.md` - Human-readable brain map
- `cortex/graph/graph-v1.json` - Full graph data structure
- `docs/decisions/ADR-0006-phase-2-automation-strategy.md` - Context on automation goals

---

**Last Updated**: 2025-12-01  
**Status**: Production Ready ✅  
**Next Milestone**: MCP Server Integration (Recipe 5)
