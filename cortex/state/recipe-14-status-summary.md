# Recipe 14 Daily Digest Generator - 現状と課題サマリー

**作成日**: 2025-11-30
**目的**: GPT判断材料として現在の経緯を整理

---

## 📋 背景

### Cortex OS v1.2 "Autonomy" の自律神経系
- 毎日自動的にDaily Digestファイルを生成するシステムを構築
- n8n workflows (Recipe 03, 09, 10, 13) が生成されたDigestを読み取って各種処理を実行

### 実装したシステム
1. **テンプレート**: `cortex/templates/daily-digest-template.md`
2. **生成スクリプト**: `cortex/scripts/generate-daily-digest.mjs`
3. **n8n Recipe 14**: 毎朝07:00 JSTに自動実行
4. **Slack通知**: 生成成功/失敗を通知

---

## ✅ 完了した作業

### 1. Recipe 14の実装と動作確認
- ✅ ワークフローJSON作成完了
- ✅ n8nにインポート成功 (ID: bmWRMVSa6BXgP9Qq)
- ✅ 手動実行テスト成功 (Slack通知受信済み)
- ✅ Recipe 14を **Active** に設定完了

### 2. ファイル生成の動作確認
```bash
cortex/daily/2025-11-29-digest.md  (395B - Recipe 14手動テスト)
cortex/daily/2025-11-30-digest.md  (395B - 手動生成確認)
```

### 3. スクリプトの動作
```bash
$ pnpm cortex:digest:today

📝 Generating daily digest...
   ✓ High Priority: 0 tasks
   ✓ Regular: 0 tasks
   ✓ No Tags: 0 tasks

✅ Daily digest generated successfully!
```

---

## ⚠️ 発生している問題

### 現象
- Digestファイルは正常に生成される
- **しかしタスクが0件と表示される**
- 生成されたDigestの内容が空（「（タスクなし）」のみ）

### 原因分析

#### TODO.mdの現状
```markdown
## Today — 2025-11-28  ← 2日前の日付

- [x] [Cortex] generateLlmsInput.cs.js 骨組み作成（完了済み）
- [x] [Cortex] llms-input.json 生成テスト & 検証（完了済み）
- [x] [n8n] Recipe 02/03/10 ワークフロー n8n UI へ保存（完了済み）
- [x] [n8n] Recipe 10 v1.2 実装（完了済み）
- [x] [Docs] Recipe 10 tags ドキュメント作成（完了済み）
- [x] [GitHub] Recipe 10 v1.2 デプロイ（完了済み）

## 📋 システム情報
（以降は別セクション）
```

#### スクリプトの動作ロジック
```javascript
// generate-daily-digest.mjs の extractTasks() 関数

function extractTasks(todoContent) {
  const lines = todoContent.split('\n');
  const highPriority = [];
  const regular = [];
  const noTag = [];
  let inTodaySection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // "## Today" セクションを検出
    if (trimmed.match(/^##\s+Today/i)) {
      inTodaySection = true;
      continue;
    }

    // 次のセクション (##) が来たら Today セクション終了
    if (trimmed.startsWith('##') && !trimmed.match(/^##\s+Today/i)) {
      inTodaySection = false;
      continue;
    }

    // Today セクション内の **未完了タスク** のみ抽出
    if (inTodaySection && trimmed.startsWith('- [ ]')) {  // ← ここが重要
      // タグベースで分類処理...
    }
  }

  return { highPriority, regular, noTag };
}
```

#### 問題の本質
1. ✅ スクリプトは "## Today" セクションを正しく検出している
2. ✅ 未完了タスク `- [ ]` のみを抽出する仕様（正しい動作）
3. ❌ **TODO.mdの "Today" セクションが2日前 (2025-11-28) のもので、全て完了済み `[x]`**
4. ❌ 現在の日付 (2025-11-30) 用の "Today" セクションが存在しない
5. → 結果: 抽出タスク 0件

---

## 🤔 解決方法の選択肢

### Option 1: 手動でTODO.mdを毎日更新（シンプル）
**方法**:
```markdown
## Today — 2025-11-30

- [ ] Recipe 14のタスク抽出ロジック検証 #urgent
- [ ] n8n本番環境デプロイ準備 #review
- [ ] Cortex OS v1.2 週次サマリー確認

## Today — 2025-11-28  ← アーカイブ（過去のセクション）
- [x] [Cortex] generateLlmsInput.cs.js 骨組み作成
...
```

**メリット**:
- 即座に解決
- スクリプト変更不要
- シンプルで確実

**デメリット**:
- 毎日手動でセクション作成が必要
- 日付更新忘れのリスク

---

### Option 2: スクリプトに日付検証機能を追加（自動化）
**実装内容**:
1. "## Today — YYYY-MM-DD" 形式の日付を検出
2. 現在の日付と比較
3. 古い場合は警告メッセージを出力
4. オプション: 自動的に新しい "Today" セクションを追加

