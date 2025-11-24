# MCP × n8n 自動化レシピ集

このドキュメントでは、MCP サーバーと n8n ワークフローを組み合わせた典型的な自動化パターン（レシピ）を紹介します。

---

## 📖 概要

### MCP × n8n 自動化とは

**MCP (Model Context Protocol)** と **n8n (Workflow Automation)** を組み合わせることで、以下のような強力な自動化フローを構築できます：

- **Obsidian ノート更新** → Slack/メール通知
- **ADR 作成** → KB 再インデックス → GitHub Issue コメント
- **KB 更新検出** → チーム通知 → ドキュメントレビュー依頼
- **エラー検出** → アラート送信 → 自動復旧試行

### アーキテクチャ概要

```mermaid
flowchart LR
    subgraph MCP["MCP Layer"]
        OBSIDIAN[Obsidian MCP]
        GITHUB[GitHub MCP]
        GCAL[Google Calendar MCP]
    end

    subgraph N8N["n8n Workflow Engine"]
        WEBHOOK[Webhook Trigger]
        LOGIC[Workflow Logic]
        ACTIONS[Action Nodes]
    end

    subgraph External["External Services"]
        SLACK[Slack]
        EMAIL[Email]
        GH_ISSUES[GitHub Issues]
    end

    subgraph KB["Knowledge Base"]
        INDEX[Embeddings Index]
        SEARCH[RAG Search]
    end

    OBSIDIAN -->|ノート更新イベント| WEBHOOK
    GITHUB -->|PR/Issue イベント| WEBHOOK
    GCAL -->|予定追加| WEBHOOK

    WEBHOOK --> LOGIC
    LOGIC --> ACTIONS
    ACTIONS --> SLACK
    ACTIONS --> EMAIL
    ACTIONS --> GH_ISSUES
    ACTIONS -->|KB 再構築| INDEX
    INDEX --> SEARCH
```

---

## 📚 Recipe Catalog（レシピ一覧）

### 🔵 Documentation Workflows（ドキュメント系）

| # | レシピ名 | トリガー | アクション | Phase |
|---|---------|---------|-----------|-------|
| **1** | Obsidian → Slack 通知 | ノート更新 | Slack チャンネル投稿 | 2 |
| **2** | ADR 追加 → KB 再インデックス | ADR ファイル作成 | KB rebuild → GitHub comment | 2 |
| **3** | Spec 更新 → レビュー依頼 | Spec 変更検出 | Slack DM → GitHub PR 作成 | 2 |

### 🟢 Development Workflows（開発系）

| # | レシピ名 | トリガー | アクション | Phase |
|---|---------|---------|-----------|-------|
| **4** | PR マージ → KB 自動更新 | GitHub PR merged | KB ingest → Vercel deploy | 2 |
| **5** | Build 失敗 → アラート | GitHub Actions failure | Slack alert → Issue 自動作成 | 2 |
| **6** | Healthz 異常検出 | `/api/healthz` 503 | PagerDuty alert → 自動再起動 | 3 |

### 🟡 Scheduling Workflows（スケジュール系）

| # | レシピ名 | トリガー | アクション | Phase |
|---|---------|---------|-----------|-------|
| **7** | 定期 KB 再構築 | Cron (毎日 3:00) | KB rebuild → Slack 完了通知 | 2 |
| **8** | 週次レポート生成 | Cron (毎週月曜) | Usage metrics → GitHub Issue | 3 |
| **9** | Daily Digest → Claude Code 連携 | Cron (毎日 08:00) | Obsidian Tasks 抽出 → ファイル出力 → Slack 通知 | 2 |
| **11** | Weekly Summary (Cortex OS) | Cron (毎週日曜 23:00) | 7日分 Digest 集約 → Obsidian → Slack | 2 |

---

## 🍳 Detailed Recipes（詳細レシピ）

### Recipe 1: Obsidian ノート更新 → Slack 通知

**用途**: 重要なノート（ADR, Specs）が更新されたときにチームに自動通知

**前提条件**:
- Obsidian Local REST API Plugin 有効
- n8n インスタンス稼働
- Slack Webhook URL 設定済み

