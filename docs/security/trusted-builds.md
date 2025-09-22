# Trusted builds policy (pnpm approve-builds)

このプロジェクトは、依存パッケージのインストールスクリプト（preinstall/install/postinstall）の実行をデフォルトで禁止し、必要最小限のみを許可します。

- 設定: `pnpm-workspace.yaml`
- キー: `onlyBuiltDependencies`
- 現在の許可リスト: `unrs-resolver`

## 背景

- サプライチェーン攻撃対策として、依存の postinstall などを無条件に実行しません。
- ネイティブ拡張や事前ビルドバイナリの配置など、機能上必要なケースに限り個別許可します。

## 運用ルール（概要）

1) 必要性の確認
- スクリプトがないと機能しないのか（ネイティブ拡張、WASM 生成など）
- 代替（prebuilt ダウンロード済み、純 JS 実装）がないか

2) 実行内容の確認
- `package.json` の `preinstall`/`install`/`postinstall` の中身を確認
- ネットワークアクセスの有無、ダウンロード先 URL、ハッシュ検証の有無
- 書き込み先が自パッケージ配下に限定されているか

3) リスク判断
- 外部スクリプトのダウンロード実行、難読化、テレメトリ送信等がないか
- 供給元（メンテナ/Org）と公開実績

4) 許可と固定
- `pnpm-workspace.yaml` の `onlyBuiltDependencies` に追記
- lockfile でバージョンを固定し、更新時は再監査

## 実査のヒント

- 参照元の把握
  ```sh
  pnpm why <pkg>
  pnpm ls <pkg>
  ```
- スクリプトの確認
  ```sh
  pnpm view <pkg> scripts repository homepage
  # またはローカル解決パス
  cat node_modules/.pnpm/<pkg>*/node_modules/<pkg>/package.json
  ```
- アーカイブ内容
  ```sh
  ver=$(pnpm view <pkg> version)
  pnpm pack "<pkg>@${ver}"
  tar -tf *.tgz | head -n 50
  ```

## 現状の許可リスト

- `unrs-resolver` — ネイティブ/バイナリ系のセットアップが必要なため許可

将来、別の依存で警告が出た場合は、本ドキュメントのフローに従い監査のうえ許可可否を判断してください。
