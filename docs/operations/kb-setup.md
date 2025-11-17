# ナレッジベース（SSD上）最小セットアップ

この手順で、このリポのSSD上に KB インデックスを作成・検索できます。大規模用途ではベクタDB(Qdrant/pgvector)移行を推奨しますが、まずはローカルJSONインデックスで開始します。

## パイプライン概要：KB 埋め込みフロー（ADR-0005 対応）

**Knowledge Base 構築の全体フロー：**

```mermaid
flowchart LR
    subgraph Source["ソース (Knowledge Sources)"]
      OB_VAULT[Obsidian Vaults<br/>/docs, /adr, /operations]
      GH_REPO[GitHub Repo<br/>Markdown / OpenAPI / ADR]
    end

    subgraph Pipeline["Embedding Pipeline"]
      WATCHER[ファイル監視 / CI<br/>(GitHub Actions / ローカルスクリプト)]
      PARSER[Markdown / YAML パーサ<br/>frontmatter → メタデータ抽出]
      CHUNKER[チャンク分割<br/>見出し・段落単位]
      EMBEDDER[Embedding 生成<br/>LLM / API]
      INDEXER[Index 反映<br/>Upsert / Delete]
    end

    subgraph Store["KB / Index"]
      VECDB[Vector Store / Index]
      META[メタデータストア<br/>パス / タグ / ADR ID / MCP Tool 名]
    end

    subgraph Consumer["利用側 (Consumers)"]
      MCP_CLIENT[MCP Client / LLM]
      SEARCH_UI[検索UI / CLI / 専用ツール]
    end

    OB_VAULT --> WATCHER
    GH_REPO --> WATCHER
    WATCHER --> PARSER --> CHUNKER --> EMBEDDER --> INDEXER
    INDEXER --> VECDB
    INDEXER --> META

    MCP_CLIENT -->|semantic + フィルタ検索| VECDB
    MCP_CLIENT -->|メタ情報参照| META
    SEARCH_UI -->|キーワード & フィルタ| VECDB
    VECDB --> MCP_CLIENT
    VECDB --> SEARCH_UI
```

**パイプラインステージ：**
1. **ソース監視** - ファイル変更検出（GitHub Actions / ローカルスクリプト）
2. **パーサー** - Markdown/YAML解析、frontmatter → メタデータ抽出
3. **チャンク分割** - 見出し・段落単位で分割（1200文字、200文字オーバーラップ）
4. **Embedding生成** - LLM/API（OpenAI `text-embedding-3-small` または Hash mode）
5. **Index反映** - Upsert/Delete操作

**埋め込みモード（ADR-0005）：**
- **OpenAI モード**（本番）: `text-embedding-3-small`、高精度セマンティック検索
- **Hash モード**（開発）: SHA256ベース決定的埋め込み、API不要、完全一致のみ

**Delta 検出：**
- SHA256ハッシュによるファイル内容変更検出
- 変更されたファイルのみ再埋め込み（増分ビルド）

> 詳細は [ADR-0005: KB埋め込みモード選択](../decisions/ADR-0005-kb-embedding-mode-selection.md) を参照。

## 1) 前提
- Node 20+ / pnpm
- OPENAI_API_KEY を `.env.local` に設定（埋め込み生成用）
- このリポが SSD 上（例: `/Volumes/Extreme Pro/dauberside.github.io-1`）にあること

```env
# .env.local
OPENAI_API_KEY=sk-...
# 任意: モデル/入出力パスを上書きしたい場合
# KB_EMBEDDING_MODEL=text-embedding-3-small
# KB_INDEX_PATH=/Volumes/Extreme Pro/dauberside.github.io-1/kb/index/embeddings.json
# KB_SOURCES=docs,spec
```

## 2) インデックス作成（SSDに保存）
- 既定では `docs/` 配下の `.md/.mdx` を走査し、
- 1200文字チャンク（200文字オーバーラップ）で分割 → OpenAI Embeddings でベクタ化 → `kb/index/embeddings.json` に保存します。
- `pnpm -s kb:build` はリポ直下の `.env.local` → `.env` の順で自動読込します（OPENAI_API_KEY/KB_SOURCES 等）。

```bash
pnpm -s kb:build
```

出力例:
```
Found 15 markdown files under: docs
Indexed: docs/requirements/chat.md (12 chunks)
...
Wrote index: kb/index/embeddings.json (chunks=234)
```

### 2.5) Obsidian ボールトをソースに追加したい場合
- `KB_SOURCES` に Obsidian ボールトの絶対パスをカンマ区切りで追加してください（スペースを含む場合は引用）。
- `.obsidian/` ディレクトリは自動で除外されます。添付（attachments/assets 等）は必要に応じて後述の無視パターン拡張で対応してください。

