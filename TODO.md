# TODO - n8n Production Deployment

> Recipe 4 Phase 2 完了に向けた本番環境デプロイタスク
> 作成日: 2025-11-24

**重要**: Obsidian Local REST API は PORT 27124 で稼働中（HTTPS）

---

## Today — 2025-12-03

### High Priority
- [x] ⚡ Recipe 03 v1.2 Slack 通知統合完了 <!-- #urgent,#done -->
- [x] ⚡ /diagnose コマンド実装 & テスト完了 <!-- #urgent,#done -->

### Regular Tasks
- [ ] 1週間の安定稼働監視開始（2025-12-03 → 2025-12-10）
- [x] Cortex OS ヘルスチェック（初回スコア: 80% Good ⚠️）

### Completed (2025-12-03)
- [x] Recipe 03 に tomorrow.json 統合
- [x] タグベース時間見積もり実装（⚡1.5h, 🎯2h, 通常1h）
- [x] 20%バッファ計算ロジック実装
- [x] Slack メッセージフォーマット作成
- [x] Recipe 03 ドキュメント作成（Known Issues含む）
- [x] /diagnose コマンド修正（Obsidian API check, KB chunks count）
- [x] /diagnose 初回実行（ヘルススコア: 80%）
- [x] v1.2 Roadmap 更新（達成率: 36% → 45%）

### Completed (2025-11-28)
- [x] [Cortex] generateLlmsInput.cs.js 骨組み作成（Codescript 実装）
- [x] [Cortex] llms-input.json 生成テスト & 検証（Plan A → Plan A+ 完了）
- [x] [n8n] Recipe 02/03/10 ワークフロー n8n UI へ保存
- [x] [n8n] Recipe 10 v1.2 実装（タグベース絵文字 + マルチセクションフォールバック）
- [x] [Docs] Recipe 10 tags ドキュメント作成（1505+ lines）
- [x] [GitHub] Recipe 10 v1.2 デプロイ + Jekyll Liquid 構文エラー修正

---

## 📋 システム情報

- **Obsidian REST API**: https://127.0.0.1:27124/ (PORT 27124, HTTPS, 認証必須)
- **MCP 設定**: .mcp.json で host.docker.internal:27124 を指定
- **n8n ローカル**: PORT 5678
- **n8n 本番予定**: https://n8n.xn--rn8h03a.st/
- **Recipe 13**: PORT 27123/27124 使用

---

## 🚀 n8n Production Deployment

### Phase 1: n8n 本番環境構築
- [ ] デプロイ先選択
  - オプション: Railway / Render / Fly.io / VPS
  - 推奨: Railway（最もシンプル、無料枠あり）
- [ ] n8n を起動（最小構成）
  - Docker / Docker Compose 使用
  - 環境変数設定:
    ```bash
    N8N_HOST=n8n.xn--rn8h03a.st
    N8N_PROTOCOL=https
    N8N_SECURE_COOKIE=true
    WEBHOOK_URL=https://n8n.xn--rn8h03a.st
    ```
- [ ] DNS 設定
  - Type: A / CNAME
  - Name: n8n
  - Value: <VPS IP> または <Platform ホスト>
  - 確認: `dig n8n.xn--rn8h03a.st`
- [ ] HTTPS 設定
  - Let's Encrypt / 自動（プラットフォーム依存）
  - 確認: `curl -I https://n8n.xn--rn8h03a.st`
- [ ] n8n UI アクセス確認
  - BASIC Auth 設定（Admin UI）
  - セキュリティ設定確認

### Phase 2: Recipe 4 Phase 2 移行
- [ ] GitHub webhook URL を本番環境に更新
  - URL: `https://n8n.xn--rn8h03a.st/webhook/github-adr-push`
  - Repository: dauberside/dauberside.github.io
  - Events: push
- [ ] `recipe-04-phase2-github-webhook.json` を本番 n8n にインポート
  - ワークフロー: services/n8n/workflows/recipe-04-phase2-github-webhook.json
- [ ] GitHub credentials 設定
  - HTTP Header Auth
  - Header: `Authorization`
  - Value: `Bearer <GITHUB_TOKEN>`
- [ ] テスト実行
  - ADR ファイルを push
  - Webhook 受信確認
  - Issue 自動作成確認

