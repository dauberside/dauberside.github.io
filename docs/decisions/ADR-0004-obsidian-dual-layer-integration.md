# ADR: Obsidian二層統合アーキテクチャの採択

- ID: ADR-0004
- 日付: 2025-11-17
- 状態: Accepted
- 決定者: プロジェクトオーナー（dauberside）
- 関連:
  - `docs/operations/mcp-obsidian-spec.md`
  - `docs/operations/mcp-obsidian-workflows.md`
  - `docs/requirements/obsidian.md`
  - `src/lib/obsidian.ts`
  - Obsidian vault内 `specs/obsidian-vault-info.md`
  - ADR-0003（MCP統合アーキテクチャ）

## 背景（Context）

- Obsidian vaultをKnowledge Baseのソースとして活用したい
- Claude から Obsidian ノートを安全に生成・編集し、ナレッジベースと自動処理に反映したい
- 読み取り（KB取り込み）と書き込み（ノート編集）で最適なアクセス方法が異なる
  - **読み取り**: 大量ファイルの効率的なスキャン、Delta検出による差分更新
  - **書き込み**: セクション単位の安全な編集、定期ノート処理、検索機能
- iCloud Drive経由で複数デバイスで同期されるvaultに対応する必要がある

## 決定（Decision）

**2つの統合方式を併用する二層アーキテクチャを採択する。**

### 方式A: REST API統合（KB取り込み専用）

**用途**: 読み取り専用、Knowledge Base への埋め込みベクトル生成

**構成**:
```
Obsidian Local REST API Plugin
    ↓
src/lib/obsidian.ts (クライアント)
    ↓
/api/obsidian/ingest (取り込みエンドポイント)
    ↓
kb/index/embeddings.json (Knowledge Base)
```

**特徴**:
- Delta検出（SHA256ハッシュ）による差分更新
- 読み取り専用（編集機能なし）
- KB インデックスへの一方向同期
- OpenAI Embeddings による RAG 検索

**環境変数**:
```bash
OBSIDIAN_API_URL="http://127.0.0.1:8443"
OBSIDIAN_API_KEY=<from-plugin>
```

### 方式B: MCP統合（ノート編集・管理）

**用途**: 双方向（読み書き可能）、ノート編集・検索・自動処理

**構成**:
```
MCP Server (uvx mcp-obsidian)
    ↓
Claude Code / Claude Desktop
    ↓
Obsidian Vault（直接ファイル I/O）
```

**特徴**:
- 双方向（読み書き可能）
- Obsidian Local REST API 不要
- セクション・ブロック・frontmatter 単位の編集
- テキスト検索および JsonLogic による複雑な検索
- 定期ノート（Daily/Weekly/Monthly）の自動処理

**設定**: `.mcp.json` の obsidian サーバー定義

### Vault情報

- **Vault ID**: `2742690dfebfe8dc`
- **Vault パス**: `/Users/krinkcrank/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault`
- **同期**: iCloud Drive経由

### ベストプラクティス

**「編集はMCP、検索はKB」の二段構え**

1. MCP でノート整理・編集
2. `/api/obsidian/ingest` で KB 再取り込み
3. Claude RAG 検索で最新情報を参照

## 根拠（Rationale）

### なぜ二層構造か？

#### 用途分離の必要性

| 要件 | REST API統合 | MCP統合 |
|------|--------------|---------|
| **大量ファイルスキャン** | ✅ 効率的 | ❌ 個別アクセス |
| **Delta検出** | ✅ SHA256ハッシュ | ❌ 機能なし |
| **埋め込み生成** | ✅ バッチ処理 | ❌ 対象外 |
| **ノート編集** | ❌ 機能なし | ✅ セクション単位 |
| **定期ノート処理** | ❌ 機能なし | ✅ 専用機能 |
| **高度な検索** | ❌ 単純検索のみ | ✅ JsonLogic対応 |

#### セキュリティとパフォーマンス

- **REST API**: ローカルポート（8443）へのHTTPアクセス、認証トークン必須
- **MCP**: ファイルシステム直接アクセス、プラグイン不要、オーバーヘッド低

#### 依存関係

- **REST API**: Obsidian Local REST API Plugin が必要（起動時にプラグイン稼働確認）
- **MCP**: プラグイン不要、vaultパスのみ必要

### メリット

1. **用途に最適化**
   - KB取り込み: 効率的なDelta検出と埋め込み生成
   - ノート編集: セクション単位の安全な操作

2. **パフォーマンス**
   - REST API: HTTP経由だがバッチ処理で効率化
   - MCP: ファイル直接アクセスで低レイテンシ

