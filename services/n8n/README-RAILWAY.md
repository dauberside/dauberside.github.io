# Railway Deployment Guide for n8n

**Last Updated**: 2025-11-25

---

## 🚀 Quick Deploy

### Step 1: Railway プロジェクト作成

1. [Railway](https://railway.app/) にアクセス
2. "Start a New Project" をクリック
3. "Deploy from GitHub repo" を選択
4. `dauberside/dauberside.github.io` リポジトリを選択

---

### Step 2: サービス設定

Railway が自動的に以下を検出します：
- `services/n8n/Dockerfile.railway`
- `services/n8n/railway.json`

**Root Directory を設定**:
- Settings → Service → Root Directory: `services/n8n`

---

### Step 3: 環境変数設定

Railway の Variables タブで以下を設定：

```bash
# === n8n Basic Configuration ===
N8N_HOST=${{RAILWAY_PUBLIC_DOMAIN}}
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_SECURE_COOKIE=true

# === Webhook Configuration ===
WEBHOOK_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}

# === Authentication ===
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=Cpr1xaHdUQzQPnkYugkhGRshJloMKpj4

# === Timezone ===
GENERIC_TIMEZONE=Asia/Tokyo
TZ=Asia/Tokyo

# === Executions ===
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true

# === Logs ===
N8N_LOG_LEVEL=info
N8N_LOG_OUTPUT=console

# === Security ===
N8N_ENCRYPTION_KEY=8882ecfda4a1763c476bd243a602e31481ad1aed739017d9b9ba08bf18714223

# === Editor ===
N8N_EDITOR_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}

# === Metrics ===
N8N_METRICS=false
```

**重要**: `${{RAILWAY_PUBLIC_DOMAIN}}` は Railway が自動的に提供する公開ドメインです。

---

### Step 4: カスタムドメイン設定

1. Railway の Settings → Networking → Custom Domain
2. `n8n.xn--rn8h03a.st` を追加
3. DNS レコードを設定：
   ```
   Type: CNAME
   Name: n8n
   Value: <Railway が提供する CNAME>
   TTL: 300
   ```

4. Let's Encrypt 証明書が自動的に発行されます

---

### Step 5: デプロイ確認

```bash
# ヘルスチェック
curl https://n8n.xn--rn8h03a.st/healthz

# UI アクセス
open https://n8n.xn--rn8h03a.st

# BASIC 認証
Username: admin
Password: Cpr1xaHdUQzQPnkYugkhGRshJloMKpj4
```

---

## 📊 モニタリング

Railway のダッシュボードで以下を確認：
- CPU/Memory 使用率
- ログ（リアルタイム）
- デプロイ履歴
- メトリクス

---

## 🔄 更新方法

1. GitHub にコミット＆プッシュ
2. Railway が自動的に再デプロイ

または、Railway CLI を使用：
```bash
railway up
```

---

## 💾 データ永続化

Railway は自動的に Volume をマウントします：
- `/home/node/.n8n` - n8n のデータディレクトリ
- SQLite データベースはここに保存

**バックアップ**:
```bash
# Railway CLI でバックアップ
railway run backup

# または Docker ボリュームをエクスポート
railway volumes export
```

---

## 🔗 関連ドキュメント

- [Railway Documentation](https://docs.railway.app/)
- [n8n Documentation](https://docs.n8n.io/)
- [Recipe 4 Phase 2](../../docs/decisions/ADR-0008-recipe-4-phase2-test.md)

---

## 🎯 Next Steps

1. ✅ n8n UI にアクセス
2. ✅ Recipe 4 Phase 2 ワークフローをインポート
3. ✅ GitHub webhook URL を更新
4. ✅ エンドツーエンドテスト実行

---

**Railway で n8n を本番運用開始！** 🚀
