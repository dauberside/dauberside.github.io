# Cortex Automation Hub — Obsidian Scripts

Codescript Toolkit scripts for Cortex OS v2.0 automation.

## Architecture

```
Obsidian (Codescript) ──→ JSON ──→ Node Pipeline ──→ Output
  脳の活動              中間表現      外周インフラ      成果物
```

**Principle**: Obsidian handles metadata-rich operations, Node handles heavy computation.

---

## Scripts

### 1. `exportConcepts.cs.js`

**Purpose**: Extract concept candidates from vault

**Output**: `cortex/graph/concepts.json`

**Process**:
1. Traverse vault markdown files
2. Extract concepts from:
   - Tags (`#concept`)
   - Links (`[[concept]]`)
   - Frontmatter (`tags`, `category`, `type`, `topic`)
   - Headings (H1, H2)
3. Normalize and deduplicate
4. Write deterministic JSON

**Usage**:
1. Open Obsidian command palette (Cmd+P)
2. Search: "Codescript: Run exportConcepts"
3. Check output: `cortex/graph/concepts.json`

**Next Step**: Run Node pipeline to generate Knowledge Graph
```bash
node cortex/graph/build-embeddings.mjs
node cortex/graph/cluster.mjs
node cortex/graph/export-graph.mjs
```

---

### 2. `generateLlmsTxt.cs.js` (TODO)

**Purpose**: Extract and canonicalize notes for llms.txt generation

**Output**: `cortex/tmp/llms-input.json`

**Process**:
1. Select target notes (recent, pinned, specific folder)
2. Extract metadata and structure
3. Canonicalize (sort, normalize)
4. Write deterministic JSON

**Next Step**: Run Node pipeline
```bash
node cortex/scripts/llms/summarize.mjs
node cortex/scripts/llms/generate.mjs
```

---

### 3. `buildWeeklyDigest.cs.js` (TODO)

**Purpose**: Aggregate daily digests into weekly summary

**Output**: `cortex/weekly/YYYY-Www-summary.md`

**Process**:
1. Find all daily digests for target week
2. Extract tasks, highlights, insights
3. Generate weekly summary (Obsidian-native)

---

## Installation

### Prerequisites
- Obsidian with Codescript Toolkit plugin installed
- Cortex OS v2.0 file structure

### Setup
1. Ensure `cortex/scripts/obsidian/` exists in vault
2. Symlink vault to Git repo (recommended):
   ```bash
   ln -s "/path/to/git/repo/cortex" "/path/to/vault/cortex"
   ```
3. Register scripts in Codescript Toolkit settings

---

## Data Flow

### Knowledge Graph Pipeline
```
Vault Files
  ↓
exportConcepts.cs.js (Obsidian)
  ↓
cortex/graph/concepts.json
  ↓
build-embeddings.mjs (Node)
  ↓
cluster.mjs (Node)
  ↓
export-graph.mjs (Node)
  ↓
cortex/graph/graph-v1.json
cortex/graph/clusters-v1.md
```

### llms.txt Pipeline
```
Vault Files
  ↓
generateLlmsTxt.cs.js (Obsidian)
  ↓
cortex/tmp/llms-input.json
  ↓
summarize.mjs (Node + LLM)
  ↓
generate.mjs (Node)
  ↓
docs/llms.txt
```

---

## Development

### Codescript Toolkit API

**Available objects**:
- `app`: Obsidian app instance
- `app.vault`: Vault operations (read, write, getMarkdownFiles)
- `app.metadataCache`: Metadata cache (tags, links, frontmatter, headings)
- `Notice`: Display notifications

**Example**:
```javascript
async function myScript(app) {
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const content = await app.vault.read(file);
    const cache = app.metadataCache.getFileCache(file);
    // Process...
  }
  new Notice('Done!');
}
module.exports = myScript;
```

---

## Best Practices

1. **Deterministic Output**: Always sort and normalize JSON output
2. **Error Handling**: Wrap file operations in try/catch
3. **Progress Feedback**: Use `console.log` and `Notice` for user feedback
4. **Separation of Concerns**: Obsidian = metadata extraction, Node = computation
5. **Idempotency**: Scripts should be safe to run multiple times

---

**Last Updated**: 2025-11-26
**Status**: Phase 1 - exportConcepts.cs.js implemented