3. **拡張性**
   - REST API: KB機能拡張に集中
   - MCP: 編集・自動処理の機能追加に集中

4. **フォールトトレランス**
   - REST API Pluginが停止してもMCP経由の編集は可能
   - MCPが利用不可でもKB検索は継続可能

## 代替案（Alternatives）

### 代替A: REST API統合のみ
- KB取り込みとノート編集をすべてREST API経由
- **問題**:
  - セクション単位編集が困難
  - 定期ノート処理の実装が複雑
  - Claude CodeとのMCP連携の恩恵を受けられない

### 代替B: MCP統合のみ
- KB取り込みもMCP経由で実装
- **問題**:
  - Delta検出の実装が複雑
  - 大量ファイルスキャンの効率が悪い
  - 埋め込み生成のバッチ処理が困難

### 代替C: 完全カスタム実装
- Obsidian vault を直接ファイルシステムから読み書き
- **問題**:
  - `.obsidian/` ディレクトリの扱いが複雑
  - Obsidianのメタデータ形式への対応が必要
  - プラグインやMCPの恩恵を受けられない

## 影響（Consequences）

### メリット

- ✅ 用途別に最適化されたアクセス方法
- ✅ KB取り込みの効率化（Delta検出）
- ✅ ノート編集の柔軟性（セクション単位、定期ノート）
- ✅ Claude Codeとの直接連携
- ✅ フォールトトレランス（一方が停止しても他方は動作）

### リスク/コスト

- ⚠️ **設定の複雑性**: 2つの統合方式の設定が必要
  - **緩和策**: 詳細なセットアップガイド、設定チェックリスト
- ⚠️ **認識の混同**: 用途の違いを理解する必要
  - **緩和策**: ドキュメントで明確に区別、ベストプラクティスの提示
- ⚠️ **同期タイミング**: MCP編集後のKB更新が必須
  - **緩和策**: 編集後に `/api/obsidian/ingest` を手動/自動実行

## 実装ノート（Implementation Notes）

### ファイル構成

**REST API統合**:
- `src/lib/obsidian.ts`: REST APIクライアント
- `/api/obsidian/ingest`: 取り込みエンドポイント
- `/api/obsidian/ping`: 接続確認
- `/api/obsidian/list`: ファイル一覧
- `/api/obsidian/search`: 検索

**MCP統合**:
- `.mcp.json`: obsidian サーバー定義
- `docs/operations/mcp-obsidian-spec.md`: 仕様書
- `docs/operations/mcp-obsidian-workflows.md`: 運用ガイド

**Vault情報**:
- Obsidian vault内 `specs/obsidian-vault-info.md`: Vault ID、パス、統合状況

### ポート標準化

- **8443**: HTTP（デフォルト）
- **8445**: HTTPS（推奨）

すべてのドキュメントとコードで8443に統一（2025-11-17）

### 推奨ワークフロー

```bash
# 1. MCP でノート編集
"Obsidian MCP で、プロジェクトノートの構造を整理して..."

# 2. KB への再取り込み
curl -X POST http://localhost:3000/api/obsidian/ingest

# 3. KB 再ビルド（必要に応じて）
pnpm kb:build

# 4. Claude RAG 検索で確認
curl "http://localhost:3000/api/kb/search?q=MCP&topK=5"
```

## フォローアップ（Follow-ups）

### 短期（1週間以内）

- [x] `docs/operations/mcp-obsidian-spec.md` 作成
- [x] `docs/operations/mcp-obsidian-workflows.md` 作成
- [x] Obsidian vault内に `specs/obsidian-vault-info.md` 作成
- [x] ポート番号統一（8443）
- [x] Context Capsule更新

### 中期（1ヶ月以内）

- [ ] MCP編集後のKB自動再取り込み実装
- [ ] 定期ノート自動処理のワークフロー構築
- [ ] n8n連携による通知/自動処理

### 長期（3ヶ月以内）

- [ ] 複数vault対応の検討
- [ ] 仕様レビューの自動チェック（Lint/テンプレート検証）
- [ ] PR コメント連携（KB ingest 後の差分サマリ自動投稿）

## 関連ADR

- ADR-0001: Context Capsule と ADR 運用プロセス
- ADR-0003: MCP統合アーキテクチャ
- ADR-0005: KB埋め込みモード選択

---

この ADR により、Obsidian統合は用途別に最適化された二層アーキテクチャとなり、効率的なKB構築と柔軟なノート編集の両立が実現される。
