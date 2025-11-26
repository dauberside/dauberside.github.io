# ADR-0008: Recipe 4 Phase 2 Auto-Detection Test

Status: Proposed
Date: 2025-11-24
Author: dauberside

---

## 🎯 Context

Recipe 4 Phase 2 の自動検知機能をテストする。GitHub webhook が正しく動作し、ADR ファイルの push を検知して自動的に GitHub Issue を作成することを確認する。

## 🧩 Decision

以下の技術スタックで Recipe 4 Phase 2 を実装：

- **GitHub Webhook**: push イベントの自動検知
- **Tailscale**: ローカル n8n への安全なアクセス
- **n8n Workflow**: ADR ファイルのパースと Issue 作成
- **GitHub API**: Issue 自動生成

## 🏗️ Implementation

1. GitHub webhook で `docs/decisions/ADR-*.md` を監視
2. ファイル内容を GitHub API で取得
3. Markdown をパースして構造化データに変換
4. GitHub Issue を自動作成

## 🧪 Test Plan

このファイルを push して、自動的に Issue が作成されることを確認する。

---

## 📝 Implementation Status (2025-11-24)

### ✅ 完了
- Phase 1: 手動トリガー方式（Production-ready）
- Phase 2: ワークフロー設計完了（`recipe-04-phase2-github-webhook.json`）
- GitHub webhook ペイロード検証

### ⏳ ブロック中
**原因**: Tailscale IP (`100.102.85.62`) はプライベートネットワークのため、GitHub から到達不可

**解決策**: n8n を本番環境にデプロイ
- **URL**: `https://n8n.xn--rn8h03a.st/webhook/github-adr-push`
- **構成**: 独自ドメイン + HTTPS + Webhook 集約
- **候補**: Railway / Render / Fly.io / VPS

### 🔜 Next Steps
1. n8n を VPS/コンテナ環境にデプロイ
2. DNS 設定（`n8n.xn--rn8h03a.st`）
3. HTTPS 設定（Let's Encrypt / 自動）
4. GitHub webhook URL 更新
5. Phase 2 本番テスト

---

**Auto-detection test for Recipe 4 Phase 2** 🚀
