# llms-input.json Schema Design

**Version**: 1.0
**Created**: 2025-11-27
**Purpose**: Cortex OS の「今の頭の構造」を LLM が一発で把握できる中間表現

---

## ゴール

Knowledge Graph の Cluster 情報（説明・目的・出力物・代表概念・代表ノート）と、
現在のコンテキスト（最近の更新・TODO）を統合し、
llms.txt 生成パイプラインの入力として使える決定的なデータ構造を提供する。

---

## 3レイヤー構造

### Layer 1: Meta (プロジェクト情報)
- project, version, clusters, totalConcepts
- Knowledge Graph の全体メタデータ

### Layer 2: Cluster Summaries
- clusters: [{id, name, size, description, purpose, outputs, coreConcepts, representativeNotes}]
- clusters-v1.md からの Annotation 情報を含む

### Layer 3: Global Highlights
- recentHighImpactNotes: 重要度の高いノート
- recentlyUpdatedNotes: 最近更新されたノート
- todoContext: 今日のタスクコンテキスト

---

## スキーマ定義

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-27T...",
  "project": "Cortex OS",
  "knowledgeGraph": {
    "totalConcepts": 184,
    "totalClusters": 5,
    "method": "connected-components",
    "similarityThreshold": 0.7
  },
  "clusters": [
    {
      "id": "cluster-0",
      "name": "Cluster 1: .mcp.json",
      "shortName": "MCP",
      "size": 136,
      "frequencySum": 488,

      "description": "このクラスターは主に MCP の実装・設計・接続周り。今の自分の専門性のコア領域。仕様・実装ログ・試行錯誤が集約されている。",
      "purpose": "技術システムの中核を構成する層。MCP アーキテクチャの理解と実装を深める。",
      "outputs": [
        "MCP 設定ファイル",
        "統合コード",
        "技術ドキュメント",
        "トラブルシューティングガイド"
      ],

      "coreConcepts": [
        { "label": ".mcp.json", "frequency": 21 },
        { "label": "🔌 MCP stdio Bridge Setup Guide", "frequency": 14 },
        { "label": "🧩 関連ノート", "frequency": 13 },
        { "label": "Primitive", "frequency": 12 },
        { "label": "LLM", "frequency": 10 }
      ],

      "representativeNotes": [
        "docs/operations/mcp-troubleshooting.md",
        "📕 「第2章：MCPの仕組み」/🎲 Section 2-6 サンプリング（プリミティブ④）.md",
        "📕 「第2章：MCPの仕組み」/💬 Section 2-4 プロンプト（プリミティブ②）.md"
      ]
    }
    // cluster-1〜4 も同様
  ],

  "highlights": {
    "recentHighImpactNotes": [
      "cortex/weekly/2025-W48-summary.md",
      "docs/releases/v1.0.md"
    ],
    "recentlyUpdatedNotes": [
      "cortex/graph/clusters-v1.md",
      "TODO.md",
      "tomorrow.json"
    ],
    "todoContext": {
      "today": "2025-11-27",
      "topItems": [
        "clusters-v1.md Annotation（完了）",
        "Phase 2.5 設計（optional）",
        "llms-input.json スキーマ設計"
      ]
    }
  },
  "mcpLayer": {
    "enabled": true,
    "version": "v1.1",
    "completionDate": "2025-12-05",
    "servers": [
      {
        "name": "filesystem",
        "status": "active",
        "priority": "critical",
        "tools": ["read_file", "list_files"]
      },
      {
        "name": "terminal",
        "status": "active",
        "priority": "critical",
        "tools": ["run_task", "list_tasks"]
      },
      {
        "name": "text-editor",
        "status": "active",
        "priority": "critical",
        "tools": ["write_file", "append_to_file", "insert_at_line", "replace_lines", "search_replace"]
      },
      {
        "name": "search",
        "status": "active",
        "priority": "critical",
        "tools": ["search_concepts", "search_notes", "search_by_cluster", "list_clusters", "get_concept", "find_similar"]
      }
    ]
  }
}
```

---

## フィールド詳細

### clusters[].coreConcepts
- **抽出元**: clusters-v1.md の "Core Concepts" セクション
- **件数**: 上位 5〜10 件（頻度順）
- **構造**: `{ label: string, frequency: number }`

### clusters[].representativeNotes
- **抽出元**: clusters-v1.md の "Representative Notes" セクション
- **形式**: Obsidian パス（`[[...]]` の中身のみ）
- **件数**: 3〜5 件

### clusters[].description / purpose / outputs
- **抽出元**: clusters-v1.md の Phase 2 - Annotation で追加した説明文
- **形式**:
  - description: 2〜3行の説明文（そのまま）
  - purpose: 1行の目的（"**目的**: " の後の部分）
  - outputs: 出力物の配列（"**出力物**: " の後をカンマ区切りで分割）

### highlights.recentHighImpactNotes
- **定義**: 週次サマリー、リリースノート、ADR など
- **抽出**: Cluster 5 (Highlights) の Representative Notes + 手動キュレーション

### highlights.recentlyUpdatedNotes
- **定義**: 最近 7 日以内に更新されたノート
- **抽出**: Obsidian の `app.vault.getMarkdownFiles()` から mtime でソート
- **件数**: 上位 5〜10 件

### highlights.todoContext
- **抽出元**: TODO.md と tomorrow.json
- **構造**:
  - today: 今日の日付
  - topItems: 今日〜明日のタスク候補（3〜5 件）

---

## 決定性の保証

同じ入力 → 同じ出力を保証するため：

1. **ソート規則**:
   - clusters: id 順（cluster-0, cluster-1, ...）
   - coreConcepts: frequency 降順、同値なら label アルファベット順
   - representativeNotes: clusters-v1.md の出現順（決定的）
   - recentlyUpdatedNotes: mtime 降順、同値ならパスのアルファベット順

2. **タイムスタンプ**:
   - generatedAt: ISO 8601 形式
   - highlights.todoContext.today: YYYY-MM-DD 形式

3. **文字列正規化**:
   - Obsidian パスは Unix パス形式（`/` 区切り）
   - 絵文字・特殊文字はそのまま保持

---

## 生成フロー

### Phase 1: Obsidian Codescript (`generateLlmsInput.cs.js`)

```javascript
// 1. clusters-v1.md を読む
// 2. Markdown パース:
//    - Cluster 名・ID・Size・Frequency
//    - 説明・目的・出力物（**説明**: / **目的**: / **出力物**: の後）
//    - Core Concepts（上位 N 個、頻度付き）
//    - Representative Notes（[[...]] リンク抽出）
// 3. TODO.md / tomorrow.json から今日の文脈を抽出
// 4. 最近更新されたノート（mtime 降順）
// 5. 決定的にソート
// 6. cortex/tmp/llms-input.json に書き出し
```

### Phase 2: Node 処理 (`cortex/scripts/llms/`)

#### `extract.mjs` (オプション)
- llms-input.json を読んで、追加情報を抽出
- KB index から補足情報を取得

#### `canonicalize.mjs`
- ソート・正規化・重複排除
- 決定的な中間表現に整形

#### `summarize.mjs` (オプション)
- LLM による Cluster 説明の要約
- 環境変数で有効/無効切り替え

#### `generate.mjs`
- llms-input.json → docs/llms.txt 整形
- /init コマンドで読み込まれる最終形式

---

## 使用例（/init コマンド）

```markdown
# /init で読み込まれる llms.txt の構造イメージ

