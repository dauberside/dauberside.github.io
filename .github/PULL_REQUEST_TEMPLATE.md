# PR チェックリスト

- [ ] `./scripts/sync-templates.sh --check` を実行してテンプレート差分がないことを確認しました。
- [ ] 必要なら `./scripts/sync-templates.sh` を実行して生成物 (`spec/templates/`) を更新し、変更をコミットしました。
- [ ] `./spec/scripts/validate-spec.sh` をローカルで実行してエラーがないことを確認しました。
- [ ] 変更点が spec/templates に関わる場合、`spec/templates` 配下のテンプレートを編集したことを確認しました。

注意:
- CI は PR 時に自動で同期チェックと検証を実行します。CI が「Templates are out of sync」で失敗した場合は、上記コマンドをローカルで実行して差分をコミットしてください。
- 重要: テンプレート本体の編集は `spec/templates` を単一ソースとして行ってください。`spec/templates/` は生成物です。