### Phase 3: 他の Recipe 移行（オプション）
- [ ] Recipe 1: Obsidian → Slack 通知
- [ ] Recipe 7: 週次ふりかえりノート生成
- [ ] その他の Webhook を集約

---

## 🔌 Cortex OS v1.1: MCP Integration Layer

**MCP 厳選セット（最小構成 4 つ）**:
1. **Filesystem MCP** (⭐⭐⭐⭐⭐) - 長期記憶アクセスの核
   - clusters-v1.md, TODO.md, llms.txt を直接読み込める
   - Cortex OS の I/O の基盤

2. **Terminal MCP** (⭐⭐⭐⭐⭐) - 自動再生成パイプライン
   - generate-llms-input.mjs, generate-llms-txt.mjs を自動実行
   - 「認知の更新」を自動化

3. **Text Editor MCP** (⭐⭐⭐⭐⭐) - Cortex OS が「編集」できる
   - TODO.md への追記、clusters-v1.md の更新
   - Reflection ノートの生成

4. **Search MCP** (⭐⭐⭐⭐) - 概念検索・クラスタ検索
   - 「どこに書いた？」が瞬時に分かる
   - v1.3 の自動タスク生成の基盤

**MCP Integration Layer の I/O 境界**:
- **入力層（Input Layer）**:
  - Filesystem MCP（ノート、Graph、llms.txt）
  - Search MCP（概念 → ノート検索）
- **変換層（Compute Layer）**:
  - Terminal MCP（パイプライン実行）
  - generate-llms-input.mjs
  - generate-llms-txt.mjs
  - build-embeddings / cluster / export
- **出力層（Output Layer）**:
  - Text Editor MCP（ノート更新、TODO 追加）
  - Filesystem MCP（出力ファイル書き込み）

**Upgrade Summary (v1.0 → v1.1)** ✅ **完成！**:
- ✅ Graph と llms.txt が OS に読める（Filesystem MCP）
- ✅ OS 自身が graph/llms.txt を再生成できる（Terminal MCP）
- ✅ OS がノートへ書き戻せる（Text Editor MCP）
- ✅ OS が自分の脳を検索できる（Search MCP）

**🎉 Cortex OS v1.1 完成日**: 2025-12-05

**実装順序（最適化済み）**:
1. **Filesystem MCP**（読む）— まず OS に「脳」を読ませる
   - clusters-v1.md, llms.txt, TODO.md を読めるようにする
   - /init の基盤ができる
   - 依存関係なし、いきなり手応えが出る

2. **Terminal MCP**（作る）— OS に「自分を再構築」させる
   - generate-llms-input.mjs, generate-llms-txt.mjs を OS が直接呼び出せる
   - build-embeddings / cluster / export も実行可能
   - **v1.1 の核心**: OS が自力で llms.txt と Knowledge Graph を再生成できる

3. **Text Editor MCP**（書く）— OS に「手を持たせる」
   - ノート修正、TODO 追加、clusters-v1.md の更新
   - OS が完全に「編集可能」になる

4. **Search MCP**（探す）— 最後でOK
   - Filesystem + Graph があれば検索ロジックは後付け可能
   - まずは「読む・作る・書く」の三位一体を揃える

**実装タスク**:
- [x] Filesystem MCP の start code（OpenAI MCP spec 準拠）✅ 2025-11-27 完了
  - `services/mcp/filesystem.mjs` 実装完了
  - `.mcp.json` 設定追加（priority: critical, autoStart: true）
  - 全8テスト通過（llms.txt, TODO.md, clusters-v1.md 読み込み検証済み）
  - セキュリティ境界実装（ALLOWED_PATHS による制限）
- [x] Terminal MCP のコマンド定義（generate-llms-input など）✅ 2025-11-27 完了
  - `services/mcp/terminal.mjs` 実装完了
  - `.mcp.json` 設定追加（priority: critical, autoStart: true）
  - 全6テスト通過（dry-run、quick-refresh 実行検証済み）
  - セキュリティ実装（ホワイトリストタスクのみ実行可能）
  - 5タスク定義: rebuild-knowledge-graph, regenerate-llms-input, regenerate-llms-txt, full-refresh, quick-refresh
  - **🎉 OS が自力で llms.txt と Knowledge Graph を再生成可能に！**
