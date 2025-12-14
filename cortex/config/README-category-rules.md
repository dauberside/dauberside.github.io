# Category Rules Configuration

**Status**: 🚧 Design Complete, Implementation Optional
**Config File**: `cortex/config/category-rules.json`
**Schema**: `cortex/config/category-rules.schema.json`

---

## Overview

This directory contains the category classification rules used by the daily digest generator to categorize tasks into predefined categories (ops, n8n, cortex, docs, github, infra, other).

### Current Status

- ✅ **v1.0 (Current)**: Rules are hardcoded in `cortex/scripts/generate-daily-digest.mjs`
- 🚧 **v2.0 (Designed)**: Config-based rules via `category-rules.json` (not yet implemented)

---

## How to Customize (v1.0 - Current Implementation)

Since rules are currently hardcoded, customization requires editing the script directly.

### Edit `cortex/scripts/generate-daily-digest.mjs`

Find the `estimateCategory` function (around line 220):

```javascript
function estimateCategory(task) {
  const rules = [
    { cat: 'ops', re: /運用|防御|incident|on[- ]?call|alert|pager|slack/i },
    { cat: 'n8n', re: /\bn8n\b|recipe|workflow|verification node|error workflow/i },
    { cat: 'cortex', re: /\bcortex\b|llm|digest|tomorrow\.json|daily/i },
    { cat: 'docs', re: /docs?|ドキュメント|readme|spec|設計/i },
    { cat: 'github', re: /github|\bpr\b|pull request|merge/i },
    { cat: 'infra', re: /deploy|production|staging|docker|k8s|server|infra/i },
  ];

  for (const r of rules) {
    if (r.re.test(task)) return r.cat;
  }
  return 'other';
}
```

### Add a New Category

```javascript
const rules = [
  // ... existing rules ...
  { cat: 'security', re: /security|vuln|cve|audit|pentest/i },
];
```

### Modify Existing Patterns

```javascript
// Before
{ cat: 'ops', re: /運用|防御|incident|on[- ]?call|alert|pager|slack/i },

// After (add more keywords)
{ cat: 'ops', re: /運用|防御|incident|on[- ]?call|alert|pager|slack|monitoring|observability/i },
```

---

## Future: Config-Based Rules (v2.0)

The `category-rules.json` file is a **design prototype** for config-based rule management.

### Benefits of Config-Based Approach

- ✅ No code changes required to update rules
- ✅ Version control for rule changes
- ✅ JSON schema validation
- ✅ Easier for non-developers to customize
- ✅ Rule priority support

### Example: category-rules.json

```json
{
  "version": "1.0",
  "default_category": "other",
  "rules": [
    {
      "category": "ops",
      "priority": 1,
      "patterns": [
        "運用",
        "incident",
        "alert"
      ],
      "case_sensitive": false,
      "description": "Operations and incident response"
    }
  ]
}
```

### Implementation Steps (TODO)

To implement config-based rules, update `generate-daily-digest.mjs`:

```javascript
import fs from 'fs/promises';

// Load rules from config
const CATEGORY_RULES_PATH = path.join(ROOT, 'cortex/config/category-rules.json');

async function loadCategoryRules() {
  try {
    const config = JSON.parse(await fs.readFile(CATEGORY_RULES_PATH, 'utf8'));

    // Validate schema (optional, requires ajv or similar)
    // validateSchema(config);

    // Convert config to runtime rules
    return config.rules
      .sort((a, b) => (a.priority || 100) - (b.priority || 100))
      .map(rule => ({
        category: rule.category,
        regex: new RegExp(rule.patterns.join('|'), rule.case_sensitive ? '' : 'i')
      }));
  } catch (error) {
    console.warn('⚠️  Failed to load category rules, using defaults:', error.message);
    return getDefaultRules(); // Fallback to hardcoded
  }
}

function estimateCategory(task, rules) {
  for (const rule of rules) {
    if (rule.regex.test(task)) return rule.category;
  }
  return 'other';
}

// Usage
const categoryRules = await loadCategoryRules();
const category = estimateCategory(taskText, categoryRules);
```

---

## Schema Validation (Optional)

Install `ajv` for JSON schema validation:

```bash
pnpm add ajv
```

Then validate the config:

```javascript
import Ajv from 'ajv';

const ajv = new Ajv();
const schema = JSON.parse(await fs.readFile('cortex/config/category-rules.schema.json', 'utf8'));
const validate = ajv.compile(schema);

if (!validate(config)) {
  throw new Error(`Invalid category rules config: ${JSON.stringify(validate.errors)}`);
}
```

---

## Testing Category Rules

Test individual patterns:

```javascript
const testCases = [
  { task: 'Fix n8n workflow error', expected: 'n8n' },
  { task: 'Update README.md', expected: 'docs' },
  { task: 'Deploy to production', expected: 'infra' },
  { task: 'Respond to incident alert', expected: 'ops' },
  { task: 'Random task', expected: 'other' },
];

for (const test of testCases) {
  const result = estimateCategory(test.task, rules);
  console.log(`${result === test.expected ? '✅' : '❌'} "${test.task}" → ${result} (expected: ${test.expected})`);
}
```

---

## Rule Design Best Practices

### 1. Specific Before General

Place more specific patterns before general ones:

```javascript
// ✅ Good: Specific first
{ cat: 'n8n', re: /\bn8n\b|recipe|workflow/ },
{ cat: 'ops', re: /運用|incident/ },

// ❌ Bad: General first (might catch n8n tasks as ops)
{ cat: 'ops', re: /運用|incident|workflow/ },  // "workflow" is too general
{ cat: 'n8n', re: /\bn8n\b|recipe/ },
```

### 2. Use Word Boundaries

Avoid false positives with `\b`:

```javascript
// ✅ Good: Only matches "n8n" as whole word
/\bn8n\b/

// ❌ Bad: Matches "n8n" in "design8n"
/n8n/
```

### 3. Escape Special Regex Characters

```javascript
// ✅ Good: Properly escaped
/tomorrow\.json/

// ❌ Bad: . matches any character
/tomorrow.json/  // Matches "tomorrowXjson"
```

### 4. Support Multilingual Patterns

```javascript
{ cat: 'docs', re: /docs?|ドキュメント|readme|spec|設計/i }
```

---

## Related Files

- **Config**: `cortex/config/category-rules.json`
- **Schema**: `cortex/config/category-rules.schema.json`
- **Script**: `cortex/scripts/generate-daily-digest.mjs`
- **Heatmap**: `cortex/state/category_heatmap.json`

---

**Last Updated**: 2025-12-15
**Status**: Design prototype (implementation optional)
