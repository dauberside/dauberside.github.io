# Feature Spec: LINE-native scheduling (my-feature)

- ID: 003
- Owner: Dauber
- Date: 2025-09-12
- Links: [related issues/PRs]

## Problem Statement

チャット（LINE）上で予定を作りたいが、往復の調整や画面遷移が面倒。LINEネイティブな体験で、自然文かワンタップで素早く予約・確認・取消ができるようにする。Google
Calendar と整合し、重複や通知も自動で扱う。

## Stakeholders / Personas

- Group participant / DM user:
  グループ/1:1の参加者。自然文で登録、または候補から選びたい。
- Owner: 運営（重複防止・通知・誤爆防止が重要）。

## Goals / Non-Goals

- Goals:
  - LINE上での予約体験
    - 自然文 → AI解釈 →（確認 or 即時）登録
    - 「空き」リクエスト → 候補カルーセル → ワンタップ登録
  - Google Calendar連携（空き取得・作成/取消・リンク返信）
  - 通知: LINEの30分前リマインド＋GCalリマインダー（非終日のみ、既定30分）
  - CF Workers AI を優先利用、落ちた場合はフォールバックパーサで堅牢化
  - レート制限・グループ許可リスト（ALLOW_GROUP_IDS）・最小限ログ
- Non-Goals:
  - 複数カレンダーの自動最適化
  - 高度な会議室/出席者調整
  - 決済連携

## User Stories

- As a user, I can DM/group で「/ai 予約 明日15時から30分 打合せ
  @渋谷」と送ると、そのまま登録され、開始/終了とリンクが返る。
- As a user,
  「空き」系を送ると日付/時間帯に応じた候補カルーセルが返り、「この枠で予約」で確定できる。
- As an owner,
  予約はGCalと整合し、重複時間帯は弾かれる。取消するとKVと通知（LINEリマインド）も連動で消える。
- As a user, 「/cancel last」や「/cancel <id>」で直近/ID指定の取消ができる。

## Interaction Flows

1. 自動登録（/ai）

- 形式: `/ai <予約|登録|作成|book>[ :|：] <自然文>`
- 例: `/ai 予約 9/25 15:00-16:00 ミーティング 場所:新宿`
  `/ai 登録: 来週木曜 15-16 面談 @渋谷`
- 振る舞い: CF-AIで解釈 → 失敗時はフォールバックパーサ → 競合チェック → GCal作成
  → KV保存 → 30分前リマインダー（LINE/GCal）

2. 候補カルーセル

- トリガー: 「空き/空いて/予約/あいて」等を含む自然文
- 応答: 利用可能スロットをカルーセルで提示（「この枠で予約」postback）
- 登録: postback payload 経由でGCal作成 → 確認メッセージ返信

3. 確認→確定（確認モード）

- オプション:
  方針により、即時登録ではなく確認カードを返す構成に切替可能（グループのみ確認など）

4. 取消

- コマンド: `/cancel <id|last|タイトルの一部>` `/cancelid <eventId>`
- 効果: GCal削除、KV参照削除、LINEリマインダーも削除

## Commands / Grammar

- 自動登録トリガー: `/ai` の後に `予約|登録|作成|book`（半角/全角コロン許容）
  - 例: `/ai 予約 ...` `/ai 登録: ...` `/ai book ...`
- 自然文の解釈（フォールバックパーサ）
  - 日付: `M/D`、`今日/明日/明後日`、`今週/来週 + 曜日`（JST前提）
  - 時刻: `15:00`、`15時`、`午後3時`、`15時半`
  - 範囲: `15-16`、`15:00〜16:00`
  - 所要: `15:00から30分/1時間`
  - 場所: `@渋谷`、`＠新宿`、`場所:表参道`
  - 時刻なし: 終日、開始のみ: 30分デフォルト

## Functional Requirements

- LINE webhook
  - インテント: 予定確認 / 作成 / 取消 / スロット提案 / smalltalk
  - コマンド: `/ai`、`#cal`/`#cal?`（登録/パース確認）、`/cancel` 系
  - グループ制限: `ALLOW_GROUP_IDS` に含まれないIDは拒否
- Google Calendar 連携
  - 空き取得: 同日の `timeMin/Max` でイベント列挙
  - 競合検出: `aS < bE && bS < aE` で重なり有無を判定
  - 作成/削除: HTMLリンクを返信（成功時）
  - GCalリマインダー: 非終日は既定30分前（環境変数で調整可）
- 通知とKV
  - KV: eventRef 保存（取消・確認用）
  - LINEリマインダー: 開始30分前（近すぎる場合はスキップ）
  - dispatcher: `/api/reminders/tick` トークン保護、GitHub Actionsで5分毎起動