- [x] Text Editor MCP の安全書き戻しロジック ✅ 2025-12-05 完了
  - `services/mcp/text-editor.mjs` 実装完了
  - 全10テスト通過（write_file, append_to_file, insert_at_line, replace_lines, search_replace）
  - セキュリティ境界実装（ALLOWED_WRITE_PATHS: TODO.md, clusters-v1.md, cortex/daily, cortex/weekly, cortex/state）
  - アトミック書き込み（temp + rename）
  - 自動バックアップ機能（.backup ファイル生成）
  - **🎉 OS が TODO.md や clusters-v1.md を編集可能に！**
- [x] Search MCP の "Concept + Note" 両検索 API ✅ 2025-12-05 完了
  - `services/mcp/search.mjs` 実装完了
  - 全10テスト通過（search_concepts, search_notes, search_by_cluster, list_clusters, get_concept, find_similar）
  - 6つのツール: 概念検索、ノート検索、クラスタ検索、概念詳細、意味的類似検索
  - Knowledge Graph + KB index 統合
  - **🎉 OS が自分の脳を検索可能に！Cortex OS v1.1 完成！**
- [ ] llms-input-schema への MCP Layer 情報追加
  - MCP の状態（有効/無効、プライマリ/セカンダリ）を llms-input.json に含める
- [ ] .claude/commands/init.md に MCP ローディング手順追加（v1.1 対応版）
  - /init で MCP の状態も把握できるようにする
- [ ] MCP config テンプレート生成（primary/secondary 区分）
- [ ] Cortex OS v1.0 の MCP Layer 図式化（ASCII または Mermaid）

**Definition of Done (v1.1)**:
- [ ] /init 実行時に、llms.txt + TODO.md + MCP 状態が読めること
- [ ] MCP 4種（FS / Terminal / Edit / Search）が安定して動作
- [ ] generate-llms-input / llms.txt を Terminal から再生成可能
- [ ] ノート編集（Text Editor MCP）が安全に動作
- [ ] llms-input.json → llms.txt の差分が Git で追跡可能

**拡張セット（v1.2 以降）**:
- [ ] Web MCP (⭐⭐⭐) - Context7 連携の前段、外部知識・最新ドキュメント
- [ ] Browser Automation MCP (⭐⭐⭐) - 非 API サービスから情報取得
- [ ] Git MCP (⭐⭐) - バージョン管理を OS が自律化

---

## 🧠 Cortex OS v2.0 Phase 2 & llms.txt

### 🎯 Codescript Toolkit 統合（Cortex Automation Hub）

**アーキテクチャ原則**:
- **Obsidian（Codescript）**: 脳の活動（概念抽出、メタデータ処理）
- **Node/Git/MCP**: 脳の外周インフラ（重い計算、永続化、外部連携）

**実装順序**:
1. Knowledge Graph: 概念抽出（Codescript → concepts.json → Node パイプライン）
2. llms.txt: 前処理（Codescript: extract + canonicalize → Node: summarize + generate）
3. Cortex Automation Hub: 統合運用

**Phase 1: Codescript 基盤構築**
- [ ] `cortex/scripts/obsidian/` ディレクトリ作成
- [ ] `exportConcepts.cs.js` 実装（概念抽出）
  - Vault 全体を走査（または対象フォルダ指定）
  - tags, links, frontmatter, headings から Concept 候補抽出
  - `cortex/graph/concepts.json` 出力（決定的ソート）
  - Obsidian のリンクグラフ API 活用
- [ ] `generateLlmsTxt.cs.js` 実装（llms.txt 前処理）
  - 対象ノート選択（特定フォルダ, pinned, 最近更新）
  - メタ情報抽出 → 決定的中間表現
  - `cortex/tmp/llms-input.json` 出力
- [ ] `buildWeeklyDigest.cs.js` 実装（週次集約）
  - Daily Digest から週次サマリー生成
  - Obsidian 内で完結
- [ ] Codescript をコマンドパレットから実行可能に設定

**Phase 2: Node パイプライン統合**
- [ ] Node 側で `concepts.json` を読み込む処理追加
- [ ] Node 側で `llms-input.json` を読み込む処理追加
- [ ] 既存 KB パイプラインとの統合確認

