# Implementation Templates

このディレクトリには、機能実装のための標準テンプレートが含まれています。

**最終更新**: 2025-11-09
**バージョン**: 1.1

---

## 📋 テンプレート一覧

| テンプレート | 用途 | サイズ | 参照 |
|------------|------|--------|------|
| `spec-template.md` | 機能仕様書 | ~323 行 | 機能の Problem/Solution/Requirements を定義 |
| `plan-template.md` | 実装計画書 | ~399 行 | Phase 0-4 の実装戦略を計画 |
| `tasks-template.md` | タスク定義書 | ~251 行 | 具体的な実装タスクを定義 |

---

## 🚀 ワークフロー

### ステップ 1: 機能仕様の作成

**テンプレート**: `spec-template.md`

```bash
# 新機能ブランチを作成
git checkout -b feat/my-feature

# 仕様ディレクトリを作成
mkdir -p spec/specs/001-my-feature

# テンプレートをコピー
cp templates/spec-template.md spec/specs/001-my-feature/spec.md

# 編集
vim spec/specs/001-my-feature/spec.md
```

**記入内容**:
- Problem Statement（解決する課題）
- User Stories（ユーザーストーリー）
- Requirements（機能/非機能要件）
- Success Criteria（成功基準）
- Technical Design（技術設計）

**完了基準**:
- [ ] Problem が明確
- [ ] 主要な User Stories が定義済み
- [ ] 機能要件（FR-1～）が明記
- [ ] 非機能要件（性能、セキュリティ、アクセシビリティ）が明記
- [ ] API エンドポイントとデータモデルが定義済み

---

### ステップ 2: 実装計画の作成

**テンプレート**: `plan-template.md`

```bash
# テンプレートをコピー
cp templates/plan-template.md spec/specs/001-my-feature/plan.md

# 編集
vim spec/specs/001-my-feature/plan.md
```

**記入内容**:
- Technical Context（技術的背景）
- Constitution Check（設計原則チェック）
- Phase 0: Research（調査・設計）
- Phase 1: Contracts & Foundation（契約とテスト）
- Phase 2: Task Planning（タスク計画）

**完了基準**:
- [ ] Technical Context 記入済み（言語、依存関係、制約）
- [ ] Constitution Check 完了（Simplicity/Architecture/Testing/Observability）
- [ ] Phase 0 の Unknowns/Questions が明確
- [ ] Phase 1 の Entity と API Contract が定義済み
- [ ] Phase 2 の Task 生成方針が明確

---

### ステップ 3: タスク定義の作成

**テンプレート**: `tasks-template.md`

```bash
# テンプレートをコピー
cp templates/tasks-template.md spec/specs/001-my-feature/tasks.md

# 編集
vim spec/specs/001-my-feature/tasks.md
```

**記入内容**:
各タスクごとに：
- **Goal**: 1行で達成内容を記述
- **Deliverables**: 作成/変更するファイル
- **Acceptance Criteria**: 受け入れ基準（typecheck/lint/test/build）
- **Constraints/Dependencies**: 依存関係と制約
- **Risk/Rollback**: リスクとロールバック方法
- **Size Estimate**: S/M/L（< 4時間 / < 1日 / 1-3日）

**タスクの順序**:
1. 並列実行可能なタスクに **[P]** マーク
2. TDD 順序: Contract Tests → Service Layer → API → UI
3. 依存関係を明記（"Depends on: Task 2"）

**完了基準**:
- [ ] 全タスクに Goal/Deliverables/Acceptance/Risk/Size が記入済み
- [ ] 並列実行可能タスクに **[P]** マーク
- [ ] 依存関係が明確
- [ ] Quality Gates Checklist が理解済み

---

## 📝 テンプレートの詳細

### `spec-template.md` - 機能仕様書

**目的**: 機能の「何を」「なぜ」「どのように」を定義

**主要セクション**:
- **Problem Statement**: 現状と理想状態
- **Stakeholders/Personas**: ユーザー、ステークホルダー
- **Goals/Non-Goals**: スコープの明確化
- **User Stories**: Epic と具体的なストーリー
- **Requirements**: 機能要件（FR-1～）と非機能要件
  - Performance（P95 latency, throughput）
  - Security（auth, CORS, noindex）
  - Privacy（data collection, retention）
  - Accessibility（WCAG 2.1）
  - Observability（logging, metrics）
  - Reliability（uptime, error budget）
- **Success Criteria**: KPI と Acceptance
- **Metrics/Telemetry**: 計測するイベントとメトリクス
- **Technical Design**: アーキテクチャ、API、データモデル
- **Risks & Mitigations**: リスク評価と対策

**使用タイミング**: プロジェクト開始時、要件定義フェーズ

---

### `plan-template.md` - 実装計画書

**目的**: 実装の「どうやって」を段階的に計画

**主要セクション**:
- **Summary**: 問題、解決策、影響の概要
- **Technical Context**: 技術スタック、制約、性能目標
- **Constitution Check**: 設計原則の遵守確認
  - Simplicity（シンプルさ）
  - Architecture（アーキテクチャパターン）
  - Testing（テスト戦略）
  - Observability（可観測性）
  - Versioning（バージョニング）
- **Phase 0: Research**: 不明点の調査と決定
- **Phase 1: Design & Contracts**: エンティティ、API契約、契約テストの作成
- **Phase 2: Task Planning**: タスク生成方針（tasks.md は別途作成）
- **Progress Tracking**: フェーズごとの進捗チェックリスト
- **Dependencies & Risks**: 依存関係とリスク管理

**使用タイミング**: 仕様確定後、実装開始前

---

### `tasks-template.md` - タスク定義書

**目的**: 実装を具体的なタスクに分解し、並列化とトラッキングを可能にする

