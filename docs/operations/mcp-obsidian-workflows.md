# MCP × Obsidian 運用ガイド

最終更新: 2025-11-17

---

## 1. 統合アーキテクチャ

このプロジェクトには **2つの Obsidian 統合** が存在し、それぞれ異なる役割を持ちます。

### 1.1 既存統合：REST API ベース（KB 取り込み専用）

**構成:**
```
Obsidian Local REST API Plugin
    ↓
src/lib/obsidian.ts (クライアント)
    ↓
/api/obsidian/ingest (取り込みエンドポイント)
    ↓
kb/index/embeddings.json (Knowledge Base)
```

**環境変数:**
```bash
# ポート番号は Local REST API Plugin の設定に合わせて変更すること
OBSIDIAN_API_URL="http://127.0.0.1:8443/"
OBSIDIAN_API_KEY=<from-plugin>
```

**用途:**
- Obsidian vault からのコンテンツ取り込み
- Knowledge Base への埋め込みベクトル生成
- Claude による RAG 検索の対象データ化

**特徴:**
- Delta 検出（SHA256 ハッシュ）による差分更新
- 読み取り専用（編集機能なし）
- KB インデックスへの一方向同期

### 1.2 新規統合：MCP Obsidian（ファイル直アクセス）

**構成:**
```
MCP Server (obsidian-mcp)
    ↓
Claude Code / Claude Desktop
    ↓
Obsidian Vault（直接ファイル I/O）
```

**環境変数:**
```bash
MCP_API_TOKEN="<secure-token>"
```

**用途:**
- ノートの直接編集・追記・削除
- 高度な検索（simple / complex）
- 定期ノート（Daily/Weekly/Monthly）の自動処理
- 最近の変更追跡

**特徴:**
- 双方向（読み書き可能）
- Obsidian Local REST API 不要
- セクション・ブロック・frontmatter 単位の編集

### 1.3 役割の違い（重要！）

| 機能 | REST API 統合 | MCP 統合 |
|------|--------------|----------|
| **主な用途** | KB への取り込み | ノート編集・管理 |
| **方向性** | 読み取り専用 | 読み書き可能 |
| **検索** | Embedding ベース（RAG） | テキスト / JsonLogic |
| **編集** | ❌ | ✅（セクション単位も可） |
| **依存** | REST API Plugin 必要 | プラグイン不要 |
| **認証** | API Key | MCP Token |

**ベストプラクティス:**
- **編集は MCP、検索は KB** の二段構え
- MCP でノート整理 → `/api/obsidian/ingest` で KB 再取り込み → Claude RAG 検索

---

## 2. セットアップ

### 2.1 MCP Obsidian サーバーのインストール

**前提条件:**
- Node.js 18 以上
- Obsidian vault のパス

**インストール手順:**

```bash
# MCP Obsidian サーバーのインストール
npm install -g @modelcontextprotocol/server-obsidian

# または、ローカルでの実行
npx @modelcontextprotocol/server-obsidian
```

### 2.2 Claude Desktop での設定

**設定ファイル:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-obsidian",
        "/path/to/your/obsidian/vault"
      ]
    }
  }
}
```

### 2.3 Claude Code での設定

**設定ファイル:** `.mcp.json` (プロジェクトルート)

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-obsidian",
        "/path/to/your/obsidian/vault"
      ]
    }
  }
}
```

### 2.4 環境変数の設定

**`.env.local` に追加:**

```bash
# MCP Obsidian 認証トークン
MCP_API_TOKEN="<secure-random-token>"

# 既存の REST API 設定（KB 取り込み用）
# ポート番号は Local REST API Plugin の設定に合わせて変更すること
OBSIDIAN_API_URL="http://127.0.0.1:8443/"
OBSIDIAN_API_KEY=<from-plugin>
```

**トークン生成例:**
```bash
# macOS/Linux
openssl rand -hex 32

# または UUID
uuidgen
```

### 2.5 HTTP/HTTPS ポート越えの注意点

**Docker 環境での接続:**