**フロー図**:
```mermaid
flowchart LR
    OBS[Obsidian<br/>ノート更新] -->|REST API| N8N[n8n Webhook]
    N8N --> FILTER{ファイルパス<br/>フィルタ}
    FILTER -->|ADR or Spec| SLACK[Slack 通知]
    FILTER -->|その他| SKIP[Skip]
```

**n8n ワークフロー設定例**:

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Obsidian Update Webhook",
      "parameters": {
        "path": "obsidian-update",
        "httpMethod": "POST",
        "responseMode": "onReceived"
      }
    },
    {
      "type": "n8n-nodes-base.filter",
      "name": "Filter ADR/Spec",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.filePath }}",
              "operation": "contains",
              "value2": "ADR-"
            },
            {
              "value1": "={{ $json.filePath }}",
              "operation": "contains",
              "value2": "spec/"
            }
          ],
          "combineOperation": "any"
        }
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Slack Notification",
      "parameters": {
        "channel": "#docs-updates",
        "text": "📝 Document updated: {{ $json.filePath }}\nBy: {{ $json.author }}\n{{ $json.summary }}"
      }
    }
  ]
}
```

**トリガースクリプト例** (Obsidian Plugin 側):
```javascript
// Obsidian plugin code (pseudo)
async function onFileModified(file) {
  if (file.path.includes('ADR-') || file.path.includes('spec/')) {
    await fetch('http://localhost:5678/webhook/obsidian-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: file.path,
        author: file.lastModifiedBy,
        summary: file.excerpt(100),
        timestamp: new Date().toISOString()
      })
    });
  }
}
```

---

### Recipe 2: ADR 追加 → KB 再インデックス → GitHub Comment

**用途**: 新しい ADR が作成されたら、自動で KB に反映し、関連 Issue にコメント

**フロー図**:
```mermaid
flowchart LR
    ADR[ADR ファイル<br/>作成] -->|Git push| GH[GitHub Webhook]
    GH --> N8N[n8n Workflow]
    N8N --> KB[KB Rebuild<br/>POST /api/obsidian/ingest]
    KB --> COMMENT[GitHub Issue<br/>Comment]
    KB --> SLACK[Slack 通知]
```

**n8n ワークフロー設定例**:

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "GitHub Push Webhook",
      "parameters": {
        "path": "github-push",
        "httpMethod": "POST"
      }
    },
    {
      "type": "n8n-nodes-base.filter",
      "name": "Filter ADR Files",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.commits[0].added.join(',') }}",
              "operation": "contains",
              "value2": "docs/decisions/ADR-"
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Trigger KB Rebuild",
      "parameters": {
        "method": "POST",
        "url": "https://your-app.vercel.app/api/obsidian/ingest",
        "authentication": "headerAuth",
        "options": {
          "timeout": 60000
        }
      }
    },
    {
      "type": "n8n-nodes-base.github",
      "name": "Comment on Related Issue",
      "parameters": {
        "operation": "createIssueComment",
        "issueNumber": "={{ $json.issueNumber }}",
        "body": "📚 ADR updated: {{ $json.adrTitle }}\nKnowledge Base has been rebuilt.\n\nView: [{{ $json.adrPath }}]({{ $json.adrUrl }})"
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Slack Notification",
      "parameters": {
        "channel": "#architecture",
        "text": "🏛️ New ADR: {{ $json.adrTitle }}\nKB updated and team notified."
      }
    }
  ]
}
```

---

### Recipe 3: Spec 更新 → レビュー依頼

**用途**: 仕様書が更新されたら、関連する開発者に自動でレビュー依頼

**フロー図**:
```mermaid
flowchart LR
    SPEC[Spec ファイル<br/>更新] -->|Obsidian REST| N8N[n8n Workflow]
    N8N --> PARSE[関連者抽出<br/>frontmatter]
    PARSE --> SLACK[Slack DM<br/>レビュー依頼]
    PARSE --> GH[GitHub PR<br/>作成]
```

