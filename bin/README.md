# bin/ - Utility Scripts

> Environment-independent utilities for development and operations

---

## Scripts

### `claude-dev`

**目的**: Claude Code を MCP 環境変数付きで起動

**特徴**:
- `.env.mcp` を自動的に読み込み
- GUI アプリ（VSCode, Cursor, Raycast）からでも動作
- 環境変数の確認メッセージを表示

**使い方**:
```bash
./bin/claude-dev

# または Makefile 経由
make claude
```

**内部動作**:
1. プロジェクトルートの `.env.mcp` を検出
2. すべての `MCP_*` 環境変数を export
3. 必須変数（`MCP_OBSIDIAN_API_KEY`）の存在確認
4. `claude` コマンドを起動

---

### `reload-mcp`

**目的**: 現在のシェルで MCP 環境変数を再読み込み

**特徴**:
- `.env.mcp` を編集した後にすぐ反映
- Claude Code を再起動せずに環境変数を更新
- 読み込んだ変数を一覧表示（値は `***` でマスク）

**使い方**:
```bash
# 方法1: source で実行（現在のシェルに反映）
source ./bin/reload-mcp

# 方法2: Makefile 経由
make reload-mcp

# 方法3: シェルエイリアス（.zshrc で定義済み）
reload-mcp
```

**内部動作**:
1. プロジェクトルートの `.env.mcp` を検出
2. すべての変数を export
3. `MCP_*` で始まる環境変数を表示

---

## Why bin/?

### 問題: 環境依存の起動方法

従来の方法には以下の問題がありました：

| 起動方法 | 問題点 |
|---------|--------|
| `claude` | `.env.mcp` が読み込まれない |
| `source ~/.zshrc && claude` | GUI アプリから起動できない |
| エイリアス `claude-dev` | 新しい環境でエイリアスが無い |

### 解決策: プロジェクト内スクリプト

`bin/` にスクリプトを置くことで：

✅ **環境依存ゼロ**: どのマシン・シェルでも同じように動く
✅ **GUI セーフ**: VSCode, Cursor, Raycast から起動しても動作
✅ **ポータブル**: 新しいマシンでも `git clone` すればすぐ使える
✅ **Makefile 統合**: `make claude` で呼び出せる

---

## 使い分け

| 状況 | 推奨コマンド |
|------|------------|
| **通常の起動** | `./bin/claude-dev` または `make claude` |
| **.env.mcp を編集した直後** | `source ./bin/reload-mcp` |
| **環境変数の確認** | `make check-mcp` |
| **GUI アプリから起動** | ターミナルで `./bin/claude-dev` |
| **新しいマシン** | `.env.mcp` を配置 → `./bin/claude-dev` |

---

## トラブルシューティング

### 「Permission denied」エラー

```bash
# 実行権限を付与
chmod +x ./bin/claude-dev ./bin/reload-mcp
```

### 「.env.mcp not found」エラー

```bash
# .env.mcp.example から作成
cp .env.mcp.example .env.mcp
# API キーを編集
vim .env.mcp
```

### 環境変数が読み込まれない

```bash
# 現在の環境変数を確認
make check-mcp

# 再読み込み
source ./bin/reload-mcp

# Claude Code を再起動
./bin/claude-dev
```

---

## 関連ドキュメント

- [MCP Troubleshooting](../docs/operations/mcp-troubleshooting.md) - 詳細なデバッグガイド
- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体のドキュメント
- [.env.mcp](./.env.mcp) - 環境変数の定義（gitignored）
- [Makefile](../Makefile) - 開発タスクのショートカット

---

**最終更新**: 2025-11-25
