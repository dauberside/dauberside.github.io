# Recipe Logging Quick Start Guide

**目的**: 任意の Recipe に JSONL logging を5分で追加する

**前提**: ADR-0010 に基づく Method B（直接追記方式）

---

## 実装手順（3ステップ）

### Step 1: workflow JSON にノードを追加

**Location**: `services/n8n/workflows/recipe-XX-name.json`

**追加するノード**（2個）:

```json
{
  "parameters": {
    "jsCode": "// Prepare JSONL log entry\nconst startTime = $('TRIGGER_NODE_NAME').first().json.startTime || Date.now();\nconst endTime = Date.now();\n\n// Get result data from your workflow\nconst resultData = $('MAIN_RESULT_NODE').first().json;\n\nconst logEntry = {\n  ts: new Date().toISOString(),\n  workflow: \"Recipe XX: Your Workflow Name\",\n  executionId: $executionId,\n  status: \"success\",\n  durationMs: endTime - startTime,\n  env: \"production\",\n  errorMessage: null,\n  meta: {\n    // ADD YOUR CUSTOM FIELDS HERE\n    exampleField: resultData.exampleValue\n  }\n};\n\nconst today = new Date().toISOString().split('T')[0];\nconst filename = `cortex/logs/recipe-XX-${today}.jsonl`;\nconst logLine = JSON.stringify(logEntry);\n\nreturn {\n  json: {\n    logEntry: logEntry,\n    logLine: logLine,\n    filename: filename\n  }\n};"
  },
  "id": "prepare-log",
  "name": "Prepare Log Entry",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [YOUR_X, YOUR_Y]
},
{
  "parameters": {
    "command": "={{ \"echo '\" + $json.logLine + \"' >> /workspace/dauberside.github.io-1/\" + $json.filename }}",
    "options": {}
  },
  "id": "write-log",
  "name": "Write JSONL Log",
  "type": "n8n-nodes-base.executeCommand",
  "typeVersion": 1,
  "position": [YOUR_X + 200, YOUR_Y],
  "onError": "continueRegularOutput"
}
```

### Step 2: connections を追加

```json
"LAST_BUSINESS_NODE": {
  "main": [
    [
      {
        "node": "Prepare Log Entry",
        "type": "main",
        "index": 0
      }
    ]
  ]
},
"Prepare Log Entry": {
  "main": [
    [
      {
        "node": "Write JSONL Log",
        "type": "main",
        "index": 0
      }
    ]
  ]
}
```

### Step 3: JSON 検証

```bash
python3 -m json.tool services/n8n/workflows/recipe-XX-name.json > /dev/null && echo "✅ Valid" || echo "❌ Invalid"
```

---

## Meta Fields 設計ガイド

### Recipe 02 (KB Rebuild)
```javascript
meta: {
  scriptsRun: 3,
  kbChunks: $('Build KB').first().json.totalChunks,
  kbSizeMB: ($('Build KB').first().json.sizeBytes / 1048576).toFixed(2),
  rebuildSuccess: true
}
```

### Recipe 10 (TODO Auto-sync)
```javascript
meta: {
  tasksAdded: $('Merge Tasks').first().json.newTasksCount,
  totalTasks: $('Extract Tasks').first().json.taskCount,
  sourceSection: $('Extract Tasks').first().json.sourceSection,
  statusCode: $('Update TODO').first().json.statusCode,
  target: "vault/TODO.md"
}
```

### Recipe 11 (Weekly Summary)
```javascript
meta: {
  weeksProcessed: 1,
  digestsFound: $('Count Digests').first().json.count,
  summaryLength: $('Generate Summary').first().json.length,
  weekNumber: $('Calculate Week').first().json.weekNumber
}
```

### Recipe 13 (Nightly Wrap-up)
```javascript
meta: {
  sessionDuration: $('Calculate Duration').first().json.minutes,
  tasksCompleted: $('Count Tasks').first().json.completed,
  tomorrowGenerated: $('Generate Tomorrow').first().json.success,
  digestPath: $('Write Digest').first().json.path
}
```

