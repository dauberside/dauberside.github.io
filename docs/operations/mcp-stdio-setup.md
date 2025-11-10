# MCP stdio Bridge Setup Guide

Claude Desktop 用の MCP stdio ブリッジの設定方法を説明します。

## 概要

Claude Desktop は MCP サーバーと stdio（標準入出力）経由で通信します。このブリッジは以下の役割を果たします：

1. Claude Desktop から JSON-RPC リクエストを受信（stdin）
2. Next.js API または Obsidian API に HTTP リクエストを転送
3. レスポンスを JSON-RPC 形式で返却（stdout）

## 前提条件

- Node.js 22+ がインストールされていること
- Next.js 開発サーバーが起動していること（`pnpm dev -p 3001`）
- Obsidian Local REST API が起動していること（ポート 8445）

## 設定手順

### 1. Claude Desktop の設定ファイルを編集

**macOS の場合**：
```bash
# Claude Desktop の設定ファイルを開く
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**設定内容**：
```json
{
  "mcpServers": {
    "dauberside": {
      "command": "node",
      "args": ["/Volumes/Extreme Pro/dauberside.github.io-1/services/mcp/stdio-bridge.mjs"],
      "env": {
        "NEXT_API_URL": "http://localhost:3001",
        "OBSIDIAN_API_URL": "https://127.0.0.1:8445",
        "OBSIDIAN_API_KEY": "270cc55355f7e4747e643100df3f121cf1360d8c191c92d5765f24962db88e66",
        "INTERNAL_API_TOKEN": "77dfaeac7af352007c6b2acad3d8d7395eb309ace9a6c102479fd690a6594fe5"
      }
    }
  }
}
```

**重要**：
- `args` のパスは**絶対パス**で指定してください
- `OBSIDIAN_API_KEY` と `INTERNAL_API_TOKEN` は `.env.local` から取得してください

### 2. Claude Desktop を再起動

設定を反映するために Claude Desktop を完全に再起動します：

```bash
# macOS の場合
killall Claude
open -a Claude
```

### 3. 動作確認

Claude Desktop で新しい会話を開始し、以下のように MCP ツールが利用可能か確認します：

```
You: MCPツールが使えますか？
Claude: はい、以下のツールが利用可能です：
- kb_search: ナレッジベース検索
- obsidian_get: Obsidian ファイル取得
- obsidian_search: Obsidian 検索
```

## 利用可能なツール

### kb_search

KB（ナレッジベース）から関連ドキュメントを検索します。

**パラメータ**：
- `query` (string, 必須): 検索クエリ
- `topK` (number, 任意): 返却する結果数（デフォルト: 5）

**例**：
```
You: MCP の設定方法を KB から検索して
Claude: (kb_search ツールを使用)
```

### obsidian_get

Obsidian Vault 内のファイル内容を取得します。

**パラメータ**：
- `path` (string, 必須): Vault ルートからの相対パス

**例**：
```
You: Dauber/DauberCanvas.canvas の内容を表示して
Claude: (obsidian_get ツールを使用)
```

### obsidian_search

Obsidian Vault 内を全文検索します。

**パラメータ**：
- `query` (string, 必須): 検索クエリ
- `contextLength` (number, 任意): マッチ前後のコンテキスト文字数（デフォルト: 100）

**例**：
```
You: Obsidian Vault 内で "MCP" を検索して
Claude: (obsidian_search ツールを使用)
```

## トラブルシューティング

### エラー: "KB search failed: 404"

**原因**: Next.js 開発サーバーが起動していない

**解決方法**:
```bash
cd "/Volumes/Extreme Pro/dauberside.github.io-1"
pnpm dev -p 3001
```

### エラー: "Obsidian get failed: 401"

**原因**: `OBSIDIAN_API_KEY` が間違っている

**解決方法**:
1. `.env.local` から正しい API キーを確認
2. Claude Desktop の設定ファイルを更新
3. Claude Desktop を再起動

### エラー: "Obsidian get failed: Network unreachable"

**原因**: Obsidian Local REST API が起動していない

**解決方法**:
1. Obsidian を起動
2. Local REST API プラグインが有効になっているか確認
3. 以下のコマンドで疎通確認:
   ```bash
   curl -k -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:8445/
   ```

### デバッグログの確認

stdio ブリッジのログは stderr に出力されます。Claude Desktop のログで確認できます：

**macOS**:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

## セキュリティ注意事項

1. **API キーの管理**: 設定ファイルには機密情報が含まれます。Git にコミットしないでください。
2. **自己署名証明書**: Obsidian Local REST API は自己署名証明書を使用します。本番環境では適切な証明書を使用してください。
3. **ローカルのみ**: このブリッジはローカル開発用です。外部からのアクセスは想定していません。

## 参考リンク

- [MCP Protocol Specification](https://modelcontextprotocol.io/docs/specification)
- [Obsidian Local REST API Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Claude Desktop MCP Configuration](https://docs.anthropic.com/claude/docs/mcp-servers)