**主要セクション**:
- **Overview**: 機能の Goal と実装戦略
- **Task List**: 個別タスク定義（6つのサンプルタスク付き）
  - Task 1-3: Foundation/Service/UI 実装
  - Task 4: Tests & Documentation
  - Task 5: Security & Performance Review
  - Task 6: Deployment & Smoke Test
- **Quality Gates Checklist**: 完了前の必須チェック
- **Implementation Notes**: 共通パターン
  - Service Layer Pattern
  - Agent Builder の使い方
  - Knowledge Base の使い方
  - Protected Routes の設定方法
- **Definition of Done**: タスク完了の定義

**使用タイミング**: plan.md 完成後、実装中のトラッキング

---

## 🎯 Definition of Ready/Done

### Definition of Ready（着手可能条件）

タスクは以下を満たす場合のみ着手可能：
- [ ] **Goal**: 1行で達成内容が明確
- [ ] **Deliverables**: 作成/変更するファイルが明確
- [ ] **Acceptance Criteria**: 受け入れ基準が具体的（typecheck/lint/test/build）
- [ ] **Constraints/Dependencies**: 依存関係と制約が明記
- [ ] **Risk/Rollback**: リスクとロールバック方法が明記
- [ ] **Size Estimate**: S/M/L が見積もり済み

### Definition of Done（完了条件）

タスクは以下を満たす場合のみ完了：
1. ✅ All deliverables created/modified（すべての成果物作成済み）
2. ✅ All acceptance criteria met（受け入れ基準をすべて満たす）
3. ✅ Quality gates pass（`pnpm typecheck && pnpm lint && pnpm test && pnpm build`）
4. ✅ Documentation updated（ドキュメント更新済み）
5. ✅ Code reviewed（コードレビュー済み - 該当する場合）
6. ✅ Security/performance validated（セキュリティ/性能検証済み）
7. ✅ Deployed and smoke tested（デプロイとスモークテスト完了）

---

## 🔧 共通パターン

### Agent Builder を使用する場合

```bash
# 1. Agent 設定ファイルを編集
vim src/lib/agent/configs/my-agent.json

# 2. 生成
pnpm agent:builder:generate

# 3. 実装（agent.generated.ts の TODO を置き換え）
vim src/lib/agent/agent.generated.ts

# 4. スモークテスト
pnpm agent:builder:smoke
```

### Knowledge Base を使用する場合

```bash
# 1. KB_SOURCES を設定
export KB_SOURCES="docs,/path/to/obsidian/vault"

# 2. インデックス作成
pnpm kb:build

# 3. 検索テスト
curl "http://localhost:3000/api/kb/search?q=test&topK=3"
```

### Protected Routes を追加する場合

```bash
# 1. middleware.ts を更新（パス追加）
vim src/middleware.ts

# 2. IP アロウリストに追加
pnpm ops:allowlist:add 100.102.85.62

# 3. PM2 再起動
npx pm2 reload next-app --update-env

# 4. 検証
curl -v http://localhost:3030/my-protected-route
# → 401 (未認証) or 200 (認証済み)
```

---

## 📚 参照ドキュメント

**要件定義**:
- `docs/requirements/README.md` - 不変条件（インデックス抑止、保護ルート、モック禁止）
- `docs/requirements/tasks.md` - タスク定義とワークフロー規約
- `docs/requirements/dev-environment.md` - 開発環境セットアップ
- `docs/requirements/chat.md` - Chat 機能要件
- `docs/requirements/kb.md` - Knowledge Base 要件
- `docs/requirements/hot-path-optimization.md` - Direct Agent Path
- `docs/requirements/services.md` - サービス運用（PM2/ポート/CORS）

**運用ガイド**:
- `docs/operations/deploy-and-smoke.md` - デプロイとスモークテスト
- `docs/operations/line-ai-menu.md` - LINE AI メニュー運用
- `docs/operations/kb-setup.md` - KB セットアップ

**アーキテクチャ**:
- `CLAUDE.md` - Claude Code 向けガイド
- `docs/decisions/ADR-*.md` - アーキテクチャ決定記録

---

## ✅ チェックリスト: テンプレート使用前

実装開始前に以下を確認：
- [ ] `docs/requirements/README.md` の不変条件を理解済み
- [ ] `docs/requirements/tasks.md` のタスク定義を理解済み
- [ ] 技術スタック（Next.js 14, Node 22, TypeScript 5.8, pnpm）を確認済み
- [ ] 開発環境セットアップ完了（`pnpm install && pnpm dev`）
- [ ] Quality Gates コマンド確認（`pnpm typecheck/lint/test/build/ci`）

---

## 🆘 トラブルシューティング

**Q: どのテンプレートから始めればいい？**
A: 順番に使用：`spec-template.md` → `plan-template.md` → `tasks-template.md`

**Q: Constitution Check で違反が見つかった場合は？**
A: 正当な理由がある場合は "Violations" セクションに記載。そうでなければ設計を見直す。

**Q: タスクが大きすぎる（L サイズが3日超）場合は？**
A: 複数の M/S サイズタスクに分割。1つのタスクは最大3日以内に。

**Q: 並列実行 [P] マークの基準は？**
A: 他タスクに依存せず、独立して実行可能なタスクに付与。例：契約テスト作成とデータモデル定義は並列可能。

**Q: Quality Gates で失敗する場合は？**
A: タスクを「完了」にせず、エラーを修正してから再実行。`pnpm ci` がすべて通るまで次タスクに進まない。

---

**Templates Version**: 1.1
**Based on**: `docs/requirements/tasks.md` (最終更新: 2025-10-25), `docs/requirements/README.md` (不変条件)
**Last Updated**: 2025-11-09
