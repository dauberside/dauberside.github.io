# ADR: ホットパス最適化（Direct Agent Path の導入）

- ID: ADR-0002
- 日付: 2025-10-29
- 状態: Accepted
- 決定者: プロダクト/エンジニアリング合意（記録者）
- 関連:
  - 要件: docs/requirements/hot-path-optimization.md
  - 運用: docs/operations/deploy-and-smoke.md（Direct Path スモーク追記）
  - 既存: docs/decisions/ADR-0001-context-capsule-and-adr-process.md

## 背景（Context）
- 既存のエージェント実行は n8n Webhook ベース（Workflow Path）。機能拡張や試行に強い一方、実行オーバーヘッドや可観測性の粒度に限界があり、対話 UX 上のレイテンシが課題となっていた。
- 実測では約 20s 程度まで遅延が伸びるケースがあり（履歴長、外部ツール、I/O に依存）、高速応答が望まれる場面でUXを阻害。
- 一方で n8n を完全に置換するにはワークフロー可視化/運用の利点を失うリスクがある。

## 決定（Decision）
- アプリ内で完結する「ダイレクト実行パス（Direct Agent Path）」を追加する。
  - 新規エンドポイント: `POST /api/agent/direct`
  - 添付プレビュー（テキスト系）とナレッジ検索（MCP HTTP）をアプリ内で直結し、LLM も直接呼び出す。
- 既存の n8n 経路（Workflow Path）は併存維持し、用途に応じて選択できる状態を保つ（ストラングラーパターン）。
- セキュリティ/契約（入力フィールド互換・ツールパラメータ形式）は共通ポリシーに準拠する。

## パス選択基準（Path Selection Criteria）
2つの実行パスが併存するため、用途に応じた選択基準を明文化する。

### Direct Path を選択すべきケース
以下の条件に該当する場合、Direct Path（`POST /api/agent/direct`）を優先：

1. **レイテンシが重要なインタラクション**
   - リアルタイムチャット、顧客対応、即座のフィードバックが求められる場面
   - ユーザー体験上、応答速度が5秒以内を目指す必要がある場合

2. **アプリ内で完結する処理**
   - KB検索 + テキスト添付プレビュー + LLM呼び出しのみで完結
   - 外部API呼び出しが少なく、複雑な分岐・条件判定が不要
   - 単純な問い合わせ・情報取得が主目的

3. **高い可観測性が必要**
   - 詳細なログ・メトリクス（KB ヒット率、プレビュー採用率、レイテンシ分解）を取得したい
   - 障害時の原因特定を迅速に行う必要がある

### Workflow Path を維持すべきケース
以下の条件に該当する場合、Workflow Path（n8n経由）を継続使用：

1. **多段ワークフローが必要**
   - 明確な分岐、条件判定、複数アクションの連鎖（例：承認フロー、通知 + DB更新）
   - ビジネスロジックが複雑で、GUIでの可視化・編集が運用上有利

2. **n8n のエコシステムを活用**
   - n8n の豊富なノード（Slack, Google Sheets, Webhook等）を組み合わせたい
   - 非エンジニアがワークフローをメンテナンスする必要がある

3. **実験的パイプライン**
   - 新しい外部システム連携の試行錯誤
   - プロトタイピング段階で、コード化前にロジックを検証したい

### 判断が難しい場合
- **デフォルト**: レイテンシが許容できる場合は Direct Path を優先（シンプルで可観測性が高い）
- **段階的移行**: Workflow Path で安定稼働しているものを無理に移行しない（ストラングラーパターンの原則）
- **A/Bテスト**: 同一機能で両パスを並行稼働させ、メトリクスで評価

## 根拠（Rationale）
- レイテンシ: 中間ホップ（n8n 実行/シリアライズ/VM2/式評価など）をバイパスすることで、コールド時でも応答の下限を引き下げやすい。
- 制御性: 入力正規化、添付抽出、KB 連携、エラーハンドリングを単一コードパスで統制できるため、障害解析と漸進的最適化が容易。
- 互換性: 既存 UI/契約は維持。n8n は実験・GUI編集用途として継続。直書きとワークフローの利点を併存。
- 実装コスト: 既存 `src/lib/ai.ts` と `services/mcp` を活用し、最小の依存追加で立ち上げ可能。

