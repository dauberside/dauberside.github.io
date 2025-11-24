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

**Auto-detection test for Recipe 4 Phase 2** 🚀
