# 開発環境 要件定義（Dev Environment Requirements)

最終更新: 2025-10-25

本書は当リポジトリのローカル開発・検証・運用に共通する「開発環境」の要件を定義する。実装・運用手順は operations ドキュメント（例: `docs/operations/kb-setup.md`）と併読のこと。

---

## 1. 技術スタック / 前提
- Node.js: 22.x（engines で固定）
- パッケージマネージャ: pnpm 10系
- フレームワーク: Next.js 14（pages ルータ）
- 言語: TypeScript 5.8（`tsc --noEmit` による型検証）
- UI: Tailwind CSS + Radix（`@tailwindcss/*`, `tailwindcss-animate`）
- エージェント: OpenAI Agents SDK `@openai/agents@0.1.11` + Zod
- プロセス管理: PM2（本番/常駐）
- ストレージ（最小構成）: JSON（KB インデックス `kb/index/embeddings.json`）

## 2. ポート / URL / ネットワーク
- 既定ポート: 3030 に統一
- ローカル: `http://localhost:3030`
- Tailscale（同一 tailnet 端末から）:
  - IP 直: `http://<tailnet-ip>:3030`（例: `http://100.102.85.62:3030`）
  - MagicDNS: `http://<hostname>.<tailnet>.ts.net:3030`
    - 注: `http://<ip>.ts.net:3030` の形式は無効（IP に ts.net を付ける形は不可）

## 3. 環境変数（基礎）
- `.env.local`（リポ直下）と `services/.env` を使用。読み込み順/マージは実装により `.env.local` → `services/.env`。
- 主要キー:
  - `OPENAI_API_KEY`: 必須（KB の埋め込み生成・検索時のクエリ埋め込みに使用）
  - `PORT`: 既定 3030
  - `ALLOWED_ORIGINS`: CORS 許可（例: `http://100.102.85.62:3030,http://localhost:3030`）
  - 管理保護: `ADMIN_ENABLE_PROTECTION=1`, `ADMIN_IP_ALLOWLIST`, `ADMIN_BASIC_USER`/`PASS` または `ADMIN_BASIC_USERS`
  - KB 関連: `KB_SOURCES`, `KB_INDEX_PATH`, `KB_INCLUDE_CANVAS=1`, `KB_INCLUDE_BASE=1`
  - 夜間ビルド: `KB_NIGHTLY_TIME="HH:MM"`（例: `03:30`）
  - kb-api 連携（任意）: `KB_API_URL`（例: `http://127.0.0.1:4040`）、`KB_API_PROXY=1`（未設定でも `KB_API_URL` があれば有効）

## 4. ローカル開発（Dev）
- 起動（既定ポート）: `pnpm dev`（3030）
  - 本番 PM2 が同ポートで稼働中の場合は 3030 衝突。開発では 3031 などに切替: `pnpm dev -p 3031`
- 型チェック: `pnpm typecheck`
- Lint: `pnpm lint` / `pnpm lint:next`
- テスト: `pnpm test`（Jest）
- ビルド: `pnpm build`
- 最低限の検証:
  - ルート: `/` が 200
  - KB API: `/api/kb/search?q=Hello&topK=2` が `{ hits: [...] }` を返す
  - 保護ページ: `/agent/workflow` は 401（保護有効時）

## 5. 本番/常駐（PM2）
- 設定: `services/ecosystem.config.cjs`
  - `next-app`: Next 本体を `node <repo>/node_modules/.../next start -p <PORT>` で直接起動（空白パス対策）
  - `ALLOWED_ORIGINS` 既定は `http://<tailnet-ip>:3030,http://localhost:3030` 等（MagicDNS はホスト名形式を追加）
  - ルート保護: `/agent/workflow`, `/api/agent/workflow(-proxy)` を IP アロウリスト/BASIC 認証で保護
- 代表操作（例）:
  - 初回起動: `npx pm2 start services/ecosystem.config.cjs`
  - 再起動: `npx pm2 restart next-app`
  - 反映（環境変数込み）: `npx pm2 reload next-app --update-env`
  - ログ: `npx pm2 logs next-app --lines 200`
- 注意: ビルド更新後は Next を再起動して静的アセットのズレを解消（CSS 404 防止）。

## 6. KB（ナレッジベース）
- ビルダー: `scripts/kb/build.mjs`（`pnpm -s kb:build`）
  - 既定で `docs/` の `.md/.mdx` を対象にチャンク→埋め込み→`kb/index/embeddings.json` を出力
  - Obsidian ボールト取り込み: `KB_SOURCES="docs,/Users/you/Obsidian/My Vault"`（`.obsidian/` は自動除外）
  - 任意: `KB_INCLUDE_CANVAS=1`（.canvas）/`KB_INCLUDE_BASE=1`（.base）
- 検索 API: `/api/kb/search`（GET: `?q=...&topK=5` / POST: `{ query, topK }`）
- ランタイム: 検索時も OpenAI Embeddings を1回呼ぶ（クエリエンコード）

## 7. Chat UI × KB 連携
- フロー: ユーザー送信時に KB 上位3件を検索 → `kb_snippets` としてサーバのワークフローに渡す → 応答下部に「引用（KB）」表示
- サーバ: `/api/agent/workflow-proxy` が `kb_snippets`（任意）を受け取り、会話先頭に注入
- 保護: 上記ルートは既定で保護（IP allowlist/BASIC 認証）

