# TODO - n8n Production Deployment

> Recipe 4 Phase 2 完了に向けた本番環境デプロイタスク
> 作成日: 2025-11-24

**重要**: Obsidian Local REST API は PORT 27124 で稼働中（HTTPS）

---

## 📋 システム情報

- **Obsidian REST API**: https://127.0.0.1:27124/ (PORT 27124, HTTPS, 認証必須)
- **MCP 設定**: .mcp.json で host.docker.internal:27124 を指定
- **n8n ローカル**: PORT 5678
- **n8n 本番予定**: https://n8n.xn--rn8h03a.st/
- **Recipe 13**: PORT 27123/27124 使用

---

## 🚀 n8n Production Deployment

### Phase 1: n8n 本番環境構築
- [ ] デプロイ先選択
  - オプション: Railway / Render / Fly.io / VPS
  - 推奨: Railway（最もシンプル、無料枠あり）
- [ ] n8n を起動（最小構成）
  - Docker / Docker Compose 使用
  - 環境変数設定:
    ```bash
    N8N_HOST=n8n.xn--rn8h03a.st
    N8N_PROTOCOL=https
    N8N_SECURE_COOKIE=true
    WEBHOOK_URL=https://n8n.xn--rn8h03a.st
    ```
- [ ] DNS 設定
  - Type: A / CNAME
  - Name: n8n
  - Value: <VPS IP> または <Platform ホスト>
  - 確認: `dig n8n.xn--rn8h03a.st`
- [ ] HTTPS 設定
  - Let's Encrypt / 自動（プラットフォーム依存）
  - 確認: `curl -I https://n8n.xn--rn8h03a.st`
- [ ] n8n UI アクセス確認
  - BASIC Auth 設定（Admin UI）
  - セキュリティ設定確認

### Phase 2: Recipe 4 Phase 2 移行
- [ ] GitHub webhook URL を本番環境に更新
  - URL: `https://n8n.xn--rn8h03a.st/webhook/github-adr-push`
  - Repository: dauberside/dauberside.github.io
  - Events: push
- [ ] `recipe-04-phase2-github-webhook.json` を本番 n8n にインポート
  - ワークフロー: services/n8n/workflows/recipe-04-phase2-github-webhook.json
- [ ] GitHub credentials 設定
  - HTTP Header Auth
  - Header: `Authorization`
  - Value: `Bearer <GITHUB_TOKEN>`
- [ ] テスト実行
  - ADR ファイルを push
  - Webhook 受信確認
  - Issue 自動作成確認

### Phase 3: 他の Recipe 移行（オプション）
- [ ] Recipe 1: Obsidian → Slack 通知
- [ ] Recipe 7: 週次ふりかえりノート生成
- [ ] その他の Webhook を集約

---

## 📚 参考ドキュメント

- **デプロイ手順**: [docs/operations/n8n-production-deployment.md](docs/operations/n8n-production-deployment.md)
- **Phase 2 実装状況**: [docs/decisions/ADR-0008-recipe-4-phase2-test.md](docs/decisions/ADR-0008-recipe-4-phase2-test.md)
- **ワークフロー設計**: [services/n8n/workflows/recipe-04-phase2-github-webhook.json](services/n8n/workflows/recipe-04-phase2-github-webhook.json)
- **Phase 2 戦略**: [docs/decisions/ADR-0006-phase-2-automation-strategy.md](docs/decisions/ADR-0006-phase-2-automation-strategy.md)

---

## ✅ 完了済み（2025-11-24）

- [x] Recipe 4 Phase 1: 手動トリガー方式（Production-ready）
  - Webhook endpoint: `/webhook/adr-to-issue`
  - ADR データ完全パース実装
  - GitHub Issue 自動生成（Issue #66 作成成功）
- [x] Recipe 4 Phase 2: ワークフロー設計完了
  - GitHub Push イベント自動検知
  - ADR ファイルフィルタリング
  - ファイル内容取得 + パース
  - ローカルテスト完了（Tailscale 制約により本番移行待ち）
- [x] n8n 本番デプロイ計画書作成
  - ドメイン構成: https://n8n.xn--rn8h03a.st/
  - デプロイオプション比較
  - セキュリティ考慮事項

---

**Next Step**: n8n を本番環境にデプロイして、Recipe 4 Phase 2 の自動検知機能を有効化 🚀
