# AI Handoff - Copilot CLI ↔️ Claude (Cursor) 連携

このディレクトリは、**Copilot CLI** (Obsidian/Terminal) と **Claude** (Cursor IDE) の間でコンテキストを引き継ぐための共有メモリです。

## 🎯 目的

- Copilot CLI でのセッション内容を Cursor/Claude に引き継ぐ
- Cursor/Claude での作業内容を Copilot CLI に伝える
- AI 間でのシームレスなコラボレーション

## 📂 構成

```
cortex/ai-handoff/
├── README.md                              # このファイル
├── 2025-12-02-daily-digest-fix.json      # セッション記録例
├── context.json                           # 現在の共有コンテキスト（オプション）
└── YYYY-MM-DD-<topic>.json               # 日付ごとのセッション記録
```

## 🔄 使用方法

### Copilot CLI から Cursor/Claude へ

1. **セッション終了時に記録を作成**:
   ```bash
   cat > cortex/ai-handoff/2025-12-02-my-session.json << 'EOF'
   {
     "date": "2025-12-02",
     "source": "copilot-cli",
     "topic": "Your Topic Here",
     "summary": "What you accomplished",
     "nextActions": ["What to do next"],
     "relevantFiles": ["list", "of", "files.js"]
   }
   EOF
   ```

2. **Cursor で開く**:
   - Cursor を開く
   - Cmd+K (または Ctrl+K)
   - `@cortex/ai-handoff/2025-12-02-my-session.json の続きを実行して`

3. **Claude が自動的にコンテキストを読み込む**:
   - ファイル内容を理解
   - 次のアクションを提案
   - 関連ファイルを参照

### Cursor/Claude から Copilot CLI へ

1. **Cursor で作業記録を保存**:
   ```json
   {
     "date": "2025-12-02",
     "source": "claude-cursor",
     "topic": "Refactoring completed",
     "summary": "Extracted functions to lib/",
     "filesModified": ["lib/utils.js", "index.js"],
     "nextActions": ["Run tests", "Update documentation"]
   }
   ```

2. **Copilot CLI で読み込む**:
   ```bash
   cat cortex/ai-handoff/2025-12-02-refactoring.json
   # → 内容を確認して続きを実行
   ```

## 📋 ファイル命名規則

```
YYYY-MM-DD-<short-topic>-<source>.json

例:
- 2025-12-02-daily-digest-fix.json       # 今日のセッション
- 2025-12-03-refactoring-cursor.json     # Cursor での作業
- 2025-12-03-testing-copilot.json        # Copilot での作業
```

## 📝 JSON スキーマ

### 基本構造

```json
{
  "version": "1.0",
  "date": "YYYY-MM-DD",
  "time": "HH:MM JST (optional)",
  "source": "copilot-cli | claude-cursor",
  "target": "claude-cursor | copilot-cli (optional)",
  "session": {
    "topic": "セッションの主題",
    "status": "completed | in-progress | blocked",
    "summary": "何を達成したか"
  },
  "next_actions": [
    {
      "priority": "high | medium | low",
      "action": "次にやること",
      "when": "いつやるか (optional)",
      "estimated_time": "所要時間見積もり (optional)"
    }
  ],
  "relevant_files": [
    "path/to/file1.js",
    "path/to/file2.md"
  ],
  "notes_for_ai": "次のAIへのメッセージ"
}
```

## 🚀 実例

### Example 1: デバッグ完了の引き継ぎ

```json
{
  "date": "2025-12-02",
  "source": "copilot-cli",
  "topic": "Daily Digest Bug Fix",
  "status": "completed",
  "summary": "Fixed 3 bugs, system now operational",
  "next_actions": [
    "Monitor tomorrow's execution",
    "Consider Phase 2 refactoring"
  ],
  "relevant_files": [
    "cortex/scripts/generate-daily-digest.mjs"
  ]
}
```

**Cursor での使用**:
```
User: "@cortex/ai-handoff/2025-12-02-daily-digest-fix.json の続きをお願い"
Claude: "了解しました。Daily Digest の修正が完了しているので、Phase 2 のリファクタリングを始めましょうか？"
```

### Example 2: リファクタリング作業の記録

```json
{
  "date": "2025-12-02",
  "source": "claude-cursor",
  "topic": "Extracted digest functions",
  "status": "completed",
  "summary": "Created lib/digest-utils.js with 5 functions",
  "filesModified": [
    "cortex/scripts/lib/digest-utils.js",
    "cortex/scripts/generate-daily-digest.mjs"
  ],
  "next_actions": [
    {
      "action": "Add unit tests",
      "priority": "high"
    },
    {
      "action": "Update documentation",
      "priority": "medium"
    }
  ]
}
```

## 🔧 便利なコマンド

```bash
# 最新のハンドオフファイルを確認
ls -lt cortex/ai-handoff/*.json | head -1

# 特定のセッションを検索
grep -l "daily-digest" cortex/ai-handoff/*.json

# 全セッションの要約
jq '.session.summary' cortex/ai-handoff/*.json
```

## 💡 ベストプラクティス

1. **セッション終了時に必ず記録**
   - 何を達成したか
   - 次に何をすべきか
   - 関連ファイルは何か

2. **ファイル名をわかりやすく**
   - 日付 + トピック
   - 誰が見てもわかる名前

3. **next_actions を具体的に**
   - 「リファクタリング」より「Extract XX function to lib/」
   - 優先度を明記

4. **relevant_files を網羅的に**
   - 次の AI が何を見るべきか明確にする

5. **notes_for_ai を活用**
   - 注意点やコンテキストを補足

## 🎯 利点

- ✅ シンプル（JSONファイルだけ）
- ✅ git で管理可能（履歴追跡）
- ✅ 人間も読める（デバッグ容易）
- ✅ 両方の AI が同じファイルシステムにアクセス
- ✅ 実装時間: 5分

## 📚 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - Cursor/Claude の設定
- [CURSOR-CONTEXT.md](../CURSOR-CONTEXT.md) - Cursor 用コンテキスト
- [TODO.md](../../TODO.md) - タスク管理

---

**Status**: 🟢 Active  
**Version**: 1.0  
**Last Updated**: 2025-12-02