MCP サーバーが Docker 内で動作する場合、ホストの Obsidian vault にアクセスするには：

```bash
# host.docker.internal を使用
OBSIDIAN_API_URL=https://host.docker.internal:8445
```

**ポート設定:**
- `8443`: HTTP（デフォルト例）
- `8445`: HTTPS（推奨）
- **注意:** 実際のポート番号は Obsidian Local REST API Plugin の設定で確認すること

**よくあるエラー:**
```
Error: connect ECONNREFUSED 127.0.0.1:8443
```

**対処法:**
1. Obsidian Local REST API Plugin のポート設定を確認
2. `host.docker.internal` を使用（Docker の場合）
3. ファイアウォール設定を確認

---

## 3. 推奨ワークフロー

### 3.1 読み取り編（安全に試す）

#### 例1: ボールト全体のファイル一覧

```
Obsidian MCP を使って、vault のルートディレクトリにあるファイルとディレクトリを一覧表示して。
```

**使用ツール:** `obsidian_list_files_in_vault`

#### 例2: テーマに関するノートを一気に読ませる

```
Obsidian MCP で "MCP" というキーワードを simple_search して、
上位5件のノート本文をまとめて読み込んで、
"このボールトにおける MCP に関する設計方針" を日本語で要約して。
```

**使用ツール:**
1. `obsidian_simple_search` - キーワード検索
2. `obsidian_batch_get_file_contents` - 複数ファイル一括取得
3. 要約は Claude の通常機能

**メリット:**
- 設計メモが散らばっていても、1回で俯瞰可能
- 読み取り専用なので安全

#### 例3: 最近の変更を追跡

```
Obsidian MCP で、直近7日間に変更されたファイルを10件取得して、
それぞれのファイル名と変更日時を表にまとめて。
```

**使用ツール:** `obsidian_get_recent_changes`

**パラメータ:**
- `days`: 7（デフォルト90日）
- `limit`: 10（デフォルト10件）

#### 例4: 複雑な検索（タグ・条件指定）

```
Obsidian MCP の complex_search を使って、
タグに #project と #active を両方含むノートを検索して、
ファイル名とパスを一覧表示して。
```

**使用ツール:** `obsidian_complex_search`

**JsonLogic クエリ例:**
```json
{
  "and": [
    {"in": ["#project", {"var": "tags"}]},
    {"in": ["#active", {"var": "tags"}]}
  ]
}
```

### 3.2 編集編（段階的に試す）

#### 例5: 今日のデイリーノートに追記

```
Obsidian MCP を使って、
1. 今日のデイリーノートを取得して、
2. "## 今日やること" というセクションを追加して、
3. "- [ ] MCP Obsidian のドキュメント確認" というタスクを追記して。
```

**使用ツール:**
1. `obsidian_get_periodic_note` (period: "daily")
2. `obsidian_append_content`

**安全性:** 追記のみなので既存コンテンツを壊さない

#### 例6: セクション単位の安全な書き換え

```
operations/claude-code.md を開いて、
見出し "## MCP 統合" の直下の内容だけを、
"MCP Obsidian 統合（ファイル直アクセス版）が利用可能" に書き換えて。
他のセクションは変更しないで。
```

**使用ツール:** `obsidian_patch_content`

**パラメータ:**
- `target_type`: "heading"
- `target`: "## MCP 統合"
- `operation`: "replace"
- `content`: "MCP Obsidian 統合（ファイル直アクセス版）が利用可能"

**メリット:**
- 全文編集じゃなく、セクション単位での修正
- 他のセクションへの影響ゼロ

#### 例7: 「最近の学び」ノートを自動生成

```
Obsidian MCP を使って、
1. 直近3日間で変更されたノートを取得して、
2. それらの変更内容を "学び/最近学んだこと.md" というノートに箇条書きでまとめて追記して。
```

**使用ツール:**
1. `obsidian_get_recent_changes` (days: 3)
2. `obsidian_batch_get_file_contents`
3. `obsidian_append_content`

**応用:**
- 週次レビューの自動生成
- プロジェクトごとの進捗まとめ