**設定例**:
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Spec Update Webhook",
      "parameters": {
        "path": "spec-update"
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Parse Frontmatter",
      "parameters": {
        "jsCode": "const frontmatter = $input.item.json.frontmatter;\nconst reviewers = frontmatter.reviewers || [];\nreturn reviewers.map(r => ({ reviewer: r }));"
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Send DM to Reviewers",
      "parameters": {
        "channel": "@{{ $json.reviewer }}",
        "text": "📋 Spec review requested: {{ $json.specTitle }}\nPlease review by {{ $json.deadline }}\n{{ $json.specUrl }}"
      }
    }
  ]
}
```

---

### Recipe 4: PR マージ → KB 自動更新

**用途**: ドキュメント変更の PR がマージされたら、自動で KB を再構築して Vercel にデプロイ

**フロー図**:
```mermaid
flowchart LR
    PR[PR マージ] -->|GitHub Webhook| N8N[n8n Workflow]
    N8N --> FILTER{docs/ 変更?}
    FILTER -->|Yes| KB[KB Rebuild]
    KB --> DEPLOY[Vercel Deploy]
    DEPLOY --> SLACK[Slack 完了通知]
    FILTER -->|No| SKIP[Skip]
```

**設定例**:
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "GitHub PR Merged",
      "parameters": {
        "path": "github-pr-merged",
        "httpMethod": "POST"
      }
    },
    {
      "type": "n8n-nodes-base.filter",
      "name": "Filter Docs Changes",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.pull_request.files }}",
              "operation": "contains",
              "value2": "docs/"
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Trigger KB Rebuild",
      "parameters": {
        "method": "POST",
        "url": "{{ $env.APP_URL }}/api/obsidian/ingest",
        "authentication": "headerAuth"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Trigger Vercel Deploy",
      "parameters": {
        "method": "POST",
        "url": "https://api.vercel.com/v1/deployments",
        "authentication": "headerAuth"
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Success Notification",
      "parameters": {
        "channel": "#deployments",
        "text": "✅ Docs updated and deployed\nPR: {{ $json.pr_title }}\nKB rebuilt: {{ $json.kb_chunks }} chunks"
      }
    }
  ]
}
```

---

### Recipe 5: Build 失敗 → アラート + Issue 作成

**用途**: CI/CD パイプラインが失敗したら、Slack でアラートを送り、GitHub Issue を自動作成

**フロー図**:
```mermaid
flowchart LR
    CI[GitHub Actions<br/>Failure] -->|Webhook| N8N[n8n Workflow]
    N8N --> SLACK[Slack Alert<br/>#alerts]
    N8N --> ISSUE[GitHub Issue<br/>自動作成]
    ISSUE --> LABEL[Label: bug<br/>Assignee: oncall]
```

**設定例**:
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "CI Failure Webhook",
      "parameters": {
        "path": "ci-failure"
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Alert Slack",
      "parameters": {
        "channel": "#alerts",
        "text": "🚨 Build failed: {{ $json.workflow_name }}\nCommit: {{ $json.commit_sha }}\nBranch: {{ $json.branch }}\nLogs: {{ $json.logs_url }}"
      }
    },
    {
      "type": "n8n-nodes-base.github",
      "name": "Create Issue",
      "parameters": {
        "operation": "createIssue",
        "title": "CI Failure: {{ $json.workflow_name }}",
        "body": "**Build failed**\n\nCommit: {{ $json.commit_sha }}\nBranch: {{ $json.branch }}\nLogs: {{ $json.logs_url }}\n\nAuto-created by n8n workflow.",
        "labels": ["bug", "ci-failure"],
        "assignees": ["{{ $json.oncall_engineer }}"]
      }
    }
  ]
}
```

---

### Recipe 6: Healthz 異常検出 → 自動復旧

**用途**: `/api/healthz` が 503 を返したら、アラートを送信し、自動再起動を試行

**フロー図**:
```mermaid
flowchart LR
    CRON[Cron Trigger<br/>5分毎] --> HEALTHZ[/api/healthz<br/>チェック]
    HEALTHZ --> CHECK{ok: true?}
    CHECK -->|No| ALERT[PagerDuty Alert]
    CHECK -->|No| RESTART[PM2 Restart<br/>next-app]
    CHECK -->|No| SLACK[Slack 通知]
    CHECK -->|Yes| OK[正常]
