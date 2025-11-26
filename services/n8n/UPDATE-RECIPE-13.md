# Recipe 13: Reflection 抽出ロジック更新手順

> Issue #68 対応: https://github.com/dauberside/dauberside.github.io/issues/68

## 📋 更新内容

**問題**: `tomorrow.json` の `reflection_summary` が古いデータのまま固定されている

**解決策**: `extractReflection()` 関数を改善し、3段階のフォールバックを実装

---

## 🔧 更新手順

### Option A: n8n UI で更新（推奨）

1. **n8n UI を開く**
   ```bash
   open http://localhost:5678
   ```

2. **Recipe 13 ワークフローを開く**
   - "Recipe 13: Nightly Wrap-up (Cortex OS)" をクリック

3. **"Build tomorrow.json" ノードを編集**
   - ノードをダブルクリック
   - Code エディタを開く

4. **extractReflection() 関数を置き換え**

   **Before** (line 27-39):
   ```javascript
   function extractReflection(text) {
     if (!text.includes('## Reflection')) return '';

     const reflectionSection = text.split('## Reflection')[1];
     if (!reflectionSection) return '';

     const lines = reflectionSection.split('\n')
       .filter(l => l.trim().startsWith('- '))
       .map(l => l.trim().replace('- ', ''));

     return lines.slice(0, 2).join('、');
   }
   ```

   **After** (新しいコード):
   ```javascript
   function extractReflection(text) {
     // Option 1: Extract from ## Reflection section
     const reflectionMatch = text.match(/## Reflection\s*\n([\s\S]*?)(?=\n##|$)/);
     if (reflectionMatch && reflectionMatch[1].trim()) {
       const lines = reflectionMatch[1]
         .split('\n')
         .filter(l => l.trim().startsWith('- ') && l.trim().length > 2)
         .map(l => l.trim().replace(/^- /, ''));

       if (lines.length > 0) {
         return lines.slice(0, 2).join('、');
       }
     }

     // Option 2: Extract from Yesterday's Summary section
     const yesterdayMatch = text.match(/\*\*Reflection\*\*:\s*(.+)/);
     if (yesterdayMatch && yesterdayMatch[1].trim()) {
       return yesterdayMatch[1].trim();
     }

     // Option 3: Fallback - Generate summary from date
     const dateMatch = text.match(/# Daily Digest — (\d{4}-\d{2}-\d{2})/);
     const date = dateMatch ? dateMatch[1] : '今日';

     return `${date} の作業完了`;
   }
   ```

5. **保存して実行**
   - "Save" をクリック
   - "Test workflow" で動作確認

---

### Option B: ワークフロー JSON を直接編集

1. **ワークフローをエクスポート**
   ```bash
   # n8n UI で Export → Download as JSON
   ```

2. **`services/n8n/workflows/recipe-13-nightly-wrapup.json` をバックアップ**
   ```bash
   cp services/n8n/workflows/recipe-13-nightly-wrapup.json \
      services/n8n/workflows/recipe-13-nightly-wrapup.json.backup
   ```

3. **`services/n8n/scripts/extract-reflection-v2.js` の内容を参照**
   - 完全なコードが記載されています

4. **n8n UI で Import**
   - Import → Upload from file

---

## ✅ 動作確認

### 1. 手動テスト

n8n UI で "Execute Node" をクリックして、`tomorrow.json` の内容を確認：

```json
{
  "reflection_summary": "Recipe 13 完成、Obsidian 連携強化、secrets 管理整備"
}
```

### 2. 明日の朝に確認

翌日の `/brief` 実行時に、`tomorrow.json` の `reflection_summary` が更新されていることを確認。

---

## 📊 改善点

| 項目 | Before | After |
|------|--------|-------|
| **Reflection 抽出** | `## Reflection` セクションのみ | 3段階フォールバック |
| **空の処理** | 空文字列を返す | フォールバック値を生成 |
| **Yesterday's Summary** | 未対応 | 対応済み |
| **正規表現** | split() | match() で堅牢化 |

---

## 🔗 関連

- Issue #68: https://github.com/dauberside/dauberside.github.io/issues/68
- 改善コード: `services/n8n/scripts/extract-reflection-v2.js`
- v1.2 フォローアップ: `cortex/backlog/v1.2-followup.md`

---

**更新日**: 2025-11-25
**担当**: Issue #68 対応
