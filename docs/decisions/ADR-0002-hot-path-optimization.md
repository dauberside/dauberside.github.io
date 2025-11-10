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
- 主要ファイル
  - `src/pages/api/agent/direct.ts`: Direct Path 本体（JSON+multipart、テキスト添付プレビュー、KB 検索、LLM 呼び出し）。
  - `src/lib/ai.ts`: `callCfChat` により OpenAI Chat Completions をラップ。
  - `services/mcp/server.mjs`: KB 検索の HTTP エンドポイント（`/kb/search`）を提供（ローカル/PM2/Docker で運用）。
- セキュリティ
  - 添付は 20MB 上限、テキスト判定のみ抽出、JSON 整形注入。サーバサイドのキーのみ使用。
- テスト/監視
  - スモーク: JSON/multipart/KB の 3 ケース。将来は負荷・パフォーマンス計測を自動化。
  - ログ: 相関ID（rid）を Direct Path 内で引き回し（将来拡張）。
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
