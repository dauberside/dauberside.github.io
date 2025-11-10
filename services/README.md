# services/ （常駐プロセス用スケルトン）

このフォルダは、Next.js アプリ本体（リポ直下）とは分離して、常駐系のサービス（例: KB API、MCPサーバ）を運用するための置き場です。

- 例: `kb-api/`（将来のRAG用API）, `mcp/`（MCPサーバ）
- プロセス管理: PM2 または LaunchAgent（macOS）
- ネットワーク: Tailscale（ゼロトラストVPN）で tailnet 内からのみアクセス

> 注意: このリポは外付けSSD（パスに空白を含む）上にあるため、パスは常にクォートされる前提で設定してください。PM2 の `ecosystem.config.cjs` は相対解決にしてあり、空白を意識せず使えます。

## 構成
```
services/
  ├─ ecosystem.config.cjs   # PM2設定（本体Nextアプリを常駐）
  ├─ .env.example           # サービス用の環境変数サンプル
  ├─ .gitignore             # ローカル環境ファイル等を除外
  ├─ kb-api/                # 将来的なKB専用API（任意）
  │   ├─ README.md
  │   └─ .env.example
  └─ mcp/                   # 将来的なMCPサーバ（任意）
      ├─ README.md
      └─ .env.example
```

## 使い方（PM2）
1) 本番ビルド（リポ直下）
   - `pnpm build`
2) PM2で起動（services/ 内で）
   - `pm2 start ecosystem.config.cjs`
   - `pm2 save`
   - （任意）`pm2 startup` で再起動時の自動起動設定

ポートは `3030`（必要に応じ `ecosystem.config.cjs` を編集）。

要件定義: docs/requirements/services.md を参照（PORT=3030 統一、保護/CORS、環境変数、受け入れ基準など）。

## Tailscale（推奨）
- mac に Tailscale を導入 → tailnet 内端末から `http://<macのtailnet名>:3030` でアクセス
- 公開インターネットには露出しない。代替として Cloudflare Tunnel/Access も可

## KB/MCP の追加方法（雛形）
- `kb-api/` や `mcp/` にサーバ実装（`server.mjs` など）を配置
- `ecosystem.config.cjs` の apps に定義を追加 → `pm2 reload ecosystem.config.cjs`

---
トラブルシュート:
- 外付けSSDが外れるとプロセスは落ちます。スリープ抑止と自動マウントを推奨
- パスに空白があるため、手動コマンド時はクォート必須（PM2設定は相対パス解決済み）