## 代替案（Alternatives）
1) n8n 側の最適化を継続（ワークフロー分割、式簡素化、メモリ短縮）
   - 改善余地はあるが、根本となるオーケストレーターのオーバーヘッドと可観測性の粗さは残る。
2) 別フレームワーク（LangGraph/Temporal 等）で再構築
   - 学習/運用コスト・移行コストが高い。まずは最小インパクトの直結パスで効果検証する方針に合致しない。
3) キャッシュ先行（過去応答/KB 結果）
   - 効くケースは限定的。キャッシュ不適合時や初回問い合わせの遅延は依然残る。

## 影響（Consequences）
- メリット
  - 応答遅延の下限改善、失敗時の原因切り分けが容易、要件拡張（ストリーミング/OCR 等）の見通し向上。
- リスク
  - 経路が増えることで運用複雑度が上がる（検証パターン増）。
  - サーバ内での添付処理・外部呼び出しが増え、DoS/リソース消費の考慮が必要。
- 運用
  - デプロイ後スモークに Direct Path を追加（JSON/multipart/KB有効）。
  - メトリクス（p50/p95、KB ヒット率、OpenAI 失敗率、previews 採用率）を観測。

## 実装ノート（Implementation Notes）

### 正本情報（Authoritative - ADR-0001準拠）

以下は ADR-0001「正本の境界」に該当する、変更時に PR レビューを要する情報：

**API 契約**:
- エンドポイント: `POST /api/agent/direct`
- リクエスト形式: JSON または multipart/form-data
- レスポンス形式: JSON（`{ response: string, rid?: string }`）
- 添付ファイル: 最大 20MB、テキスト系のみプレビュー生成

**エージェントの不変条件**:
- KB 検索: MCP HTTP 経由で `/kb/search` を呼び出し、結果をコンテキストに注入
- LLM 呼び出し: OpenAI API（`callCfChat`）を使用、サーバサイドキーのみ
- 実行フロー: 入力正規化 → 添付プレビュー → KB 検索 → LLM 呼び出し → レスポンス返却

**セキュリティポリシー**:
- （前述の「セキュリティ（Security Controls）」セクション参照）

### 実装詳細（Implementation Details - 変更しやすい）

以下は将来的に変更される可能性が高い実装固有の情報：

**主要ファイル**:
- `src/pages/api/agent/direct.ts`: Direct Path 本体
- `src/lib/ai.ts`: `callCfChat` により OpenAI Chat Completions をラップ
- `services/mcp/server.mjs`: KB 検索の HTTP エンドポイント提供

**インフラ構成**:
- MCP サーバー: PM2 または Docker Compose で運用
- KB インデックス: `kb/index/embeddings.json`（ビルド時生成）
- ポート: 本番 3030（PM2）、開発 3001 推奨（衝突回避）

