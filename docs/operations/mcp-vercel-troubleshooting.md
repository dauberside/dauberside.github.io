# Vercel MCP サーバーのトラブルシューティング

Vercel MCP サーバーが接続できない場合の対処方法です。

## 症状

```
vercel            ✘ failed · Enter to view details
```

## 確認手順

### 1. Vercel API トークンの確認

```bash
# トークンが正しく設定されているか確認
cat .mcp.local.json | grep VERCEL_API_TOKEN

# トークンが有効かテスト
curl -s -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v2/user
```

正常な場合、ユーザー情報が JSON で返ってきます。

### 2. MCP サーバーパッケージの確認

```bash
# MCP サーバーが正しくインストールできるか確認
npx -y @modelcontextprotocol/server-vercel --help
```

### 3. 設定ファイルの構文確認

`.mcp.local.json` の JSON 構文が正しいか確認：

```bash
# JSON 構文をチェック
cat .mcp.local.json | python3 -m json.tool > /dev/null && echo "OK" || echo "ERROR"
```

または

```bash
node -e "JSON.parse(require('fs').readFileSync('.mcp.local.json', 'utf8')); console.log('OK')"
```

### 4. Claude Code の再起動

設定を反映するため、Claude Code を再起動：

```bash
./scripts/restart-claude.sh
```

## よくある問題と解決方法

### 問題 1: トークンが無効または期限切れ

**解決方法:**
1. Vercel Dashboard → Settings → Tokens
2. 既存のトークンを削除
3. 新しいトークンを生成
4. `.mcp.local.json` を更新
5. Claude Code を再起動

### 問題 2: トークンの権限不足

**解決方法:**
1. Vercel Dashboard → Settings → Tokens
2. トークンの権限を確認
3. 必要に応じて新しいトークンを生成（適切な権限を付与）

### 問題 3: ネットワーク接続の問題

**解決方法:**
```bash
# Vercel API への接続をテスト
curl -v https://api.vercel.com/v2/user -H "Authorization: Bearer YOUR_TOKEN"
```

### 問題 4: MCP サーバーパッケージのインストール失敗

**解決方法:**
```bash
# キャッシュをクリアして再試行
npm cache clean --force
npx -y @modelcontextprotocol/server-vercel --help
```

### 問題 5: 環境変数の読み込み問題

**確認:**
`.mcp.local.json` の設定が正しいか確認：

```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

**注意:**
- トークンに余分なスペースや改行が含まれていないか確認
- トークンは完全にコピーされているか確認

## 詳細な診断

### Claude Code 内で診断を実行

```
/doctor
```

または

```
/mcp
```

エラーの詳細を確認するには、`Enter` キーを押して詳細を表示してください。

### ログの確認

Claude Code のターミナルでエラーメッセージを確認：

```
/mcp
```

その後、`Enter` キーを押して詳細なエラーメッセージを確認してください。

## 代替方法

Vercel MCP サーバーが動作しない場合、直接 Vercel API を使用できます：

```bash
# プロジェクト一覧を取得
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v9/projects

# デプロイメント一覧を取得
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.vercel.com/v6/deployments
```

## 参考リンク

- [Vercel API ドキュメント](https://vercel.com/docs/rest-api)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code MCP ドキュメント](https://docs.claude.com/en/docs/claude-code/mcp)