例（zsh/bash の .env.local 記述）:
```env
# 既定の docs,spec に加え、Obsidian Vault を取り込む
KB_SOURCES="docs,spec,/Users/you/Obsidian/My Vault"
```
注:
- `KB_SOURCES` は絶対パス/相対パスどちらも可。絶対パスが含まれる場合はそれが優先されます。
- ボールト直下の Markdown（.md/.mdx）が対象です。

### 2.6) Obsidian Canvas（.canvas）/ Base（.base）を取り込みたい場合（任意）
- フラグを有効化して再ビルドしてください。

```env
# .env.local 例: Canvas と Base を取り込む
KB_INCLUDE_CANVAS=1
KB_INCLUDE_BASE=1
```

- 抽出仕様（簡易・ベストエフォート）
	- .canvas: JSON の `nodes[].text` と `edges[].label` を収集してテキスト化（不足時は生JSONをfallback）
	- .base: JSON なら全文字列フィールドをフラット収集しテキスト化／非JSONはそのままテキストとして取り込み
- 注意: 構造は将来変更される可能性があります。より厳密な抽出が必要なら専用スキーマをご提示ください。

## 3) アプリからの検索（ユーティリティ）
`src/lib/kb/index.ts` にユーティリティを用意しています。

```ts
import { searchKB } from '@/lib/kb/index';

const hits = await searchKB('通知を抑止する方法', { topK: 5 });
// => [{ source, text, score }, ...]
```

- 環境変数 `KB_INDEX_PATH` を設定していない場合、既定の `kb/index/embeddings.json` を読み込みます。
- 検索時も OpenAI Embeddings を1回呼び出します（クエリエンコード）。

## 4) ヘルスチェック

アプリの健全性を確認するには `/api/healthz` エンドポイントを使用します。

### 基本的な使い方

```bash
# ローカル環境
curl http://localhost:3000/api/healthz

# 本番環境（Vercel Deployment Protection 有効時）
curl "https://your-app.vercel.app/api/healthz?x-vercel-protection-bypass=YOUR_SECRET"
```

### レスポンス例

**正常時（200 OK）**:
```json
{
  "ok": true,
  "uptime": 123.45,
  "now": "2025-11-17T12:00:00.000Z",
  "checks": {
    "kb": {
      "status": "healthy",
      "message": "KB index is present and valid",
      "details": {
        "path": "kb/index/embeddings.json",
        "size": 1234567
      }
    },
    "obsidian": {
      "status": "healthy",
      "message": "Obsidian REST responded successfully",
      "details": {
        "url": "http://localhost:8443/vault"
      }
    }
  }
}
```

**KB が見つからない場合（503 Service Unavailable）**:
```json
{
  "ok": false,
  "uptime": 123.45,
  "now": "2025-11-17T12:00:00.000Z",
  "checks": {
    "kb": {
      "status": "unavailable",
      "message": "KB index file not found",
      "details": {
        "path": "kb/index/embeddings.json",
        "size": 0
      }
    },
    "obsidian": {
      "status": "not_configured",
      "message": "OBSIDIAN_API_URL is not set"
    }
  }
}
```

### ステータス一覧

| Status | 意味 | 対応 |
|--------|------|------|
| `healthy` | 正常動作 | 問題なし |
| `degraded` | 部分的に劣化（ファイル空、JSON 不正等） | 要確認、影響は限定的 |
| `unavailable` | 利用不可 | 即対応必要 |
| `not_configured` | 未設定（Obsidian のみ） | 任意、RAG には影響なし |

### クリティカル判定ルール

- **KB が `unavailable`** → 503 を返す（RAG/検索が動作不可のため）
- **Obsidian が `unavailable`** → Obsidian が設定されている場合のみ 503
- **Obsidian が `not_configured`** → クリティカル扱いしない（RAG には不要）

---

## 5) 注意事項
- 無料/小規模想定のため、JSONインデックスはメモリに読み込みます。ファイルが巨大になると非現実的なので、1万チャンク程度を目安に。
- 大規模/高頻度になったら Qdrant/pgvector などのベクタDBへ移行し、インデクサ/検索APIを別プロセス化してください（VPN/Tunnel運用との相性〇）。
- Vercel の Serverless からはローカルSSDパスは見えません。Vercel運用時はインデックスをリポにコミットするか、外部ストレージ/DBを使います（推奨は後者）。
 - 既定の無視パターン: `.git/`, `.next/`, `cache/`, `node_modules/`, `kb/`, `.obsidian/`

## 6) よくある質問
- 「PDF も入れたい」: 追加の抽出ツールが必要です（例: `pdf-parse` や外部の前処理）。最初は Markdown から始めるのを推奨します。
- 「コストをほぼゼロに」: 埋め込みをローカル（e5/bge系 + sentence-transformers/Ollama）に切り替えればOK。別プロセス化が前提になります。
- 「UIへ統合」: `searchKB` の上位でヒット上位をプロンプトへ差し込む（RAG）か、引用パネルとして表示してください。

---
最小構成のため、必要に応じて PR で拡張（PDF/HTML抽出、非同期バッチ、ストレージ分離など）してください。