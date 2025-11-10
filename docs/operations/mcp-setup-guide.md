# MCP サーバーセットアップガイド

このプロジェクト向けの MCP サーバーセットアップ手順です。

## 推奨される MCP サーバー

### 1. GitHub MCP サーバー（最優先）

**用途**: 課題追跡、PR管理、コードレビュー

**セットアップ手順**:

1. **GitHub Personal Access Token を取得**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 「Generate new token (classic)」を選択（**Fine-grained ではなく Classic を選んでください**）
   - 必要な権限（Scopes）を選択:
     - ✅ `repo` - リポジトリへのフルアクセス（issues、PR、コードの読み取り）
     - ✅ `read:org` - 組織情報の読み取り（オプション、組織に所属している場合）
     - ✅ `read:user` - ユーザー情報の読み取り
   - Note（メモ）: 任意で「Claude Code MCP」などと記入
   - 有効期限: 必要に応じて設定（推奨: 90日または1年）
   - 「Generate token」をクリック
   - **重要**: トークンは一度だけ表示されます。必ずコピーして安全な場所に保存してください

2. **`.mcp.local.json` に設定を追加**
   ```json
   {
     "mcpServers": {
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
         }
       }
     }
   }
   ```

3. **Claude Code を再起動**

4. **動作確認**
   - Claude Code 内で `/mcp` コマンドを実行
   - GitHub サーバーが表示されることを確認

### 2. Vercel MCP サーバー

**用途**: デプロイメント管理、環境変数管理

**セットアップ手順**:

1. **Vercel API Token を取得**
   - [Vercel Dashboard](https://vercel.com/dashboard) にログイン
   - 右上のプロフィールアイコンをクリック → 「Settings」を選択
   - 左側のメニューから「**Tokens**」を選択
   - 「**Create Token**」ボタンをクリック
   - トークン名を入力（例: 「Claude Code MCP」）
   - 有効期限を設定（推奨: 90日または1年、または「Never expire」）
   - 権限スコープ: 通常はデフォルトの権限で問題ありません
   - 「**Create**」ボタンをクリック
   - **重要**: トークンは一度だけ表示されます。必ずコピーして安全な場所に保存してください

2. **`.mcp.local.json` に設定を追加**
   ```json
   {
     "mcpServers": {
       "vercel": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-vercel"],
         "env": {
           "VERCEL_API_TOKEN": "your_vercel_token_here"
         }
       }
     }
   }
   ```

### 3. Postgres MCP サーバー（オプション）

**用途**: データベースクエリ（Supabase 使用時）

**セットアップ手順**:

1. **Supabase 接続文字列を取得**
   - Supabase Dashboard → Settings → Database → Connection string
   - または `.env.local` の `DATABASE_URL` を参照

2. **`.mcp.local.json` に設定を追加**
   ```json
   {
     "mcpServers": {
       "postgres": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-postgres"],
         "env": {
           "POSTGRES_CONNECTION_STRING": "postgresql://user:password@host:port/dbname"
         }
       }
     }
   }
   ```

## 設定ファイルの構造

### `.mcp.json`（チーム共有）
- プロジェクト全体で使用する設定
- バージョン管理に含める
- API キーは含めない（プレースホルダーのみ）

### `.mcp.local.json`（個人設定）
- 個人の API キーやトークンを保存
- `.gitignore` に含まれる（コミットしない）
- 実際の認証情報を記述

## 使用方法

### Claude Code 内での使用

1. **@ メンションで参照**
   ```
   @github このリポジトリの open issues を表示して
   @vercel 最新のデプロイメント状況を確認して
   ```

2. **カスタムスラッシュコマンド**
   - `/mcp` - MCP サーバーの一覧表示
   - `/mcp enable github` - GitHub サーバーを有効化
   - `/mcp disable github` - GitHub サーバーを無効化

### プロンプトでの使用例

```
GitHub の issue #123 の内容を確認して、関連する PR を探してください。
@github
```

```
Vercel の最新デプロイメントのログを確認してください。
@vercel
```

## トラブルシュート

### MCP サーバーが起動しない
- 設定ファイルの JSON 構文を確認
- API トークンが正しく設定されているか確認
- Claude Code を再起動

### 認証エラー
- API トークンの権限を確認
- トークンの有効期限を確認
- 環境変数が正しく読み込まれているか確認

### サーバーが見つからない
- `npx` が正しくインストールされているか確認
- ネットワーク接続を確認
- `/doctor` コマンドで診断を実行

## セキュリティ注意事項

- **`.mcp.local.json` は絶対にコミットしない**
- API トークンは定期的にローテーション
- 最小限の権限でトークンを発行
- チーム共有設定（`.mcp.json`）には API キーを含めない

## 参考リンク

- [Claude Code MCP ドキュメント](https://docs.claude.com/en/docs/claude-code/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [Vercel MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/vercel)