**例**:
```javascript
function extractTasks(todoContent) {
  // 既存のロジック...

  // 日付検証を追加
  if (trimmed.match(/^##\s+Today\s*—\s*(\d{4}-\d{2}-\d{2})/i)) {
    const dateMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
    const sectionDate = dateMatch[1];
    const today = formatDate(new Date());

    if (sectionDate !== today) {
      console.warn(`⚠️  Warning: Today section is dated ${sectionDate}, but today is ${today}`);
      console.warn(`   Please update TODO.md with current tasks.`);
    }

    inTodaySection = true;
    continue;
  }
}
```

**メリット**:
- 日付のズレを自動検出
- ユーザーに明確な警告を表示
- 将来的な自動化の基盤

**デメリット**:
- スクリプト変更が必要
- テストが必要

---

### Option 3: 日付付き "Today" セクション以外も許容（柔軟性）
**方法**:
- "## Today" (日付なし) も検出するようにする
- 日付検証を緩和

**メリット**:
- より柔軟な運用が可能

**デメリット**:
- 古いタスクを検出してしまうリスク

---

## 📊 現在のシステム状態

### Recipe ステータス
| Recipe | 名前 | 実行時刻 | ステータス | 役割 |
|--------|------|----------|------------|------|
| 14 | Daily Digest Generator | 07:00 JST | **Active** ✅ | Digest生成 |
| 03 | Daily Digest to Slack | 08:00 JST | Active | Digest読み取り→Slack |
| 09 | Daily Digest Export | 08:00 JST | Active | Digest→notifications/ |
| 10 | TODO Sync | 08:05 JST | Active | Digest→TODO同期 |
| 13 | Nightly Wrapup | 22:00 JST | Active | Digest→tomorrow.json |

### 実行フロー（設計通り）
```
07:00  Recipe 14 → cortex/daily/YYYY-MM-DD-digest.md 生成
   ↓
08:00  Recipe 03 → Digestを読み取り → Slack通知
   ↓
08:00  Recipe 09 → Digestを読み取り → notifications/ 書き出し
   ↓
08:05  Recipe 10 → Digestを読み取り → TODO同期
   ↓
22:00  Recipe 13 → Digestを読み取り → tomorrow.json生成
```

---

## 🎯 判断が必要な点

### 質問1: TODO.mdの運用方針
- **毎日手動で "Today" セクションを更新する** のが現実的か？
- それとも **スクリプト側で日付検証・警告を出す** 方が良いか？

### 質問2: 日付管理の厳格さ
- "## Today — YYYY-MM-DD" 形式を強制すべきか？
- それとも "## Today" だけでも許容すべきか？

### 質問3: 自動化の範囲
- Digest生成時に **TODO.mdを自動的に更新** すべきか？
  - 例: 前日の "Today" セクションを自動アーカイブ
  - 例: 新しい "Today" セクションを自動作成（tomorrow.jsonから）

---

## 💡 推奨案（個人的な意見）

### 短期的解決（今日中）
**Option 1を採用**: 手動でTODO.mdを更新
- 即座に動作確認できる
- Recipe 14の完全動作を検証できる

### 中長期的改善（v1.3以降）
**Option 2を実装**: スクリプトに日付検証を追加
- ユーザーに日付ズレを警告
- 自動化の基盤を構築

### 将来的な拡張（v2.0）
- Recipe 14が前日のDigestから tomorrow_candidates を読み取り
- 自動的に新しい "Today" セクションを生成
- 完全自律型の認知ループ実現

---

## 📎 関連ファイル

```
cortex/
├── scripts/
│   ├── generate-daily-digest.mjs          ← タスク抽出ロジック
│   └── README-digest-generator.md
├── templates/
│   └── daily-digest-template.md
├── daily/
│   ├── 2025-11-29-digest.md              ← 生成済み（空）
│   └── 2025-11-30-digest.md              ← 生成済み（空）
└── state/
    └── tomorrow.json                      ← tomorrow_candidates あり

services/n8n/workflows/
└── recipe-14-daily-digest-generator.json  ← Active稼働中

TODO.md                                     ← 更新が必要
```

---

## 🙋 GPTへの質問

上記の状況を踏まえて、以下の点についてアドバイスをお願いします：

1. **TODO.mdの運用方針として、どのOptionが最も実用的か？**
   - Option 1: 手動更新
   - Option 2: スクリプト日付検証
   - Option 3: 柔軟な検出

2. **Cortex OS v1.2の自律性を高めるための次のステップは？**
   - tomorrow.jsonとの連携
   - 自動アーカイブ機能
   - その他のアイデア

3. **日付付き "Today" セクションの厳格な管理は必要か？**
   - それとも "## Today" だけで十分か？

よろしくお願いします！
