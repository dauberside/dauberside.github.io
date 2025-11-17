# Obsidian ワークフロー：Personal / Project Vault 運用パターン

> **注意**: この文書は**ユーザー個人のワークフロー**を示すものであり、[ADR-0004: Obsidian二層統合アーキテクチャ](../decisions/ADR-0004-obsidian-dual-layer-integration.md) で定義される「REST API / MCP の二層アクセス構成」とは異なる概念です。

## 概要

このドキュメントでは、Obsidian を使った**二Vault運用パターン**を説明します：
- **Personal Vault**: 個人の思考・メモ・実験的アイデア
- **Project Vault**: プロジェクト固有の知識・仕様・ADR

この分離により、個人的なノート（日記、アイデア、未整理の Inbox）とプロジェクトドキュメント（仕様書、ADR、運用ガイド）を明確に区別し、開発環境と連携させます。

## ワークフロー図

```mermaid
flowchart LR
    subgraph Local["ローカル環境（Mac）"]
      subgraph ObsidianPersonal["Obsidian Vault: Personal / Thinking"]
        DN[Daily Notes / Journal]
        IN[Inbox / Capture]
        IDEA[Ideas / Experiments]
      end

      subgraph ObsidianProject["Obsidian Vault: Project / KB"]
        ADR[ADR / Architecture]
        OPS[Operations Docs]
        SPEC[Specs / API (OpenAPI, MCP)]
        KB[Index / Embeddings]
      end

      DN -->|整理/昇格| ADR
      IN -->|整理/昇格| OPS
      IDEA -->|設計確定| SPEC
    end

    subgraph DevEnv["開発環境"]
      CURSOR[Cursor<br/>AI Coding]
      CLOUD_CODE[Cloud Code<br/>(GCP / K8s など)]
      REPO[GitHub Repo<br/>dauberside.github.io-1 他]
    end

    CURSOR <-->|設計/実装往復| ObsidianProject
    CURSOR -->|メモ/決定事項| ObsidianPersonal
    REPO <-->|Docs とコード| ObsidianProject
    CLOUD_CODE -->|運用知見/Runbook| OPS
```

## Vault 構成

### Personal Vault（個人用）

**目的**: 思考の流れ、未整理のアイデア、実験的メモ

**主要セクション**:
- **Daily Notes / Journal**: 日次振り返り、作業ログ
- **Inbox / Capture**: とりあえず書き留める場所
- **Ideas / Experiments**: 実験的アイデア、プロトタイプ構想

**特徴**:
- 構造化不要、自由度高い
- バージョン管理不要（個人用）
- KB への取り込み対象外

### Project Vault（プロジェクト用）

**目的**: プロジェクト固有の知識・仕様・決定事項

**主要セクション**:
- **ADR / Architecture**: Architecture Decision Records、設計判断
- **Operations Docs**: 運用ガイド、手順書、トラブルシューティング
- **Specs / API**: 仕様書、OpenAPI、MCP 定義
- **Index / Embeddings**: KB 埋め込みインデックス

**特徴**:
- 構造化必須（テンプレート使用推奨）
- GitHub リポジトリと同期
- KB への取り込み対象
- チーム共有可能

## 運用フロー

### 1. 個人メモ → プロジェクトドキュメント昇格

```
Personal: Daily Notes → 整理 → Project: ADR
Personal: Inbox → 整理 → Project: Operations Docs
Personal: Ideas → 設計確定 → Project: Specs
```

**昇格基準**:
- **ADR**: アーキテクチャに影響する重要な決定
- **Operations Docs**: チームで共有すべき手順・ナレッジ
- **Specs**: 実装に必要な詳細仕様

### 2. 開発環境との連携

**Cursor / IDE**:
- Project Vault と双方向連携
- 実装中の設計判断を Personal Vault にメモ
- 確定した設計を Project Vault に反映

**GitHub Repo**:
- `docs/` ディレクトリと Project Vault を同期
- ADR / Specs は Git 管理対象

**Cloud / Infrastructure**:
- 運用知見・トラブルシューティングを Operations Docs に蓄積
- Runbook として整備

### 3. KB への反映

Project Vault のドキュメントは定期的に KB に取り込み：

```bash
# Project Vault を KB ソースに追加（.env.local）
KB_SOURCES="docs,/path/to/Project-Vault"

# KB 再ビルド
pnpm kb:build
```

**注意**: Personal Vault は KB 対象外（個人メモは検索不要）

## ツール統合

### MCP 統合（ADR-0004）

Project Vault に対しては、[ADR-0004](../decisions/ADR-0004-obsidian-dual-layer-integration.md) の二層アクセス構成を使用：

- **Layer 1 (REST API)**: KB 取り込み専用、読み取りのみ
- **Layer 2 (MCP)**: ノート編集、読み書き可能

Personal Vault は MCP 経由の編集のみ（KB 取り込み不要）

### テンプレート活用

Project Vault では構造化を維持するため、テンプレート使用推奨：

**ADR テンプレート**:
```markdown
# ADR-XXXX: タイトル

- ID: ADR-XXXX
- 日付: YYYY-MM-DD
- 状態: Proposed / Accepted / Deprecated
- 関連: ファイルパス、Issue番号

## 背景（Context）
## 決定（Decision）
## 根拠（Rationale）
## 影響（Consequences）
```

**Operations Docs テンプレート**:
```markdown
# 手順：タイトル

## 目的
## 前提条件
## 手順
## トラブルシューティング
```

## ベストプラクティス

### ✅ Do

- Personal Vault で自由に書き、Project Vault で整理
- ADR は決定後すぐに作成（記憶が新しいうちに）
- Operations Docs はトラブル発生時にすぐ更新
- Project Vault のファイル名は英語・ケバブケース（`mcp-setup-guide.md`）

### ❌ Don't

- Project Vault に未整理メモを直接書かない
- Personal Vault を Git 管理しない
- ADR を事後的に追記せず、新規ファイルで記録
- Project Vault のファイル名に日本語・スペースを使わない

## 関連ドキュメント

- [ADR-0004: Obsidian二層統合アーキテクチャ](../decisions/ADR-0004-obsidian-dual-layer-integration.md) - REST API / MCP の二層アクセス構成
- [MCP-Obsidian 統合仕様](./mcp-obsidian-spec.md) - MCP 経由のノート編集
- [KB セットアップガイド](./kb-setup.md) - Knowledge Base への取り込み手順

---

**最終更新**: 2025-11-17