# Cortex OS - Knowledge Map

## Project Overview
- Total Concepts: 184
- Clusters: 5 (MCP 73.9%, Reflection 11.4%, 現状 7.1%, Follow-ups 4.3%, Highlights 3.3%)

## Cluster 1: MCP (136 concepts)
**Purpose**: 技術システムの中核を構成する層
**Outputs**: MCP設定、統合コード、技術ドキュメント
**Key Concepts**: .mcp.json, MCP stdio Bridge, Primitive, LLM, Agent
**Representative Notes**:
- docs/operations/mcp-troubleshooting.md
- 📕 「第2章：MCPの仕組み」/...

## Cluster 2: Reflection (21 concepts)
...

## Recent Context
**Updated Today**: clusters-v1.md, TODO.md
**Active Tasks**:
- Phase 2.5 設計（optional）
- llms-input.json スキーマ設計
```

---

## 実装ステップ

### Step 1: スキーマ確定（今日）
- [x] このドキュメント作成
- [ ] レビュー・調整

### Step 2: Codescript 実装（次回）
- [ ] `generateLlmsInput.cs.js` 骨組み作成
- [ ] clusters-v1.md パーサー実装
- [ ] TODO/tomorrow.json 抽出
- [ ] 決定的ソート実装

### Step 3: Node パイプライン（次々回）
- [ ] `extract.mjs` 実装（必要なら）
- [ ] `canonicalize.mjs` 実装
- [ ] `summarize.mjs` 実装（オプション）
- [ ] `generate.mjs` 実装

### Step 4: /init 統合
- [ ] docs/llms.txt 生成
- [ ] .claude/commands/init.md 更新
- [ ] 決定性検証（2回実行して diff なし）

---

## 参考ドキュメント

- `cortex/graph/clusters-v1.md`: Phase 2 で作成した Knowledge Map
- `TODO.md`: Phase 3 実装タスク
- `docs/requirements/kb.md`: KB 要件
- `CLAUDE.md`: llms.txt パターン実装セクション
