# Daily Digest Generator

自動的にDaily Digestファイルを生成するスクリプト。

## 📝 概要

`generate-daily-digest.mjs` は、TODO.mdから今日のタスクを抽出し、テンプレートを使用してDaily Digestファイルを自動生成します。

## 🚀 使い方

### 1. 今日のDigestを生成

```bash
pnpm cortex:digest:today
```

### 2. 特定の日付のDigestを生成

```bash
node cortex/scripts/generate-daily-digest.mjs 2025-11-29
```

### 3. 複数日分を一括生成

```bash
# 過去7日分を生成する例
for i in {1..7}; do
  date=$(date -v-${i}d +%Y-%m-%d)
  node cortex/scripts/generate-daily-digest.mjs $date
done
```

## 📂 出力先

生成されたファイルは以下のパスに保存されます：

```
cortex/daily/YYYY-MM-DD-digest.md
```

## 🎨 テンプレート

テンプレートファイル: `cortex/templates/daily-digest-template.md`

カスタマイズ可能な項目：
- セクション構成
- デフォルトテキスト
- フォーマット

## 🔄 自動実行の設定

### Option 1: Cronで毎日自動実行

```bash
# crontab -e
0 7 * * * cd /path/to/repo && /usr/local/bin/pnpm cortex:digest:today
```

### Option 2: n8n Recipeとして統合

新しいRecipe（Recipe 14など）を作成して、毎朝自動実行：

```json
{
  "name": "Recipe 14: Daily Digest Generator",
  "trigger": "Every morning 07:00 JST",
  "action": "Execute: node ${WORKSPACE_ROOT}/cortex/scripts/generate-daily-digest.mjs"
}
```

### Option 3: PM2で定期実行

```bash
pm2 start cortex/scripts/generate-daily-digest.mjs --cron "0 7 * * *" --name digest-generator
```

## 📊 動作フロー

```
1. TODO.md を読み込む
   ↓
2. "Today" セクションからタスクを抽出
   ↓
3. タグ別に分類:
   - High Priority: #urgent, #deepwork, #blocked, #waiting
   - Regular Tasks: #review などのタグ付き
   - No Tags: タグなし
   ↓
4. テンプレートに挿入
   ↓
5. cortex/daily/{date}-digest.md に書き出し
```

## 🔧 トラブルシューティング

### エラー: "TODO.md not found"

```bash
# TODO.md のパスを確認
ls -lh TODO.md
```

### 既存のDigestを上書きしたくない場合

スクリプトは既存ファイルを上書きします。バックアップが必要な場合：

```bash
cp cortex/daily/2025-11-29-digest.md cortex/daily/2025-11-29-digest.md.backup
```

### タスクが抽出されない場合

TODO.md に "## Today" セクションが存在することを確認してください。

## 📚 関連ドキュメント

- `cortex/templates/daily-digest-template.md` - テンプレートファイル
- `services/n8n/workflows/recipe-03-daily-digest.json` - Digest読み取りRecipe
- `services/n8n/workflows/recipe-13-nightly-wrapup.json` - 夜間ラップアップ

## 🎯 今後の拡張案

- [ ] Obsidian REST API経由で直接Vaultに書き込む
- [ ] 前日の完了タスクを自動的に "Progress" セクションに挿入
- [ ] GitHub activity（commits, PRs）を自動集計
- [ ] カレンダーイベントを自動取得して予定セクションに追加

---

**Created**: 2025-11-30
**Version**: 1.0
**Maintainer**: Cortex OS Development Team
