# /sync-todo — TODO.md Sync Command

AI側に保存されたタスクを、TODO.md に反映するコマンド。

## 目的

外出先で `/brief` や `/wrap-up` で決めたタスクを、自宅でDocker接続時に TODO.md に反映させる。

---

## 使い方

```bash
/sync-todo [today|tomorrow|both] [--append|--replace]
```

**デフォルト**: `today --replace`

---

## 引数

- `today`: 今日のタスクを TODO.md の "Today" セクションに反映
- `tomorrow`: 明日のタスクを TODO.md の "Tomorrow" セクションに反映
- `both`: 今日と明日の両方を反映
- `--append`: 既存タスクに追記
- `--replace`: 既存タスクを置き換え（デフォルト）

---

## 動作フロー

### `today` の場合

1. 今日の日付を取得（例: `2025-12-05`）
2. `cortex/state/brief-{date}.json` を読み込む
3. Obsidian REST API で TODO.md を取得
4. `## Today — {date}` セクションを探す
5. タスクを Markdown 形式に変換：
   ```markdown
   - [ ] {task.title} ({task.time})
   ```
6. セクション内容を置き換え（`--replace`）or 追記（`--append`）
7. Obsidian REST API で TODO.md を更新

### `tomorrow` の場合

1. 明日の日付を取得（例: `2025-12-06`）
2. `cortex/state/tomorrow.json` を読み込む
3. `tomorrow_candidates` を取得
4. TODO.md の `## Tomorrow — {date}` セクションを更新

---

## 実装

**Phase 2 完了**: bash スクリプトによる自動化を実装

このコマンドを実行すると、`scripts/sync-todo.sh` が呼び出されます：

```bash
./scripts/sync-todo.sh [today|tomorrow|both] [--append|--replace]
```

### スクリプトの動作

1. **引数を解析**（デフォルト: `today --replace`）
2. **日付を計算**
   - `today`: 今日の日付（YYYY-MM-DD）
   - `tomorrow`: 明日の日付（YYYY-MM-DD）
3. **JSON ファイルを読み込み**
   - `today`: `cortex/state/brief-{date}.json`
   - `tomorrow`: `cortex/state/tomorrow.json`
4. **タスクを Markdown に変換**
   ```bash
   cat brief-{date}.json | jq -r '.tasks[] | "- [\(if .status == "completed" then "x" else " " end)] \(.title) (\(.time))"'
   ```
5. **Obsidian REST API で TODO.md を取得**
   ```bash
   curl -k "https://127.0.0.1:27124/vault/TODO.md" \
     -H "Authorization: Bearer ${OBSIDIAN_API_KEY}"
   ```
6. **Python で Today セクションを置き換え**
   ```python
   pattern = r'## Today — {date}.*?(?=\n---\n\n## )'
   updated = re.sub(pattern, new_section, current, flags=re.DOTALL)
   ```
7. **Obsidian REST API で TODO.md を更新**
   ```bash
   curl -k -X PUT "https://127.0.0.1:27124/vault/TODO.md" \
     -H "Authorization: Bearer ${OBSIDIAN_API_KEY}" \
     -H "Content-Type: text/markdown" \
     --data "${updated_content}"
   ```

---

## エラーハンドリング

- JSON ファイルが存在しない場合: エラーメッセージを表示して終了
- TODO.md が取得できない場合: Obsidian REST API の接続を確認
- セクションが見つからない場合: 新規セクションを作成して追加

---

## 使用例

```bash
# 今日のタスクを TODO.md に反映（置き換え）
/sync-todo

# 今日のタスクを追記
/sync-todo today --append

# 明日のタスクを TODO.md に反映
/sync-todo tomorrow

# 今日と明日の両方を反映
/sync-todo both
```

---

## Claude Code での実行

このコマンドを実行すると、以下の bash コマンドが実行されます：

```bash
# OBSIDIAN_API_KEY を環境変数として設定
export OBSIDIAN_API_KEY="270cc55355f7e4747e643100df3f121cf1360d8c191c92d5765f24962db88e66"

# sync-todo.sh を実行
./scripts/sync-todo.sh today --replace
```

**注意**: `OBSIDIAN_API_KEY` は実行時に自動的に設定されます。

---

**Created**: 2025-12-05
**Version**: 4.0 (Phase 4 完了)

## Phase 3 更新内容

- ✅ `/sync-todo tomorrow` の完全実装
- ✅ `/sync-todo both` の完全実装
- ✅ `/brief` の自動 JSON 保存機能追加

## Phase 4 更新内容（2025-12-05 完了）

### ✅ `--append` オプションの完全実装
- 既存タスクを保持しつつ、新しいタスクを追記
- today, tomorrow, both すべてのモードで動作
- 既存タスクのチェック状態（完了/未完了）を維持

### ✅ エラーハンドリングの大幅強化
1. **依存関係チェック**: jq, python3, curl の存在を事前確認
2. **JSON 構造検証**:
   - JSON 形式の妥当性チェック（jq empty）
   - 必須フィールド（tasks, tomorrow_candidates）の存在確認
   - パースエラー時の詳細なエラーメッセージ
3. **Obsidian API エラーハンドリング**:
   - HTTP ステータスコードの検証（200/204）
   - 401 (認証エラー) の検出とヒント表示
   - 000 (接続エラー) の検出とトラブルシューティングガイド
4. **macOS 互換性修正**:
   - `head -n-1` → `sed '$d'` (macOS で動作しない問題を修正)
   - `tail -n1` → `tail -n 1` (スペース追加で互換性向上)
5. **stdout/stderr 分離**:
   - 情報メッセージを stderr にリダイレクト (>&2)
   - タスクリストへの出力混入を防止

## 次のステップ（Phase 5 - 将来の拡張）

- [ ] `/wrap-up` との統合テスト
- [ ] タスク重複検出・防止機能
- [ ] n8n Recipe への移行（オプション）
- [ ] タスク優先度の自動調整
- [ ] 実行時間のトラッキングと集計
