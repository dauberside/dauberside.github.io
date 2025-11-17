# ADR: KB埋め込みモード選択（OpenAI / Hash二重モード）の採択

- ID: ADR-0005
- 日付: 2025-11-17
- 状態: Accepted
- 決定者: プロジェクトオーナー（dauberside）
- 関連:
  - `docs/requirements/kb.md`
  - `docs/operations/kb-setup.md`
  - `scripts/kb/build.mjs`
  - `src/lib/kb/index.ts`
  - ADR-0004（Obsidian二層統合）

## 背景（Context）

- Knowledge Base（KB）の構築には、テキストの埋め込みベクトル生成が必要
- OpenAI Embeddings API（`text-embedding-3-small`）は高精度だがコストとAPI依存がある
- 開発中はAPI呼び出しを避けてコストを削減し、オフライン環境でも動作させたい
- 本番環境では高精度な埋め込みによる正確な検索結果が必要
- KB再ビルド時に変更されたファイルのみを再埋め込みする「Delta検出」が必要

## 決定（Decision）

**2つの埋め込みモードを実装し、環境変数で切り替え可能にする。**

### モードA: OpenAI埋め込み（本番）

**用途**: 本番環境、高精度な検索が必要な場合

**特徴**:
- **モデル**: `text-embedding-3-small`
- **次元数**: 1536次元
- **精度**: 高精度なセマンティック検索
- **コスト**: API呼び出しごとに課金
- **必須環境変数**: `OPENAI_API_KEY`

**環境変数**:
```bash
KB_EMBED_MODE="openai"  # デフォルト
OPENAI_API_KEY=<your-key>
```

### モードB: Hash埋め込み（開発/フォールバック）

**用途**: 開発環境、コスト削減、オフライン動作

**特徴**:
- **アルゴリズム**: SHA256ハッシュベースの決定的埋め込み
- **次元数**: 1536次元（OpenAIと互換）
- **精度**: 完全一致のみ、セマンティック検索不可
- **コスト**: ゼロ（API不要）
- **オフライン**: 完全にローカルで動作

**環境変数**:
```bash
KB_EMBED_MODE="hash"
# OPENAI_API_KEY 不要
```

### Delta検出（増分ビルド）

**両モード共通の最適化機能**

- **仕組み**: SHA256ハッシュによるファイル内容の変更検出
- **動作**:
  1. 既存の `kb/index/embeddings.json` を読み込み
  2. 各ファイルのSHA256ハッシュを計算
  3. ハッシュが変更されたファイルのみ再埋め込み
  4. 変更なしのファイルは既存の埋め込みを再利用
- **効果**:
  - 大幅な時間短縮（変更ファイルのみ処理）
  - APIコスト削減（OpenAIモードでも変更分のみ課金）

## 根拠（Rationale）

### なぜ二重モードか？

| 要件 | OpenAIモード | Hashモード |
|------|--------------|-----------|
| **開発環境** | ❌ API課金 | ✅ 無料 |
| **本番環境** | ✅ 高精度 | ❌ 低精度 |
| **オフライン** | ❌ API必須 | ✅ 完全ローカル |
| **セマンティック検索** | ✅ 可能 | ❌ 不可 |
| **完全一致検索** | ✅ 可能 | ✅ 可能 |
| **コスト** | 💰 API課金 | 💰 無料 |
| **CI/CD** | ❌ キー管理必要 | ✅ キー不要 |

### メリット

1. **開発効率の向上**
   - 開発中はHashモードでAPI課金を回避
   - KBの構造テスト・デバッグが無料
   - CI/CDでのビルド時にAPI不要

2. **本番品質の確保**
   - 本番ではOpenAIモードで高精度検索
   - セマンティック検索による柔軟なクエリ対応

3. **コスト最適化**
   - Delta検出により変更ファイルのみ埋め込み
   - 開発環境でのAPI課金ゼロ

4. **フォールトトレランス**
   - OpenAI APIが一時的に利用不可でもHashモードにフォールバック可能
   - キーの期限切れやレート制限時の対応策

5. **テスト容易性**
   - Hashモードで完全一致検索のテストが可能
   - モック不要で確定的な動作

## 代替案（Alternatives）

### 代替A: OpenAIモードのみ
- すべての環境でOpenAI Embeddings APIを使用
- **問題**:
  - 開発中の不要なAPI課金
  - CI/CDでAPI キー管理が必要
  - オフライン環境で動作不可
  - APIレート制限のリスク

