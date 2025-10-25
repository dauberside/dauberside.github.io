# Services 要件定義（services/）

最終更新: 2025-10-25

本書は `services/` 配下の常駐運用（PM2 管理）に関する要件と設計方針を定義する。初期対象は Next.js 本体の常駐（`next-app`）であり、将来的に `kb-api/` や `mcp/` を追加できる。

## スコープ
- 対象: `services/` ディレクトリ、`ecosystem.config.cjs`、常駐させる各サービス
- 初期構成: Next.js 本体を PM2 で常駐（1インスタンス, fork モード）
- 将来構成: `kb-api/`, `mcp/` を apps に追加

## 主要決定（Decision）
- ポートは 3030 を既定値とする（競合回避のため）。
- 起動は pnpm PATH に依存しない「node 直接起動 + 配列引数」に統一する。
  - 目的: 外付け SSD のパスに空白が含まれても確実に起動できるようにする。
  - 実体: `node <repo>/node_modules/next/dist/bin/next start -p 3030`
- 保護は既定で有効（`ADMIN_ENABLE_PROTECTION=1`）。
  - IP アロウリスト（`ADMIN_IP_ALLOWLIST`）で tailnet からのアクセスを許可。
  - Basic 認証（`ADMIN_BASIC_USERS="user:pass,..."`）も併用可能。
- CORS は 3030 を反映し、VPN 直アクセス/ローカルの双方を許容。
  - `ALLOWED_ORIGINS="http://<tailnet-ip>:3030,http://localhost:3030,http://127.0.0.1:3030"`
- 保護ルートは常に noindex + no-store（インデックス抑止・キャッシュ禁止）。
- ドキュメントと実装の一貫性: `services/README.md` と本要件を参照基準とする。

## 機能要件（Functional Requirements）
1) Next 常駐
- FR-1: PM2 で Next を production ビルドから起動できること（`next start -p 3030`）。
- FR-2: PORT は `.env` または PM2 env で上書き可能だが、デフォルトは 3030。
- FR-3: 空白を含むパス環境でも起動に失敗しないこと。

2) ルート保護
- FR-4: `/agent/workflow`, `/api/agent/workflow`, `/api/agent/workflow-proxy` は保護対象。
- FR-5: `ADMIN_IP_ALLOWLIST` に含まれるクライアントは 401 なしでアクセス可。
- FR-6: Basic 認証を設定した場合、正しい資格情報で 200、誤りで 401。
- FR-7: 保護レスポンス/通過レスポンスの双方で `X-Robots-Tag: noindex, nofollow, noarchive` と `Cache-Control: no-store` を適用。

3) CORS
- FR-8: `ALLOWED_ORIGINS` に一致する Origin からのリクエストに CORS ヘッダを付与。
- FR-9: `OPTIONS` プリフライトに 204 を返し、`Access-Control-*` を適切に付与。
- FR-10: 開発時は `http://localhost:3030` と `http://127.0.0.1:3030` を既定許可。

4) オブザーバビリティ/運用
- FR-11: `pm2 logs next-app` で標準出力/エラーが確認できること。
- FR-12: `pm2 describe next-app` で `args: ... -p 3030` が確認できること。
- FR-13: 再起動は `pm2 restart next-app` で無停止切替（フォークモード）であること。

## 非機能要件（NFR）
- NFR-1: セキュリティ: tailnet もしくは Basic 認証で制限。保護ルートは noindex + no-store。
- NFR-2: 信頼性: PM2 の `autorestart: true` と `max_memory_restart: 512M` を設定。
- NFR-3: 可観測性: PM2 ログと `pm2 monit` 等で監視可能。
- NFR-4: メンテナンス性: 起動方式は node 直叩き＆配列引数でシンプルに保つ。

## 環境変数（Env）
- `PORT`（既定 3030）
- `ADMIN_ENABLE_PROTECTION`（`1` で有効）
- `ADMIN_IP_ALLOWLIST`（例: `100.102.85.62`）
- `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS` または `ADMIN_BASIC_USERS="user1:pass1,user2:pass2"`
- `ALLOWED_ORIGINS`（例: `http://100.102.85.62:3030,http://localhost:3030`）
- `OPENAI_API_KEY`（アプリ機能に必要）
 - （KB API 用）`KB_API_PORT`（既定 4040）, `KB_INDEX_PATH`
 - （MCP 用）`MCP_PORT`（既定 5050）
 - （Next→kb-api プロキシ）`KB_API_URL`（例: `http://127.0.0.1:4040`）, `KB_API_PROXY=1`

## 受け入れ基準（Acceptance Criteria）
- AC-1: `pm2 describe next-app` に `... next start -p 3030` が表示される。
- AC-2: `http://<tailnet-ip>:3030/` でアプリが表示される。
- AC-3: `http://<tailnet-ip>:3030/agent/workflow` にアロウリスト IP からは 200、非許可 IP からは 401。
- AC-4: `OPTIONS` プリフライトに 204 が返り、許可 Origin には CORS ヘッダが付与される。
- AC-5: ログに `Ready` が出力され、パスに空白が含まれる環境でも起動が安定する。

## 既知リスクと対処
- R-1: パスに空白 → node 直接起動 + 配列引数で回避。
- R-2: 3000 と 3030 の混在 → `package.json` と `middleware.ts`, ドキュメントを 3030 に統一。
- R-3: ポート競合 → `PORT` で回避・変更し、PM2 再起動で反映。
- R-4: ビルド不足 → `pnpm build` 必須（production 起動）。

## 運用手順（抜粋）
- ビルド: `pnpm build`
- 起動: `pm2 start services/ecosystem.config.cjs`
- 再起動: `pm2 restart next-app`
- 永続化: `pm2 save` / 自動起動: `pm2 startup`
- ログ: `pm2 logs next-app --lines 200`

### 保護ルートの即時運用（Ops スクリプト）
- IP 許可管理: `pnpm ops:allowlist:list|add|remove`
  - 例: `pnpm ops:allowlist:add 100.102.85.62`
- BASIC 認証管理: `pnpm ops:basic:list|add|remove|set-single`
  - 例: `pnpm ops:basic:add alice s3cr3t`
- これらは `services/.env` を更新後に `pm2 reload next-app --update-env` を自動試行（失敗時は警告のみ）

### 追加サービス（将来/任意）
- KB API: `npx pm2 start services/ecosystem.config.cjs --only kb-api`
  - 確認: `curl -sS http://localhost:${KB_API_PORT:-4040}/healthz`
- MCP Server: `npx pm2 start services/ecosystem.config.cjs --only mcp-server`
  - 確認: `curl -sS http://localhost:${MCP_PORT:-5050}/healthz`

---
関連:
- `services/README.md`
- `services/ecosystem.config.cjs`
- `src/middleware.ts`（保護/CORS 実装）
- `docs/requirements/dev-environment.md`（開発環境の前提・運用と連携）
- `docs/requirements/basic-auth.md`（BASIC 認証ユーザーの要件）
