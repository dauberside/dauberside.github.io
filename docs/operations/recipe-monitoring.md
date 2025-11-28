# Recipe 動作確認 Checklist（2025-11-28）

## 📋 Overview

本ドキュメントは、Cortex OS v1.2 の自律認知ループを構成する Recipe 02/03/10 の実運用監視チェックリストです。

**監視対象 Recipe**:
- **Recipe 02**: Nightly KB Rebuild（03:00 JST）
- **Recipe 03**: Morning Digest（08:00 JST）
- **Recipe 10**: TODO Auto-sync（08:05 JST）

---

## Recipe 02: Nightly KB Rebuild（03:00 JST）

### 事前確認
- [ ] n8n UI で Recipe 02 がアクティブ化されているか
- [ ] Obsidian REST API（PORT 27124）が稼働中か

### 実行履歴確認
- [ ] 最新の実行日時: ______（今朝 03:00 の実行があるか）
- [ ] 実行ステータス: ✅ Success / ❌ Error
- [ ] エラーがある場合、どのノードで失敗したか: ______

### 出力確認
- [ ] KB index が更新されたか（kb/index/embeddings.json のタイムスタンプ）
- [ ] Slack 通知が届いたか（オプション）

**確認コマンド**:
```bash
# KB index の最終更新時刻を確認
ls -lh kb/index/embeddings.json | awk '{print "Modified: " $6 " " $7 " " $8}'

# Obsidian API 接続確認
curl -k -s https://127.0.0.1:27124/ | jq -r '.status'
```

---

## Recipe 03: Morning Digest（08:00 JST）

### 事前確認
- [ ] n8n UI で Recipe 03 がアクティブ化されているか
- [ ] Obsidian REST API（PORT 27124）が稼働中か

### 実行履歴確認
- [ ] 最新の実行日時: ______（今朝 08:00 の実行があるか）
- [ ] 実行ステータス: ✅ Success / ❌ Error
- [ ] エラーがある場合、どのノードで失敗したか: ______

### 出力確認
- [ ] Daily Digest が生成されたか（cortex/daily/YYYY-MM-DD-digest.md）
- [ ] Slack 通知が届いたか（オプション）

**確認コマンド**:
```bash
# 最新の Daily Digest を確認
ls -lt cortex/daily/*.md | head -3

# 今日の digest が存在するか
TODAY=$(date +%Y-%m-%d)
test -f "cortex/daily/${TODAY}-digest.md" && echo "✅ Today's digest exists" || echo "❌ Missing"
```

---

## Recipe 10: TODO Auto-sync（08:05 JST）

### 事前確認
- [ ] n8n UI で Recipe 10 v1.2 がアクティブ化されているか
- [ ] Obsidian REST API（PORT 27124）が稼働中か
- [ ] 昨日の Daily Digest が存在するか

### 実行履歴確認
- [ ] 最新の実行日時: ______（今朝 08:05 の実行があるか）
- [ ] 実行ステータス: ✅ Success / ❌ Error
- [ ] エラーがある場合、どのノードで失敗したか: ______

### 出力確認
- [ ] TODO.md が更新されたか（新規タスクが追加されている）
- [ ] タグベース絵文字が正しく付いているか（⚡🚧⏳🎯👁️）
- [ ] 重複排除が機能しているか
- [ ] Slack 通知が届いたか（新規タスク数を表示）

**確認コマンド**:
```bash
# TODO.md の最終更新時刻
ls -lh TODO.md | awk '{print "Modified: " $6 " " $7 " " $8}'

# タグベース絵文字が含まれているか確認
grep -E "⚡|🚧|⏳|🎯|👁️" TODO.md | head -5

# 昨日の digest が存在するか
YESTERDAY=$(date -v-1d +%Y-%m-%d)
test -f "cortex/daily/${YESTERDAY}-digest.md" && echo "✅ Yesterday's digest exists" || echo "❌ Missing"
```

---

## 統合テスト

### データフロー確認
- [ ] Recipe 13（22:00）→ tomorrow.json 生成 → Recipe 10（08:05）→ TODO.md 更新の流れが正常か
- [ ] yesterday digest → Recipe 10 → TODO.md の流れが正常か

**データフロー図**:
```
22:00 Recipe 13 (Wrap-up)
    ↓
tomorrow.json 生成
    ↓
03:00 Recipe 02 (KB Rebuild)
    ↓
kb/index/embeddings.json 更新
    ↓
08:00 Recipe 03 (Morning Digest)
    ↓
cortex/daily/YYYY-MM-DD-digest.md 生成
    ↓
08:05 Recipe 10 (TODO Auto-sync)
    ↓
TODO.md 更新（タグ付き、重複排除）
```

