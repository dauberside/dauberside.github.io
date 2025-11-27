# Knowledge Graph Implementation Plan

**Status**: Ready to Execute
**Target**: Cortex OS v2.0 Phase 2 & 2.5
**Date**: 2025-11-26

---

## 現状の KB 構造

### `kb/index/embeddings.json` (既存)

```json
{
  "model": "hash-256",
  "embed_mode": "hash",
  "embed_dim": 256,
  "files": 57,
  "chunks": 298,
  "items": [
    {
      "id": 0,
      "source": "docs/architecture/cortex-daily-automation-v1.0.md",
      "chunk_index": 0,
      "text": "...",
      "embedding": [256-dim vector]
    }
  ]
}
```

**特徴**:
- **Chunk-based**: ファイルを1200文字単位で分割
- **Hash embeddings**: `text-embedding-3-small` の代替（開発用）
- **Flat structure**: 概念抽出なし、単純なテキスト分割

---

## 新しい Concept-based 構造

### 1. `cortex/graph/concepts.json` (Codescript 出力)

**生成**: `exportConcepts.cs.js` (Obsidian)

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-26T...",
  "totalConcepts": 42,
  "concepts": [
    {
      "id": "concept-db-indexing-btree",
      "label": "B-Tree",
      "sourceNotes": ["note1.md", "note2.md"],
      "types": ["tag", "link", "heading"],
      "frequency": 5
    }
  ]
}
```

**目的**: Obsidian の豊富なメタデータから概念を抽出

---

### 2. `cortex/graph/concept-embeddings.json` (Node 出力)

**生成**: `build-embeddings.mjs` (Node)

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-26T...",
  "embeddingModel": "text-embedding-3-large",
  "dimension": 3072,
  "nodes": [
    {
      "id": "concept-db-indexing-btree",
      "label": "B-Tree",
      "sourceNotes": ["note1.md", "note2.md"],
      "types": ["tag", "link"],
      "frequency": 5,
      "embedding": [3072-dim vector]
    }
  ]
}
```

**目的**: 各概念に embedding を付与（OpenAI API または Hash）

---

### 3. `cortex/graph/concept-clusters.json` (Node 出力)

**生成**: `cluster.mjs` (Node - Connected Components)

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-26T...",
  "method": "connected-components",
  "threshold": 0.7,
  "numClusters": 12,
  "nodes": [
    {
      "id": "concept-db-indexing-btree",
      "clusterId": 3
    }
  ]
}
```

**目的**: 類似概念をクラスター化

---

### 4. `cortex/graph/communities.json` (Node 出力 - Phase 2.5)

**生成**: `community-detect.mjs` (Node - Louvain)

```json
{
  "version": "1.0",
  "generatedAt": "2025-11-26T...",
  "method": "louvain",
  "resolution": 1.0,
  "modularity": 0.42,
  "numCommunities": 8,
  "communities": [
    {
      "id": "community-001",
      "nodeIds": ["concept-1", "concept-2"],
      "size": 2,
      "coreConcepts": ["concept-1"],
      "label": "Database Indexing"
    }
  ]
}
```

**目的**: より細かいコミュニティ検出

---

### 5. `cortex/graph/clusters-v1.md` (Markdown 出力)

**生成**: `export-graph.mjs` (Node)

```markdown
# Knowledge Clusters v1

Generated: 2025-11-26
Concepts: 42 | Clusters: 12 | Communities: 8

---

## Cluster 1: Database Indexing

**Core Concepts**:
- B-Tree
- LSM-Tree
- Page Cache
- Disk IO

**Representative Notes**:
- [[db/indexing-overview]]
- [[btree-optimization]]

**Community**: community-001 (modularity: 0.85)

---

## Cluster 2: Personal Knowledge Management

**Core Concepts**:
- Second Brain
- PARA
- Cortex OS
- Zettelkasten

**Representative Notes**:
- [[cortex/design/architecture-v2]]
- [[pkm/para-vs-zettelkasten]]

**Community**: community-002 (modularity: 0.73)
```

**目的**: 人間が読める「脳の地図」

---

## 実装ステップ

### ✅ Phase 0: 準備完了
- [x] Codescript Toolkit インストール
- [x] `cortex/scripts/obsidian/` 作成
- [x] `exportConcepts.cs.js` 実装
- [x] `cortex/graph/types.ts` Concept-based 設計

### 🔄 Phase 1: 概念抽出（即座に実行可能）

**1.1. exportConcepts.cs.js 実行**
```
Obsidian Command Palette (Cmd+P)
→ "Codescript: Run exportConcepts"
```

**1.2. concepts.json チェック**
- [ ] Total concepts: 30〜150 が理想（最初は粗くてOK）
- [ ] 粒度チェック: 名詞/名詞句中心か
- [ ] sourceNotes が複数ノートにまたがっているか
- [ ] **決定性確認**: 2回実行して diff（generatedAt 以外同じか）

**1.3. Git commit**
```bash
git add cortex/graph/concepts.json
git commit -m "feat(cortex): add initial concepts extraction"
```

---

### 🚧 Phase 2: Embeddings 生成

**2.1. build-embeddings.mjs リファクタ**

**既存**: `kb/index/embeddings.json` (chunk-based)
**新規**: `cortex/graph/concept-embeddings.json` (concept-based)

**実装案**:
```javascript
// cortex/graph/build-embeddings.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "cortex");
const CONCEPTS_PATH = path.join(ROOT, "graph", "concepts.json");
const OUTPUT_PATH = path.join(ROOT, "graph", "concept-embeddings.json");

