# Phase 2 Implementation Guide

**Status**: Active (Phase 2.1 in progress)
**Last Updated**: 2025-11-17
**Related**: [ADR-0006](../decisions/ADR-0006-phase-2-automation-strategy.md), [MCP Recipes](./mcp-recipes.md)

---

## 🎯 Overview

このガイドは、ADR-0006 で決定された **Phase 2 Automation Strategy** の実装手順を記載します。

Phase 2 は以下の 3 段階で進めます：
- **Phase 2.1**: 基本自動化（Recipe 1, 2, 3）
- **Phase 2.2**: 推論系とプロジェクト連携（Recipe 4, 5, 7）
- **Phase 2.3**: 監視と自己修復（Recipe 6, 8）

このドキュメントでは、**Phase 2.1** の実装手順を中心に解説します。

---

## 🛠️ Prerequisites（前提条件）

### 必要な環境
- ✅ Docker Compose（n8n 起動用）
- ✅ Obsidian Local REST API Plugin（MCP Layer 1）
- ✅ Slack Workspace（通知先）
- ✅ 既存の MCP サーバー稼働（`mcp-obsidian`, `mcp-n8n`）

### 確認コマンド
```bash
# Docker がインストールされているか
docker --version

# n8n が起動できるか
docker compose up -d n8n
open http://localhost:5678

# Obsidian MCP が稼働しているか（Optional）
curl -k https://127.0.0.1:8334/vault/
```

---

## 📋 Phase 2.1: 基本自動化（Core Automation）

### Recipe 1: Obsidian → Slack 通知

**目的**: Obsidian の ADR や Spec が更新されたら、Slack チャンネルに自動通知。

#### Step 1: Slack Webhook URL の取得

