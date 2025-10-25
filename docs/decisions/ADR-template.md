# ADR: <タイトル>

- ID: ADR-<番号（ゼロ埋め3〜4桁）>
- 日付: <YYYY-MM-DD>
- 状態: <Proposed|Accepted|Deprecated|Superseded>
- 決定者: <担当/レビュワー（任意）>
- 関連: <Issue/PR/Specへのリンク（任意）>

## 背景（Context）
- どの問題/制約/前提が意思決定を必要にしているか。
- 影響範囲（コード/運用/セキュリティ/コスト）。

## 決定（Decision）
- 採択するアプローチの要点（1〜3行）。
- 必要なガードレール（MUST/禁止/前提）。

## 根拠（Rationale）
- なぜそれが最適かの理由とトレードオフ。
- 証拠（PoC/ベンチ/業界慣行/リスク評価）。

## 代替案（Alternatives）
- 検討した他案と不採用理由。

## 影響（Consequences）
- 期待されるメリット/リスク。
- マイグレーション/運用手順の変更点。

## 実装ノート（Implementation Notes）
- 対応するコード領域/ファイル/モジュール。
- テスト/監視/ロールバック戦略。

## フォローアップ（Follow-ups）
- 後続タスク/判定ゲート/期限。

---
命名規則: `docs/decisions/ADR-<番号>-<短いスラッグ>.md`
- 例: `ADR-0001-context-capsule-and-adr-process.md`

ステータスの定義:
- Proposed: 提案中（レビュー待ち）
- Accepted: 採択済（正本・実装に反映）
- Deprecated: 旧方針（現行と不一致だが履歴として保持）
- Superseded: 他の ADR に置き換え済み（該当 ADR を参照）

運用フロー（推奨）:
1) PR で ADR を追加/更新 → 2) 正本（requirements/constitution）反映 → 3) `docs/memory/context-capsule.md` を更新 → 4) 新スレッド開始時にカプセルだけを携行。