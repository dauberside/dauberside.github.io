Cursor / Claude Code を再起動したあと、前回のセッション状態に最短で復帰するためのコンテキスト復元コマンド。

## やってほしいこと

1. 以下のファイルを順番に読み込んで、今日必要な文脈を内部状態にロードしてください：
   - `daily/` の最新ファイル（Daily Digest）- 以下の優先順位で取得:
     1. Obsidian vault: `obsidian_list_files_in_dir(dirpath: "cortex/daily")` → 最新ファイルを `obsidian_get_file_contents` で読む
     2. フォールバック: Git repo `cortex/daily/` から最新ファイルを `Glob` + `Read` で読む
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

Note:
- Obsidian REST API は PORT 27124 (HTTPS) で稼働中
- `obsidian_get_recent_periodic_notes` はエラーが出やすいため使用しない
- 代わりに `obsidian_list_files_in_dir` + `obsidian_get_file_contents` を使用
- エラー時は Git repo の `cortex/daily/` から直接読むこと
