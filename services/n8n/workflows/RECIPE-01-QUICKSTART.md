# Recipe 01: Obsidian → Slack — Quick Start Guide

**Phase**: 2.1
**Time to Complete**: ~10 minutes
**Status**: Ready to implement

---

## 🎯 What This Does

When you update an ADR or Spec file in Obsidian, this workflow automatically sends a notification to your Slack channel.

**Flow**:
```
Obsidian note update → HTTP POST → n8n → Filter (ADR/Spec only) → Slack notification
```

---

## 🛠️ Setup Steps

### Step 1: Get Slack Webhook URL (5 min)

1. Go to [Slack API](https://api.slack.com/messaging/webhooks)
2. Click "Create New App" → "From scratch"
3. App name: **"Obsidian Notifier"**
4. Select your workspace
5. Navigate to "Incoming Webhooks" → Enable it
6. Click "Add New Webhook to Workspace"
7. Select the channel (e.g., `#general` or `#docs-updates`)
8. **Copy the Webhook URL** (looks like: `https://hooks.slack.com/services/XXX/YYY/ZZZ`)

**Save this URL** — you'll need it in Step 3.

---

### Step 2: Import Workflow to n8n (2 min)

1. Open n8n: http://localhost:5678
2. Click "Add workflow" → Import from File
3. Select: `services/n8n/workflows/recipe-01-obsidian-slack.json`
4. Click "Import"

The workflow will appear in your n8n editor.

---

### Step 3: Configure Slack Credentials (2 min)

1. In the n8n workflow editor, click on the **"Slack Notification"** node
2. Click "Credential to connect with" dropdown
3. Click "Create New Credential"
4. Select **"Slack Webhook"**
5. Paste your Webhook URL from Step 1
6. Name it: **"Slack Webhook - Obsidian"**
7. Click "Save"

---

### Step 4: Activate the Workflow (1 sec)

1. Click the **"Active"** toggle in the top-right corner
2. The workflow is now live! 🎉

---

## 🧪 Test the Workflow

### Test with curl

```bash
curl -X POST http://localhost:5678/webhook/obsidian-update \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "docs/decisions/ADR-0006-phase-2-automation-strategy.md",
    "author": "Test User",
    "summary": "Testing Recipe 1 workflow",
    "event": "modified",
    "timestamp": "2025-11-17T12:00:00Z"
  }'
```

**Expected Result**: You should see a message in your Slack channel! 🎉

---

### What the Slack Message Looks Like

```
📄 Obsidian Note Updated

File: docs/decisions/ADR-0006-phase-2-automation-strategy.md
Author: Test User
Event: modified
Summary: Testing Recipe 1 workflow
Time: 2025-11-17T12:00:00Z
```

---

## 🔧 Troubleshooting

### Workflow doesn't trigger
- Check that the workflow is **Active** (toggle in top-right)
- Verify the Webhook URL: `http://localhost:5678/webhook/obsidian-update`
- Check n8n logs: click "Executions" tab in n8n

### Slack notification doesn't appear
- Verify Slack Webhook URL is correct
- Check if the file path matches the filter (must include `ADR-`, `spec/`, or `docs/decisions/`)
- Test the Slack Webhook directly:
  ```bash
  curl -X POST YOUR_SLACK_WEBHOOK_URL \
    -H "Content-Type: application/json" \
    -d '{"text": "Test message"}'
  ```

### No notification for certain files
- Check the filter logic in the **"Filter ADR/Spec Files"** node
- Current filter: `filePath.includes('ADR-')` or `filePath.includes('spec/')` or `filePath.includes('docs/decisions/')`
- Modify the filter if you want to include other paths

---

## 🎨 Customization Ideas

### Change the Slack Message Format

Edit the **"Slack Notification"** node's "Text" field:

```
📝 *New Document Update*

*{{ $json.file }}* was {{ $json.event }}
by *{{ $json.author }}*

> {{ $json.summary }}

_Updated at {{ $json.timestamp }}_
```

### Add More File Filters

Edit the **"Filter ADR/Spec Files"** node's code:

```javascript
const filePath = $input.item.json.filePath || '';

// Add more conditions
if (filePath.includes('ADR-') ||
    filePath.includes('spec/') ||
    filePath.includes('README') ||
    filePath.includes('CHANGELOG')) {
  return { json: { shouldNotify: true, ... } };
}
```

### Send to Different Channels

1. Create multiple Slack Webhook URLs (one per channel)
2. Add an IF node after the filter to route based on file path
3. Connect different Slack nodes for different channels

---

## 🚀 Next Steps

Once Recipe 1 is working:

- ✅ **Phase 2.1**: Implement Recipe 2 (Daily KB Rebuild)
- 🔄 **Integration**: Connect Obsidian MCP to auto-detect changes
- 📊 **Monitoring**: Set up execution logging in n8n

---

## 📋 Workflow Summary

| Node | Type | Purpose |
|------|------|---------|
| Obsidian Update Webhook | Webhook Trigger | Receives HTTP POST from external sources |
| Filter ADR/Spec Files | Code (JavaScript) | Filters only ADR/Spec files |
| Should Notify? | IF Condition | Checks if notification should be sent |
| Slack Notification | Slack Webhook | Sends message to Slack |
| Skip (No Match) | No Operation | Silent skip for non-matching files |

---

## 🔗 Related Documents

- [ADR-0006: Phase 2 Automation Strategy](../../../docs/decisions/ADR-0006-phase-2-automation-strategy.md)
- [Phase 2 Implementation Guide](../../../docs/operations/phase-2-implementation.md)
- [MCP Recipes Catalog](../../../docs/operations/mcp-recipes.md)

---

**Recipe 1 is ready to go! 🚀**

**Estimated setup time**: ~10 minutes
**Difficulty**: Easy
**Prerequisites**: n8n running, Slack workspace access

**Last Updated**: 2025-11-17
