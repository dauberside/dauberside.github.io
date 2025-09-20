# src/lib structure

目的: 既存のファイル配置を壊さずに、カテゴリ単位での参照経路を用意しました（バレル index.ts）。

- core: エラー型/メッセージ、型、ロガーなどの基盤
- scheduling: コンテキスト調整、スマート/マルチステージ・リマインダー、通知、KV ユーティリティ
- integrations: Google Calendar, LINE, KV など外部連携
- preferences: ユーザープリファレンスのモデル/バリデーション/ストレージ/API
- sessions: ランタイムセッションと永続化
- nlp: NLP・意図抽出・インタプリタ
- features: 横断的な機能（操作履歴、エラーリカバリ、AI スケジュール UI など）

## 推奨インポート例

```ts
// カテゴリ単位の参照
import { scheduling, preferences } from "@/lib";

await scheduling.smartReminderEngine.scheduleSmartReminder(/* ... */);
const prefs = await preferences.api.getUserPreferences("user123");

// あるいはカテゴリのサブバレル
import { contextAwareScheduler } from "@/lib/scheduling";
import { api as preferencesAPI } from "@/lib/preferences";
```

既存の `@/lib/xxx` から直接 import も引き続き動作します。段階的に置き換え可能です。