#### 例8: 「今日やること」を1発で集約

```
Obsidian MCP を使って、
1. 今日のデイリーノートを開いて、
2. 直近2日で変更されたファイルから "TODO" や "やること" を拾い集めて、
3. 今日のデイリーノートに "## 今日やること" セクションを追記して。
```

**使用ツール:**
1. `obsidian_get_periodic_note` (period: "daily")
2. `obsidian_get_recent_changes` (days: 2)
3. `obsidian_simple_search` (query: "TODO", "やること")
4. `obsidian_append_content`

**効果:**
- 散らばったタスクを自動集約
- デイリーノートに一元化

---

## 4. 組み合わせパターン（重要！）

### 4.1 編集（MCP） → ingest（KB） → Claude 検索

**ワークフロー:**

```bash
# 1. MCP でノートを編集・整理
"Obsidian MCP で、プロジェクトノートの構造を整理して..."

# 2. KB への再取り込み
curl -X POST http://localhost:3000/api/obsidian/ingest \
  -H "Content-Type: application/json" \
  -d '{"sources": ["/path/to/vault"]}'

# 3. KB 再ビルド
pnpm kb:build

# 4. Claude RAG 検索で確認
curl "http://localhost:3000/api/kb/search?q=MCP&topK=5"
```

**メリット:**
- MCP で編集の自由度
- KB で高精度な検索
- 最新情報が即座に反映

### 4.2 定期ノート + 自動編集

**週次レビューの自動化:**

```
Obsidian MCP を使って、
1. 今週の週次ノートを取得して、
2. 過去7日間の Daily Notes から完了タスク（[x]）を抽出して、
3. 週次ノートの "## 今週の成果" セクションに追記して。
```

**使用ツール:**
1. `obsidian_get_periodic_note` (period: "weekly")
2. `obsidian_get_recent_periodic_notes` (period: "daily", limit: 7)
3. `obsidian_batch_get_file_contents`
4. `obsidian_patch_content`

### 4.3 Daily/Weekly データ集約の自動化

**月次レポートの生成:**

```
Obsidian MCP を使って、
1. 今月の月次ノートを取得して、
2. 今月の全ての週次ノートを取得して、
3. 各週の "## 今週の成果" セクションを集約して、
4. 月次ノートの "## 今月の成果" に追記して。
```

**使用ツール:**
1. `obsidian_get_periodic_note` (period: "monthly")
2. `obsidian_get_recent_periodic_notes` (period: "weekly", limit: 4)
3. `obsidian_batch_get_file_contents`
4. `obsidian_append_content`

---

## 5. 安全な運用ポイント

### 5.1 削除系はテストディレクトリで

**最初に試す場所:**

```
vault/
  ├── test/                    # ここで試す！
  │   ├── mcp-test.md
  │   └── delete-test.md
  ├── projects/                # 本番データ
  └── daily/
```

**削除コマンド例:**

```
Obsidian MCP で、test/delete-test.md を削除して。
confirm パラメータを true にして実行して。
```

**使用ツール:** `obsidian_delete_file`

**重要:** `confirm: true` が必須

### 5.2 ingest 再実行のタイミング

**KB に反映させたい場合:**

```bash
# MCP で編集後、KB を更新
pnpm kb:build

# または API 経由
curl -X POST http://localhost:3000/api/obsidian/ingest
```

**推奨タイミング:**
- 大量のノート編集後
- 新規プロジェクトノート追加後
- 定期実行（cron で毎日深夜など）

### 5.3 バックアップ

**Obsidian vault のバックアップ:**

```bash
# Git バージョン管理（推奨）
cd /path/to/vault
git init
git add .
git commit -m "Initial vault backup"

# または定期的なコピー
rsync -av /path/to/vault/ /path/to/backup/
```

**MCP 編集前のスナップショット:**

```bash
# 編集前に Git commit
cd /path/to/vault
git add .
git commit -m "Before MCP batch edit"

# MCP で編集

# 問題があれば復元
git reset --hard HEAD
```

---

## 6. よくあるエラーと対処

