# タスク要件定義（Tasks Requirements)

最終更新: 2025-10-25

本書はエンジニアリング作業単位（タスク）の定義、粒度、品質基準、運用フローを定める。既存ドキュメント（`docs/memory/context-capsule.md`, `docs/operations/context-engineering-vscode.md`）と併読し、一貫性を保つこと。

---

## 1. スコープ/目的
- スコープ: 機能追加（feature）、バグ修正（fix/bug）、整備（chore）、運用（ops）、ドキュメント（docs）を含む開発タスク
- 目的: タスク定義を共通化し、実装品質（型/テスト/ビルド/セキュリティ）を自動検証まで一気通貫にする

## 2. タスクの最小要件（Definition of Ready）
各タスクは以下を満たすこと。
- Goal: 1行で「何を達成するか」
- Deliverables: どのファイルをどう変えるか（具体的な編集対象/新規作成）
- Acceptance Criteria（受け入れ基準）:
  - Typecheck/Lint/Test/Build/Smoke の合否条件
  - ユーザ観点の確認手順（URL/エンドポイント/期待レスポンス）
- Constraints/Dependencies: 前提、依存、外部影響（PORT/CORS/環境変数、VPN/PM2 など）
- Risk/Rollback: 想定失敗と戻し方（最小限で可）
- Size: S/M/L（半日/1日/複数日の目安）
- Links: 関連ADR/要件/テンプレート（例: `docs/requirements/dev-environment.md`、`templates/tasks-template.md`）

テンプレート（推奨）: `templates/tasks-template.md`

## 3. 実装フロー（標準）
1) 設計/確認
   - 影響範囲を洗い出し、関連ドキュメント（要件/ADR/カプセル）を更新
2) 実装
   - 変更は最小差分を徹底（既存スタイル/公開APIを尊重）
   - セキュリティ・副作用に留意（キー露出禁止、CORS/保護ルート維持）
3) 検証（Quality Gates）
   - Typecheck: `pnpm typecheck`
   - Lint: `pnpm lint`（必要に応じて `pnpm lint:next`）
   - Unit Test: `pnpm test`
   - Build: `pnpm build`
   - Smoke（必要に応じて）: 代表URL/APIを `curl` 等でヘルス確認
4) 反映/運用
   - PM2 管理下の変更は `npx pm2 reload next-app --update-env`
   - ログ確認: `npx pm2 logs next-app --lines 200`

参考: `docs/operations/context-engineering-vscode.md`, `docs/requirements/dev-environment.md`

