# Recipe 10 Import Guide

**目的**: 修正したRecipe 10ワークフローをn8n UIにインポートする

---

## Method 1: UI Import (推奨)

### Step 1: n8n UIを開く

```bash
open http://localhost:5678
```

または手動でブラウザで開く: http://localhost:5678

### Step 2: ワークフローページへ移動

1. 左サイドバーの「Workflows」をクリック
2. 既存の「Recipe 10: TODO.md Auto-sync」を見つける

### Step 3: 既存ワークフローを更新

#### Option A: 上書きインポート（推奨）

1. 既存の「Recipe 10」ワークフローを開く
2. 右上の「⋮」メニュー → 「Settings」
3. 下部の「Delete」ボタンで削除（またはRenameで一時保存）
4. ワークフロー一覧に戻る
5. 右上の「Import from file」または「Import from URL」
6. ファイルを選択: `/Volumes/Extreme Pro/dauberside.github.io-1/services/n8n/workflows/recipe-10-todo-autosync.json`
7. 「Import」クリック

#### Option B: 手動コード更新

1. Recipe 10ワークフローを開く
2. 「Merge Tasks into TODO」ノードをクリック
3. コードエディタを開く
4. 以下のファイルの内容をコピー:
   `/Volumes/Extreme Pro/dauberside.github.io-1/services/n8n/workflows/recipe-10-merge-fix.js`
5. エディタに貼り付け
6. 「Save」をクリック
7. ワークフロー全体を保存（Ctrl+S / Cmd+S）

### Step 4: 動作確認

1. 「Execute Workflow」ボタンをクリック（手動実行）
2. 各ノードの出力を確認:
   - ✅ Calculate Dates: 日付が正しいか
   - ✅ Read Latest Daily Digest: digestファイルが読めているか
   - ✅ Extract Uncompleted Tasks: タスクが抽出されているか
   - ✅ Read TODO.md: TODO.mdの内容が取得できているか
   - ✅ Merge Tasks into TODO: 新しいセクションが正しく生成されているか
   - ✅ Update TODO.md: 更新が成功しているか

### Step 5: TODO.mdで確認

Obsidianで TODO.md を開き、`## Today — 2025-12-02` セクションが正しく更新されているか確認

---

## Method 2: n8n API (トラブルシューティング用)

もしUI経由でうまくいかない場合:

```bash
# n8nコンテナ内でCLIを使う
docker exec -it -u root n8n sh

# root権限で一時ディレクトリにコピー
cat > /home/node/.n8n/import-temp.json << 'JSONEOF'
[ワークフローJSON全体をここに貼り付け]
JSONEOF

# nodeユーザーに権限変更
chown node:node /home/node/.n8n/import-temp.json

# nodeユーザーでインポート
su - node -c "n8n import:workflow --input=/home/node/.n8n/import-temp.json"
```

---

## 検証項目

### Before Import (バックアップ確認)

```bash
ls -lh /Volumes/Extreme\ Pro/dauberside.github.io-1/services/n8n/workflows/backups/2025-12-02/
```

以下が存在するか:
- ✅ `recipe-10-todo-autosync-pre-merge-fix.json.backup`

### After Import (動作確認)

1. ✅ ワークフローが正しくインポートされた
2. ✅ 「Merge Tasks into TODO」ノードのコードに `FIX:` コメントがある
3. ✅ 正規表現が `/^## Today — \d{4}-\d{2}-\d{2}\s*\n[\s\S]*?^---\s*$/m` になっている
4. ✅ 手動実行で TODO.md が正しく更新される
5. ✅ 既存の `## Today` セクションが完全に置き換わる
6. ✅ `---` が二重にならない

---

## Troubleshooting

### ワークフローが見つからない

→ n8n UIの左サイドバー「Workflows」から検索: "Recipe 10"

### インポートボタンがない

→ 右上の「+ Add workflow」→「Import from file」

### 実行時エラー: "Obsidian API"

→ 環境変数 `OBSIDIAN_API_KEY` が設定されているか確認:

```bash
docker exec n8n env | grep OBSIDIAN
```

### TODO.md が更新されない

→ Obsidian Local REST API が稼働中か確認:

```bash
curl -k -H "Authorization: Bearer YOUR_KEY" \
  https://localhost:27124/vault/TODO.md
```

---

## Next: Task 2

インポートと動作確認が完了したら、次のタスクに進む:

- Task 2: v1.2 Roadmap 確認（10分）
- Task 3: Recipe 02/14 実行ログ確認（15分）