async function main() {
  const raw = JSON.parse(await fs.readFile(CONCEPTS_PATH, "utf8"));

  const nodes = [];
  for (const c of raw.concepts) {
    const text = buildConceptText(c); // 決定的テキスト表現
    const embedding = await embed(text); // 既存 embed 関数

    nodes.push({ ...c, embedding });
  }

  const out = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    embeddingModel: process.env.KB_EMBED_MODE === "openai"
      ? "text-embedding-3-large"
      : "hash-256",
    dimension: nodes[0]?.embedding?.length ?? 0,
    nodes
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log(`✅ ${nodes.length} concept embeddings → ${OUTPUT_PATH}`);
}

/**
 * 決定的なテキスト表現（重要！）
 */
function buildConceptText(concept) {
  return [
    concept.label,
    `Types: ${concept.types.join(", ")}`,
    `Frequency: ${concept.frequency}`,
    `Source notes: ${concept.sourceNotes.join(", ")}`
  ].join("\n");
}

main().catch(err => {
  console.error("❌ build-embeddings failed", err);
  process.exit(1);
});
```

**重要**:
- `buildConceptText()` を一箇所に集中（後で変更しやすい）
- nodes 配列の順序を concepts.json と同じに保つ
- 既存の `embed()` 関数を再利用

**2.2. 実行**
```bash
node cortex/graph/build-embeddings.mjs
```

**2.3. Git commit**
```bash
git add cortex/graph/concept-embeddings.json
git commit -m "feat(cortex): generate concept embeddings"
```

---

### 🚧 Phase 3: Clustering

**3.1. cluster.mjs 実装**

**入力**: `concept-embeddings.json`
**出力**: `concept-clusters.json`

**アルゴリズム**: Connected Components (類似度 ≥ 0.7 でエッジ)

**3.2. 実行**
```bash
node cortex/graph/cluster.mjs
```

---

### 🚧 Phase 2.5: Community Detection (Optional)

**4.1. community-detect.mjs 実装**

**ライブラリ**: Graphology + Louvain

**4.2. 実行**
```bash
node cortex/graph/community-detect.mjs
```

---

### 🚧 Phase 4: Export Graph

**5.1. export-graph.mjs 実装**

**出力**:
1. `graph-v1.json` (JSON: AI & アプリ用)
2. `clusters-v1.md` (Markdown: 人間用「脳の地図」)

**5.2. 実行**
```bash
node cortex/graph/export-graph.mjs
```

**5.3. Obsidian で確認**
- `clusters-v1.md` を開く
- 脳の地図を眺めてニヤニヤする 😊

---

## チェックポイント

### Phase 1 完了後
- [ ] concepts.json が生成された
- [ ] Total concepts が妥当な範囲（30〜150）
- [ ] 決定性確認（2回実行して同じ）
- [ ] Git commit 完了

### Phase 2 完了後
- [ ] concept-embeddings.json が生成された
- [ ] Embedding dimension が正しい（256 or 3072）
- [ ] nodes 配列の順序が concepts.json と同じ
- [ ] Git commit 完了

### Phase 3 完了後
- [ ] concept-clusters.json が生成された
- [ ] Cluster 数が妥当（10〜20程度）
- [ ] 各 cluster に複数 nodes がある

### Phase 4 完了後
- [ ] clusters-v1.md が生成された
- [ ] Obsidian で読める
- [ ] 「脳の地図」として意味がある

---

## トラブルシューティング

### exportConcepts.cs.js エラー
- Codescript Toolkit が有効化されているか確認
- `cortex/graph/` ディレクトリが存在するか確認
- Obsidian コンソール（Cmd+Option+I）でエラー確認

### build-embeddings.mjs エラー
- `concepts.json` が存在するか確認
- `KB_EMBED_MODE` 環境変数確認（`hash` または `openai`）
- OpenAI API key 設定確認（`openai` モード時）

### Concept 数が多すぎる/少なすぎる
- **多すぎる**: `exportConcepts.cs.js` のフィルタ強化
  - Frequency 閾値追加（≥2 のみ）
  - 除外パターン追加
- **少なすぎる**: 抽出対象拡大
  - H3 headings も含める
  - Inline tags も含める

---

## 次のステップ

1. **今すぐ**: exportConcepts.cs.js 実行 → concepts.json 確認
2. **次**: build-embeddings.mjs リファクタ
3. **その後**: cluster.mjs → export-graph.mjs

---

**Last Updated**: 2025-11-26
**Status**: Phase 1 Ready to Execute 🚀