```

**設定例**:
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.cron",
      "name": "Health Check Cron",
      "parameters": {
        "cronExpression": "*/5 * * * *"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Check Healthz",
      "parameters": {
        "method": "GET",
        "url": "{{ $env.APP_URL }}/api/healthz",
        "options": {
          "timeout": 10000
        }
      }
    },
    {
      "type": "n8n-nodes-base.if",
      "name": "Check OK Status",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.ok }}",
              "value2": true
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "PagerDuty Alert",
      "parameters": {
        "method": "POST",
        "url": "https://events.pagerduty.com/v2/enqueue",
        "body": {
          "event_action": "trigger",
          "payload": {
            "summary": "Healthz check failed",
            "severity": "critical",
            "source": "n8n-healthz-monitor"
          }
        }
      }
    },
    {
      "type": "n8n-nodes-base.executeCommand",
      "name": "Restart PM2",
      "parameters": {
        "command": "npx pm2 restart next-app"
      }
    }
  ]
}
```

---

### Recipe 7: 定期 KB 再構築

**用途**: 毎日深夜に KB を自動で再構築して、最新のドキュメントを反映

**フロー図**:
```mermaid
flowchart LR
    CRON[Cron<br/>毎日 3:00] --> KB[KB Rebuild<br/>pnpm kb:build]
    KB --> CHECK{成功?}
    CHECK -->|Yes| SLACK_OK[Slack 成功通知]
    CHECK -->|No| SLACK_ERR[Slack エラー通知]
    CHECK -->|No| ISSUE[GitHub Issue]
```

**設定例**:
```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.cron",
      "name": "Daily KB Rebuild",
      "parameters": {
        "cronExpression": "0 3 * * *"
      }
    },
    {
      "type": "n8n-nodes-base.executeCommand",
      "name": "Run KB Build",
      "parameters": {
        "command": "cd /path/to/repo && pnpm kb:build"
      }
    },
    {
      "type": "n8n-nodes-base.if",
      "name": "Check Success",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.exitCode }}",
              "value2": 0
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Success Notification",
      "parameters": {
        "channel": "#kb-updates",
        "text": "✅ Daily KB rebuild completed\nChunks: {{ $json.chunks }}\nDuration: {{ $json.duration }}s"
      }
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Error Notification",
      "parameters": {
        "channel": "#alerts",
        "text": "❌ KB rebuild failed\nError: {{ $json.error }}\nLogs: {{ $json.logs }}"
      }
    }
  ]
}
```

---

### Recipe 9: Daily Digest → Claude Code 連携

**用途**: 毎朝 Obsidian の Daily Note から Tasks と Reflection を抽出し、Claude Code が読めるファイルとして出力。同時に Slack にも通知。

**前提条件**:
- Obsidian Local REST API Plugin 有効
- n8n インスタンス稼働
- Slack Webhook URL 設定済み
- プロジェクトリポジトリへの書き込み権限（n8n から）

**フロー図**:
```mermaid
flowchart LR
    CRON[Cron<br/>毎日 08:00] --> DATE[昨日の日付<br/>計算]
    DATE --> OBS[Obsidian から<br/>Daily Note 取得]
    OBS --> PARSE[Tasks/Reflection<br/>抽出]
    PARSE --> FILE[Write File<br/>notifications/daily/]
    PARSE --> SLACK[Slack 通知]
```

