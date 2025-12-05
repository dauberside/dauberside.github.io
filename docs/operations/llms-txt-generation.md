# llms.txt Generation Pipeline

**Version**: 1.0  
**Created**: 2025-12-05  
**Status**: Production Ready

---

## Overview

The llms.txt generation pipeline converts structured `llms-input.json` data into a human-readable text format optimized for LLM context windows.

### Purpose
- Provide LLMs with structured context about Cortex OS
- Include project metadata, MCP layer info, knowledge graph, and tasks
- Maintain a single source of truth for AI interactions

### Input/Output
- **Input**: `cortex/tmp/llms-input.json`
- **Output**: `llms.txt` (root directory)
- **Format**: Markdown-style text with clear sections

---

## Usage

### Option 1: Node.js Pipeline (Recommended)

```bash
# Generate llms-input.json and llms.txt
pnpm cortex:llms:all

# Generate only llms.txt (requires llms-input.json)
pnpm cortex:llms:txt

# Generate only llms-input.json
pnpm cortex:llms:input
```

### Option 2: Direct Execution

```bash
# Generate llms-input.json
node cortex/scripts/generate-llms-input.mjs

# Generate llms.txt
node scripts/generate-llms-txt.mjs
```

### Option 3: Obsidian Codescript

1. Open Obsidian
2. Open Command Palette (`Cmd+P`)
3. Run: `Codescript: Run Script`
4. Select: `cortex/scripts/obsidian/generateLlmsTxt.cs.js`

---

## Output Structure

### 1. Header
- Generation timestamp
- Version info
- Project name

### 2. Project Context
- Knowledge Graph statistics
- System architecture overview
- Core capabilities

### 3. MCP Layer
- MCP server list with status
- Tool capabilities per server
- Priority and active status

### 4. Knowledge Graph
- Cluster summaries (5 clusters)
- Core concepts per cluster
- Purpose and outputs

### 5. Task Context
- Today's date
- Top priority tasks (from TODO.md)
- Task metadata (category, emoji, tags)

### 6. Recent Updates
- High-impact notes
- Recently updated notes
- Activity tracking

### 7. Related Resources
- Links to key files
- Knowledge Graph, TODO.md, KB Index
- Daily/Weekly summaries

---

## File Structure

```
project-root/
├── scripts/
│   └── generate-llms-txt.mjs          # Main Node.js script
├── cortex/
│   ├── scripts/
│   │   ├── generate-llms-input.mjs    # Input generation
│   │   └── obsidian/
│   │       └── generateLlmsTxt.cs.js  # Obsidian version
│   └── tmp/
│       └── llms-input.json            # Input data
└── llms.txt                           # Output file
```

---

## Output Example

```markdown
# Cortex OS - Context File

**Generated**: 2025-12-05T05:42:15.818Z
**Version**: 1.0
**Project**: Cortex OS

---

## 📋 Project Context

**Cortex OS** is a self-operating personal knowledge and task management system.

### Knowledge Graph Statistics
- **Total Concepts**: 184
- **Total Clusters**: 5
- **Clustering Method**: connected-components
- **Similarity Threshold**: 0.7

---

## 🔌 MCP Layer

**Status**: Enabled
**Version**: v1.1+
**Completion Date**: 2025-12-05

### MCP Servers

**filesystem** (critical)
- Status: active
- Tools: read_file, list_files

**terminal** (critical)
- Status: active
- Tools: run_task, list_tasks

[... more sections ...]
```

---

## Implementation Details

### Data Flow

```
clusters-v1.md ──┐
TODO.md ─────────┤
tomorrow.json ───┼──> generate-llms-input.mjs ──> llms-input.json
                 │
                 └──> generate-llms-txt.mjs ──> llms.txt
```

### Key Functions

#### `generateHeader(input)`
- Generates file header with metadata
- Includes generation timestamp

#### `generateProjectContext(input)`
- Knowledge Graph statistics
- System architecture overview

#### `generateMcpLayer(input)`
- Lists all MCP servers
- Shows tools and status per server

#### `generateKnowledgeGraph(input)`
- Iterates through clusters
- Shows top 5 core concepts per cluster

#### `generateTaskContext(input)`
- Parses todoContext from highlights
- Handles both string and object task formats

#### `generateRecentUpdates(input)`
- Lists high-impact notes
- Lists recently updated notes
- Handles both string and object formats

---

## Data Format Handling

### Flexible Input Handling

The pipeline handles multiple data formats:

```javascript
// Task formats
typeof task === 'string' ? task : task.text

// Note formats
typeof note === 'string' ? note : note.label
```

### Error Handling

- Missing llms-input.json: Exit with error message
- Empty highlights: Show "No updates available"
- Missing todoContext: Show "No task context"

---

## Performance

### Metrics (Typical Run)
- **Generation Time**: <100ms
- **File Size**: ~6 KB
- **Lines**: ~200
- **Clusters**: 5
- **Total Concepts**: 184

### Optimization
- Single-pass generation
- Minimal string concatenation
- No external API calls

---

## Integration

### With Cortex OS Automation

```bash
# Morning routine (08:00 JST)
pnpm cortex:digest:today
pnpm cortex:llms:all

# Updates TODO.md and llms.txt for the day
```

### With MCP Servers

The generated llms.txt is designed for:
- **Filesystem MCP**: Read as context file
- **Text Editor MCP**: Update sections dynamically
- **Search MCP**: Query structure for navigation

---

## Testing

### Manual Test

```bash
# Generate
pnpm cortex:llms:all

# Verify output
cat llms.txt | head -50
cat llms.txt | grep "MCP Layer"
cat llms.txt | grep "Task Context"

# Check file size
ls -lh llms.txt
```

### Expected Output
- ✅ File exists at root: `llms.txt`
- ✅ File size: 5-7 KB
- ✅ Lines: 190-210
- ✅ All sections present
- ✅ No "undefined" strings

---

## Troubleshooting

### Issue: "llms-input.json not found"
**Solution**: Run `pnpm cortex:llms:input` first

### Issue: "undefined" in output
**Cause**: Data format mismatch in llms-input.json
**Solution**: Check highlights.todoContext and recentHighImpactNotes format

### Issue: Empty Task Context
**Cause**: TODO.md not parsed correctly
**Solution**: Verify TODO.md structure and tomorrow.json exists

---

## Future Enhancements

### v1.1 (Planned)
- [ ] Add cluster visualization (ASCII art)
- [ ] Include concept relationship graph
- [ ] Add weekly progress section

### v1.2 (Planned)
- [ ] Automatic regeneration on file changes
- [ ] Multiple output formats (JSON, YAML, HTML)
- [ ] Compression for large knowledge graphs

### v2.0 (Roadmap)
- [ ] Interactive mode with filtering
- [ ] Section-level updates (partial regeneration)
- [ ] Integration with `/brief` and `/wrap-up` commands

---

## Related Documentation

- **llms-input-schema.md**: Input data structure specification
- **generate-llms-input.mjs**: Input generation pipeline
- **MCP Integration**: Integration with MCP servers

---

**Last Updated**: 2025-12-05  
**Maintained By**: Cortex OS Team
