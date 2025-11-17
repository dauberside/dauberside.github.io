# MCP .json 設定ファイルの利用方法

Claude Code では、MCP サーバーを `.json` ファイルで設定できます。3つの設定スコープがあります。

## 設定スコープ

### 1. Local (`.mcp.local.json`)
- **用途**: プライベート、プロジェクト固有の設定
- **バージョン管理**: `.gitignore` に含まれる（コミットしない）
- **使用例**: 個人の API キー、ローカル開発環境の設定

### 2. Project (`.mcp.json`)
- **用途**: チーム共有の設定
- **バージョン管理**: バージョン管理に含める（コミットする）
- **使用例**: チーム全体で使用する MCP サーバーの設定

### 3. User (グローバル)
- **用途**: すべてのプロジェクトで使用するグローバルな個人ユーティリティ
- **場所**: Claude Desktop の設定ファイル内
- **使用例**: 個人の開発ツール、全プロジェクト共通の設定

## 設定ファイルの作成

### プロジェクト共有設定 (`.mcp.json`)

チーム全体で使用する MCP サーバーを設定します。例として `.mcp.json.example` を参照してください。

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/dbname"
      }
    }
  }
}
```

### ローカル設定 (`.mcp.local.json`)

個人の API キーやローカル開発環境の設定を保存します。例として `.mcp.local.json.example` を参照してください。

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "OBSIDIAN_HOST",
        "-e", "OBSIDIAN_PORT",
        "-e", "OBSIDIAN_API_KEY",
        "mcp/obsidian"
      ],
      "env": {
        "OBSIDIAN_HOST": "host.docker.internal",
        "OBSIDIAN_PORT": "8443",
        "OBSIDIAN_API_KEY": "your-obsidian-api-key-here"
      }
    },
    "local-kb": {
      "command": "node",
      "args": ["./services/mcp/server.mjs"],
      "env": {
        "PORT": "5050",
        "KB_API_URL": "http://127.0.0.1:4040",
        "KB_API_TOKEN": "your-kb-api-token-here"
      }
    }
  }
}
```

## 設定手順

1. **例ファイルをコピー**
   ```bash
   cp .mcp.json.example .mcp.json
   cp .mcp.local.json.example .mcp.local.json
   ```

2. **API キーやトークンを設定**
   - `.mcp.json` にはチーム共有の設定を記述
   - `.mcp.local.json` には個人の API キーを記述

3. **Claude Code を再起動**
   - 設定ファイルの変更を反映するため、Claude Code を再起動してください

4. **設定の確認**
   ```bash
   claude mcp
   ```
   または Claude Code 内で `/mcp` コマンドを実行

## このプロジェクト向けの推奨設定

### 開発ツール
- `@modelcontextprotocol/server-github` - GitHub issues/PRs 統合
- `@modelcontextprotocol/server-postgres` - データベースクエリ

### インフラストラクチャ
- `@modelcontextprotocol/server-vercel` - Vercel デプロイメント管理
- `@modelcontextprotocol/server-sentry` - エラートラッキング

### ローカル開発
- Obsidian MCP（Docker） - Obsidian ボールトへのアクセス
- ローカル KB API - プロジェクト内のナレッジベース検索

## セキュリティ注意事項

- **`.mcp.local.json` は絶対にコミットしないでください**
  - `.gitignore` に含まれていますが、確認してください
- **API キーやトークンは環境変数から読み込むことを推奨**
  - 設定ファイルに直接記述する場合は、`.mcp.local.json` を使用
- **サードパーティの MCP サーバーは自己責任で使用**
  - Anthropic がすべてのサーバーを検証しているわけではありません

## トラブルシュート

### 設定が反映されない
- Claude Code を再起動してください
- 設定ファイルの JSON 構文を確認してください

### MCP サーバーが起動しない
- `claude mcp` コマンドで設定を確認
- `/doctor` コマンドで診断を実行

### 認証エラー
- API キーやトークンが正しく設定されているか確認
- 環境変数が正しく読み込まれているか確認

## 参考リンク

- [Claude Code MCP ドキュメント](https://docs.claude.com/en/docs/claude-code/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)

