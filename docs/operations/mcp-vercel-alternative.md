# Vercel MCP サーバーの代替方法

## 問題

`@modelcontextprotocol/server-vercel` パッケージが存在しないため、Vercel MCP サーバーが使用できません。

## 代替方法

### 方法 1: Vercel CLI を使用（推奨）

Vercel CLI をインストールして使用：

```bash
# Vercel CLI をインストール
npm i -g vercel

# 認証
vercel login

# プロジェクト一覧を取得
vercel projects list

# デプロイメント一覧を取得
vercel deployments list
```

### 方法 2: Vercel API を直接使用

Vercel API を直接呼び出して情報を取得：

```bash
# プロジェクト一覧
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v9/projects

# デプロイメント一覧
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v6/deployments

# 特定のプロジェクトのデプロイメント
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v6/deployments?projectId=YOUR_PROJECT_ID
```

### 方法 3: カスタム MCP サーバーを作成

Vercel API をラップするカスタム MCP サーバーを作成できます。

## 現在の設定

Vercel MCP サーバーの設定は `.mcp.local.json` と `.mcp.json` から削除しました。

## 今後の対応

Vercel MCP サーバーが公式にリリースされたら、再度設定を追加できます。

## 参考リンク

- [Vercel API ドキュメント](https://vercel.com/docs/rest-api)
- [Vercel CLI ドキュメント](https://vercel.com/docs/cli)

