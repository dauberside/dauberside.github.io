# Obsidian統合 要件定義書

最終更新: 2025-11-09
対象: Obsidian VaultをKnowledge Baseシステムに統合し、ドキュメント管理と検索を一元化する。

## 1. 目的とスコープ

### 目的
- Obsidian Vaultに保存されたMarkdownノートをKB（Knowledge Base）に統合
- Obsidian Local REST API経由での安全なアクセス
- `pnpm kb:build`でのObsidianノートの自動インデックス化
- Agent/Chatシステムからのシームレスな検索

### スコープ（In）
- Obsidian Local REST APIプラグイン経由のVaultアクセス
- HTTPS接続による安全な通信（自己署名証明書対応）
- .md/.mdxファイルの自動スキャンとKB取り込み
- .canvas/.baseファイルの任意取り込み（環境変数制御）
- 絶対パス・相対パスの両対応（`KB_SOURCES`）

### スコープ外（Out）
- Obsidianアプリの自動起動・監視
- リアルタイム同期（差分検出はファイルハッシュベース）
- Obsidianプラグイン開発
- バイナリファイル（画像、PDF等）の直接取り込み

## 2. システム構成（概要）

### アーキテクチャ
```
Obsidian App (Local REST API Plugin)
    ↓ HTTPS (8445) or HTTP (8443)
Node.js (src/lib/obsidian.ts)
    ↓
KB Build (scripts/kb/build.mjs)
    ↓
embeddings.json (kb/index/embeddings.json)
    ↓
KB Search API (/api/kb/search)
    ↓
Agent/Chat UI
```

### コンポーネント
- **Obsidian Local REST API Plugin**: バージョン3.2.0以上
- **クライアント**: `src/lib/obsidian.ts`（HTTPS/HTTP対応）
- **APIエンドポイント**: `src/pages/api/obsidian/*`
  - `/api/obsidian/ping` - 接続テスト
  - `/api/obsidian/list` - ノート一覧
  - `/api/obsidian/search` - 検索
  - `/api/obsidian/get` - ノート取得
  - `/api/obsidian/ingest` - KB取り込み（将来対応）
- **KB Builder**: `scripts/kb/build.mjs`（絶対パス対応）

### ポート/URL
- **HTTPS（推奨）**: `https://127.0.0.1:8445/`
- **HTTP（開発用）**: `http://127.0.0.1:8443/`
- **Obsidian Vault**: ローカルファイルシステムパス（例: `/Users/username/Documents/Obsidian Vault`）

## 3. 環境変数・設定

### 必須環境変数
```bash
# Obsidian Local REST API接続設定
OBSIDIAN_API_URL="https://127.0.0.1:8445/"  # HTTPSポート（推奨）
OBSIDIAN_API_KEY="<プラグイン設定画面から取得>"
OBSIDIAN_ALLOW_SELF_SIGNED="1"  # 自己署名証明書を許可

# KB Sources（Obsidian Vaultを含める）
KB_SOURCES="docs,/Users/username/Documents/Obsidian Vault"
```

### 任意環境変数
```bash
# .canvas/.baseファイルの取り込み（既定: 無効）
KB_INCLUDE_CANVAS="1"  # Obsidian Canvasファイルを含める
KB_INCLUDE_BASE="1"    # .baseファイルを含める
```

### Obsidian Local REST API プラグイン設定
- **Non-encrypted (HTTP) Server Port**: `8443`
- **Encrypted (HTTPS) Server Port**: `8445`（推奨）
- **API Key**: ランダム文字列（プラグインが自動生成）
- **Binding Host**: `127.0.0.1`（ローカルのみ）
- **Certificate Hostnames**: 空欄（localhostのみ）
- **Authorization Header**: `Authorization`（既定）

## 4. Obsidian Local REST API連携

### クライアント実装 (src/lib/obsidian.ts)

#### 主要機能
```typescript
// 接続テスト
await ping()
// → { ok: true, base: "https://127.0.0.1:8445" }

// ルート直下のノート/フォルダ一覧
await listRoot()
// → { files: ["note1.md", "note2.md", ...] }

// ノート取得（パスはエンコード済み）
await getNote("folder%2Fnote.md")
// → { content: "# Title\n...", ... }

// 検索（プラグインに/searchがある場合）
await searchNotes("keyword", 10)
// → [{ path: "...", content: "..." }, ...]
```

#### エラーハンドリング
- `Missing OBSIDIAN_API_KEY`: 環境変数未設定
- `Obsidian API 401`: 認証失敗（APIキー不一致）
- `Obsidian API 404`: エンドポイント不在（プラグイン未起動）
- `Connection refused`: Obsidianアプリ未起動

### API経由でのアクセス

#### 接続テスト
```bash
curl http://localhost:3000/api/obsidian/ping
# → {"ok":true,"base":"https://127.0.0.1:8445"}
```

#### ノート一覧取得
```bash
curl http://localhost:3000/api/obsidian/list
# → {"files":["2025-11-09.md","test-note.md",...]}
```

