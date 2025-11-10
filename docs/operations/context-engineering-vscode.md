# コンテキストエンジニアリング（VS Code 運用）

最終更新: 2025-10-24

このガイドは、VS Code + GitHub Copilot/Copilot Chat で“意図が伝わるプロンプト”を素早く書き、確実に実装へ落とすための運用メモです。

---

## 1) セットアップ（このリポジトリ）

- 推奨拡張機能は `.vscode/extensions.json` に定義済み
  - GitHub Copilot / Copilot Chat
  - ESLint / Prettier / Jest / Error Lens / GitLens / Spell Checker / Markdown All in One
- プロンプト用スニペット: `.vscode/context-prompts.code-snippets`
  - `ce:task`, `ce:changes`, `ce:review`, `ce:bug`, `ce:doc` が利用可能

## 2) 使い方の基本

- まずはスニペットを呼び出し、枠を埋めて「目的・制約・受け入れ基準」を明文化
- Copilot Chat では以下のコンテキストタグを併用
  - `@workspace`（全体の参照）
  - `@file` / `@selection`（該当ファイルや選択範囲）
  - `@terminal`（直近のビルド/テスト出力）
- 可能なら“変更の粒度”を小さく刻んで依頼（小さな差分→ビルド→テスト）

## 3) ワークフロー例

### コード変更

1. 変更対象ファイルを開く → `ce:changes` で要件を記述
2. Copilot Chat: 依頼文に `@file` を添え、受け入れ基準/テストを明記
3. 生成後は自動で typecheck/build を回し、失敗時はログを `@terminal` で共有

### バグ修正

1. 再現手順を `ce:bug` で明文化（スクショ/ログも貼付）
2. 原因仮説と修正案を列挙 → 最小修正で適用 → ビルド/テスト

### ドキュメント化

1. `ce:doc` で README/運用メモを作成
2. コマンドや環境変数は“実際に動作確認”した最小セットのみを残す

## 4) 良いプロンプトの骨子（最短版）

- Goal: 何を達成したいか（1行）
- Constraints: 環境/依存/影響範囲
- Deliverables: どのファイルをどう変えるか
- Acceptance: 受け入れ基準（ビルド/型/テスト/スモーク）
- Tests: 最低限の検証（happy/error）

## 5) このリポジトリ特有の文脈

- Next.js (pages), TypeScript strict, pnpm, Agents SDK, Zod
- 生成パイプライン: validate→generate→build（prebuild フック）
- セキュリティ: ミドルウェア保護・noindex/no-store・サーバ内プロキシ
- 代表タスク: `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm agent:builder:all:dev`

## 6) 失敗時の進め方

- 生成差分が大きい → 目的を更に絞る/段階に分解
- 依存関係が未確定 → 仮置きの前提を明示し、実装後に整合性チェック
- エラーが読めない → `@terminal` でログを添付し、エラーメッセージ単位で依頼

## 7) 注意事項

- 機密（APIキー等）はプロンプトに書かない。UIからも露出させない
- 外部サイトの情報は引用範囲に注意し、出典をメモ
- 大改修は RFC 的に docs/ に草案を作ってから実装へ

---

これで“毎回ゼロから書かない・粒度を揃える・自動検証まで一気通貫”の流れが作れます。改善点があればこのドキュメントに追記してください。
