# n8n Recipe バージョン確認ガイド

## 🎯 目的

Recipe 01 と Recipe 04 の稼働中バージョンを特定して、旧版をアーカイブする。

---

## 📋 確認手順

### 1. n8n UI にアクセス

```bash
# n8n が起動しているか確認
docker ps | grep n8n

# アクセス
open http://localhost:5678
```

### 2. Recipe 01 の確認

**確認項目**:
- Workflows タブで "Recipe 01" または "Obsidian Slack" で検索
- **Active** (緑色) になっているワークフローを確認
- ワークフローを開いて、右上の **Settings** → **Workflow ID** をメモ

**判定基準**:
- v3 (最新 11/18 08:53) が Active → v1, v2 をアーカイブ
- v2 が Active → v1 をアーカイブ、v3 を削除
- v1 が Active → v2, v3 を削除（まさか...）

### 3. Recipe 04 の確認

**確認項目**:
- "Recipe 04" または "ADR GitHub" で検索
- Phase2 (11/24 21:38) が Active か確認

**判定基準**:
- Phase2 が Active → Simple, 通常版 をアーカイブ
- 通常版 が Active → Simple, Phase2 を確認
- Simple が Active → 他をアーカイブ

---

## 🗂️ 確認結果記入欄

### Recipe 01

```
稼働中バージョン: [ v1 / v2 / v3 ]
Workflow ID: __________
最終実行日時: __________

アーカイブ対象:
[ ] recipe-01-obsidian-slack.json (v1)
[ ] recipe-01-obsidian-slack-v2.json (v2)
[ ] recipe-01-obsidian-slack-v3.json (v3)
```

### Recipe 04

```
稼働中バージョン: [ Simple / 通常版 / Phase2 ]
Workflow ID: __________
最終実行日時: __________

アーカイブ対象:
[ ] recipe-04-adr-to-github-issue-simple.json
[ ] recipe-04-adr-to-github-issue.json
[ ] recipe-04-phase2-github-webhook.json
```

---

## 🚀 アーカイブ実行コマンド（確認後）

### Pattern A: Recipe 01 = v3, Recipe 04 = Phase2 の場合

```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1/services/n8n/workflows"

# アーカイブディレクトリ作成
mkdir -p archive/recipe-01-old-versions
mkdir -p archive/recipe-04-old-versions

# Recipe 01 旧版
mv recipe-01-obsidian-slack.json archive/recipe-01-old-versions/
mv recipe-01-obsidian-slack-v2.json archive/recipe-01-old-versions/

# Recipe 04 旧版
mv recipe-04-adr-to-github-issue-simple.json archive/recipe-04-old-versions/
mv recipe-04-adr-to-github-issue.json archive/recipe-04-old-versions/

# 確認
ls -lh archive/
```

### Pattern B: その他のパターン

確認結果に応じてコマンドを調整してください。

---

## 📝 メモ

- アーカイブは**削除ではなく移動**
- git で履歴管理されているので安全
- 問題があれば `git mv` で戻せる

---

**作成日**: 2025-12-02  
**Status**: 🟡 確認待ち
