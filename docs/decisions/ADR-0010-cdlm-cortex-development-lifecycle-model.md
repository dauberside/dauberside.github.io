# ADR-0010: CDLM (Cortex Development Lifecycle Model) 採用

**Status**: Accepted  
**Date**: 2025-12-08  
**Owner**: Cortex OS Development Team  
**Version**: 1.0.0  

---

## Context

Cortex OS の開発は、v1.4 に至るまで以下のような特徴的なスタイルで進められてきた:

- Daily Digest / JDL（Journal-Driven Loop）による日次の意図宣言と振り返り  
- 実装前に詳細な Spec を書ききる **Spec-First Design**  
- TDD を軸にした **RED → GREEN → REFACTOR** の開発リズム  
- 本番データ（digest / task-entry / tomorrow.json）を使った **Real-Data Validation**  
- 振り返りを構造化データとして残し、KB に統合する **Reflection Integration**  
- /log, /note, detect-incomplete-tasks.py, sync-digest-tasks.py などによる **自己拡張的な自動化レイヤー**

これらは当初「個人的な開発習慣」として始まったが、  
v1.4 の開発過程で以下のような性質が明らかになった:

- 開発速度・品質・学習効率のいずれも高水準で安定している  
- Spec / Tests / Implementation / Digest / KB が一貫した形で連携している  
- このスタイル自体が再現可能な「開発モデル」として抽象化できる  

そこで、この開発スタイルを **CDLM (Cortex Development Lifecycle Model)** と名付け、  
単なる個人の習慣ではなく、**公式な開発ライフサイクルモデル**として採用する。

---

## Decision

- Cortex OS の開発手法として **CDLM (Cortex Development Lifecycle Model)** を正式採用する。
- CDLM の定義ドキュメントを `docs/cortex/cdlm.md` として管理し、バージョン付けする。
- 今後のフェーズ設計・タスク設計・自動化設計は、原則として CDLM の各フェーズにマッピングする。
- 新規プロジェクト／大きな機能追加については、可能な限り CDLM に沿って進めることを推奨する。

---

## CDLM Overview

CDLM は、以下 6 フェーズから構成される循環モデルである:

1. **Phase 0 — JDL (Journal-Driven Loop)**  
   - Daily Digest による意図・成果・学びの記録  
   - `/log` `/note` を通じたタスク・知見の即時記録  
   - `tomorrow.json` などによる「明日への連続性」の確保  

2. **Phase 1 — Spec-First Design**  
   - 実装前に仕様（Purpose / Non-Goals / Data Model / Errors / Tests）を固める  
   - レビュー・フィードバックを Spec に反映し、認知負荷と手戻りを削減  

3. **Phase 2 — TDD (Red → Green → Refactor)**  
   - 先にテスト（あるいはテストスケルトン）を書く  
   - 必要最低限の実装で GREEN に到達し、その後リファクタリング  

4. **Phase 3 — Implementation + Real-Data Validation**  
   - Spec に従って実装し、テストをすべて GREEN にする  
   - digest / task-entry / tomorrow.json など、実データで挙動を検証  

5. **Phase 4 — Reflection Integration**  
   - 振り返り（Reflection）を Daily Digest に明示的に残す  
   - completion_rate などの構造化メトリクスを metadata に保存し、  
     Weekly / Long-term Intelligence の入力とする  

6. **Phase 5 — Automation Layer**  
   - `/log` `/note` や sync-digest-tasks.py, detect-incomplete-tasks.py, wrap-up.py 等で  
     開発環境自体を自動化・自己拡張していく  

CDLM は次の一文で要約される:

> 「自己を観測し、仕様化し、検証し、自動化し、未来の自分を拡張するための開発モデル」

---

## Rationale

このタイミングで CDLM を正式採用する理由:

1. **再現可能性の確保**  
   - v1.4 における高い生産性と品質は、CDLM 的な進め方の結果であり、  
     これを文書化・モデル化することで、将来の自分や他者が再現可能になる。

2. **設計・実装・ナレッジの一貫性**  
   - Spec / Test / Implementation / Digest / KB がバラバラに増えるのではなく、  
     CDLM という一本の軸に沿って増えていくことで、長期保守性・拡張性が高まる。

3. **メタレベル設計の重要性**  
   - Cortex OS は「自分の作業そのものを OS 化する」プロジェクトであり、  
     開発プロセス自体も OS の一部として設計することに意味がある。

4. **既存手法との親和性**  
   - ウォーターフォールの体系性、アジャイルの反復性、DevOps の継続性、TDD の厳密さといった、  
     既存のベストプラクティスを包含しつつ、自分のワークスタイルに最適化されている。

---

## Consequences

### Positive

- 以降の v1.x / v2.x の開発において、  
  「どう進めるか」を毎回ゼロから決める必要がなくなる。
- Spec → Tests → Implementation → Reflection → Automation の流れが標準化され、  
  認知負荷が減少する。
- ADR / Spec / Digest / KB が CDLM を軸に統一され、  
  将来の自分が「なぜこのように作ったか」を理解しやすくなる。
- 新しい自動化（Phase 5）の追加が、既存フェーズと自然に接続できる。

### Negative / Trade-offs

- CDLM に合わせるために、プロトタイピングや即興的な試行が抑制される場面があるかもしれない。
- ドキュメント（Spec / Digest / ADR）が増えるため、  
  初期コストは「何も決めずにコードを書く」より高くなる。
- チーム開発に拡張する場合、他メンバーに CDLM を学習してもらう必要がある。

---

## Alternatives Considered

1. **既存のアジャイル / スクラムをそのまま採用する**
   - Pros: ドキュメント・書籍・ツールが豊富  
   - Cons: Cortex OS の日次 / 個人開発スタイルとはフィットしない部分が多い

2. **ウォーターフォール + V モデルの採用**
   - Pros: フェーズの明確さ、検証の体系性  
   - Cons: 日々の JDL / Reflection / Automation のような短いループとの相性が悪い

3. **明示的な開発モデルを採用せず、これまで通り暗黙のやり方で続ける**
   - Pros: 初期コストは低い  
   - Cons: 再現性がなく、将来の自分や他者に伝えられない

CDLM は、これらの代替案の「良いところ」を取り込みつつ、  
Cortex OS 向けに特化したモデルであるため採用した。

---

## Implementation Notes

- `docs/cortex/cdlm.md` を CDLM のソース・オブ・トゥルースとする。  
- 大きな設計変更を行う場合は、CDLM のどのフェーズに属するのかを意識して作業ログを残す。  
- 新しい自動化スクリプトやコマンド（例: `/wrap-up`, `weekly-intelligence`）は、  
  どの Phase を強化するものかを明確にしたうえで設計する。  
- 必要に応じて、CDLM 自体のバージョンアップ（v1.1, v2.0 など）を行い、  
  変更内容は別 ADR で管理する。

---

## References

- `docs/cortex/cdlm.md`  
- `docs/cortex/v1.4-incomplete-task-detection.md`  
- `docs/cortex/v1.4-wrap-up-integration.md`  
- `cortex/daily/YYYY-MM-DD-digest.md`（特に 2025-12-08 の開発ログ）