1. Slack の [Incoming Webhooks](https://api.slack.com/messaging/webhooks) ページに移動
2. "Create New App" → "From scratch"
3. App 名を入力（例: "Obsidian Notifier"）
4. Workspace を選択
5. "Incoming Webhooks" を有効化
6. "Add New Webhook to Workspace" で通知先チャンネルを選択
7. Webhook URL をコピー（`https://hooks.slack.com/services/XXX/YYY/ZZZ`）

#### Step 2: n8n Workflow の作成

1. n8n を開く: `http://localhost:5678`
2. 新しいワークフローを作成: "Recipe 01: Obsidian → Slack"
3. 以下のノードを追加：

**ノード構成**:
```
Webhook Trigger → Function (Filter) → Slack Node
```

**詳細設定**:

**1. Webhook Trigger Node**
- Node Type: `Webhook`
- HTTP Method: `POST`
- Path: `obsidian-update`
- Response Mode: `On Received`

**2. Function Node (Filter)**
```javascript
// ADR または Spec ファイルのみ処理
const filePath = $input.item.json.filePath || '';

if (filePath.includes('ADR-') || filePath.includes('spec/')) {
  return {
    json: {
      shouldNotify: true,
      file: filePath,
      author: $input.item.json.author || 'Unknown',
      summary: $input.item.json.summary || 'No summary',
      timestamp: $input.item.json.timestamp || new Date().toISOString()
    }
  };
}

return { json: { shouldNotify: false } };
```

**3. IF Node**
- Condition: `{{ $json.shouldNotify }}` equals `true`

**4. Slack Node**
- Authentication: Webhook URL（上で取得した URL）
- Channel: 自動（Webhook で指定済み）
- Message:
  ```
  📄 *Obsidian Note Updated*

  *File*: {{ $json.file }}
  *Author*: {{ $json.author }}
  *Summary*: {{ $json.summary }}
  *Time*: {{ $json.timestamp }}
  ```

#### Step 3: ワークフローのテスト

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

**期待結果**: Slack チャンネルに通知が届く

#### Step 4: Obsidian との統合（Optional）

現時点では手動トリガーで十分です。将来的に、Obsidian Plugin または Cron ベースの差分検出を実装します。

---

### Recipe 2: 定期 KB 再構築

**目的**: 毎日深夜に KB を自動再構築して、翌朝には最新の RAG が使える状態にする。

#### Step 1: n8n Cron Workflow の作成

1. n8n で新しいワークフローを作成: "Recipe 02: Daily KB Rebuild"
2. 以下のノードを追加：

**ノード構成**:
```
Cron Trigger → HTTP Request (KB Ingest) → IF (Success Check) → Slack Notification
```

**詳細設定**:

**1. Cron Node**
- Trigger Time: `0 3 * * *`（毎日 03:00 JST）
- Mode: `Every Day`

**2. HTTP Request Node**
- Method: `POST`
- URL: `https://your-app.vercel.app/api/obsidian/ingest`
  - または localhost: `http://localhost:3000/api/obsidian/ingest`
- Authentication: Header Auth（必要に応じて）
  - Header Name: `Authorization`
  - Header Value: `Bearer YOUR_SECRET_TOKEN`
- Timeout: `60000` (60秒)

**3. IF Node (Success Check)**
- Condition: `{{ $json.success }}` equals `true`
  - または Status Code: `{{ $statusCode }}` equals `200`

**4. Slack Node (Success)**
- Message:
  ```
  ✅ *KB Rebuild Completed*

  *Chunks Updated*: {{ $json.chunksUpdated || 'N/A' }}
  *Total Chunks*: {{ $json.totalChunks || 'N/A' }}
  *Duration*: {{ $json.duration || 'N/A' }}s
  *Time*: {{ $now }}
  ```

**5. Slack Node (Failure)**
- Message:
  ```
  ⚠️ *KB Rebuild Failed*

  *Error*: {{ $json.error || 'Unknown error' }}
  *Status Code*: {{ $statusCode }}
  *Time*: {{ $now }}

  Please check logs: `pnpm kb:build`
  ```

#### Step 2: 環境変数の設定

n8n の Settings → Variables に以下を追加：

```bash
KB_INGEST_URL=https://your-app.vercel.app/api/obsidian/ingest
KB_AUTH_TOKEN=your-secret-token-here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

#### Step 3: ワークフローのテスト

**手動トリガーでテスト**:
1. n8n の "Execute Workflow" ボタンをクリック
2. HTTP Request の結果を確認
3. Slack 通知が届くことを確認

**本番実行**:
- Cron が設定されているので、翌日 03:00 に自動実行される
- n8n の Execution History で結果を確認可能

---

### Recipe 3: Daily Note 集計 → Slack DM（Optional）

**目的**: Daily Note の `#todo` や `## Reflection` を毎朝 Slack DM に送る。

#### 実装概要（Phase 2.1 後半で実装）

1. **Cron Trigger**: 毎朝 08:00
2. **Obsidian MCP**: `obsidian_get_periodic_note(period='daily')` を呼び出し
3. **Function Node**: `#todo` タグや `## Reflection` セクションを抽出
4. **Slack Node**: DM で送信

詳細は Phase 2.1 の進捗に応じて追加します。

---

## 🔧 Troubleshooting（トラブルシューティング）

### n8n が起動しない
```bash
# ポート 5678 が既に使われているか確認
lsof -i :5678

# 既存の n8n コンテナを停止
docker compose down n8n

# 再起動
docker compose up -d n8n
```

### Webhook が反応しない
- n8n の Workflow が "Active" になっているか確認
- Webhook URL が正しいか確認（`http://localhost:5678/webhook/obsidian-update`）
- n8n の Execution History でエラーログを確認

### Slack 通知が届かない
- Webhook URL が正しいか確認
- Slack App の権限を確認（`chat:write` が必要）
- n8n の Slack Node でテスト実行してエラーメッセージを確認

### KB Ingest が失敗する
```bash
# ローカルで手動実行してエラーを確認
curl -X POST http://localhost:3000/api/obsidian/ingest \
  -H "Content-Type: application/json"

# または
pnpm kb:build
```

---

## 📊 Monitoring（モニタリング）

### n8n Execution History
- n8n の UI で "Executions" タブを開く
- 各 Workflow の実行履歴を確認
- エラーがあれば詳細ログを確認

### Slack 通知の確認
- 毎日 03:00 に KB 再構築の通知が届くことを確認
- 失敗通知が届いた場合は、ログを確認して原因を特定

### PM2 でのモニタリング（本番環境）
```bash
# n8n のステータス確認
npx pm2 status

# n8n のログ確認
npx pm2 logs n8n --lines 100
```

---

## 🚀 Next Steps（次のステップ）

### Phase 2.1 完了条件
- ✅ Recipe 1（Obsidian → Slack）が稼働
- ✅ Recipe 2（定期 KB 再構築）が稼働
- ✅ 1週間の安定稼働を確認
- ✅ ADR-0006 のステータスを "Accepted" に更新

### Phase 2.2 への移行
Phase 2.1 が安定したら、以下の Recipe を実装：
- Recipe 4: ADR 追加 → GitHub Issue 自動作成
- Recipe 5: PR マージ → KB 更新
- Recipe 7: 週次ふりかえりノート生成

詳細は別途 `phase-2.2-implementation.md` で記載予定。

---

## 🔗 Related Documents

- [ADR-0006: Phase 2 Automation Strategy](../decisions/ADR-0006-phase-2-automation-strategy.md)
- [MCP Recipes](./mcp-recipes.md) - Recipe 詳細仕様
- [MCP Setup Guide](./mcp-setup-guide.md) - MCP サーバー初期設定
- [KB Setup Guide](./kb-setup.md) - Knowledge Base 構築手順
- [n8n Operations Guide](./n8n.md) - n8n 運用ガイド

---

**Phase 2.1: 基本自動化を実現しよう 🚀**

**最終更新**: 2025-11-17
