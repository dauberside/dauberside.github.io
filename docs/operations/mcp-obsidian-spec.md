# MCP × Obsidian 統合仕様（例）

## 背景
- Claude から Obsidian ノートを安全に生成・編集し、ナレッジベースと自動処理に反映したい。
- ローカル REST API プラグイン経由の一方向同期に加え、MCP で双方向編集を可能にして運用効率と安全性を高める。

## スコープ
- 含まれるもの: Obsidian ノートの生成・編集・追記、KB への再取り込みトリガー、n8n 連携による通知/自動処理。
- 含まれないもの: 本番デプロイへの自動反映、外部ストレージ連携、削除系の本番運用。

## ユースケース
- UC1: Claude から新規ノートを生成し、必要なセクション構造を自動整形する。
- UC2: MCP でノートを編集（追記/セクション置換）し、完了後に KB ingest を走らせて検索対象を最新化する。
- UC3: 更新イベントを n8n Webhook に送り、Slack/メール通知や追加処理（例: タグ整形・リマインダー作成）を行う。

## 機能要件
- F-1: Obsidian vault の `specs/` 配下に仕様書ファイルを作成できること（例: `specs/mcp-obsidian.md`）。
- F-2: セクション単位での安全な上書きができること（`obsidian_patch_content` を heading 対象で利用）。
- F-3: ノート編集は MCP ツール経由のみで行い、REST 直叩きによる編集を避けること。
- F-4: 編集完了後に KB ingest (`POST /api/obsidian/ingest`) をトリガーできること。

## 非機能要件
- N-1: ローカル環境で 1 秒以内にノート更新が反映されること（目安）。遅延時はポート疎通とプラグイン稼働を確認。
- N-2: 変更は Git でバージョン管理し、誤操作時にロールバックできること。
- N-3: 削除系操作は `test/` 配下を原則とし、本番配下では行わないこと。

## 関連システム
- Obsidian vault パス: （ローカル環境の vault ルート。例: `~/Obsidian/Vault`）
- MCP Obsidian 設定概要:
  - コマンド: `uvx mcp-obsidian`
  - OBSIDIAN_API_URL: `http://127.0.0.1:8443`
  - OBSIDIAN_API_KEY: `.mcp.local.json` に設定
  - Allow self-signed: `0`
- KB ingest エンドポイント: `POST http://127.0.0.1:3000/api/obsidian/ingest`（必要に応じて `pnpm kb:build`）。
- n8n Webhook URL（任意）: 例 `http://localhost:5678/webhook/mcp-agent-chat`（`.mcp.local.json` の n8n 設定を参照）。

## 制約・注意点
- Obsidian Local REST API プラグインが有効で、`127.0.0.1:8443` にバインドされていること。
- API Key は `.mcp.local.json` または環境変数に保持し、Git には含めないこと。
- MCP 経由の編集のみ許容し、直接ファイル操作や REST PUT/POST での編集は避ける。
- 削除系は `confirm: true` を必須とし、原則 `test/` 配下のみ。

## 今後の拡張案
- 複数 vault 対応（MCP 設定を複数プロファイルに分離）。
- 仕様レビューの自動チェック（Lint/テンプレート検証を MCP ツール化）。
- PR コメント連携（KB ingest 後の差分サマリを GitHub MCP で投稿）。

## ラフ仕様（ドラフト・雑記）
- 目的: Claude から Obsidian の仕様書を「生成・追記・安全に差し替え」できる最小セットを確保し、更新を KB と n8n へ波及させる。
- スコープ: `specs/` 配下のノートのみ編集対象。削除は `test/` 限定。本番ノートは append/section-replace のみ。
- フロー（典型）:
  1) Claude で雛形生成（obsidian_append_content or patch_content）
  2) セクション差し替え（heading ターゲットで patch）
  3) 保存後に KB ingest を呼ぶ（API/スクリプト）→ 必要なら `pnpm kb:build`
  4) n8n Webhook に更新イベントを投げる（任意）
- ツール使用ポリシー: 編集系は MCP ツールのみ。REST 直編集は禁止。削除は confirm 必須で `test/` のみ。
- SLA 的な目安: ローカルで 1s 以内に反映、KB ingest は数十秒以内、小規模なら即時。遅い場合はポート/プラグイン稼働を確認。
- セキュリティ: API Key は `.mcp.local.json`/環境変数のみ。Git へコミット禁止。自己署名は `ALLOW_SELF_SIGNED=0`（必要時のみ 1）。
