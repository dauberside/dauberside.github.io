# 要件定義（Requirements）インデックス

最終更新: 2025-11-09

本リポジトリの要件定義書を横断的に参照できるインデックスです。過去の要件定義との整合性を保つため、下記の“不変条件”を全ドキュメントの前提に統一しました。

## 不変条件（MUST / 共有前提）
- インデックス抑止（全体）: `next.config.js` で全ページに `X-Robots-Tag=noindex,nofollow,noarchive` を付与。`public/robots.txt` は `Disallow: /`。
- 保護ルート: `/agent/workflow`, `/api/agent/workflow`, `/api/agent/workflow-proxy` は `middleware.ts` により IP アロウリスト/BASIC 認証で保護し、`noindex` + `no-store` を強制（全体方針に加え二重で担保）。
- 本番モック禁止: 本番ではモック/APIキー無し実行を失敗（500）として顕在化。
- クライアント秘匿: 内部トークンはクライアントに渡さず、必ずサーバプロキシ経由。
- ランタイム: Next.js 14 (pages), Node 22, TypeScript 5.x, pnpm。

## ドメイン別要件
- Chat 要件定義: [chat.md](./chat.md)
  - UI 表示制御フラグ:
    - `NEXT_PUBLIC_SHOW_KB_REFS=0|1`（KB 引用ブロックの表示）
    - `NEXT_PUBLIC_HIDE_SPEC_OUTPUT=1|0`（仕様/ADR/Context Capsule 様式の出力を UI から隠す）
- OpenAI Agents SDK 要件定義: [openai-agents-sdk.md](./openai-agents-sdk.md)
- KB（最小RAG）要件定義: [kb.md](./kb.md)
- Obsidian統合 要件定義: [obsidian.md](./obsidian.md)
  - Obsidian Local REST API連携
  - HTTPS接続・自己署名証明書対応
  - KB Buildでの絶対パス対応
- ホットパス最適化（Direct Agent Path）: [hot-path-optimization.md](./hot-path-optimization.md)
- BASIC 認証要件定義: [basic-auth.md](./basic-auth.md)
- サービス運用（PM2/ポート/CORS）: [services.md](./services.md)
- 開発環境（Dev/本番・ポート/CI）: [dev-environment.md](./dev-environment.md)
- n8n 要件定義: [n8n.md](./n8n.md)
- Tailscale 要件定義: [tailscale.md](./tailscale.md)
- LangChain（参考・Deferred）: [langchain.md](./langchain.md)

## 補助サービス / 実行基盤（最新）
- Docker Compose により `kb-api(:4040)` と `mcp(:5050)` を一括起動可能（ルートの `docker-compose.yml`）。
  - 認証: `KB_API_TOKEN` / `MCP_API_TOKEN`（または BASIC）を設定。
  - 露出方針: 内部のみで良い場合は `ports` を外し、ゼロトラスト（Tailscale）やリバースプロキシ配下で運用。
- PM2 エコシステム: `services/ecosystem.config.cjs` に `next-app`, `kb-api`, `mcp-server`, `kb-nightly` を定義（必要に応じて起動）。

## 整合性メモ（差分解消）
- 旧ドキュメントで「ページ単位の meta robots による noindex」を前提としている箇所がありますが、現行は“サイト全体 noindex（X-Robots-Tag + robots.txt）”に統一しました。保護対象は `middleware` でも重ねて付与するため、旧記述と矛盾しません（より強い抑止）。
- Chat UI の出力方針は環境変数で制御可能になりました（仕様/ADR様式の出力を UI から隠す）。
- n8n 等の外部連携は HTTP で `mcp`（HTTPアダプタ）経由が最短。純MCP(WebSocket)は将来の拡張領域。

### 棲み分けメモ（Direct Path vs Workflow Path）
- Direct Path（`/api/agent/direct`）はアプリ内完結・低遅延の経路。添付プレビュー・KB 検索（MCP HTTP）をサポート。
- Workflow Path（`/api/agent/chat`）は n8n の Webhook 経由。ワークフロー実験や GUI 編集が容易。
- UI/契約（フィールド名互換、添付の基本扱い）は共通思想で維持する。

---
この README は“要件の入口”です。詳細は各ファイルを参照し、変更時は本 README の不変条件に適合するかを確認してください。
