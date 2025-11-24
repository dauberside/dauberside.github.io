Cursor / Claude Code を再起動したあと、前回のセッション状態に最短で復帰するためのコンテキスト復元コマンド。

## やってほしいこと

1. 以下のファイルを順番に読み込んで、今日必要な文脈を内部状態にロードしてください：
   - `daily/` の最新ファイル（Daily Digest）- Obsidian vault から
   - `docs/operations/phase-2-implementation.md`
   - `docs/decisions/ADR-0006-phase-2-automation-strategy.md`
   - `CLAUDE.md`
   - `docs/operations/mcp-recipes.md`
   - `TODO.md`（存在する場合）

2. それらを読み込んだら、次のフォーマットで「現在の作業コンテキスト」を再構築してください：

```
## Session Restore Complete

### 読み込んだ文脈
- **Daily Digest**: <日付>
- **進行中の Recipe**: <該当があれば>
- **今日の最重要タスク**（Digest から抽出）: 上位3件

### 次にできるアクション
1. Recipe の続き
2. 今日のタスクに着手
3. 次の設計レイヤを開く
```

---

Note: Obsidian API（port 8443）を使用して daily/ から最新の Digest を取得すること。