- API（内部）
  - `/api/slots` 空き枠生成（GCal反映）
  - `/api/book` バリデーション・競合検出・レート制限（1 IP/分）

## Non-Functional Requirements

- セキュリティ: 署名検証（LINE）、トークン保護（tick）
- レート制御: KV またはメモリで 1 IP/分（/api/book）
- 障害耐性: CF-AI失敗時はフォールバックパーサ
- ログ: 重要イベントのみ最小限（PII最小化）
- コード品質: ESLint/Prettier/TypeScript順守、CI通過

## Configuration

- Google: `GC_CLIENT_ID / GC_CLIENT_SECRET / GC_REFRESH_TOKEN`, `CALENDAR_ID`
- KV: `KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN`
- LINE: `CHANNEL_ACCESS_TOKEN / CHANNEL_SECRET / ALLOW_GROUP_IDS`
- AI: `CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CF_AI_MODEL`
- Business hours (optional warnings): `WORK_START_HOUR` (default 9),
  `WORK_END_HOUR` (default 17)
- Reminders (GCal):
  - `GC_REMINDER_USE_DEFAULT=1` でカレンダー既定を使用
  - 既定は `popup @ 30min`。`GC_REMINDER_MINUTES` と `GC_REMINDER_METHOD`
    で調整可

## Contract / Alignment

- **Review Owner**: [@owner1,
  @owner2]（この仕様に対してレビュー/承認を行う責任者）
- **Approval Status**: ✅ Draft / 🟡 Review / ✅ Approved
- **Last Reviewed**: 2025-09-12
- **Agreement Scope**:
  - 本仕様は、LINE上での予約体験およびGoogle
    Calendar連携の振る舞いに関する合意事項を定義する。
  - 実装・テスト・リリースにおいてこの仕様を準拠基準とする。
- **Change Management**:
  - 承認後の仕様変更は `Pull Request + コメントレビュー`
    を通じて合意を得ること。
  - 軽微な文言修正を除き、**レビューなしの変更はリリースに含めないこと**。

## Success Criteria

- 自然文の代表パターンで登録成功（例: 「明日15時から30分」「来週水曜
  15-16」「9/25 15時半〜16時」）
- 重複時間帯は拒否され、ユーザに明示（「その時間帯は重なっています」）
- 予約成功時に開始/終了とGCalリンクを返信
- リマインダー: LINEとGCal（非終日）で30分前に通知（設定により変更可）
- p95: webhook応答 < 600ms（AI待ち除く）、失敗率 < 1%

## Metrics / Telemetry

- 予約完了率、競合拒否率、AIフォールバック率、通知送達件数、キャンセル件数
- グループ/DM別の利用比率、/ai コマンドの成功率

## Risks & Mitigations

- 誤登録（AIミス）: 確認モード/営業時間ガード/グループのみ確認などのポリシー切替
- 外部依存停止（CF-AI/GCal/KV）: フォールバック、リトライ、最小限の案内返信
- タイムゾーン齟齬: JST固定の規則＋ISO整形（秒補完）、表示はJST短縮形式

## Out of Scope

- 参加者招待、ゲストメール送付、会議室自動アサイン

## Appendix

### チートシート（コマンド例）

- 自動登録: `/ai 予約 明日15時から30分 打合せ @渋谷`
- 自動登録（コロン）: `/ai 登録: 来週木曜 15-16 面談 ＠新宿`
- 候補提示: `来週 水曜 予約 空きある？`
- 取消: `/cancel last` `/cancel 9/25 ミーティング` `/cancelid abcd1234`

## Open Questions

- グループ/DMでの確認ポリシー（常時即登録 / グループのみ確認 / 常時確認）
- 営業時間外の扱い（注意表示のみ or 登録禁止）
- LINEとGCalリマインダーの重複をどうするか（どちらかを無効化する設定を提供するか）

---

## Addendum: Simplification & UX De‑complexification (2025-09-25)

このアドエンダムは実装途中で増えたフォールバック／分岐（日時ピッカー多層フロー等）がユーザー体験を複雑化し始めた状況を踏まえ、元のゴール「最少手順で予定登録」へ立ち返るための整理とガードレールを定義する。

### 背景 / 痛点
現状 webhook 実装には以下の多段経路が存在：
1. datetimepicker 通常フロー (`pick_datetime`)
2. params フォールバックフロー（params-first）
3. 手動プリセット (`pick_datetime_manual` now1h / tonight / tomorrow_am)
4. 日付→時間二段 (`pick_date` → `pick_date_time`)
5. 日付プリセット (today / tomorrow) → 時間候補 (`pick_day_preset`)
6. 直接自然文パーサ（テキスト）

結果として「どのボタンを押せば最短なのか」が利用者視点で不明瞭化。レスキューパスが“主経路化”するリスクがある。