## 8. 夜間ビルド（Optional）
- 常駐スケジューラ: `services/kb-nightly.mjs`（PM2 アプリ `kb-nightly`）
  - 既定 03:30 に `scripts/kb/build.mjs` を実行しインデックスを更新
  - 有効化: `npx pm2 start services/ecosystem.config.cjs`（apps に `kb-nightly` 定義済）

## 9. セキュリティ要件
- 本番で mock は不可。`OPENAI_API_KEY` 未設定は 500 により誤運用を顕在化
- 保護ルートは `noindex, no-store` を徹底
- クライアントへ内部トークンを渡さず、必ずサーバプロキシ経由
- CORS は最小許可に限定（ローカル/自端末の tailnet オリジン）

### 9.1 保護ルートのアクセス整備（端末追加・資格情報）
- IP アロウリスト管理: `pnpm ops:allowlist:list|add|remove`
  - 例: `pnpm ops:allowlist:add 100.102.85.62`
  - 反映: 自動で `pm2 reload next-app --update-env` を試行（失敗してもビルドは継続）
  - 抑止: `OPS_ALLOWLIST_NO_RELOAD=1 pnpm ops:allowlist:add <ip>`
  - 対象: `services/.env` の `ADMIN_IP_ALLOWLIST` を CSV で更新
- BASIC 認証管理: `pnpm ops:basic:list|add|remove|set-single`
  - 複数: `ADMIN_BASIC_USERS="user1:pass1,user2:pass2"`
    - 例: `pnpm ops:basic:add alice s3cr3t`
  - 単一（レガシー互換）: `ADMIN_BASIC_USER`/`ADMIN_BASIC_PASS`
    - 例: `pnpm ops:basic:set-single admin P@ssw0rd`
  - 反映: 自動で `pm2 reload next-app --update-env` を試行（`OPS_BASIC_NO_RELOAD=1` で抑止）
 - 詳細: `docs/requirements/basic-auth.md`

## 10. 受け入れ基準（抜粋）
- AC-1: `pnpm typecheck` が PASS
- AC-2: `pnpm build` が PASS し、`/_next/static/css/*.css` が 200 を返す
- AC-3: `/api/kb/search` がヒットを返す（`OPENAI_API_KEY` 設定時）
- AC-4: `/agent/workflow` が保護下で 401、許可条件を満たすと 200
- AC-5: tailnet 別端末から `http://<tailnet-ip>:3030/` にアクセス可

## 11. トラブルシュート
- CSS が適用されない / 404
  - 原因: Next が古い buildId のまま稼働 → `npx pm2 restart next-app`
  - 補助: ビルド後に `npx pm2 reload next-app` をルーチン化
- 3030 ポート衝突
  - Dev/Prod の同時起動 → Dev を 3031 に、または PM2 を一時停止
- `/agent/*` が 401
  - `ADMIN_IP_ALLOWLIST` に自端末の Tailscale IP を追加 or BASIC 認証で入る
- `/api/kb/search` が `missing OPENAI_API_KEY`
  - `.env.local` / `services/.env` のキー設定と PM2 の `--update-env` 反映を確認

## 12. デプロイ後の自動 reload（postbuild 連携）
- 本リポの `scripts/postbuild.mjs` はビルド後にベストエフォートで `pm2 reload next-app --update-env` を試行し、静的アセットのズレを解消します。
- 失敗してもビルドを失敗させません（PM2 非導入環境でも無害）。
- 無効化したい場合は環境変数 `POSTBUILD_PM2_RELOAD=0` を設定してください（CI/ローカルの任意タイミングでの制御に利用）。

### 12.1 CSS ミラー（非推奨・既定無効）
- 旧ワークアラウンドとして `.next/static/css` を `public/_next/static/css` にコピーする処理が存在しますが、Next の buildId と競合し 404/キャッシュ不整合を招くため、既定で無効化しています。
- 有効化する場合は `POSTBUILD_COPY_CSS=1` を明示設定してください（レガシー環境でのみ）。
- 原則として CSS ミラーは使用せず、ビルド後の PM2 reload により最新アセットを配信する運用を推奨します。

---
関連: 
- `docs/operations/kb-setup.md`
- `docs/requirements/services.md`
- `docs/requirements/basic-auth.md`
- `services/ecosystem.config.cjs`
- `src/middleware.ts`

## 13. ローカル開発端末（スナップショット）

- 取得日: 2025-10-25
- OS: macOS 15.6.1 (24G90)
- ハードウェア:
  - Model Name: Mac mini
  - Model Identifier: Mac14,12
  - Chip: Apple M2 Pro
  - Total Cores: 10（パフォーマンス6 + 省電力4）
  - Memory: 16 GB
- アーキテクチャ: arm64
- ディスク: 460Gi total, 339Gi free (4% used)
- ローカルツールチェーン:
  - Node.js: v22.17.1
  - pnpm: 9.15.9

注記:
- 本節は現行開発者端末の参考情報であり、要件の最小値ではない（動作の再現性やパフォーマンス評価の補助目的）。
- セキュリティの観点から、シリアル番号や UUID など固有識別子は記載しない。