### 代替B: Hashモードのみ
- すべての環境でHashベース埋め込みを使用
- **問題**:
  - セマンティック検索不可（完全一致のみ）
  - 本番環境での検索品質が低い
  - 類似文書の検索が困難

### 代替C: 別の埋め込みサービス（Cohere, Hugging Face など）
- OpenAI以外のEmbeddings APIを使用
- **問題**:
  - 複数APIの管理が必要
  - コスト比較の複雑性
  - APIごとの次元数・形式の違い

### 代替D: ローカルモデル（Sentence Transformers など）
- ローカルでTransformerモデルを実行
- **問題**:
  - モデルのダウンロード・管理が必要
  - 実行環境の依存関係が増加
  - パフォーマンスがハードウェアに依存

## 影響（Consequences）

### メリット

- ✅ 開発環境でのAPI課金ゼロ
- ✅ 本番環境での高精度検索
- ✅ CI/CDでのビルドが容易
- ✅ オフライン環境での動作可能
- ✅ Delta検出による増分ビルド
- ✅ フォールトトレランス

### リスク/コスト

- ⚠️ **モード切り替えの理解**: 用途に応じた適切なモード選択が必要
  - **緩和策**: ドキュメントで明確に説明、デフォルトを適切に設定
- ⚠️ **Hashモードの制限**: セマンティック検索不可
  - **緩和策**: 開発中のみ使用、本番では必ずOpenAIモード
- ⚠️ **環境変数の設定ミス**: 本番でHashモードを使用してしまうリスク
  - **緩和策**: 本番環境の設定チェック、デフォルトをOpenAIに設定

## 実装ノート（Implementation Notes）

### ファイル構成

- `scripts/kb/build.mjs`: KB構築スクリプト（モード切り替え実装）
- `src/lib/kb/index.ts`: KB読み込みと検索
- `kb/index/embeddings.json`: 埋め込みインデックス（Delta検出用ハッシュ含む）

### 環境変数

```bash
# デフォルト（本番）
KB_EMBED_MODE="openai"
OPENAI_API_KEY=<your-key>

# 開発/テスト
KB_EMBED_MODE="hash"
# OPENAI_API_KEY 不要
```

### Delta検出の仕組み

```typescript
// 既存インデックスの読み込み
const existingIndex = await loadExistingIndex();

// ファイルごとにハッシュ計算
for (const file of files) {
  const content = await readFile(file);
  const hash = sha256(content);

  // ハッシュが変更されていない場合はスキップ
  if (existingIndex[file]?.hash === hash) {
    console.log(`Skipping ${file} (unchanged)`);
    continue;
  }

  // 変更されたファイルのみ埋め込み生成
  const embedding = await generateEmbedding(content, mode);
  newIndex[file] = { content, embedding, hash };
}
```

### KB構築コマンド

```bash
# 開発環境（Hashモード）
KB_EMBED_MODE=hash pnpm kb:build

# 本番環境（OpenAIモード）
KB_EMBED_MODE=openai pnpm kb:build

# デフォルト（OpenAIモード）
pnpm kb:build
```

### セキュリティ考慮事項

1. **APIキーの管理**
   - `.env.local` に保存（Git除外）
   - 本番環境は環境変数で注入

2. **Mock禁止**
   - `KB_API_MOCK=1` は開発環境のみ
   - `NODE_ENV=production` では mock 無効化

3. **モード検証**
   - 本番環境で意図しないHashモード使用を警告

## フォローアップ（Follow-ups）

### 短期（1週間以内）

- [x] `scripts/kb/build.mjs` でモード切り替え実装
- [x] Delta検出機能の実装
- [x] `docs/requirements/kb.md` 更新
- [x] Context Capsule更新

### 中期（1ヶ月以内）

- [ ] KBビルドのCI統合（Hashモード使用）
- [ ] 本番環境でのモード検証スクリプト
- [ ] Delta検出のパフォーマンス測定

### 長期（3ヶ月以内）

- [ ] 他の埋め込みプロバイダの評価（Cohere, Hugging Face）
- [ ] ローカルモデルの検証（Sentence Transformers）
- [ ] ハイブリッド検索の検討（埋め込み + キーワード）

## 関連ADR

- ADR-0001: Context Capsule と ADR 運用プロセス
- ADR-0004: Obsidian二層統合

---

この ADR により、KB構築は開発環境でのコスト削減と本番環境での高精度検索を両立し、Delta検出による効率的な増分ビルドが実現される。
