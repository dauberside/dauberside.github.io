# task-entry.json Schema

**Version**: 1.0  
**Status**: ✅ Stable (v1.2)  
**Last Updated**: 2025-12-05

## Purpose

`task-entry.json` is the **unified task data model** for Cortex OS. It serves as the single source of truth for:

- **Temporal Analytics** (v1.3): Workload heatmaps, rhythm detection
- **Adaptive Task Management** (v1.3): Smart prioritization, /suggest
- **Self-Improvement Loop** (v1.3): Health scoring, feedback collection

## File Location

```
cortex/state/task-entry-YYYY-MM-DD.json
```

## Schema Definition

```json
{
  "date": "YYYY-MM-DD",
  "source": "daily-digest | todo-sync | wrap-up | manual",
  "generated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "tasks": [
    {
      "id": "unique-task-id",
      "title": "Task title",
      "status": "pending | in_progress | done | cancelled",
      "category": "work | personal | learning | health | optional",
      "priority": "high | medium | low",
      "estimated_duration": 30,
      "actual_duration": 45,
      "tags": ["tag1", "tag2"],
      "created_at": "YYYY-MM-DDTHH:mm:ssZ",
      "completed_at": "YYYY-MM-DDTHH:mm:ssZ",
      "notes": "Optional context or details"
    }
  ],
  "metadata": {
    "total_tasks": 10,
    "completed": 7,
    "completion_rate": 0.7,
    "workload_level": "normal | high | low"
  }
}
```

## Field Specifications

### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | ✅ Yes | ISO 8601 date (YYYY-MM-DD) |
| `source` | string | No | Where the data came from |
| `generated_at` | string | No | ISO 8601 timestamp |
| `tasks` | array | ✅ Yes | Array of task objects |
| `metadata` | object | No | Summary statistics |

### Task Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ Yes | Unique identifier |
| `title` | string | ✅ Yes | Task description |
| `status` | string | ✅ Yes | One of: pending, in_progress, done, cancelled |
| `category` | string | No | Task category |
| `priority` | string | No | One of: high, medium, low |
| `estimated_duration` | number | No | Minutes (estimated) |
| `actual_duration` | number | No | Minutes (actual) |
| `tags` | array | No | Tags for filtering/grouping |
| `created_at` | string | No | ISO 8601 timestamp |
| `completed_at` | string | No | ISO 8601 timestamp |
| `notes` | string | No | Additional context |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| `total_tasks` | number | Total task count |
| `completed` | number | Completed task count |
| `completion_rate` | number | 0.0 - 1.0 |
| `workload_level` | string | normal, high, low |

## Validation Rules

1. **Date Format**: Must be valid ISO 8601 date
2. **Status Values**: Must be one of the allowed status strings
3. **Completion Rate**: Must be between 0.0 and 1.0
4. **Task IDs**: Must be unique within the file
5. **Timestamps**: Must be valid ISO 8601 timestamps

## Backward Compatibility

This schema is compatible with:

- `analyze-workload.py` (requires: date, tasks[].status)
- `suggest.py` (requires: date, tasks[].status, tasks[].category)
- Future v1.3 analytics scripts

## Migration Notes

### From Daily Digest

```javascript
// cortex/daily/YYYY-MM-DD-digest.md → task-entry.json
{
  "source": "daily-digest",
  "tasks": [
    {
      "title": "[ ] Task from digest",
      "status": "pending",
      "category": "work"
    }
  ]
}
```

### From TODO.md

```javascript
// TODO.md → task-entry.json
{
  "source": "todo-sync",
  "tasks": [
    {
      "title": "[x] Completed task",
      "status": "done",
      "completed_at": "2025-12-05T10:30:00Z"
    }
  ]
}
```

### From tomorrow.json

```javascript
// data/tomorrow.json → task-entry.json
{
  "source": "wrap-up",
  "tasks": [
    {
      "title": "Tomorrow candidate",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

## Example Usage

### Extract Tasks (Python)

```python
import json
from pathlib import Path

def load_task_entry(date_str):
    path = Path(f"cortex/state/task-entry-{date_str}.json")
    with open(path, 'r') as f:
        return json.load(f)

# Usage
data = load_task_entry("2025-12-05")
tasks = data['tasks']
completion_rate = data['metadata']['completion_rate']
```

### Extract Tasks (JavaScript)

```javascript
import { readFile } from 'fs/promises';

async function loadTaskEntry(dateStr) {
  const path = `cortex/state/task-entry-${dateStr}.json`;
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

// Usage
const data = await loadTaskEntry('2025-12-05');
const tasks = data.tasks;
const completionRate = data.metadata.completion_rate;
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-05 | Initial stable release (v1.2) |

## Related Documentation

- [v1.2 Roadmap](../cortex/v1.2-autonomy.md)
- [v1.3 Roadmap](../cortex/v1.3-intelligence.md)
- [Workload Analytics](../cortex/v1.3-temporal-analytics.md)