## 5. セキュリティ要件

### HTTPS接続（推奨）
- **TLSバージョン**: TLSv1.3（AEAD-CHACHA20-POLY1305-SHA256）
- **証明書**: 自己署名証明書（Obsidianプラグインが自動生成）
- **証明書検証**: `OBSIDIAN_ALLOW_SELF_SIGNED="1"`で自己署名を許可
- **有効期限**: 約1年間（プラグインが自動更新を推奨）

### 認証
- **方式**: Bearer Token（Authorization Header）
- **APIキー**: Obsidianプラグイン設定画面から取得
- **ローテーション**: 定期的な再生成を推奨（年1回以上）

### ネットワーク制限
- **Binding Host**: `127.0.0.1`（ローカルホストのみ）
- **外部公開**: 非推奨（Tailscale等のVPN経由を推奨）
- **ポート**: 外部ファイアウォールでブロック推奨

### 機密情報の取り扱い
- APIキーは`.env.local`に保存（Gitignore対象）
- `.env.local`はバージョン管理に含めない
- サーバーサイドでのみAPIキーを使用（クライアント露出禁止）

## 6. KB Buildとの統合

### 絶対パス対応（scripts/kb/build.mjs）

#### 実装要件
- `KB_SOURCES`で絶対パス・相対パスの両方に対応
- 修正箇所: `scripts/kb/build.mjs` 278行目付近
```javascript
// 絶対パスと相対パスの両対応
const dir = path.isAbsolute(src) ? src : path.join(ROOT, src);
```

#### 除外ルール
- `.obsidian/`ディレクトリは自動除外（プラグイン設定ファイル）
- `node_modules/`, `.git/`, `.next/`, `kb/` も除外
- 0バイトファイルは自動スキップ（チャンク生成なし）

### ファイルタイプ対応
- **既定**: `.md`, `.mdx`
- **任意**: `.canvas`（`KB_INCLUDE_CANVAS=1`）
- **任意**: `.base`（`KB_INCLUDE_BASE=1`）

### ビルドフロー
```bash
pnpm kb:build
# 1. KB_SOURCESを読み込み（"docs,/path/to/Obsidian Vault"）
# 2. 各パスをスキャン（絶対/相対を判定）
# 3. .md/.mdxファイルを収集（.obsidian除外）
# 4. チャンク分割（1200文字、200オーバーラップ）
# 5. 埋め込み生成（OpenAI or hash mode）
# 6. embeddings.json に書き出し
```

### 差分検出
- SHA256ハッシュによる変更検知
- 未変更ファイルはスキップ（埋め込み再生成なし）
- 削除ファイルはインデックスから自動除外

## 7. データモデル/フロー

### Obsidian Vault → KB Index
```
Obsidian Vault/
├── 2025-11-09.md          → 空ファイル（スキップ）
├── test-note.md           → 1チャンク
├── integration-guide.md   → 1チャンク
└── .obsidian/             → 除外
    └── plugins/

embeddings.json:
{
  "items": [
    {
      "id": 0,
      "source": "../../../Users/.../Obsidian Vault/test-note.md",
      "chunk_index": 0,
      "text": "# テストノート\n\nこれはObsidian統合の...",
      "embedding": [0.123, -0.456, ...]
    },
    ...
  ]
}
```

### KB Search → Agent
```
User Query: "Obsidian統合の手順"
    ↓
/api/kb/search?q=Obsidian統合の手順&topK=3
    ↓
embeddings.json から類似度上位3件を取得
    ↓
Agent Prompt に注入（RAG）
    ↓
User Response
```

## 8. 非機能要件

### パフォーマンス
- **接続タイムアウト**: 10秒（Obsidian API呼び出し）
- **KB Build時間**: 100ファイル/分（OpenAI embeddings使用時）
- **検索レスポンス**: P95 < 500ms（ローカルJSON検索）

### 可用性
- **Obsidian起動**: 手動起動（自動起動は非対応）
- **プラグイン有効化**: 常時有効化を推奨
- **証明書期限**: 年1回の更新チェックを推奨

### スケーラビリティ
- **小規模前提**: 1,000ノート以下を想定
- **大規模対応**: ベクタDB（Qdrant/pgvector）への移行を検討

### 互換性
- **Obsidian**: v1.0.0以上
- **Local REST API Plugin**: v3.2.0以上
- **Node.js**: 22.x
- **OS**: macOS, Windows, Linux

## 9. 運用/トラブルシューティング

### セットアップ手順
1. Obsidianを開く
2. 設定 → コミュニティプラグイン → "Local REST API"を検索
3. プラグインをインストール・有効化
4. プラグイン設定を開く
   - HTTPS Server Port: `8445`を確認
   - API Keyをコピー
5. `.env.local`に設定を追加
   ```bash
   OBSIDIAN_API_URL="https://127.0.0.1:8445/"
   OBSIDIAN_API_KEY="<コピーしたAPIキー>"
   OBSIDIAN_ALLOW_SELF_SIGNED="1"
   KB_SOURCES="docs,/Users/username/Documents/Obsidian Vault"
   ```
