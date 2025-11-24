# Secrets Reference

機密情報の参照先一覧。実際の値は各保存場所を確認。

---

## API Keys

| サービス | マスク値 | 保存場所 |
|----------|----------|----------|
| Obsidian REST API | `270c...` | `.obsidian/plugins/obsidian-local-rest-api/data.json` |
| OpenAI | `sk-...` | `services/.env` の `OPENAI_API_KEY` |
| Slack Webhook | `...Zdmu` | n8n credentials / Recipe 13 |

---

## n8n Credentials

| 名前 | 用途 |
|------|------|
| Obsidian API | Header Auth (Bearer token) |

---

## 環境変数ファイル

| ファイル | 内容 |
|----------|------|
| `services/.env` | OpenAI, LINE, その他 API keys |
| `.env.local` | Next.js ローカル開発用 |

---

## Git 除外対象

以下は `.gitignore` に追加済み（または追加推奨）：

```
services/.env
.env.local
.obsidian/plugins/obsidian-local-rest-api/data.json
```

---

## ローテーション履歴

| 日付 | サービス | 理由 |
|------|----------|------|
| 2025-11-19 | Obsidian REST API | 要ローテーション |

---

Created: 2025-11-19