### 目指すシンプルモデル（Target UX）
Primary Mental Model: 「自然文を送るか、1回タップで日時を選ぶ → すぐ件名→確認（もしくは即登録）」

### 簡素化方針
- 主経路は 2 本のみ：
  1) 自然文（自由入力 → パース → pending → 件名入力/確認）
  2) datetimepicker（成功すれば同上）
- Rescue は 1 つだけの“統合レスキューメニュー”に集約（旧: date-only/ day preset/ manual presets を統合）。
  - 提供項目（上限 4〜5）例:
    - 今から1時間
    - 今夜 (19:00-20:00)
    - 明日 午前 (10:00-11:00)
    - 日付→時間（date-only picker → 時間候補生成）
    - テキスト書式例（プレーンメッセージ挿入）
- today/tomorrow 個別プリセットボタンや細分化された複数ステップは削除・統合。
- `pick_day_preset` / `pick_date` / `pick_date_time` など細分化エンドポイントは段階的に廃止予定（後述マイグレーション）。
- datetimepicker 未着検知（awaiting marker）後のレスキュー提示は 1 回のみ。再度失敗時は自然文誘導に重点化。

### AI Fallback（将来の簡素化レイヤ）
- 自然文パース失敗時のみ AI（Gemini / CF Workers AI）へ JSON 抽出を 1 ショット試行。
- スキーマ最小:
  ```json
  {"status":"ok|no_event|error","summary":"...","start":"YYYY-MM-DD HH:MM","end":"YYYY-MM-DD HH:MM","tz":"Asia/Tokyo","pv":1}
  ```
- `ok` → 直接 pending 保存 → 件名入力プロンプト。
- `no_event` → ガイド（書式例 + datetimepicker 再提示）
- `error` → シンプルな失敗文言 + 書式例のみ。

### ガードレール / Must NOT
- レスキューメニューを主メニューよりも項目数多くしない（最大5）。
- 主経路に分岐説明文を過度に追加しない（初回メッセージは 2 行 + ヒント1 行以内）。
- 新フォールバックを追加する際は本 addendum を更新し “統合レスキュー” へ吸収する形に限定。

### メトリクス（追加 / 更新）
| 指標 | 目的 | 目標値 (初期) |
|------|------|--------------|
| dtpicker_success_rate = success/present | ピッカー信頼性 | >= 0.70 |
| rescue_invocation_rate = missing/present | 欠落頻度監視 | <= 0.25 |
| avg_steps_per_success (登録完了までのユーザー操作数) | UX 簡素性 | <= 2.5 |
| ai_fallback_usage_rate | AI 依存度監視 | <= 0.30 |
| multi_path_legacy_calls (旧エンドポイント利用数) | 移行進捗 | 0 (移行完了後) |

### レガシーエンドポイント整理計画
| 現行 | 状態 | アクション |
|------|------|------------|
| pick_day_preset | Deprecated | 統合レスキューに吸収後削除 |
| pick_date / pick_date_time | Deprecated | date→time はレスキュー1項目化し内部専用関数化 |
| pick_datetime_manual (複数種) | Trim | 種類を now1h / tonight / tomorrow_am に限定（3→最大3） |

### 実装ステップ（今後 PR 方針）
1. Spec 追記（本ドキュメント） → 承認
2. フラグ `ENABLE_SIMPLIFIED_RESCUE` 導入（デフォルト off）
3. 統合レスキューメニュー実装（旧ボタン共存）+ 新メトリクス追加
4. 運用ログで success_rate / rescue_rate 観測（数日）
5. 古いハンドラ呼び出し頻度 < 5% で削除 PR
6. AI fallback (optional) スキーマ & テレメトリ追加

### リスク & Mitigation（追加）
| リスク | 内容 | Mitigation |
|--------|------|------------|
| レスキュー統合で一部利用者が慣れた細粒度操作を失う | 旧ボタン削除の反発 | 一時期は旧→新ガイド文返信を返す互換層を用意 |
| AI fallback が “過剰登録” を誘発 | ミス検知困難 | 初期は `status=ok` 時も必ず確認プロンプト経由 |
| メトリクス過少 (トラフィック低) | 意思決定遅延 | 観測期間を期間ではなく件数閾値で判定 (>= N=30 present) |

### 承認要件（この Addendum が有効になる条件）
- Reviewers (spec Contract の **Review Owner**) による “🟡 Review → ✅ Approved” ステータス遷移。
- 実装前に PR タイトル: `feat(003): simplified-rescue-phase1` で開始。

### Success 判定（追加）
- 2 週間以内に avg_steps_per_success 改善 (baseline 比 -20% 以上) または dtpicker_success_rate 説明可能な根拠付きで 0.70 以上維持。
- legacy エンドポイント呼び出し 0。

---