## 4. 命名/ブランチ/コミット
- ブランチ: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`
- コミット: 簡潔な命題 + 影響範囲（例: `chore(pm2): add nightly kb scheduler`）
- PR: タスクの Goal/Deliverables/Acceptance をそのまま記載（差分スクリーンショット/ログがあれば添付）

## 5. 受け入れ基準（Definition of Done）
- DoD-1: Typecheck/Lint/Test/Build が PASS
- DoD-2: 主要画面/API の Smoke が PASS（対象がある場合）
- DoD-3: 変更に伴うドキュメント更新が完了（要件/ADR/README/運用手順）
- DoD-4: セキュアな運用前提が崩れていない（キー非露出、保護ルート/ CORS ルール維持）
- DoD-5: 影響範囲のリスクとロールバック方針が明記

## 6. 代表的なタスク種別と追加要件
- Feature（機能追加）
  - UI: デザイン崩れ防止（既存配色/余計な固定色の排除）
  - サーバ: Zod で入力検証、エラーはJSONで一貫
- Fix（不具合修正）
  - 再発防止の最小テストを1つ追加（回帰テスト）
- Chore（整備/運用）
  - PM2/CI/ビルド/スクリプト整備は安全側で漸進
- Ops（運用）
  - PORT/CORS/保護/IP許可の整合性確認（VPN/Tailscale 前提）

## 7. トリアージ/優先度の目安
- P0: セキュリティ/可用性に直結（例: キー注入不具合、PM2 停止、保護ルートの迂回）
- P1: UX/機能の根幹（例: CSS 404、主要ページが崩れる、新規/更新不可）
- P2: 改善・自動化（例: kb-nightly、logrotate、デプロイ後の自動 reload）
- P3: 先行投資（例: mcp や独立 API の足場）

## 8. 添付/テンプレート
- タスク雛形: `templates/tasks-template.md`
- 計画雛形: `templates/plan-template.md`
- スペック雛形（必要なら）: `templates/spec-template.md`

## 9. 参考/関連
- `docs/memory/context-capsule.md`（携行用コンテキスト）
- `docs/operations/context-engineering-vscode.md`（進め方/品質ゲート）
- `docs/requirements/dev-environment.md`（開発基盤/ポート/PM2/KB）
- `docs/requirements/services.md`（常駐運用/セキュリティポリシー）


## 10. タスクリスト（運用優先・現状）

本節は直近の優先タスクを運用観点で整理する。各項目は本書の「Definition of Ready/Done」に従う。

### 10.0 今すぐ対処（P0）
- kb-nightly の復旧（errored→online）
  - Goal: 夜間 03:30 の KB 自動再構築を確実化（現在 PM2 状態が errored のため復旧）
  - Deliverables:
    - PM2 ログで原因特定（`npx pm2 logs kb-nightly`）
    - スクリプト/パス/権限/環境変数の修正（必要時）
    - 手動起動での成功確認 → PM2 で online 化 → `npx pm2 save`
  - Acceptance:
    - `pm2 status` で `kb-nightly` が `online`
    - 翌スケジュールでの KB 更新がログで確認できる
  - Constraints/Dependencies: `services/kb-nightly.mjs` の参照パス、`KB_INDEX_PATH`、VPN/PM2 環境
  - Risk/Rollback: 失敗時は `pm2 stop kb-nightly` で影響遮断 → 原因切り分け後に再開
  - Size: S
  - Status: online（`pm2 status` 確認済み）。`[kb-nightly] next run at ...` ログ出力を確認。`pm2 save` 済み。

### 10.1 今すぐやる（P2/ops）
- [DONE] kb-nightly を PM2 で常駐起動
  - Goal: 夜間 03:30 に KB インデックスを自動再構築
  - Deliverables: `services/ecosystem.config.cjs`（空白パス対応の引数配列化）、PM2 プロセス起動/保存
  - Acceptance:
    - `npx pm2 status` で `kb-nightly online`
    - `npx pm2 save` 済み
  - Notes: 空白パス（/Volumes/Extreme Pro/…）対策として `args: [<path>]` に修正済み

- [DONE] pm2-logrotate 導入と設定
  - Goal: ログ肥大化の抑止と保守容易性の向上
  - Deliverables: pm2 モジュール `pm2-logrotate` 導入、設定反映
  - Acceptance:
    - `npx pm2 install pm2-logrotate` 済み
    - 設定: `max_size=10M`, `retain=14`, `compress=true`, `dateFormat=YYYY-MM-DD_HH-mm-ss`, `workerInterval=30`, `rotateInterval='0 3 * * *'`, `rotateModule=true`
    - `npx pm2 conf` で確認できること

### 10.2 次にやる（P2/ops 自動化）
- [DONE] デプロイ後の自動 reload の組込み
  - Goal: ビルド/デプロイ後に Next を確実に再読み込み（静的資産の不整合防止）
  - Deliverables: `scripts/postbuild.mjs` に PM2 reload（`pm2 reload next-app --update-env`）をベストエフォートで実行する処理を追加（`POSTBUILD_PM2_RELOAD=0` で無効化可）
  - Acceptance: デプロイ直後に `/_next/static/css/*` 等の 404 が発生しないこと（Smoke）
  - Size: S

### 10.3 必要に応じて（P2→P1/セキュリティ強化）
- 保護ルートのアクセス整備（端末が増えた段階で）
  - Goal: `ADMIN_IP_ALLOWLIST` と BASIC 認証の見直し/配布
  - Deliverables: `.env.local` / `services/.env` の運用、`src/middleware.ts` のルール確認、手順書の更新
  - Acceptance: 保護ルートにおいて未許可端末は 401/403、許可端末は 200 であること
  - Size: S

### 10.4 将来の規模/要件で（P3/先行投資）
- [STARTED] kb-api / mcp の独立プロセス化
  - Goal: KB/API と MCP を Next から分離し疎結合化（負荷分散/スケール容易）
  - Deliverables（進捗）:
    - [DONE] `services/kb-api/server.mjs` 実装（/healthz, /search, /reload）
    - [DONE] `services/mcp/server.mjs` スケルトン（/healthz, /info）
    - [DONE] `services/ecosystem.config.cjs` に `kb-api` / `mcp-server` 追加（配列引数対応）
    - [DONE] README と要件に起動/環境変数/ヘルスチェック追記
    - [DONE] MCP に最小 KB ツールを追加（`/kb/search` GET/POST → kb-api プロキシ、`KB_API_TOKEN` 対応）
  - Next: PM2 で `--only` 起動し、ログ/ポート/CI 連携を整備
  - Acceptance: `pm2 status` で各プロセス online、`/healthz` 200、`/search` が `{hits}` を返す
  - Size: M

### 10.5 高優先（P1）
- kb-api の認可/CORS 強化
  - Goal: tailnet 内前提でも露出面を最小化（未許可アクセス遮断）
  - Deliverables:
    - `services/kb-api/server.mjs` にトークン認証または BASIC 認証を追加
    - `ALLOWED_ORIGINS` の明示設定と検証（OPTIONS/本リクエスト）
    - fetch タイムアウトと簡易リトライの実装
  - Acceptance: 未許可 401/403、許可リクエスト 200（/search GET/POST）
  - Size: M
  - Status: 完了（実装と再起動済み）。`.env.example` に `KB_API_TOKEN`/`KB_API_BASIC`/`ALLOWED_ORIGINS`/タイムアウト系を追記。

- kb-api の POST /search 対応
  - Goal: Next 側 POST プロキシと完全整合（JSON Body: `{ query, topK }`）
  - Deliverables: `services/kb-api/server.mjs` に JSON Body のパースと分岐を追加（GET/POST 両方で同じレスポンス）
  - Acceptance: `curl` にて GET/POST の結果が同一であること
  - Size: S
  - Status: 完了（`/search` の POST 実装済み、`/reload`/`/healthz` 正常）。`pnpm kb:smoke:api` でスモーク可。

- /api/kb/search の E2E スモーク（CI/ローカル）
  - Goal: プロキシ/フォールバックの動作を自動検証
  - Deliverables: スモークスクリプト/CI ジョブ（kb-api 起動時は `X-KB-Proxy: kb-api`、停止時は `fallback-local` を確認）
  - Acceptance: CI で PASS、ローカルでも再現可能
  - Size: S
  - Status: 完了（`pnpm kb:smoke:next:toggle` で `X-KB-Proxy: kb-api`→（URL を不正化）→ `X-KB-Proxy: fallback-local` を検証。kb-api は `KB_API_MOCK=1` で OpenAI をスキップ可能）

### 10.6 改善（P2）
- 観測性の強化（構造化ログ/簡易メトリクス）
  - Goal: 障害時の原因特定を高速化
  - Deliverables: kb-api/mcp-server に時刻/処理時間/エラー率を含むログ出力
  - Acceptance: `pm2 logs` から主要指標を確認可能
  - Size: S
  - Status: 完了（kb-api/mcp に `/metrics` 追加、ルート別カウンタと処理時間を集計）

- postbuild の運用明確化
  - Goal: `public/_next` 競合の再発防止
  - Deliverables: `README`/ops ドキュメントに `POSTBUILD_COPY_CSS` の扱いを明記（既定は無効）
  - Acceptance: ビルド PASS 継続、手順が周知
  - Size: XS
  - Status: 完了（`docs/requirements/dev-environment.md` に 12.1 を追記）

---

## 11. 自動管理タスクレジストリ（機械可読）

本節はツールが機械的に読み取り・同期（追加/更新/完了反映）できるように、明確なスキーマとマーカーで定義する。人間可読の 10.* 節と重複していてもよいが、最終的な自動処理はこのレジストリを参照する。

- 保持場所: 本ファイル内（単一ソース）。外部へエクスポートする場合はこれを基準とする。
- マーカー: 以下の `BEGIN:TASK_REGISTRY v1` から `END:TASK_REGISTRY` までを JSON として厳密に解釈する。
- スキーマ（v1）フィールド:
  - id: string（一意・安定 ID）
  - slug: string（短い識別子）
  - title: string
  - priority: { level: 'P0'|'P1'|'P2'|'P3', rank: number }（rank は同一レベル内の順序）
  - status: 'todo'|'in_progress'|'blocked'|'done'
  - type: 'feature'|'fix'|'chore'|'ops'|'docs'|'ci'
  - size: 'XS'|'S'|'M'|'L'
  - labels: string[]（自由語。例: ['observability','security']）
  - owner: string|null（アサイン未定は null）
  - createdAt: ISO8601 string
  - updatedAt: ISO8601 string
  - dependsOn: string[]（id の配列）
  - files: string[]（相対パスまたは glob）
  - acceptance: string[]（受け入れ基準の箇条書き）
  - notes: string（任意の補足）

<!-- BEGIN:TASK_REGISTRY v1 -->
[
  {
    "id": "T-TS-001",
    "slug": "tailscale-app-connector-docs",
    "title": "Tailscale アプリコネクタ運用要件（policy file最小差分・SaaS許可IP・手順）を整備",
    "priority": { "level": "P2", "rank": 1 },
  "status": "done",
    "type": "ops",
    "size": "S",
    "labels": ["tailscale", "docs", "security"],
    "owner": null,
    "createdAt": "2025-10-25T01:00:00.000Z",
  "updatedAt": "2025-10-25T02:30:00.000Z",
    "dependsOn": [],
    "files": [
      "docs/requirements/tailscale.md"
    ],
    "acceptance": [
      "apps（プリセット/カスタム）の追加手順が1ページで完結",
      "policy fileの tagOwners/autoApprovers/grants/nodeAttrs の例が掲載",
      "SaaS側のIPアロウリスト手順（Egress IPsの取得）が明記"
    ],
    "notes": "Linux限定・250ドメイン上限・10K routesの制約も記載"
  },
  {
    "id": "T-TS-002",
    "slug": "tailscale-api-smoke",
    "title": "Tailscale API スモーク（devices一覧）スクリプトの追加と npm scripts 連携",
    "priority": { "level": "P2", "rank": 2 },
  "status": "done",
    "type": "ops",
    "size": "XS",
    "labels": ["tailscale", "observability", "ci"],
    "owner": null,
    "createdAt": "2025-10-25T01:00:00.000Z",
  "updatedAt": "2025-10-25T02:30:00.000Z",
    "dependsOn": [],
    "files": [
      "scripts/ops/tailscale/smoke-api.mjs",
      "package.json"
    ],
    "acceptance": [
      "環境変数 TAILSCALE_API_TOKEN（なければ .env.local の dauber_tailscale_api_key を自動読込）でデバイス一覧取得",
      "200応答かつ devices 件数を表示し、失敗時は非ゼロ終了",
      "pnpm ops:smoke:tailscale で実行可能"
    ],
    "notes": "トークンはログ出力しない。ネットワークに出るためCIではモック/スキップの選択肢を文書化する"
  },
  {
    "id": "T-SEC-004",
    "slug": "kb-api-prod-guard-mock",
    "title": "本番での KB_API_MOCK を禁止し、起動時に検知・失敗する",
    "priority": { "level": "P1", "rank": 1 },
  "status": "done",
    "type": "chore",
    "size": "S",
    "labels": ["security", "reliability"],
    "owner": null,
    "createdAt": "2025-10-25T00:00:00.000Z",
  "updatedAt": "2025-10-25T00:05:00.000Z",
    "dependsOn": [],
    "files": ["services/kb-api/server.mjs", "services/kb-api/README.md"],
    "acceptance": [
      "NODE_ENV=production かつ KB_API_MOCK=1 でプロセス起動がエラー終了する",
      "README と .env.example に本番禁止の旨を明記"
    ],
    "notes": "誤運用防止のための起動ガード。開発/CI では従来どおり使用可能にする"
  },
  {
    "id": "T-OBS-001",
    "slug": "mcp-cors-auth-toggle",
    "title": "mcp-server に CORS と任意の認証（トークン/BASIC）トグルを追加",
    "priority": { "level": "P2", "rank": 1 },
  "status": "done",
    "type": "chore",
    "size": "S",
    "labels": ["observability", "security"],
    "owner": null,
    "createdAt": "2025-10-25T00:00:00.000Z",
  "updatedAt": "2025-10-25T00:12:00.000Z",
    "dependsOn": [],
    "files": ["services/mcp/server.mjs", "services/mcp/README.md"],
    "acceptance": [
      "ALLOWED_ORIGINS 設定時に未許可 Origin は 403（OPTIONS は 204）",
      "MCP_API_TOKEN または BASIC 有効化時に未許可は 401/403、許可は 200",
      "README/.env.example に設定方法を追記"
    ],
    "notes": "kb-api と整合する形で最小の保護を提供"
  },
  {
    "id": "T-OBS-002",
    "slug": "ci-metrics-smoke",
    "title": "CI に /metrics の軽量ポーリング・ヘルスチェックを追加（kb-api/mcp）",
    "priority": { "level": "P2", "rank": 2 },
  "status": "done",
    "type": "ci",
    "size": "S",
    "labels": ["observability", "ci"],
    "owner": null,
    "createdAt": "2025-10-25T00:00:00.000Z",
  "updatedAt": "2025-10-25T00:18:00.000Z",
    "dependsOn": [],
    "files": ["scripts/kb/smoke-kb-api.mjs", "services/kb-api/server.mjs", "services/mcp/server.mjs"],
    "acceptance": [
      "CI 実行で /metrics が 200 を返し JSON を検証",
      "totalRequests の増分など簡易な整合チェックが PASS"
    ],
    "notes": "将来 Prometheus を導入するまでの一次監視"
  },
  {
    "id": "T-OBS-003",
    "slug": "next-api-timing",
    "title": "Next の主要 API に軽量タイミングログを追加（/api/kb/search, /api/agent/workflow-proxy）",
    "priority": { "level": "P2", "rank": 3 },
    "status": "done",
    "type": "chore",
    "size": "S",
    "labels": ["observability"],
    "owner": null,
    "createdAt": "2025-10-25T00:00:00.000Z",
    "updatedAt": "2025-10-25T00:45:00.000Z",
    "dependsOn": [],
    "files": ["src/pages/api/kb/search.ts", "src/pages/api/agent/workflow-proxy.ts"],
    "acceptance": [
      "環境変数でログ出力を ON/OFF（例: NEXT_OBSERVABILITY=1）",
      "各 API 呼び出しで totalMs をログし、500 時はエラーメッセージも出力"
    ],
    "notes": "PII を含まないメタ情報のみを記録"
  }
]
<!-- END:TASK_REGISTRY -->
