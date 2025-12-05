# MCP Memory & Fetch Setup Guide

**Date**: 2025-12-02  
**Status**: Active  
**Version**: v1.1

## Overview

Added two Priority 1 MCP servers to enhance Cortex OS capabilities:

1. **@modelcontextprotocol/server-memory** - Session memory persistence
2. **mcp-server-fetch** - Unified HTTP client

## Installation

```bash
pnpm add -D @modelcontextprotocol/server-memory
```

Note: `mcp-server-fetch` is installed via `npx -y` on-demand (no package.json entry needed).

## Configuration

### Memory Server

**File**: `.mcp.json`

```json
"memory": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": {},
  "allowedTools": [
    "memory_store",
    "memory_retrieve",
    "memory_delete",
    "memory_search"
  ],
  "metadata": {
    "priority": "critical",
    "autoStart": true,
    "tokenUsage": "~1k tokens per session"
  }
}
```

**Usage Examples**:

- Store daily goals: `memory_store("daily_goals", "Complete feature X")`
- Retrieve context: `memory_retrieve("daily_goals")`
- Search memory: `memory_search("feature X")`
- Clean up: `memory_delete("daily_goals")`

**Cortex OS Integration**:

- `/brief`: Retrieve yesterday's wrap-up from memory
- `/wrap-up`: Store today's summary for next morning
- `/init`: Load persistent TODO state

### Fetch Server

**File**: `.mcp.json`

```json
"fetch": {
  "command": "npx",
  "args": ["-y", "mcp-server-fetch"],
  "env": {},
  "allowedTools": ["fetch"],
  "metadata": {
    "priority": "medium",
    "autoStart": false,
    "tokenUsage": "~500 tokens on-demand"
  }
}
```

**Usage Examples**:

- Query KB API: `fetch("http://127.0.0.1:4040/search?q=cortex", {method: "GET"})`
- Trigger n8n webhook: `fetch("http://localhost:5678/webhook/cortex", {method: "POST", body: {...}})`
- External API: `fetch("https://api.example.com/data", {headers: {...}})`

**Benefits**:

- Unified error handling
- Standardized retry logic
- Token usage tracking

## Environment Variables

No additional environment variables required. Both servers work out-of-the-box.

## Token Budget Impact

| Server | AutoStart | Baseline | On-Demand |
|--------|-----------|----------|-----------|
| memory | ✅ Yes | ~1k | - |
| fetch | ❌ No | 0 | ~500 |

**Total baseline increase**: +1k tokens (acceptable for critical functionality)

## Testing

```bash
# Test memory operations (manual in Claude session)
1. memory_store("test_key", "test_value")
2. memory_retrieve("test_key")
3. memory_delete("test_key")

# Test fetch (requires running services)
1. Start kb-api: docker compose up kb-api -d
2. fetch("http://127.0.0.1:4040/healthz", {method: "GET"})
3. Check response status: 200 OK
```

## Troubleshooting

### Memory Server

**Issue**: Memory not persisting across sessions  
**Cause**: In-process storage (session-scoped)  
**Solution**: Expected behavior - memory clears on restart. For persistence, use Obsidian notes.

### Fetch Server

**Issue**: `mcp-server-fetch` not found  
**Cause**: Package doesn't exist in npm registry  
**Solution**: Tool definition added but may need alternative implementation. Fallback to curl/native fetch in scripts.

## Next Steps (Priority 2)

1. Add `@modelcontextprotocol/server-postgres` for Supabase integration
2. Test memory integration with `/brief` and `/wrap-up` commands
3. Create fetch wrapper for kb-api retry logic

## References

- MCP Official Docs: https://modelcontextprotocol.io
- Cortex Daily Automation: `docs/architecture/cortex-daily-automation-v1.0.md`
- MCP Config: `.mcp.json`