6. 接続テスト: `curl -k https://127.0.0.1:8445/`
7. KB Build: `pnpm kb:build`

### よくある問題と対処

#### 接続エラー (Connection refused)
**症状**: `Failed to connect to 127.0.0.1 port 8445`
**原因**: Obsidianアプリまたはプラグインが起動していない
**対処**:
- Obsidianアプリを起動
- プラグインが有効化されているか確認
- ポート番号が正しいか確認（8445 for HTTPS, 8443 for HTTP）

#### 認証エラー (401 Unauthorized)
**症状**: `Obsidian API 401`
**原因**: APIキーが一致しない
**対処**:
- プラグイン設定画面でAPIキーを再確認
- `.env.local`のAPIキーを更新
- アプリケーションを再起動

#### Obsidian Vaultのファイルが取り込まれない
**症状**: `pnpm kb:build`で0チャンクと表示される
**原因**:
- ファイルが空（0バイト）
- パスが間違っている
- `scripts/kb/build.mjs`が絶対パスに非対応
**対処**:
- ファイルに内容を追加
- `KB_SOURCES`のパスを確認（絶対パスの場合は先頭に`/`）
- `scripts/kb/build.mjs`の修正を確認（`path.isAbsolute`対応）

#### 証明書エラー
**症状**: `SSL certificate verify result: self signed certificate`
**原因**: 自己署名証明書の検証に失敗
**対処**: `OBSIDIAN_ALLOW_SELF_SIGNED="1"`を設定

#### .obsidianディレクトリがインデックスされる
**症状**: `.obsidian/plugins/...`がembeddings.jsonに含まれる
**原因**: 除外ルールが機能していない
**対処**: `scripts/kb/build.mjs`の`isIgnored()`関数を確認

### ヘルスチェック
```bash
# 1. Obsidian API接続確認
curl -k -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  https://127.0.0.1:8445/

# 2. ノート一覧取得
curl -k -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  https://127.0.0.1:8445/vault/

# 3. Next.js経由での接続確認
curl http://localhost:3000/api/obsidian/ping

# 4. KB検索テスト
curl "http://localhost:3000/api/kb/search?q=obsidian&topK=3"
```

## 10. 受け入れ基準（Acceptance Criteria）

- [ ] Obsidian Local REST APIプラグインがインストール・有効化されている
- [ ] HTTPS接続（ポート8445）が成功する
- [ ] APIキー認証が正常に動作する
- [ ] `/api/obsidian/ping`が`{"ok":true}`を返す
- [ ] `pnpm kb:build`でObsidian Vaultのファイルがインデックス化される
- [ ] embeddings.jsonにObsidian由来のチャンクが含まれる
- [ ] 空ファイル（0バイト）が自動的にスキップされる
- [ ] `.obsidian/`ディレクトリが自動的に除外される
- [ ] 絶対パス・相対パスの両方が`KB_SOURCES`で使用可能
- [ ] KB検索でObsidianノートの内容が取得できる
- [ ] Agent/ChatからObsidianノートの内容を参照できる

## 11. 既知リスクと対処

### R-1: Obsidian手動起動
**リスク**: ユーザーがObsidianを起動し忘れる
**影響度**: 中
**対処**:
- ドキュメントで明記
- `/api/obsidian/ping`で自動チェック
- エラーメッセージで起動を促す

### R-2: 証明書の有効期限
**リスク**: 1年後に証明書が期限切れ
**影響度**: 低
**対処**:
- プラグインが自動更新を推奨表示
- 年1回の手動確認を運用ルール化

### R-3: 大規模Vault
**リスク**: 10,000ノート以上でKB Buildが遅い
**影響度**: 低（現状は小規模想定）
**対処**:
- ベクタDB（Qdrant/pgvector）への移行
- 差分ビルドの最適化

### R-4: ネットワーク公開
**リスク**: 誤ってポート8445を外部公開
**影響度**: 高（セキュリティ）
**対処**:
- ファイアウォールでブロック
- Binding Hostを127.0.0.1に固定
- Tailscale等のVPN推奨

## 12. 参考資料

### 関連ドキュメント
- `docs/requirements/kb.md` - KB全般の要件
- `docs/requirements/dev-environment.md` - 開発環境設定
- `docs/operations/kb-setup.md` - KB運用手順
- `CLAUDE.md` - プロジェクト全体のガイド

### 実装ファイル
- `src/lib/obsidian.ts` - Obsidianクライアント
- `src/pages/api/obsidian/*.ts` - APIエンドポイント
- `scripts/kb/build.mjs` - KBビルドスクリプト
- `src/lib/kb/index.ts` - KB検索ユーティリティ

### 外部リンク
- [Obsidian Local REST API Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Obsidian](https://obsidian.md/)

---

**変更履歴**:
- 2025-11-09: 初版作成（HTTPS接続、絶対パス対応、セキュリティ要件）