- セキュリティ（Security Controls）

  **添付ファイルの安全性**
  - サイズ上限: 20MB（リクエストレベルで拒否）
  - MIME タイプ検証: Content-Type ヘッダーと Magic Number（ファイル先頭バイト）の二重チェック
    - MIME spoofing 対策として、宣言された Content-Type と実際のファイル形式が一致するか検証
    - 不一致の場合は処理を拒否しログに記録
  - テキスト判定: `text/*`, `application/json`, `application/xml` 等のみ抽出
  - バイナリファイル: プレビュー生成をスキップ（将来的にサンドボックス化して対応検討）

  **入力サニタイゼーション**
  - LLM への送信前にサニタイズを実施:
    - HTML タグ・スクリプトの除去（`<script>`, `<iframe>` 等）
    - 制御文字・不可視文字の削除（U+0000-U+001F, U+007F-U+009F）
    - 過度に長い入力の切り詰め（メッセージ本文: 50,000文字、添付プレビュー: 各10,000文字）
  - JSON 整形注入時のエスケープ処理（改行・引用符・バックスラッシュ）

  **認証・認可**
  - サーバサイドのキーのみ使用（`OPENAI_API_KEY` 等はクライアントに露出しない）
  - Direct Path は認証済みユーザーのみアクセス可能（middleware で制御）
  - IP allowlist（`ADMIN_IP_ALLOWLIST`）との統合準備（現状は未適用だが、将来的に有効化可能）

  **Rate Limiting（レート制限）**
  - 現状: アプリケーションレベルでの明示的な制限なし（インフラ依存）
  - 推奨: 以下の基準を将来的に実装
    - IP単位: 60リクエスト/分
    - ユーザー単位: 20リクエスト/分（認証後）
    - グローバル: 1000リクエスト/分（DoS対策）
  - 超過時: HTTP 429（Too Many Requests）+ Retry-After ヘッダー

  **エラー情報の露出制御**
  - 本番環境ではスタックトレース・内部エラー詳細をクライアントに返さない
  - ログには詳細を記録、レスポンスには汎用エラーメッセージ（"Internal Server Error"）のみ
  - OpenAI API エラーは分類してログ記録（rate limit, invalid request, model error 等）
- テスト/監視
  - スモーク: JSON/multipart/KB の 3 ケース。将来は負荷・パフォーマンス計測を自動化。

- 可観測性（Observability）の最小必須項目

  Direct Path は高速・薄いレイヤーのため、トラブルシューティングに必要なログ項目を明確化する。

  **必須ログ項目**:
  - `rid` (Request ID): 相関ID、全ログに必須（リクエスト追跡）
  - `path`: `direct` または `workflow`（実行パス識別）
  - `latency`: レスポンス時間（ミリ秒）
    - `latency.total`: リクエスト全体
    - `latency.llm`: OpenAI API 呼び出し時間
    - `latency.kb`: KB 検索時間
    - `latency.preview`: 添付プレビュー生成時間
  - `kb.hit`: KB 検索がヒットしたか（boolean）
  - `kb.topK`: KB 検索結果数
  - `preview.count`: 添付プレビュー数
  - `preview.skipped`: スキップされた添付数（バイナリ・サイズ超過等）
  - `openai.status`: OpenAI API ステータス（`success`, `rate_limit`, `invalid_request`, `model_error`, `timeout`）
  - `openai.model`: 使用モデル名
  - `error.type`: エラー分類（該当する場合）
  - `error.message`: エラーメッセージ（本番では詳細を隠蔽、ログのみ記録）

  **推奨メトリクス**（将来的にダッシュボード化）:
  - p50/p95/p99 レイテンシ（path別、LLM/KB/preview別）
  - KB ヒット率（ヒット数 / 総リクエスト数）
  - OpenAI 失敗率（エラー数 / 総リクエスト数、ステータス別）
  - 添付プレビュー採用率（preview.count > 0 / 総リクエスト数）
  - リクエスト数（path別、時間帯別）
- 既知事項
  - リポジトリ内の別コンポーネントで TypeScript 構文エラーがあるため、typecheck 全体は赤の可能性（Direct Path 自体はビルド可）。

## ロールバック戦略（Rollback Strategy）
- 即時: ルーティング/クライアントから Direct Path の呼び出しを止め、既存 `/api/agent/chat`（Workflow Path）へ戻す。
- 低リスク撤去: `src/pages/api/agent/direct.ts` を無効化/削除し、ドキュメントの Direct Path 記載を Deprecated に更新。
- 部分切替: フラグ/環境変数で Direct Path の利用をトグル（将来導入）。障害時に自動フェイルオーバー方針も検討余地。

## フォローアップ（Follow-ups）
- ストリーミング応答対応（SSE/Chunked）: 体感速度の更なる改善。
- 非テキスト添付（PDF/OCR/表計算）プレビューの安全な導入とサンドボックス検討。
- 観測性強化: p50/p95、OpenAI 失敗率、KB ヒット率の定常可視化（ダッシュボード）。
- フラグ運用: Direct Path 利用トグルと段階的ロールアウト。