---

### Knowledge Graph 実装（Phase 2 & 2.5）

**Phase 2: Core Graph Construction**
- [x] `cortex/graph/build-embeddings.mjs` 実装
  - 既存 KB index (298 chunks) から GraphNode 生成
  - **重要**: GraphNode は「Concept」として設計（Note ではない）
  - Concept 抽出: タイトル、タグ、キーワードから概念を特定
  - Note → Concept マッピング: `sourceNotes` フィールドで参照
  - embedding 再利用で効率化
- [x] `cortex/graph/cluster.mjs` 実装（Phase 2: 基本クラスタリング）
  - Connected Components アルゴリズム（初期実装）
  - 類似度閾値: 0.7
  - 最小クラスタサイズ: 2
- [x] `cortex/graph/export-graph.mjs` 実装
  - **JSON 出力**: `graph-v1.json` (AI & アプリ用)
    - nodes, edges, clusters
    - コミュニティID含む
  - **Markdown 出力**: `clusters-v1.md` (人間用 Knowledge Map)
    - クラスターごとに見出し
    - Core Concepts リスト
    - Representative Notes へのリンク
    - "脳の地図" として可読性重視

**Phase 2 - Annotation: 人間による地図ラベリング**
- [x] `clusters-v1.md` に各クラスターの説明コメントを追加（30-45分）（2025-11-27 完了）
  - **目的**: 機械生成の地図に人間のラベルを付ける
  - **作業内容**:
    - Cluster 2〜5 に説明文（2〜3行）を追加
    - 各クラスターの代表ノートへのリンクを数個追加
    - 自分の実感ベースで微修正・追記
    - **+α 視点（Phase 3 に活かす）**:
      - 各クラスターの「目的」を1行追加（例: 技術システムの中核 / 思考循環・習慣化 / 進捗監視）
      - 各クラスターの「出力物」を1行追加（例: コード・設計 / Insight / 外部向けアウトプット）
  - **Claude 提供**: 説明文ドラフト（下記参照）
  - **効果**: LLM が「脳のクラスタ構造」を俯瞰した上で個々のノートにアクセス可能に

<details>
<summary>📝 clusters-v1.md 用ドラフトテキスト（Cluster 2〜5）</summary>

**Cluster 2: Reflection** の Core Concepts の前に追加：
```markdown
**説明**:
このクラスターは、Daily / Weekly などのふりかえりパターンが中心の領域。
Reflection テンプレート、習慣化、振り返りフォーマットなど、
「自分の思考パターンのメタ構造」に関するノートが集まっている。
```

**Cluster 3: 0. 現状（v1.1）** の Core Concepts の前に追加：
```markdown
**説明**:
このクラスターは、現在の状態・バージョン履歴・進捗管理に関する概念のまとまり。
Cortex OS や関連プロジェクトの「どこまで進んでいるか」を俯瞰するためのメタ情報が集中している。
プロジェクトの現在地を把握するための領域。
```

**Cluster 4: フォローアップ（Follow-ups）** の Core Concepts の前に追加：
```markdown
**説明**:
このクラスターは、フォローアップすべきタスクや、やりっぱなしになっているトピックを拾い上げるための領域。
ADR（Architecture Decision Records）の標準セクション構造が中心で、
「決定の背景・根拠・影響・代替案」を追跡するためのメタデータが集約されている。
```

**Cluster 5: 🎉 Highlights** の Core Concepts の前に追加：
```markdown
**説明**:
このクラスターは、達成・ハイライト・マイルストーンが中心の領域。
週次サマリーやリリースノートなど、「うまくいったこと」「成果として残したいこと」を保存するための
ポジティブな記憶の集積所。振り返りの中でも特に「達成」に焦点を当てた領域。
```

</details>