### 6.1 host.docker.internal で繋がらない問題

**エラー:**
```
Error: getaddrinfo ENOTFOUND host.docker.internal
```

**原因:**
- Docker Desktop が起動していない
- `host.docker.internal` が解決できない環境

**対処法:**

```bash
# 1. Docker Desktop を起動
# 2. または、ホスト IP を直接指定
OBSIDIAN_API_URL=http://192.168.1.100:8443
```

### 6.2 ポート 8443/8445 ミスマッチ

**エラー:**
```
Error: connect ECONNREFUSED 127.0.0.1:8443
```

**原因:**
- Obsidian Local REST API Plugin のポート設定が異なる
- HTTP (8443) vs HTTPS (8445) の混同

**対処法:**

```bash
# Obsidian Local REST API Plugin の設定を確認
# Settings → Community Plugins → Local REST API → Port

# 環境変数を合わせる
OBSIDIAN_API_URL=https://127.0.0.1:8445  # HTTPS の場合
```

### 6.3 Authorization Header/Key 設定

**エラー:**
```
Error: Unauthorized (401)
```

**原因:**
- API Key が間違っている
- Authorization Header が設定されていない

**対処法:**

```bash
# .env.local で確認
OBSIDIAN_API_KEY=<correct-key-from-plugin>

# curl でテスト
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:8443/vault/
```

### 6.4 MCP サーバーが起動しない

**エラー:**
```
Error: MCP server failed to start
```

**対処法:**

```bash
# 1. MCP サーバーのバージョン確認
npx @modelcontextprotocol/server-obsidian --version

# 2. Claude Desktop のログ確認
tail -f ~/Library/Logs/Claude/mcp*.log

# 3. 手動起動でエラー確認
npx @modelcontextprotocol/server-obsidian /path/to/vault
```

### 6.5 ファイルが見つからない

**エラー:**
```
Error: File not found: path/to/note.md
```

**原因:**
- パスが vault ルートからの相対パスになっていない
- ファイル名の大文字小文字が違う

**対処法:**

```bash
# 正しいパスを確認
obsidian_list_files_in_vault  # ルート一覧
obsidian_list_files_in_dir("path/to")  # ディレクトリ指定

# パスは常に vault ルートからの相対パス
# OK: "projects/mcp-integration.md"
# NG: "/Users/you/vault/projects/mcp-integration.md"
```

---

## 7. 次のステップ

### 7.1 最初に試すべき順序

1. **読み取り系（壊れにくい）**
   - `obsidian_list_files_in_vault`
   - `obsidian_get_file_contents`
   - `obsidian_simple_search`

2. **検索・集約系**
   - `obsidian_get_recent_changes`
   - `obsidian_batch_get_file_contents`
   - `obsidian_complex_search`

3. **ピンポイント編集系**
   - `obsidian_append_content`（追記のみ）
   - `obsidian_patch_content`（セクション単位）

4. **削除系（慎重に）**
   - `test/` ディレクトリで十分テスト
   - 本番データは Git バックアップ後

### 7.2 カスタムワークフロー例

**プロジェクト管理:**
```
週次で、#project タグのノートから進捗を抽出して、
週次ノートに "## プロジェクト進捗" を自動生成
```

**学習記録:**
```
Daily Notes から #TIL (Today I Learned) を抽出して、
月次ノートに "## 今月学んだこと" を集約
```

**タスク管理:**
```
全ての未完了タスク（[ ]）を検索して、
優先度順にソートして Daily Note に集約
```

---

## 8. 関連ドキュメント

- [CLAUDE.md](/Volumes/Extreme%20Pro/dauberside.github.io-1/CLAUDE.md) - プロジェクト全体ガイド
- [docs/operations/kb-setup.md](./kb-setup.md) - Knowledge Base セットアップ
- [docs/requirements/kb.md](../requirements/kb.md) - KB 要件定義
- [src/lib/obsidian.ts](/Volumes/Extreme%20Pro/dauberside.github.io-1/src/lib/obsidian.ts) - REST API クライアント実装

---

**最終更新:** 2025-11-17
