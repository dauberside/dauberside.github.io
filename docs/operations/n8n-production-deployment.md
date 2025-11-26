# n8n Production Deployment Plan

**Status**: ✅ **Decision Made** (2025-11-25)
**Priority**: High (v1.2 Critical Path)
**Target**: https://n8n.xn--rn8h03a.st/
**Deployment Method**: 🎯 **Self-Hosted on Existing Infrastructure (Docker)**

---

## 📌 Decision Summary (2025-11-25)

### 結論: 自前サーバーで Docker 運用

**選択理由**:
1. **v1.2 「自律性」の哲学に合致**: すべてのコンポーネントを自分の管理下に置く
2. **柔軟性**: セキュリティ、認証、ログ、バックアップを細かく制御可能
3. **拡張性**: Workflow 増加、MCP 連携強化に対応しやすい
4. **運用コスト**: 既存インフラに統合することでコスト最適化

**他の選択肢を却下した理由**:
- ❌ **n8n Cloud**: 外部サービス依存、IP制限などの柔軟性に制約
- ❌ **新規 VPS**: 既存インフラがある状況で冗長

---

## 🎯 v1.2 Scope — 必須要件（今週中に達成）

### 1. 常時稼働
- Docker の `restart: always` ポリシーで自動起動保証
- ホスト OS 再起動時も n8n が自動復旧

### 2. HTTPS + 認証
- `https://n8n.xn--rn8h03a.st/` で HTTPS アクセス（Let's Encrypt）
- Admin UI: BASIC 認証または IP 制限で保護
- Webhook: Token/Secret 付き URL で保護

### 3. バックアップ
- n8n Database（SQLite または PostgreSQL）の毎晩バックアップ
- ワークフロー JSON の Git 管理（`services/n8n/workflows/`）

### 4. ログ確認方法
- `docker logs n8n` でコンテナログを確認
- n8n UI の Execution History でワークフロー実行履歴を確認

---

## 🚀 v2 以降の拡張（今は Scope 外）

以下は v1.2 では **実装しない**（将来的な改善として記録）:
- 高可用構成（Multi-node, Load Balancer）
- 詳細なモニタリング（Prometheus, Grafana）
- 自動スケーリング
- 複数リージョン展開

---

## 🎯 Overview (Original)

Recipe 4 Phase 2 および将来のすべての Webhook を集約するため、n8n を本番環境にデプロイする。

### 目的
- **v1.2 Cron 自動ループの中核**: 22:00 wrap-up, 08:00 brief の自動実行
- GitHub webhook の受信（Phase 2 自動検知）
- すべての Recipe の Webhook を一箇所に集約
- 固定 URL + HTTPS での安定動作

---

## 🏗️ Architecture

### ドメイン構成

```
https://www.xn--rn8h03a.st/          # メインサイト
    ↓
https://n8n.xn--rn8h03a.st/          # n8n Automation Hub
    ↓
Webhook エンドポイント:
    /webhook/adr-to-issue            # Recipe 4 Phase 1（手動）
    /webhook/github-adr-push         # Recipe 4 Phase 2（自動検知）
    /webhook/github-pr-merged        # Recipe 5（予定）
    /webhook/obsidian-update         # Recipe 1（予定）
```

### 技術スタック

- **n8n**: v1.x (latest)
- **HTTPS**: Let's Encrypt / 自動（プロバイダー依存）
- **Database**: SQLite / PostgreSQL（ワークフロー永続化）
- **Authentication**: OAuth / Email + Password

---

## 📋 Deployment Options

### Option A: Railway / Render / Fly.io（推奨・最速）

**メリット**:
- Docker ベースで簡単デプロイ
- 自動 HTTPS
- カスタムドメイン対応
- スケーラブル

**手順**:
1. GitHub リポジトリを接続
2. `Dockerfile` または `docker-compose.yml` を配置
3. 環境変数を設定
4. カスタムドメイン (`n8n.xn--rn8h03a.st`) を追加
5. 自動デプロイ

**推奨**: Railway（最もシンプル、無料枠あり）

---

### Option B: VPS（DigitalOcean / Hetzner / Linode）

**メリット**:
- フルコントロール
- コスト効率が良い（長期運用）
- Cortex OS 専用インフラとして育てられる

**手順**:
1. VPS をプロビジョニング
2. Docker + Docker Compose をインストール
3. `services/ecosystem.config.cjs` を参考に n8n をセットアップ
4. Nginx でリバースプロキシ
5. Let's Encrypt で HTTPS
6. DNS で `n8n.xn--rn8h03a.st` を VPS IP に向ける

---

### Option C: 既存 VPS に追加

すでに VPS がある場合、そこに n8n を追加するのが最もコスト効率が良い。

---

## 🔧 Configuration

### 環境変数

```bash
# n8n 基本設定
N8N_HOST=n8n.xn--rn8h03a.st
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=true

# Webhook 設定
WEBHOOK_URL=https://n8n.xn--rn8h03a.st

# Database（PostgreSQL 推奨）
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=<secure-password>

# 認証
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=<admin-user>
N8N_BASIC_AUTH_PASSWORD=<secure-password>

# タイムゾーン
GENERIC_TIMEZONE=Asia/Tokyo
TZ=Asia/Tokyo
```

---

## 📝 DNS Configuration

### DNS レコード設定

```
Type: A / CNAME
Name: n8n
Value: <VPS IP> または <Railway/Fly.io ホスト>
TTL: 300
```

### 確認コマンド

```bash
# DNS 確認
dig n8n.xn--rn8h03a.st

# HTTPS 確認
curl -I https://n8n.xn--rn8h03a.st
```

---

## 🚀 Deployment Steps

### Phase 1: 最小構成でデプロイ

1. デプロイ先を選択（Railway / VPS）
2. n8n を起動（最小構成）
3. DNS 設定
4. HTTPS 確認
5. n8n UI にアクセスできることを確認

### Phase 2: Webhook 移行

1. Recipe 4 Phase 1 のワークフローをインポート
2. テスト webhook でリクエスト送信
3. 動作確認

### Phase 3: GitHub Webhook 設定

1. GitHub webhook URL を更新:
   `https://n8n.xn--rn8h03a.st/webhook/github-adr-push`
2. Recipe 4 Phase 2 のワークフローをインポート
3. ADR ファイルを push してテスト
4. Issue 自動作成を確認

---

## 🔐 Security

### 必須設定

- ✅ HTTPS 有効化
- ✅ BASIC Auth または OAuth
- ✅ Webhook エンドポイントは公開（認証なし）
- ✅ Admin UI は認証必須
- ✅ GitHub Token は環境変数で管理

### 推奨設定

- ✅ IP allowlist（Admin UI のみ）
- ✅ Rate limiting
- ✅ Webhook signature 検証

---

## 📊 Monitoring

### ヘルスチェック

```bash
# n8n ヘルスチェック
curl https://n8n.xn--rn8h03a.st/healthz

# Webhook テスト
curl -X POST https://n8n.xn--rn8h03a.st/webhook/adr-to-issue \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "status": "Draft", ...}'
```

### ログ確認

- n8n Execution History（UI）
- Docker logs（コンテナ環境）
- PM2 logs（VPS 環境）

---

## 🔗 Related Documents

- [Recipe 4 Implementation](../decisions/ADR-0008-recipe-4-phase2-test.md)
- [Phase 2 Automation Strategy](../decisions/ADR-0006-phase-2-automation-strategy.md)
- [MCP Recipes](./mcp-recipes.md)

---

**n8n を本番環境にデプロイして、Cortex OS の Automation Hub を構築** 🚀

**Last Updated**: 2025-11-24
