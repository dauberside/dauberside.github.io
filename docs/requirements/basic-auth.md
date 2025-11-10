# 保護ルート用 BASIC 認証 要件定義

最終更新: 2025-10-25

本書は、保護ルート（/agent/* および /api/agent/*）へアクセスするための BASIC 認証ユーザー管理と運用の要件を定義する。実装は Next.js の middleware により行い、IP アロウリストとの併用を前提とする。

---

## 1. スコープ/目的
- スコープ: 保護対象の HTTP ルートに対する BASIC 認証（ユーザー/パスワード）と IP アロウリストの併用運用
- 目的: tailnet 外や IP 不安定な端末でも必要最小限で安全にアクセス可能にする（ただし恒久運用は IP 許可を推奨）

## 2. 保護対象ルート
- `/agent/workflow`
- `/api/agent/workflow`
- `/api/agent/workflow-proxy`

備考: 上記は middleware で `noindex` + `no-store` を常時付与する。

## 3. 認可ロジック（要件）
- R-1: `ADMIN_ENABLE_PROTECTION=1` のときのみ保護を有効化。
- R-2: クライアントは以下のいずれかを満たせば通過（OR 条件）。
  - (a) クライアント IP が `ADMIN_IP_ALLOWLIST` に含まれる
  - (b) BASIC 認証で正しい資格情報を提示する
- R-3: 認証失敗は `401 Unauthorized` を返し、`WWW-Authenticate: Basic realm="admin"` を付与。
- R-4: 保護レスポンス/通過レスポンスとも `X-Robots-Tag: noindex, nofollow, noarchive` と `Cache-Control: no-store` を付与。

## 4. 環境変数
- `ADMIN_ENABLE_PROTECTION`: `1` で保護有効（既定で有効）
- `ADMIN_IP_ALLOWLIST`: CSV（例: `100.102.85.62,host.tailnet.ts.net`）
- BASIC（複数ユーザー）:
  - `ADMIN_BASIC_USERS`: `user1:pass1,user2:pass2`
- BASIC（単一ユーザー／レガシー互換）:
  - `ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS`

補足: これらは PM2 管理の `next-app` に環境変数として注入される（`services/ecosystem.config.cjs`）。

## 5. 運用フロー（Ops）
- IP 許可（推奨、恒久）
  - 追加: `pnpm ops:allowlist:add <ip-or-host>`
  - 削除: `pnpm ops:allowlist:remove <ip-or-host>`
  - 確認: `pnpm ops:allowlist:list`
- BASIC 認証（短期/バックアップ）
  - 複数: `pnpm ops:basic:add <user> <pass>` / `pnpm ops:basic:remove <user>` / `pnpm ops:basic:list`
  - 単一: `pnpm ops:basic:set-single <user> <pass>`
- 反映: 上記スクリプトは `pm2 reload next-app --update-env` をベストエフォートで実行（失敗時は警告のみ）。
- 抑止: `OPS_ALLOWLIST_NO_RELOAD=1` / `OPS_BASIC_NO_RELOAD=1` で PM2 リロードを抑止可。

## 6. クライアントからの利用方法
- ブラウザ: 認証ダイアログに `user`/`pass` を入力。
- API クライアント（例: curl）:
  - `curl -u user:pass https://host:3030/agent/workflow`
  - または `Authorization: Basic <base64(user:pass)>`

## 7. セキュリティ要件
- S-1: パスワードは十分な強度（長さ/複雑性）を満たすこと。
- S-2: 永続運用は IP 許可を優先し、BASIC は短期利用・緊急迂回に限定。
- S-3: 資格情報はリポジトリにコミットしない。`services/.env`（.gitignore 対象）で管理。
- S-4: 共有は必要最小限。不要になった資格情報は即時 `remove` で撤回。
- S-5: ログにはパスワードを出力しない（ops スクリプトはユーザー名のみ表示）。

## 8. 受け入れ基準（Definition of Done）
- AC-1: `ADMIN_ENABLE_PROTECTION=1` で保護対象に未認証アクセス→ 401。
- AC-2: 正しい BASIC 認証で 200 を返す（IP 非許可でも通過）。
- AC-3: IP 許可があるとき BASIC なしで 200 を返す。
- AC-4: いずれのケースも `noindex` + `no-store` ヘッダが付与される。

## 9. テスト/検証の例
- 401 確認（未認証）:
  - `curl -i https://<tailnet-ip>:3030/agent/workflow | head -n 1` → `HTTP/1.1 401 Unauthorized`
- BASIC 認証で 200:
  - `curl -i -u alice:s3cr3t https://<tailnet-ip>:3030/agent/workflow | head -n 1` → `HTTP/1.1 200 OK`
- CORS プリフライト（許可オリジン）:
  - `curl -i -X OPTIONS -H 'Origin: http://100.102.85.62:3030' https://<tailnet-ip>:3030/api/agent/workflow-proxy`

## 10. 実装リファレンス
- ミドルウェア: `src/middleware.ts`
- PM2 設定: `services/ecosystem.config.cjs`
- Ops スクリプト:
  - `scripts/ops/allowlist.mjs`
  - `scripts/ops/admin-basic.mjs`
- ドキュメント:
  - `docs/requirements/dev-environment.md`（9.1, 12）
  - `docs/requirements/services.md`

## 11. 既知のリスク/制約
- R-1: BASIC は平文パスワードのやり取りが発生（TLS 前提で運用）。
- R-2: ブラウザキャッシュに資格情報が残る場合があるため共有端末は非推奨。
- R-3: 高頻度アクセスや攻撃対策のレート制限は現状未実装（必要時は追加検討）。

## 12. 運用ガイド（推奨）
- 短期利用: ユーザー追加→利用→不要になれば即 `remove`。
- 恒久対応: IP 許可へ移行し、BASIC を空に。
- 定期棚卸し: `pnpm ops:basic:list` と `pnpm ops:allowlist:list` を月次確認。