**n8n ワークフロー設定例**:

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.cron",
      "name": "Daily Digest Cron",
      "parameters": {
        "cronExpression": "0 8 * * *"
      },
      "position": [250, 300]
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Calculate Yesterday Date",
      "parameters": {
        "jsCode": "const yesterday = new Date();\nyesterday.setDate(yesterday.getDate() - 1);\nconst year = yesterday.getFullYear();\nconst month = String(yesterday.getMonth() + 1).padStart(2, '0');\nconst day = String(yesterday.getDate()).padStart(2, '0');\nreturn [{ json: { date: `${year}-${month}-${day}`, filePath: `daily/${year}-${month}-${day}.md` } }];"
      },
      "position": [450, 300]
    },
    {
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "name": "Get Daily Note",
      "parameters": {
        "toolName": "obsidian_get_file_contents",
        "arguments": "={{ JSON.stringify({ filepath: $json.filePath }) }}"
      },
      "position": [650, 300]
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Parse Tasks and Reflection",
      "parameters": {
        "jsCode": "const content = $input.item.json.content || '';\n\n// Extract Tasks section\nconst tasksMatch = content.match(/## Tasks\\n([\\s\\S]*?)(?=\\n## |$)/);\nconst tasks = tasksMatch ? tasksMatch[1].trim() : 'No tasks found';\n\n// Extract Reflection section\nconst reflectionMatch = content.match(/## Reflection\\n([\\s\\S]*?)(?=\\n## |$)/);\nconst reflection = reflectionMatch ? reflectionMatch[1].trim() : 'No reflection found';\n\nconst date = $('Calculate Yesterday Date').item.json.date;\nconst generatedAt = new Date().toISOString();\n\n// Build Markdown for Claude Code\nconst markdown = `# Daily Digest - ${date}\n\n## Tasks\n${tasks}\n\n## Reflection\n${reflection}\n\n---\n\nMetadata:\n- Source: Obsidian daily/${date}.md\n- GeneratedAt: ${generatedAt}\n`;\n\n// Build Slack message\nconst slackMessage = `📋 *Daily Digest - ${date}*\\n\\n*Tasks:*\\n${tasks}\\n\\n*Reflection:*\\n${reflection}`;\n\nreturn [{ json: { date, markdown, slackMessage, tasks, reflection } }];"
      },
      "position": [850, 300]
    },
    {
      "type": "n8n-nodes-base.writeFile",
      "name": "Write Digest File",
      "parameters": {
        "fileName": "=/workspace/dauberside.github.io-1/notifications/daily/{{ $json.date }}-digest.md",
        "options": {
          "append": false
        }
      },
      "position": [1050, 200]
    },
    {
      "type": "n8n-nodes-base.slack",
      "name": "Slack Notification",
      "parameters": {
        "channel": "#daily-digest",
        "text": "={{ $json.slackMessage }}"
      },
      "position": [1050, 400]
    }
  ],
  "connections": {
    "Daily Digest Cron": {
      "main": [[{ "node": "Calculate Yesterday Date", "type": "main", "index": 0 }]]
    },
    "Calculate Yesterday Date": {
      "main": [[{ "node": "Get Daily Note", "type": "main", "index": 0 }]]
    },
    "Get Daily Note": {
      "main": [[{ "node": "Parse Tasks and Reflection", "type": "main", "index": 0 }]]
    },
    "Parse Tasks and Reflection": {
      "main": [
        [
          { "node": "Write Digest File", "type": "main", "index": 0 },
          { "node": "Slack Notification", "type": "main", "index": 0 }
        ]
      ]
    }
  }
}
```

**Write File ノード設定の詳細**:

| 設定項目 | 値 | 説明 |
|---------|---|------|
| File Name | `/workspace/dauberside.github.io-1/notifications/daily/{{ $json.date }}-digest.md` | n8n から見たファイルパス。Docker 環境なら `/workspace` をマウント先に合わせる |
| Data Property Name | `markdown` | Code ノードで組み立てた Markdown 文字列 |
| Append | `false` | 毎日新規作成（上書き） |

**Claude Code での使い方**:

```bash
# 最新の digest を読んで TODO.md を更新
claude "notifications/daily の最新ファイルを読んで、今日やるタスクを checklist として TODO.md に追記して"

# 特定日の digest を参照
claude "notifications/daily/2025-11-18-digest.md を読んで、昨日の振り返りをサマリーして"
```

**出力例** (`notifications/daily/2025-11-18-digest.md`):

```markdown
# Daily Digest - 2025-11-18

## Tasks
- [x] Recipe 3 完成
- [ ] Weekly Summary 実装
- [ ] Recipe 9 テスト

## Reflection
- Phase 2 の自動化基盤が整った
- n8n と Obsidian の連携がスムーズに動作

---

