# 要件定義書（n8n → OpenAI AgentKit 置換 / Next.js API統合）

最終更新: 2025-10-24（作成者: ChatGPT）

---

## 1. 背景 / 目的
- 既存の n8n ワークフロー運用を停止し、**OpenAI AgentKit** を中核とする API ベースの構成へ移行する。
- 既存リポジトリ **dauberside.github.io-1 (Next.js 14)** に組込む形で、**/api/agent/** 以下にエージェント機能と Webhook を実装し、将来の拡張（各種外部連携の tool 化）を容易にする。
- 運用・セキュリティ・可観測性を改善し、秘密情報を `.env.local` に集約。

## 2. スコープ
- Next.js プロジェクト内に AgentKit を統合（`src/lib/agent/agent.ts`・`/api/agent/webhook/[name]`・`/api/agent/run`）。
- n8n の Webhook/スケジュール運用の置き換え。
- ドメイン: `xn--rn8h03a.st`（必要なら `n8n.xn--rn8h03a.st` は廃止 or 転用）。
- CI/CD・本番デプロイ（Render もしくは Vercel）。

## 3. 用語
- **AgentKit**: `@openai/agents` を用いたエージェント実装。
- **tool**: エージェントから呼ばれる関数（Zodでパラメータ定義）。
- **内部APIトークン**: `/api/agent/run` を叩くための共有秘密 `INTERNAL_API_TOKEN`。

## 4. ステークホルダー
- 開発: krinkcrank（ローカル: macOS, Node v22.17.1）
- 運用: 同上
- 外部サービス: OpenAI API / （任意）Supabase・LINE・メール・Upstash など

## 5. システム構成（論理）
- **Next.js API Routes**
  - `POST /api/agent/webhook/[name]` : 各種Webhookの受け口。ペイロード→プロンプト化→AgentKitへ。
  - `POST /api/agent/run` : サーバ側の内部起動用（`x-internal-token` 必須）。
  - `GET /api/healthz` : ヘルスチェック（`{ ok: true, uptime, now }`）。
- **Agent実装**: `src/lib/agent/agent.ts`
  - 例: `ping` tool（Zod 3 / `.nullable()` を使用）
- **Secrets**: `.env.local` にて `OPENAI_API_KEY`, `INTERNAL_API_TOKEN` ほかを管理。Git追跡外。

## 6. 外部インターフェース（API 仕様）
### 6.1 Webhook
- **Endpoint**: `POST /api/agent/webhook/[name]`
- **Headers**: `Content-Type: application/json`
- **Body**: 任意JSON（2KB〜1MB想定）
- **Response**: `200 OK` `{ ok: true, output: string }` / `500` `{ ok: false, error }`

### 6.2 内部起動API
- **Endpoint**: `POST /api/agent/run`
- **Headers**:
  - `Content-Type: application/json`
  - `x-internal-token: <INTERNAL_API_TOKEN>`（必須）
  - `x-request-id: <string>`（任意。未指定ならサーバ側で生成）
- **Body**: `{ "input": "自然文の指示" }`
- **Response**: `200 OK` `{ output: string }` / `401` / `405` / `429` / `500`
  - 備考: モックモードは開発/検証のみ（`AGENT_MOCK_MODE=1` または `?mock=1`）。本番ではサーバ側で強制無効。

### 6.3 ヘルスチェック
- **Endpoint**: `GET /api/healthz`
- **Response**: `200 OK` `{ ok: true, uptime: number, now: ISO8601 }`

## 7. 機能要件
- Webhook受信→ペイロードをプロンプトへ整形→AgentKit 実行→テキスト出力を返却。
- ツール呼び出し（例: `ping`）が可能。
- 今後の拡張: メール送信/LINE/DB/KV/Supabase/Cloudflare などを **tool** として追加可能。

## 8. 非機能要件
- **可用性**: 99.9%（本番は PaaS 冗長性に依存）。
- **性能**: 単発リクエスト < 3s（LLM待ち含む）。
- **セキュリティ**:
  - `.env.local` は Git 非追跡。漏えい済みキーは**即ローテーション**。
  - `/api/agent/run` は `x-internal-token` による共有秘密で防御。
  - CORS: 必要なオリジンのみ許可。HTTPS運用。
  - Zodで**全項目 required もしくは `.nullable()`**（`.optional()`禁止）。
  - モックモード（`AGENT_MOCK_MODE=1` または `?mock=1`）は開発/検証専用。本番環境では**無効（未設定 or `0`）であること**。
- **可観測性**: APIログ（リクエストID/レスポンスコード/処理時間）。Cloud logsやSentry任意。
- **保護**: 内部APIに簡易レート制限（例: 同一トークン当たり 500ms 窓、違反時は 429）。

## 9. データモデル
- Webhook入力: 任意 JSON（保存しない）
- 将来保存するなら：Supabase/Postgres（events, runs, logs）テーブル設計を追補。

## 10. エラーハンドリング
- 例外発生時は `500` + `error` メッセージJSON を返却。
- ハンドラは try/catch を実装。
- 代表的なHTTPエラー: `401`（トークン不正/未指定）, `405`（メソッド不許可）, `429`（レート制限）, `500`（内部エラー/OPENAI_API_KEY未設定 等）。

## 11. 環境 / 依存
- Node: v22.17.1
- Next.js: 14.2.30（pages API）
- 依存: `@openai/agents` / `zod@^3.25.40`（v4は非推奨）
- 既知注意: Zod v4 を入れると Agents 側 peer で警告。**v3系列に固定**。

## 12. 設定値（例）
- `.env.local`
  - `OPENAI_API_KEY=...`
  - `INTERNAL_API_TOKEN=...`
  - `AGENT_MOCK_MODE=1`（開発/検証時のみ。本番では設定しない）
- Next.js API で JSON 受信: `bodyParser.sizeLimit = '1mb'`

## 13. 参考実装（抜粋）
### 13.1 `src/lib/agent/agent.ts`
```ts
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

export const ping = tool({
  name: 'ping',
  description: 'Health check tool',
  parameters: z.object({ name: z.string().nullable() }),
  execute: async ({ name }) => `pong${name ? ' ' + name : ''}`,
});

export const agent = new Agent({
  name: 'AppAgent',
  instructions: 'You are a helpful assistant. Keep answers short.',
  tools: [ping],
});
```

### 13.2 `src/pages/api/agent/webhook/[name].ts`
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { run } from '@openai/agents';
import { agent } from '../../../../lib/agent/agent';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const name = String(req.query.name ?? 'unknown');
    const payload = JSON.stringify(req.body ?? {});
    const prompt = `Handle webhook "${name}" with payload: ${payload}`;
    const result = await run(agent, prompt);
    return res.status(200).json({ ok: true, output: result.finalOutput });
  } catch (err: any) {
    console.error('[api/agent/webhook]', err);
    return res.status(500).json({ ok: false, error: err?.message ?? 'internal error' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};
```

### 13.3 `src/pages/api/agent/run.ts`
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { run } from '@openai/agents';
import { agent } from '../../../lib/agent/agent';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-internal-token'] !== process.env.INTERNAL_API_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const input = typeof req.body?.input === 'string' ? req.body.input : 'say hello';
  const result = await run(agent, input);
  return res.json({ output: result.finalOutput });
}
```

## 14. デプロイ方針
- **Render**: Web Service（Node）。Health check `/healthz` を追加する場合は別API化。
- **Vercel**: Serverless ランタイム。長時間処理は非推奨。cron 実行はプラットフォームのスケジューラから `/api/agent/run` を叩く。
 - ポストデプロイ健全性: `/api/healthz` および `/api/diagnostics` が `200` を返す。

## 15. セキュリティ / ガバナンス
- 秘密鍵はバージョン管理しない。**過去に Git へ載った鍵は全てローテーション**。
- CORS/Rate Limit/WAF は将来のトラフィック増に備えて導入検討。
- HSTS/HTTPS（CFやPaaS終端）。

## 16. マイグレーション計画（n8n → AgentKit）
1) n8n の停止・バックアップ（必要時のみ）。  
2) `.zshrc` から n8n 関数・環境変数削除、`~/.n8n` 削除済。  
3) AgentKit 実装を main ブランチへ。  
4) ドメイン切替（`n8n.xn--rn8h03a.st` の役割を整理）。  
5) 動作確認（受け口の Webhook / 内部API）。  
6) 本番リリース。ロールバックは DNS 戻し/前バージョン復元で対応。

## 17. 受け入れ条件（Acceptance Criteria）
- [ ] `POST /api/agent/webhook/demo` に `{ "hello":"world" }` を投げて `200 OK` / `ok:true` が返る。
- [ ] `POST /api/agent/run` に `x-internal-token` を付けて `200 OK` / `output` が返る。未付与は `401`。
- [ ] Zod スキーマは `.nullable()` を使用し、`.optional()` は使用しない。
- [ ] `.env.local` は Git 非追跡（`.gitignore` 登録済）。
- [ ] 重複API (`/api/slots.js` と `.ts`) の片方を削除してビルド警告が消える。
- [ ] 機密情報は外部に漏れていない（監査完了）。
 - [ ] 本番環境ではモックモード（`AGENT_MOCK_MODE` / `?mock=1`）が無効である（未設定/`0`）。
 - [ ] `GET /api/healthz` が `200 OK` / `{ ok: true }` を返す。
 - [ ] `/api/agent/run` を短時間に連打した場合に `429` が返る（レート制限有効）。

## 18. リスク / 懸念
- 以前コミット済の秘密鍵が残存している場合、外部悪用の恐れ → **必ずローテーション**。
- DNS/SSL設定の不整合（`curl -I https://n8n...` のエラー要確認）。

## 19. 今後の拡張（例）
- メール送信ツール（`nodemailer`）
- LINE Bot 連携ツール
- Supabase/Upstash 連携ツール
- ジョブキュー・リトライ・レート制限

---

### 付録A: 作業チェックリスト（短縮版）
- [ ] `@openai/agents` + `zod@^3.25.40` 導入
- [ ] `agent.ts` / `webhook/[name].ts` / `run.ts` 配置
- [ ] `.env.local` に `OPENAI_API_KEY` / `INTERNAL_API_TOKEN`
- [ ] Webhook/内部API の curl テスト完了
- [ ] n8n 終了・クリーンアップ完了
- [ ] デプロイ先（Render/Vercel）決定・DNS整理

