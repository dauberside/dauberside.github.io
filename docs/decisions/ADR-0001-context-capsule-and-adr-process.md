# ADR: Context Capsule と ADR 運用プロセスの採択

- ID: ADR-0001
- 日付: 2025-10-24
- 状態: Accepted
- 決定者: プロジェクトオーナー（dauberside）
- 関連: 
  - `docs/memory/context-capsule.md`
  - `docs/decisions/ADR-template.md`
  - （廃止）旧 `spec/memory/constitution.md`
  - `docs/requirements/chat.md`
  - `docs/requirements/openai-agents-sdk.md`

## 背景（Context）
- 会話ベースの開発では履歴が肥大化し、トークン上限や参照コストの観点から過去文脈の全持ち込みが非現実的になる。
- 決定事項がチャットログに散在すると、認証方針・API契約・運用原則の「ドリフト（逸脱）」や矛盾が発生しやすい。
- 当プロジェクトは個人運用前提でセキュアなエージェント実行を目指しており、方針の一貫性維持が重要。

## 決定（Decision）
1. 二層構造で意思決定を維持する。
  - 正本（Authoritative Source）: `docs/requirements/*` と ADR 群。（旧 `spec/memory/constitution.md` は廃止）
   - 携行用（Context Capsule）: `docs/memory/context-capsule.md` を常時コンテキストに同梱。
2. 運用プロセス：
   - 仕様/方針の変更は PR で正本（要件/憲法/ADR）を更新。
   - その要約を `docs/memory/context-capsule.md` に反映（目安 400–800 tokens）。
   - 新スレッド開始時はカプセルのみを冒頭に提示し、長い履歴は持ち込まない。

## 根拠（Rationale）
- トークン制約とコスト最適化：最小の携行情報で一貫性を保てる。
- ドリフト抑止：正本をレビュー可能なファイルに置き、履歴を Git で追跡。
- 拡張容易性：ADR により重大な設計判断を追記し、将来の差分を明確化。

## 代替案（Alternatives）
- 代替A: すべての決定事項をチャット履歴でのみ管理 → 検索性/再現性が低い、レビューフローに乗らない。
- 代替B: 正本のみで要約を持たない → 毎回のプロンプトコストが増大、上限にかかりやすい。
- 代替C: 外部ナレッジベースのみ（Notion/Wiki 等） → リポジトリと履歴の分断、CI からの参照が難化。

## 影響（Consequences）
- メリット：意思決定の追跡性・再現性向上、コンテキストの軽量化、一貫したセキュリティ/API方針の遵守。
- リスク/コスト：文書の二重管理による更新漏れリスク → プロセスとチェックリストで緩和。

## 実装ノート（Implementation Notes）
- 追加済みファイル：
  - `docs/memory/context-capsule.md`（会話携行用の要約）
  - `docs/decisions/ADR-template.md`（本 ADR を含む以降のテンプレ）
- カプセル構成：目的/不変条件/公開契約/セキュリティ/正本参照/既決/未決と次の3手/更新手順。
- 影響範囲：ドキュメント/運用のみ。アプリコードの挙動は不変。

## フォローアップ（Follow-ups）
- PR チェックリスト（テンプレ）に以下を追加（別PRで対応可）：
  - 要件/憲法/ADR 更新確認
  - `docs/memory/context-capsule.md` 更新確認
  - 新スレッド移行時にカプセルを提示
- 自動化（任意）：カプセルのトークン長検査、欠落リンク検出の CI を追加。
- 次期 ADR 候補：
  - ADR-0002 SSE ストリーミング実装方針（EventSource vs ReadableStream）
  - ADR-0003 マルチモーダル（ASR/vision）API の入出力契約とサイズ制限

---
この ADR により、以降は「正本 + カプセル」の二層で決定事項を維持し、会話スレッドは常に最新のカプセルから開始する。