Metadata:
- Source: Obsidian daily/2025-11-18.md
- GeneratedAt: 2025-11-19T08:00:03Z
```

---

### Recipe 10: Daily Digest → TODO.md Auto-sync

**用途**: 毎朝、Daily Digest から未完了タスク（`- [ ]`）を抽出し、Obsidian の TODO.md に自動追記。第二の脳の Working Memory を常に最新に保つ。

**前提条件**:
- Obsidian Local REST API Plugin 有効（HTTP port 27123）
- n8n インスタンス稼働
- Docker volume マウント（プロジェクト → `/workspace/dauberside.github.io-1`）
- Slack Webhook URL 設定済み

**フロー図**:
```mermaid
flowchart LR
    CRON[Cron<br/>毎日 08:05] --> DATE[日付計算]
    DATE --> READ[Daily Digest<br/>読み込み]
    READ --> EXTRACT[- [ ] タスク<br/>抽出]
    EXTRACT --> TODO_READ[TODO.md<br/>読み込み]
    TODO_READ --> MERGE[セクション<br/>マージ]
    MERGE --> TODO_WRITE[TODO.md<br/>書き戻し]
    TODO_WRITE --> SLACK[Slack 通知]
```

**n8n ワークフロー設定例**:

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.cron",
      "name": "Every Morning 08:05 JST",
      "parameters": {
        "triggerTimes": {
          "item": [{"hour": 8, "minute": 5}]
        }
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Calculate Date",
      "parameters": {
        "jsCode": "const now = new Date();\nconst y = now.getFullYear();\nconst m = String(now.getMonth() + 1).padStart(2, '0');\nconst d = String(now.getDate()).padStart(2, '0');\nconst dateStr = `${y}-${m}-${d}`;\nreturn [{\n  json: {\n    date: dateStr,\n    digestPath: `/workspace/dauberside.github.io-1/notifications/daily/${dateStr}-digest.md`,\n    sectionTitle: `## ${dateStr}`\n  }\n}];"
      }
    },
    {
      "type": "n8n-nodes-base.readWriteFile",
      "name": "Read Daily Digest",
      "parameters": {
        "operation": "read",
        "fileSelector": "={{ $json.digestPath }}"
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Extract Open Tasks",
      "parameters": {
        "jsCode": "const items = $input.all();\nconst dateInfo = $('Calculate Date').first().json;\nlet text = '';\nif (items[0].binary && items[0].binary.data) {\n  text = Buffer.from(items[0].binary.data.data, 'base64').toString('utf8');\n}\nconst tasks = text.split('\\n').map(l => l.trim()).filter(l => l.startsWith('- [ ]'));\nreturn [{\n  json: {\n    tasks,\n    taskCount: tasks.length,\n    date: dateInfo.date,\n    sectionTitle: dateInfo.sectionTitle\n  }\n}];"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Read TODO.md from Obsidian",
      "parameters": {
        "method": "GET",
        "url": "http://host.docker.internal:27123/vault/TODO.md",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "Authorization", "value": "Bearer YOUR_OBSIDIAN_API_KEY"}
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "name": "Merge Tasks into TODO",
      "parameters": {
        "jsCode": "// Merge tasks into TODO.md with date section"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Write TODO.md to Obsidian",
      "parameters": {
        "method": "PUT",
        "url": "http://host.docker.internal:27123/vault/TODO.md",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {"name": "Authorization", "value": "Bearer YOUR_OBSIDIAN_API_KEY"},
            {"name": "Content-Type", "value": "text/markdown"}
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { \"content\": $json.content } }}"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Slack Notification",
      "parameters": {
        "method": "POST",
        "url": "YOUR_SLACK_WEBHOOK_URL",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { \"text\": \"✅ TODO.md を更新しました\\n• 日付: \" + $json.date + \"\\n• 追記タスク数: \" + $json.taskCount + \" 件\" } }}"
      }
    }
  ]
}
```

**TODO.md 構造例**:
```markdown
# TODO - Working Memory

> 第二の脳の短期記憶。未完了タスクを集約。
> Daily Digest から自動追記される。

---

## 2025-11-18
- [ ] Recipe 9 テスト実行
- [ ] Weekly Summary ワークフロー設計
- [ ] Claude Code 連携動作確認

---

## Archive

### 2025-11-17
- [x] Recipe 1 完了
- [x] Recipe 2 完了
```

**Claude Code での使い方**:
```bash
# /init コマンドで TODO.md を自動読み込み
claude "/init"

# 直接 TODO.md を参照
claude "Obsidian の TODO.md を読んで、今日やるべきタスクを教えて"
```

---

### Recipe 11: Weekly Summary（Cortex OS／週次サマリー）

**用途**: 毎週日曜 23:00 に、直近7日分の Daily Digest を集約し、週次サマリーを Obsidian に保存＆Slack 通知。Cortex OS の週次ループを自動化。

**前提条件**:
- Obsidian Local REST API Plugin 有効
- n8n インスタンス稼働
- Slack Webhook URL 設定済み
- `notifications/daily/` に Daily Digest ファイルが存在

**フロー図**:
```mermaid
flowchart LR
    CRON[Cron<br/>毎週日曜 23:00] --> COLLECT[直近7日分<br/>Digest 読み込み]
    COLLECT --> BUILD[統計計算<br/>Markdown 生成]
    BUILD --> OBS[Obsidian<br/>weekly/*.md]
    BUILD --> SLACK[Slack 通知<br/>概要のみ]
```

**処理内容**:
- 完了 / 未完了タスク数の集計
- Highlights / Reflection / Challenges 抽出
- 進捗率の計算
- 次週のフォーカス候補の自動生成

**出力**:
- **Obsidian**: `weekly/YYYY-Www-summary.md`（週次サマリーの正本）
- **Slack**: ハイライトとメトリクスの概要通知

**Weekly Summary テンプレート**:

```markdown
# Weekly Summary — 2025-W47

対象期間: 2025-11-11 〜 2025-11-17

## 📊 Overview
- 完了タスク数: 12
- 未完了タスク数: 3
- 進捗率: 80%

## 🏆 Highlights
- 2025-11-15: ハイライトが記録されています
- 2025-11-17: ハイライトが記録されています

## 🧠 Reflection
- Phase 2 の自動化基盤が整った
- n8n と Obsidian の連携がスムーズに動作

## ⚠️ Challenges
- （特に記録された課題はありません）

## 🎯 Next Week Focus
- 今週の未完了タスクから 1〜3 件を選び、/brief でフォーカスする
- Recipe / Cortex OS のワークフローを 1 つだけ改善する
- 1つ「やらないこと」を決める
```

**n8n ワークフロー**:
- ファイル: `services/n8n/recipe-11-weekly-summary.json`
- インポート後、Obsidian API 認証と Slack Webhook URL を設定

**Claude Code での使い方**:
```bash
# 最新の Weekly Summary を参照
claude "weekly/ の最新サマリーを読んで、先週のハイライトを教えて"

# 週次の進捗傾向を分析
claude "weekly/ の過去4週分を読んで、タスク完了率の傾向を分析して"
```

---

### Recipe 12: wrap-up → brief データブリッジ（Cortex OS／記憶統合）

**用途**: /wrap-up で生成した「明日の候補」を JSON として保存し、翌朝の /brief が読み込んで優先順位を決定。Cortex OS に「睡眠と記憶統合」を追加。

**前提条件**:
- Obsidian MCP 有効
- /wrap-up, /brief コマンド設定済み

**データフロー**:
```
/wrap-up (22:00)
    ↓ 生成・保存
cortex/state/tomorrow.json
    ↓ 読み込み
/brief (翌朝)
```

**スキーマ** (`cortex/state/tomorrow.json`):
```json
{
  "generated_at": "2025-11-19T22:00:00Z",
  "source_date": "2025-11-19",
  "tomorrow_candidates": [
    "優先タスク1",
    "優先タスク2",
    "優先タスク3"
  ],
  "carryover_tasks": [
    "持ち越しタスク1"
  ],
  "reflection_summary": "今日の気づきを1行で"
}
```

**wrap-up での保存**:
```javascript
// 全文置き換え（delete + append）
obsidian_delete_file({ filepath: "cortex/state/tomorrow.json", confirm: true })
obsidian_append_content({
  filepath: "cortex/state/tomorrow.json",
  content: JSON.stringify(data, null, 2)
})
```

**brief での読み込み**:
```javascript
const tomorrow = JSON.parse(await obsidian_get_file_contents("cortex/state/tomorrow.json"))
// tomorrow.tomorrow_candidates を優先候補として使用
// tomorrow.carryover_tasks は必ず Today に含める
```

**効果**:
- 今日の終わりの意志 → 明日の朝の行動が自動で繋がる
- Cortex OS が「1日を記憶し、翌日に引き継ぐ」能力を獲得

---

## 🗺️ Implementation Roadmap

### Phase 2: 基本自動化（Q1 2026）

**優先レシピ**:
- ✅ Recipe 1: Obsidian → Slack 通知
- ✅ Recipe 2: ADR → KB → GitHub Comment
- ✅ Recipe 7: 定期 KB 再構築
- ✅ Recipe 9: Daily Digest → Claude Code 連携
- ✅ Recipe 10: Daily Digest → TODO.md Auto-sync
- ✅ Recipe 11: Weekly Summary (Cortex OS)
- ✅ Recipe 12: wrap-up → brief データブリッジ

**実装タスク**:
1. n8n インスタンス起動（Docker Compose）
2. Webhook エンドポイント設定
3. Slack / GitHub 認証設定
4. 基本ワークフロー作成＆テスト

### Phase 3: 高度な自動化（Q2 2026）

**追加レシピ**:
- ✅ Recipe 4: PR マージ → KB 自動更新
- ✅ Recipe 5: Build 失敗 → アラート
- ✅ Recipe 6: Healthz 異常検出 → 自動復旧

**実装タスク**:
1. PagerDuty 統合
2. PM2 リモート操作
3. エラーリカバリーロジック
4. モニタリングダッシュボード

### Phase 4: エンタープライズ拡張（Q3 2026）

**拡張機能**:
- カスタムレシピ作成UI
- ワークフロー versioning
- A/B テスト自動化
- メトリクス収集＆分析

---

## 🔗 Integration Points（統合ポイント）

### 既存システムとの接続

**1. Obsidian MCP**
- **接続方法**: REST API (Layer 1) または MCP (Layer 2)
- **用途**: ノート更新検出、コンテンツ取得
- **参照**: [MCP-Obsidian 統合仕様](./mcp-obsidian-spec.md)

**2. GitHub MCP**
- **接続方法**: GitHub Webhooks + MCP API
- **用途**: PR/Issue イベント処理
- **参照**: [MCP Setup Guide](./mcp-setup-guide.md)

**3. Knowledge Base**
- **接続方法**: `/api/obsidian/ingest` (POST)
- **用途**: Delta 更新、全体再構築
- **参照**: [KB Setup Guide](./kb-setup.md)

**4. Vercel Deployment**
- **接続方法**: Vercel API + Deployment Protection Bypass
- **用途**: 自動デプロイトリガー
- **参照**: [Deploy & Smoke Guide](./deploy-and-smoke.md)

---

## 🛠️ Development Setup

### ローカル n8n 起動

```bash
# Docker Compose で起動
docker compose up -d n8n

# または PM2 で起動
npx pm2 start services/ecosystem.config.cjs --only n8n

# アクセス
open http://localhost:5678
```

### Webhook テスト

```bash
# n8n Webhook にテストリクエスト送信
curl -X POST http://localhost:5678/webhook/obsidian-update \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "docs/decisions/ADR-0006-test.md",
    "author": "Test User",
    "summary": "Test ADR for workflow validation",
    "timestamp": "2025-11-17T12:00:00Z"
  }'
```

---

## 📚 関連ドキュメント

- [MCP Setup Guide](./mcp-setup-guide.md) - MCP サーバー初期設定
- [MCP Local Dev Guide](./mcp-local-dev.md) - MCP ローカル開発
- [KB Setup Guide](./kb-setup.md) - Knowledge Base 構築
- [Getting Started](./getting-started.md) - 開発者向けオンボーディング
- [ADR Index](../decisions/index.md) - ADR 一覧と関係図

---

## 📞 フィードバック・質問

レシピの追加や改善案があれば、[GitHub Issues](https://github.com/dauberside/dauberside.github.io/issues) でお知らせください。

---

**自動化で開発体験を最高に 🚀**

**最終更新**: 2025-11-19
