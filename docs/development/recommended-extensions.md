# Recommended VS Code Extensions

このドキュメントでは、このプロジェクトの開発に推奨される VS Code 拡張機能をリストアップしています。

## 設定方法

### 方法1: extensions.json から一括インストール（推奨）

ローカルの `.vscode/extensions.json` に以下の内容を追加すると、VS Code が自動的にインストールを推奨します：

```json
{
  "recommendations": [
    "GitHub.copilot",
    "GitHub.copilot-chat",

    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker",

    "orta.vscode-jest",

    "eamodio.gitlens",
    "mhutchie.git-graph",

    "ms-azuretools.vscode-docker",

    "yzhang.markdown-all-in-one",

    "bradlc.vscode-tailwindcss",
    "mikestead.dotenv",
    "christian-kohler.path-intellisense",
    "wix.vscode-import-cost",

    "formulahendry.auto-rename-tag",
    "humao.rest-client",
    "gruntfuggly.todo-tree",
    "aaron-bond.better-comments"
  ]
}
```

### 方法2: 個別インストール

VS Code のコマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）から `Extensions: Install Extensions` を選択し、以下の拡張機能IDを検索してインストールします。

---

## カテゴリ別推奨拡張

### AI 支援 (2)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| GitHub Copilot | `GitHub.copilot` | AI によるコード補完 |
| GitHub Copilot Chat | `GitHub.copilot-chat` | AI チャットによるコード支援 |

**推奨理由**: コード生成・リファクタリングの効率化

---

### コード品質 (4)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| ESLint | `dbaeumer.vscode-eslint` | JavaScript/TypeScript の静的解析 |
| Prettier | `esbenp.prettier-vscode` | コードフォーマッター |
| Error Lens | `usernamehw.errorlens` | エラー・警告をインライン表示 |
| Code Spell Checker | `streetsidesoftware.code-spell-checker` | スペルチェック |

**推奨理由**:
- このプロジェクトは TypeScript strict mode を使用しており、ESLint との連携が必須
- Prettier でコードスタイルを統一
- Error Lens でエラーの早期発見

---

### テスト (1)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| Jest | `orta.vscode-jest` | Jest テストランナー統合 |

**推奨理由**: テストファイル（`*.test.ts`）の実行・デバッグが容易

**使い方**:
```bash
pnpm test              # 全テスト実行
pnpm test:watch        # Watch モード
jest path/to/file.test.ts  # 特定ファイルのみ
```

---

### バージョン管理 (2)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| GitLens | `eamodio.gitlens` | Git の強化（blame, history 等） |
| Git Graph | `mhutchie.git-graph` | Git 履歴の視覚化 |

**推奨理由**:
- ADR・要件の変更履歴を追跡しやすい
- 複雑なブランチ戦略の可視化

---

### インフラ・運用 (1)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| Docker | `ms-azuretools.vscode-docker` | Docker コンテナ管理 |

**推奨理由**:
- KB API, MCP サーバーなど Docker Compose で管理しているサービスの操作が容易
- `docker-compose.yml` のシンタックスハイライト

---

### ドキュメント (1)

| 拡張機能 | ID | 説明 |
|---------|----|----|
| Markdown All in One | `yzhang.markdown-all-in-one` | Markdown 編集支援 |

**推奨理由**:
- `docs/` 配下の ADR・要件ドキュメントの編集に必須
- Table of Contents 自動生成、プレビュー、ショートカット

---

### プロジェクト固有 (5)

| 拡張機能 | ID | 説明 | 推奨理由 |
|---------|----|----|---------|
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind のクラス補完 | このプロジェクトのスタイリングは Tailwind CSS |
| DotENV | `mikestead.dotenv` | .env ファイルのシンタックスハイライト | 多数の環境変数を使用（OPENAI_API_KEY 等） |
| Path Intellisense | `christian-kohler.path-intellisense` | ファイルパスの自動補完 | 複雑なディレクトリ構造（`src/lib/`, `src/pages/api/`） |
| Import Cost | `wix.vscode-import-cost` | インポートのバンドルサイズ表示 | Next.js のバンドルサイズ最適化 |
| Auto Rename Tag | `formulahendry.auto-rename-tag` | HTML/JSX タグの自動リネーム | React コンポーネント編集の効率化 |

---

### API 開発・デバッグ (3)

| 拡張機能 | ID | 説明 | 推奨理由 |
|---------|----|----|---------|
| REST Client | `humao.rest-client` | `.http` ファイルで API テスト | `/api/webhook`, `/api/agent/direct` 等のエンドポイントテスト |
| Todo Tree | `gruntfuggly.todo-tree` | TODO コメント一覧表示 | Claude Code が残すコメントの追跡 |
| Better Comments | `aaron-bond.better-comments` | コメントの色分け | `// TODO:`, `// FIXME:`, `// NOTE:` の視認性向上 |

**REST Client の使い方**:

プロジェクトルートに `.http` ファイルを作成：

```http
### Test LINE Webhook
POST http://localhost:3001/api/webhook
Content-Type: application/json

{
  "type": "message",
  "message": {
    "type": "text",
    "text": "明日の10時にミーティング"
  }
}

### Test Direct Agent Path
POST http://localhost:3001/api/agent/direct
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "ナレッジベースから情報を検索して"}
  ]
}
```

---

## インストール優先度

### 必須（チーム全体）
- ESLint, Prettier, Error Lens（コード品質統一のため）
- Tailwind CSS IntelliSense（スタイリング必須）
- DotENV（環境変数の視認性）

### 強く推奨（開発効率）
- GitHub Copilot/Chat（AI 支援）
- GitLens, Git Graph（履歴追跡）
- Jest（テスト実行）
- REST Client（API 開発）
- Todo Tree, Better Comments（コメント管理）

### オプション（個人の好み）
- Docker（Docker を直接操作する場合）
- Markdown All in One（ドキュメント編集が多い場合）
- Path Intellisense, Import Cost, Auto Rename Tag（補助的）

---

## 将来的な .gitignore 例外化の検討

現在、`.vscode/extensions.json` は `.gitignore` に含まれているため、個人の設定として管理されています。

**チーム全体で拡張機能を統一したい場合**、以下の手順で `.gitignore` に例外を追加できます：

1. `.gitignore` に以下を追加：
   ```
   # Allow shared VS Code extensions
   !.vscode/extensions.json
   ```

2. `.vscode/extensions.json` を作成（このドキュメントの「方法1」の内容）

3. Git に追加：
   ```bash
   git add -f .vscode/extensions.json
   git commit -m "chore: add recommended VS Code extensions"
   ```

**判断基準**:
- チームが3人以上で、開発環境の統一が重要 → `.gitignore` 例外化を検討
- 個人プロジェクトまたは少人数 → ドキュメント管理で十分

---

## トラブルシューティング

### 拡張機能が推奨されない
1. VS Code を再起動
2. コマンドパレットから `Extensions: Show Recommended Extensions` を実行

### ESLint/Prettier が動作しない
```bash
# 依存関係を再インストール
pnpm install

# VS Code の ESLint サーバーを再起動
# コマンドパレット > "ESLint: Restart ESLint Server"
```

### Jest 拡張が赤く表示される
```bash
# テストを一度実行して Jest を初期化
pnpm test
```

---

## 参考リンク

- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/vscode)
- [このプロジェクトの開発環境設定](../requirements/dev-environment.md)
- [品質ゲート（CI）](../../CLAUDE.md#quality-gates)

---

**Last Updated**: 2025-11-14
