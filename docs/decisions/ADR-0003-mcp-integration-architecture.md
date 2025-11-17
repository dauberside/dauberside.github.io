# ADR: MCP統合アーキテクチャの採択

- ID: ADR-0003
- 日付: 2025-11-17
- 状態: Accepted
- 決定者: プロジェクトオーナー（dauberside）
- 関連:
  - `docs/operations/mcp-json-setup.md`
  - `docs/operations/mcp-setup-guide.md`
  - `.mcp.json`
  - ADR-0001（Context Capsule運用プロセス）

## 背景（Context）

- Claude Codeとの直接連携により、開発効率を大幅に向上させる必要がある
- GitHub Issues/PRs、Vercel デプロイメント、n8n ワークフロー、Obsidian vaultへのアクセスを統一的に管理したい
- プロジェクト固有の設定とチーム共有設定を分離し、セキュリティトークンをGit管理から除外する必要がある
- Model Context Protocol（MCP）は、AIアシスタントが外部ツールやデータソースと安全に連携するための標準プロトコル

## 決定（Decision）

**4つのMCPサーバーを統合し、Claude Codeからの直接アクセスを可能にする。**

### 統合するMCPサーバー

1. **GitHub MCP** (`@modelcontextprotocol/server-github`)
   - Issues/PRsの作成・更新・検索
   - コミット履歴の参照
   - プルリクエストのレビュー

2. **Vercel MCP** (`@iflow-mcp/vercel-api-mcp`)
   - デプロイメントの管理・監視
   - ビルドログの取得
   - 環境変数の確認

3. **n8n MCP** (`n8n-mcp`)
   - ワークフロー実行のトリガー
   - ノード情報の取得
   - テンプレート検索

4. **Obsidian MCP** (`mcp-obsidian`)
   - Vaultへの直接ファイルアクセス
   - ノートの編集・検索
   - 定期ノート（Daily/Weekly/Monthly）処理

### 設定ファイル構成

- **`.mcp.json`**: チーム共有設定（Git管理対象）
  - サーバー定義（command, args）
  - 環境変数テンプレート（実際のトークンは含まない）
- **`.mcp.local.json`**: 個人用設定（`.gitignore`で除外）
  - 実際のAPIキー・トークン
  - ローカル固有の設定

## 根拠（Rationale）

### メリット

1. **開発効率の向上**
   - Claude Codeから直接GitHub、Vercel、n8nにアクセス可能
   - コンテキストスイッチの削減
   - 手動操作の自動化

2. **統一的な管理**
   - MCPプロトコルによる標準化されたインターフェース
   - 一貫した認証・エラーハンドリング
   - 設定の一元管理

3. **セキュリティ**
   - トークンを`.mcp.local.json`に分離
   - Git管理からの除外
   - 環境変数による注入

4. **拡張性**
   - 新しいMCPサーバーの追加が容易
   - プロトコルベースのため、将来的な機能追加に対応

## 代替案（Alternatives）

### 代替A: 個別のCLIツール使用
- 各サービス（GitHub CLI, Vercel CLI, n8n CLI）を個別に使用
- **問題**:
  - コンテキストスイッチが多い
  - Claude Codeとの統合が困難
  - 認証管理が煩雑

### 代替B: カスタムAPIラッパー構築
- 各サービス用の独自ラッパーを実装
- **問題**:
  - 開発・メンテナンスコストが高い
  - 標準プロトコルの恩恵を受けられない
  - 将来的な互換性リスク

### 代替C: MCPなしでREST APIを直接使用
- Next.js API ルートから各サービスのREST APIを直接呼び出し
- **問題**:
  - Claude Codeとの連携が不可
  - 開発効率の低下
  - エラーハンドリングの重複実装

## 影響（Consequences）

### メリット

- ✅ Claude Codeから直接GitHub/Vercel/n8n/Obsidianにアクセス可能
- ✅ 開発フローの大幅な効率化
- ✅ 統一的な設定管理
- ✅ セキュアなトークン管理

### リスク/コスト

- ⚠️ **セットアップの複雑性**: 初回設定に時間がかかる
  - **緩和策**: 詳細なセットアップガイド（`docs/operations/mcp-setup-guide.md`）を整備
- ⚠️ **依存関係の増加**: 4つの外部MCPサーバーに依存
  - **緩和策**: 各サーバーのバージョンを固定、定期的な動作確認
- ⚠️ **トークン管理**: `.mcp.local.json`の誤コミットリスク
  - **緩和策**: `.gitignore`での除外、`.mcp.local.json.example`によるテンプレート提供

## 実装ノート（Implementation Notes）

### 追加ファイル

- `.mcp.json`: チーム共有MCP設定（GitHub/Vercel/n8n/Obsidian）
- `.mcp.local.json.example`: ローカル設定のテンプレート
- `docs/operations/mcp-json-setup.md`: 設定ファイル利用ガイド
- `docs/operations/mcp-setup-guide.md`: セットアップ手順

### 環境変数

各MCPサーバーで使用：
- `GITHUB_PERSONAL_ACCESS_TOKEN`
- `VERCEL_API_KEY`
- `N8N_API_KEY`, `N8N_API_URL`
- `OBSIDIAN_API_KEY`, `OBSIDIAN_API_URL`

### セキュリティ対策

1. **トークン分離**: `.mcp.local.json`に実際のトークンを保持
2. **Git除外**: `.gitignore`に`.mcp.local.json`を追加
3. **テンプレート提供**: `.mcp.local.json.example`でプレースホルダー付き設定例を提供

### ポート標準化

- Obsidian REST API: **8443**（HTTP）、8445（HTTPS推奨）
- n8n: 5678（デフォルト）
- KB API: 4040（オプション）

## フォローアップ（Follow-ups）

### 短期（1週間以内）

- [x] `.mcp.json`の作成とGit管理
- [x] `.mcp.local.json.example`の作成
- [x] `docs/operations/mcp-json-setup.md`の整備
- [x] Context Capsule更新（ADR-0001準拠）

### 中期（1ヶ月以内）

- [ ] MCP統合の動作確認CI追加
- [ ] トークンローテーション手順の文書化
- [ ] エラーハンドリングの改善

### 長期（3ヶ月以内）

- [ ] 新MCPサーバー追加の評価（Slack, Notion, Linear など）
- [ ] MCPサーバーのカスタム実装検討（プロジェクト固有の機能）

## 関連ADR

- ADR-0001: Context Capsule と ADR 運用プロセス
- ADR-0004: Obsidian二層統合（本ADRのObsidian部分を詳細化）

---

この ADR により、MCP統合による統一的な外部サービス連携基盤が確立され、Claude Codeを中心とした効率的な開発フローが実現される。