**Phase 2.5: Community Detection（精度向上）** ✅ 2025-12-05 完了
- [x] MCP クラスタ向け Louvain community detection 実装
  - **ターゲット**: Cluster 0 (.mcp.json) のみ（136 concepts）
  - **結果**: 5つのサブコミュニティに分割
    - mcp-community-2 (50 concepts): ドキュメント・要件・セキュリティ
    - mcp-community-0 (35 concepts): MCP コア設定・プロトコル
    - mcp-community-1 (23 concepts): トランスポート・接続
    - mcp-community-3 (19 concepts): コンテキスト・統合
    - mcp-community-4 (9 concepts): Claude Code セットアップ
  - **I/O スキーマ**:
    - 入力: graph-v1.json (Cluster 0), concept-embeddings.json
    - 出力: `cortex/graph/mcp-communities.json`, `cortex/graph/mcp-clusters-v1.md`
  - **グラフメトリクス計算完了**:
    - Top Hubs: Server (54), Primitive (51), JSONRPC (51), Prompt (50), Template (50)
    - Betweenness & Closeness centrality も計算
- [x] Louvain 法の実装（Phase 2.5）
  - Graphology ライブラリ使用（graphology v0.26.0, graphology-communities-louvain v2.0.2）
  - 1518 エッジ生成（類似度 ≥ 0.7）
  - Connected Components より細かい概念群の自動検出に成功
- [x] `cortex/graph/community-detect.mjs` 実装
  - Louvain コミュニティ検出完了
  - MCP 専用の脳の地図生成（mcp-clusters-v1.md）
  - **🎉 MCP クラスタが意味のある5つのサブコミュニティに分割完了！**

**パイプライン実行 & 検証**
- [x] 初回 Knowledge Graph 生成（2025-11-27 完了）
  - `node cortex/graph/build-embeddings.mjs`
  - `node cortex/graph/cluster.mjs`
  - `node cortex/graph/export-graph.mjs`
- [x] Markdown 出力確認
  - Obsidian で `clusters-v1.md` 読む
  - "脳の地図" として可読性検証
  - **結果**: 184 concepts → 5 clusters（MCP 73.9%, Reflection 11.4%, 他）
- [ ] Phase 2.5 実行（コミュニティ検出 - Optional）
  - `node cortex/graph/community-detect.mjs`
  - クラスター精度向上を確認

### llms.txt パターン実装（決定性重視）

**重要原則**: llms.txt は **決定的（deterministic）** であるべき
- 同じ入力 → 同じ出力
- AI が学習し直すことを防ぐ
- "ルールベース整形" と "LLM 圧縮" を分離

**Phase 3: llms-input.json スキーマ設計**
- [x] llms-input.json のスキーマ設計（30分）（2025-11-27 完了）
  - **完了**: `cortex/graph/llms-input-schema.md` 作成
  - **目的**: Knowledge Graph の Cluster 情報を llms.txt 生成パイプラインに統合
  - **3レイヤー構造で設計**:
    - **Layer 1: Meta** (プロジェクト情報)
      - project, version, clusters, totalConcepts
    - **Layer 2: Cluster Summaries**
      - clusters: [{id, name, keyConcepts, representativeNotes, description, purpose, outputs}]
    - **Layer 3: Global Highlights**
      - last 5 high-impact notes
      - last 5 updated notes
      - today's TODO.md context
  - **含めるべき情報**:
    - Cluster 情報（ID, name, size, description, **purpose, outputs**）
    - Top concepts（各クラスタの代表概念）
    - Representative Notes（代表ノートへのパス）
    - 最近更新されたノート
    - TODO.md からのタスク状態
  - **設計方針**:
    - Obsidian Codescript から生成しやすい形
    - LLM に渡しやすい構造
    - 決定的（同じ入力 → 同じ出力）
  - **出力**: `cortex/tmp/llms-input.json` のスキーマドキュメント

**Phase 4: Codescript 実装（明日の最優先タスク）**
- [ ] `generateLlmsInput.cs.js` の中身埋め（30分）
  - **骨格コード準備済み**: `cortex/scripts/obsidian/generateLlmsInput.cs.js`
  - **明日やる3つのポイント**:
    1. `parseClustersMarkdown()` を実際の clusters-v1.md のフォーマットに合わせて微調整
       - 見出し名や「**説明**:」「**目的**:」「**出力物**:」の前後空白など
    2. `buildHighlights()` の中身を実装
       - Cluster 5: Highlights から Representative Notes を拾う
       - TODO.md から「今日のタスク」をパースする
    3. `buildMetaFromClusters()` の totalConcepts を graph-v1.json から取る（任意）
  - **実行確認**:
    - Obsidian コマンドパレットから `generateLlmsInput(app)` を実行
    - `cortex/tmp/llms-input.json` が生成されることを確認