### Recipe 14 (Daily Digest Generator)
```javascript
meta: {
  digestLength: $('Format Digest').first().json.length,
  tasksExtracted: $('Extract Tasks').first().json.count,
  dateGenerated: $('Calculate Date').first().json.date,
  digestPath: $('Write File').first().json.path
}
```

### Recipe 15 (Daily Analytics Runner)
```javascript
meta: {
  scriptsRun: 3,
  durationSuccess: $('Run Duration').first().json.success,
  rhythmSuccess: $('Run Rhythm').first().json.success,
  categorySuccess: $('Run Category').first().json.success
}
```

---

## Checklist

### 実装時
- [ ] `workflow` フィールドに正しい Recipe 名を記載
- [ ] `meta` フィールドに Recipe 固有のデータを含める
- [ ] `filename` に正しい Recipe 番号（XX）を記載
- [ ] JSON syntax が valid か確認
- [ ] `onError: continueRegularOutput` を設定（ログ失敗時もワークフロー継続）

### テスト時
- [ ] n8n でワークフローを再インポート
- [ ] 手動実行してログファイル生成を確認
- [ ] `jq .` でログ内容を確認（valid JSON か）
- [ ] `meta` フィールドに期待する値が入っているか確認

### デプロイ後
- [ ] 自動実行後のログファイル確認（翌日）
- [ ] 7日分のログが蓄積されるまで監視
- [ ] `analyze-health.py` で Automation score 改善を確認

---

## Troubleshooting

### ログファイルが生成されない
1. Execute Command ノードの権限確認
2. `/workspace/dauberside.github.io-1/` パスが正しいか確認
3. `cortex/logs/` ディレクトリが存在するか確認

### JSON が invalid
1. `logLine` の中で single quote が escape されているか
2. `JSON.stringify()` でエスケープ処理されているか
3. `python3 -m json.tool` で検証

### meta フィールドが null
1. ノード名が正しいか確認（`$('Node Name')`）
2. `.first().json` でデータが取得できているか確認
3. Fallback値を設定（`|| 0`, `|| 'default'`）

---

## Example: Recipe 13 実装

**Before** (最後のノード):
```json
{
  "name": "Write Tomorrow JSON",
  "type": "n8n-nodes-base.writeFile",
  ...
}
```

**After** (ログノード追加):
```json
{
  "name": "Write Tomorrow JSON",
  "type": "n8n-nodes-base.writeFile",
  ...
},
{
  "name": "Prepare Log Entry",
  "type": "n8n-nodes-base.code",
  "parameters": {
    "jsCode": "const logEntry = { ts: new Date().toISOString(), workflow: \"Recipe 13: Nightly Wrap-up\", ... }; ..."
  },
  ...
},
{
  "name": "Write JSONL Log",
  "type": "n8n-nodes-base.executeCommand",
  "parameters": {
    "command": "={{ \"echo '\" + $json.logLine + \"' >> /workspace/dauberside.github.io-1/\" + $json.filename }}"
  },
  ...
}
```

**Connections**:
```json
"Write Tomorrow JSON": {
  "main": [[{"node": "Prepare Log Entry", ...}]]
},
"Prepare Log Entry": {
  "main": [[{"node": "Write JSONL Log", ...}]]
}
```

---

## Time Estimates

- Recipe 13: 15分（シンプルなワークフロー）
- Recipe 14: 15分（シンプルなワークフロー）
- Recipe 02: 20分（複雑なメタデータ）
- Recipe 11: 20分（複雑なメタデータ）
- Recipe 03: 15分（レガシー、優先度低）

---

## Success Criteria

✅ `cortex/logs/recipe-XX-YYYY-MM-DD.jsonl` が生成される
✅ `jq . cortex/logs/recipe-XX-*.jsonl` が valid JSON を返す
✅ `meta` フィールドに意味のあるデータが含まれる
✅ 7日間の自動実行でログが蓄積される
✅ `analyze-health.py` で Automation score が改善