### 7日間の安定稼働監視

| 日付 | Recipe 02 | Recipe 03 | Recipe 10 | 備考 |
|------|-----------|-----------|-----------|------|
| 2025-11-28 | ✅ | ✅ | ✅ | 初回確認完了 |
| 2025-11-29 | ⏳ | ⏳ | ⏳ | |
| 2025-11-30 | ⏳ | ⏳ | ⏳ | |
| 2025-12-01 | ⏳ | ⏳ | ⏳ | |
| 2025-12-02 | ⏳ | ⏳ | ⏳ | |
| 2025-12-03 | ⏳ | ⏳ | ⏳ | |
| 2025-12-04 | ⏳ | ⏳ | ⏳ | 1週間完了 |

---

## トラブルシューティング

### よくあるエラー

#### 1. Obsidian REST API 接続失敗
**症状**: n8n ワークフローで "Connection refused" または "ECONNREFUSED" エラー

**確認**:
```bash
curl -k https://127.0.0.1:27124/
# 期待する出力: {"status":"OK",...}
```

**対処**:
- Obsidian を再起動
- Local REST API プラグインが有効化されているか確認
- PORT 27124 が開いているか確認: `lsof -i :27124`

#### 2. Daily Digest が見つからない
**症状**: Recipe 10 で "File not found" エラー

**確認**:
```bash
ls cortex/daily/$(date -v-1d +%Y-%m-%d)-digest.md
```

**対処**:
- Recipe 03 を手動実行して digest を生成
- または digest を手動作成して配置

#### 3. TODO.md に重複タスクが追加される
**症状**: 同じタスクが複数回追加される

**確認**:
```bash
# TODO.md の "Today" セクションで重複を確認
grep -A 20 "## Today" TODO.md
```

**対処**:
- ワークフロー内の `normalizeTask()` 関数を確認
- デバッグ: Code ノードに `console.log(normalized)` を追加

#### 4. n8n が cron を実行しない
**症状**: 指定時刻に自動実行されない

**確認**:
```bash
# n8n コンテナのタイムゾーン確認
docker exec n8n date

# n8n UI でワークフローの "Active" トグルを確認
```

**対処**:
- ワークフローを再アクティブ化（オフ → オン）
- n8n コンテナを再起動: `docker compose restart n8n`
- n8n 環境変数に `TZ=Asia/Tokyo` が設定されているか確認

#### 5. タグベース絵文字が表示されない
**症状**: TODO.md にタグ付きタスクが追加されるが、絵文字がない

**確認**:
```bash
# Recipe 10 の Extract Uncompleted Tasks ノードを確認
# tagEmojiMap の定義を確認
```

**対処**:
- Recipe 10 v1.2 の最新版を再インポート
- `tagEmojiMap` の優先順位が正しいか確認

---

## システム状態確認（クイックチェック）

以下のコマンドを実行して、システム全体の状態を一括確認：

```bash
#!/bin/bash
echo "=== Cortex OS v1.2 System Check ==="
echo ""

echo "🔌 Obsidian REST API:"
curl -k -s https://127.0.0.1:27124/ | jq -r '.status // "ERROR"'

echo ""
echo "🐳 n8n Container:"
docker ps --filter "name=n8n" --format "{{.Status}}"

echo ""
echo "📅 Latest Daily Digest:"
ls -lt cortex/daily/*.md 2>/dev/null | head -1 | awk '{print $6 " " $7 " " $8 " " $9}'

echo ""
echo "📝 TODO.md Last Modified:"
ls -lh TODO.md | awk '{print $6 " " $7 " " $8}'

echo ""
echo "🧠 KB Index Last Modified:"
ls -lh kb/index/embeddings.json | awk '{print $6 " " $7 " " $8}'

echo ""
echo "✅ System Check Complete"
```

---

## Related Documents

- **Recipe 10 詳細**: [docs/recipes/recipe-10-tags.md](../recipes/recipe-10-tags.md)
- **MCP Recipes 全体**: [docs/operations/mcp-recipes.md](./mcp-recipes.md)
- **v1.2 Roadmap**: [cortex/roadmap/v1.2-autonomy.md](../../cortex/roadmap/v1.2-autonomy.md)
- **n8n 運用ガイド**: [docs/operations/n8n.md](./n8n.md)

---

**作成日**: 2025-11-28
**最終更新**: 2025-11-28
**更新者**: Cortex OS v1.2 Monitoring