**Phase 5: Node パイプライン実装（次々回）**
- [ ] `cortex/scripts/llms/extract.mjs` 実装
  - KB index からトピック抽出
  - ADR からアーキテクチャ決定抽出
  - Daily Digest からハイライト抽出
  - **Knowledge Graph から Cluster 情報抽出**（新規）
  - 構造化データとして出力
- [ ] `cortex/scripts/llms/canonicalize.mjs` 実装
  - ソート（アルファベット順、日付順）
  - 正規化（形式統一、重複排除）
  - 決定的な中間表現生成
- [ ] `cortex/scripts/llms/summarize.mjs` 実装（オプション）
  - LLM による要約依頼
  - 環境変数で有効/無効切り替え
  - ルールベースのみでも動作保証
- [ ] `cortex/scripts/llms/generate.mjs` 実装
  - 中間表現 → llms.txt 整形
  - フォーマット:
    - CORTEX OS アーキテクチャサマリー
    - 主要コンポーネント概要
    - 最新ハイライト（決定的にソート）
    - AI 最適化（トークン効率重視）

**Phase 2: 統合 & 検証**
- [ ] `docs/llms.txt` 初回生成
  - パイプライン実行: extract → canonicalize → summarize → generate
  - 手動確認で品質検証
  - 決定性確認（2回実行して diff なし）
- [ ] post-commit hook 統合
  - `.git/hooks/post-commit` に追加
  - 実行順序: `pnpm kb:build` → `llms/generate.mjs`
- [ ] `/init` コマンド優先読み込み更新
  - `.claude/commands/init.md` 修正
  - **読み込み順序（最適化）**:
    1. `docs/llms.txt` （必須、長期記憶）
    2. 直近変更されたノート 2〜3件（短期記憶）
    3. 現在開いているノート（作業コンテキスト）
    4. `TODO.md` （タスク状態）
- [ ] llms.txt 統合テスト
  - `/init` でセッション復元確認
  - トークン削減効果測定
  - 決定性検証（複数回実行）

**Context7 MCP 統合判断基準（将来）**
- 導入タイミング:
  - 自分の KB にない技術スタックの最新仕様を扱うとき
  - "外部ドキュメント参照率" が 20% を越えたとき
  - プロジェクトが「フレームワークに依存」し始めたとき
- 導入前提:
  - Cortex OS の内部知識体系が十分に固まってから

---

## 📚 参考ドキュメント

- **デプロイ手順**: [docs/operations/n8n-production-deployment.md](docs/operations/n8n-production-deployment.md)
- **Phase 2 実装状況**: [docs/decisions/ADR-0008-recipe-4-phase2-test.md](docs/decisions/ADR-0008-recipe-4-phase2-test.md)
- **ワークフロー設計**: [services/n8n/workflows/recipe-04-phase2-github-webhook.json](services/n8n/workflows/recipe-04-phase2-github-webhook.json)
- **Phase 2 戦略**: [docs/decisions/ADR-0006-phase-2-automation-strategy.md](docs/decisions/ADR-0006-phase-2-automation-strategy.md)

---

## ✅ 完了済み（2025-11-24）

- [x] Recipe 4 Phase 1: 手動トリガー方式（Production-ready）
  - Webhook endpoint: `/webhook/adr-to-issue`
  - ADR データ完全パース実装
  - GitHub Issue 自動生成（Issue #66 作成成功）
- [x] Recipe 4 Phase 2: ワークフロー設計完了
  - GitHub Push イベント自動検知
  - ADR ファイルフィルタリング
  - ファイル内容取得 + パース
  - ローカルテスト完了（Tailscale 制約により本番移行待ち）
- [x] n8n 本番デプロイ計画書作成
  - ドメイン構成: https://n8n.xn--rn8h03a.st/
  - デプロイオプション比較
  - セキュリティ考慮事項

---

**Next Step**: n8n を本番環境にデプロイして、Recipe 4 Phase 2 の自動検知機能を有効化 🚀
