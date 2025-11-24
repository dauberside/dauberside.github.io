# Cortex OS Daily Automation v1.0

**Status**: 完成・稼働中
**Version**: 1.0.0
**Date**: 2025-11-23
**Author**: System Design Team

---

## 概要

Cortex OS の完全なデイリー自動化フロー。毎朝のダイジェスト生成から夜間の状態管理まで、一貫したサイクルを実現。

---

## 🎯 Canonical（正）となる基軸

### `notifications/daily/YYYY-MM-DD-digest.md`

- **唯一の正規ダイジェスト**（Canonical Digest）
- Recipe 09 が生成
- `/wrap-up` の入力として利用
- Claude Code など後工程でも利用

**これが「システムが一貫して参照する Daily Digest」**

---

## 🔄 フロー全体像

```mermaid
flowchart TB
    subgraph "朝 08:00"
        A[Recipe 09<br/>Daily Digest Generator]
        A --> B[Obsidian API<br/>cortex/daily/ 取得]
        B --> C[タスク抽出<br/>整形]
        C --> D[notifications/daily/<br/>YYYY-MM-DD-digest.md]
        C --> E[Slack 通知]
    end

    subgraph "朝 08:00+"
        F[/brief コマンド]
        G[tomorrow.json]
        G --> F
        F --> H[Today's Plan<br/>対話出力]
    end

    subgraph "夜 22:00"
        I[/wrap-up コマンド]
        D --> I
        I --> J[TODO.md 更新]
        I --> K[Archive 移動]
        I --> L[tomorrow.json 生成]
    end

    L --> G
```

---

## 🌙 夜間フェーズ — /wrap-up（22:00）

### 入力
- `notifications/daily/YYYY-MM-DD-digest.md`
- `TODO.md`

### 処理
1. 完了タスク → Archive へ移動
2. 未完了タスク → 翌日へ持ち越し
3. Reflection の抽出

### 出力
- `cortex/state/tomorrow.json`
- 更新された `TODO.md`

### 役割
**状態管理の中心（State Machine の根幹）**

---

## 🌅 朝フェーズ — /brief（08:00）

### 入力
- `cortex/state/tomorrow.json`
- `TODO.md`
- 最新の Daily Digest

### 処理
1. 今日やるべきタスクを選定（最大3つ）
2. 優先順位の決定
3. バッファの計算

### 出力
- **Today's Plan**（対話形式のテキスト）

### 重要な設計判断
📌 **この段階では digest.md を生成しない**
- digest は Recipe 09 に任せて責務を分離
- `/brief` は対話に専念

---

## ☀️ 朝工程 — Recipe 09: Daily Digest Generation

### 入力
- Obsidian Vault: `cortex/daily/YYYY-MM-DD-digest.md`（Obsidian API 経由）

### 処理
1. **Calculate Yesterday's Date**: 前日の日付を計算
2. **Get Daily Note from Obsidian**: Obsidian API で取得
3. **Parse Tasks & Reflection**: タスクとReflectionを抽出
4. **Write Digest File**: `notifications/daily/` に出力
5. **Send to Slack**: Slack Webhook で通知

### 出力
- `notifications/daily/YYYY-MM-DD-digest.md`（Canonical）
- Slack 通知

### 技術スタック
- n8n Workflow
- Obsidian Local REST API
- Slack Incoming Webhooks
- Docker Compose（環境変数管理）

---

## 🧩 システムの役割分担

| ディレクトリ | 役割 | 生成方法 |
|------------|------|---------|
| `notifications/daily/` | **Canonical Daily Digest**（自動生成、後工程が参照） | Recipe 09 |
| `cortex/state/` | **状態管理**（tomorrow.json など） | /wrap-up |
| `cortex/daily/` | **人間が書く日記**（Obsidian） | 手動 |

**この三者が絶妙なバランスで分離されているのが最大の強み**

---

## 🔒 セキュリティ設計

### 環境変数管理
```bash
# .env ファイル（Git から除外）
OBSIDIAN_API_KEY=xxx
SLACK_DAILY_DIGEST_WEBHOOK=xxx
N8N_ENCRYPTION_KEY=xxx
```

### Docker Compose 経由で n8n に渡す
```yaml
services:
  n8n:
    environment:
      - OBSIDIAN_API_KEY=${OBSIDIAN_API_KEY}
      - SLACK_DAILY_DIGEST_WEBHOOK=${SLACK_DAILY_DIGEST_WEBHOOK}
```

### n8n ワークフロー内で参照
```javascript
const apiKey = $env.OBSIDIAN_API_KEY;
const webhook = $env.SLACK_DAILY_DIGEST_WEBHOOK;
```

---

## 📊 Recipe 09 の詳細仕様

### ノード構成

1. **Every Morning 08:00 JST** (Cron Trigger)
   - Schedule: `0 8 * * *`

2. **Calculate Yesterday's Date** (Code)
   ```javascript
   const yesterday = new Date();
   yesterday.setDate(yesterday.getDate() - 1);
   const dateString = `${year}-${month}-${day}`;
   ```

3. **Get Daily Note from Obsidian** (HTTP Request)
   - Method: GET
   - URL: `https://host.docker.internal:27124/vault/{{ $json.filePath }}`
   - Auth: `Bearer $env.OBSIDIAN_API_KEY`

4. **Parse Tasks & Reflection** (Code)
   - タスク抽出: `/^\s*-\s*\[[x ]\]/i`
   - セクション抽出: `##\s*${sectionName}([\s\S]*?)(?=##|$)`

5. **Write Digest File** (Execute Command)
   - Command: `mkdir -p $(dirname path) && echo base64 | base64 -d > path`

6. **Send to Slack** (HTTP Request)
   - Method: POST
   - URL: `$env.SLACK_DAILY_DIGEST_WEBHOOK`
   - Body: `{ "text": "{{ $json.slackText }}" }`

---

## 🎉 完成状態

### ✅ 動作確認済み
- [x] Obsidian API 認証（200 OK）
- [x] タスク抽出（3タスク検出）
- [x] ファイル出力（notifications/daily/）
- [x] Slack 通知
- [x] 環境変数の安全な管理

### ✅ システム統合
- [x] /wrap-up が notifications/daily を読む
- [x] /brief が tomorrow.json を読む
- [x] Claude Code が notifications/daily を参照
- [x] 完全なデイリー循環

---

## 🔮 拡張案（v1.1 / v2.0）

### 選択肢 B: cortex/daily/ 自動生成

**現状**: 温存（実装しない）

**理由**:
- 現在の役割分担が明確で一貫性がある
- cortex/daily/ は人間が書く日記として機能
- Canonical digest は notifications/daily/ で統一

**実装するタイミング**:
- Obsidian で digest 一覧を参照したくなったら
- 複数のデータソースを統合したい場合

**実装案**（参考）:
```javascript
// /brief コマンドに追加
const date = new Date().toISOString().split('T')[0];
const filepath = `cortex/daily/${date}-digest.md`;

obsidian_append_content({
  filepath,
  content: generatedDigest
});
```

---

## 🎯 運用ガイド

### 本番環境での起動

```bash
# n8n を起動
docker compose up -d n8n

# Recipe 09 を Active に設定
# n8n UI (http://localhost:5678) で Active トグルを ON
```

### 手動テスト

```bash
# n8n UI で "Test workflow" をクリック
# または、Cron を待つ（毎朝 08:00）
```

### トラブルシューティング

#### Obsidian API が 401 エラー
```bash
# 環境変数を確認
docker exec n8n sh -c 'echo $OBSIDIAN_API_KEY'

# n8n を再起動
docker compose down n8n && docker compose up -d n8n
```

#### タスクが抽出されない
- 正規表現: `/^\s*-\s*\[[x ]\]/i`
- チェックボックス形式: `- [x]` または `- [ ]`

#### Slack 通知が届かない
```bash
# Webhook URL を確認
docker exec n8n sh -c 'echo $SLACK_DAILY_DIGEST_WEBHOOK'
```

---

## 📚 関連ドキュメント

- [Recipe 09 ワークフローJSON](../../services/n8n/workflows/recipe-09-daily-digest-v2.json)
- [/brief コマンド](../../.claude/commands/brief.md)
- [/wrap-up コマンド](../../.claude/commands/wrap-up.md)
- [MCP Recipes](../operations/mcp-recipes.md)
- [Cortex Task Policy](../operations/cortex-task-policy.md)

---

## 🎊 成果

このシステムにより、以下が自動化されました：

1. **毎朝のダイジェスト生成**（08:00 自動実行）
2. **Slack への自動通知**
3. **夜間の状態管理**（TODO.md 更新、tomorrow.json 生成）
4. **完全なデイリー循環**（Daylog → Digest → State → Next day's Plan）

**Cortex OS として完全に稼働可能な状態** ✨

---

**Version History**:
- v1.0.0 (2025-11-23): 初版リリース
