# Tailscale 運用要件（Apps/アプリコネクタとAPI）

最終更新: 2025-10-25

本書は Tailnet での「アプリコネクタ（Apps）」運用と Tailscale API 利用の最小要件/手順をまとめる。

---

## 1. 目的と効果
- SaaS/クラウド/自前アプリへの通信を、Linux コネクタノード経由でドメイン単位にルーティング（IP固定化してSaaSのIP制限に対応）
- Tailnet 外部への到達はコネクタのパブリックIPから行われる
- Exit node 使用時でも対象ドメインはコネクタ経由

参考: 公式「Set up an app connector」https://tailscale.com/kb/1342/app-connectors-setup

## 2. 前提（Requirements）
- コネクタ: Linux、パブリックIP、IPフォワーディング ON
- Tailnet ポリシーを更新できる権限（Owner/Admin/Network admin）
- 対象 SaaS の管理権限（IP アロウリスト設定）

## 3. Tailnet Policy（最小差分）
- tagOwners: コネクタに使うタグの所有者
- autoApprovers.routes: コネクタが広告するルートを自動承認（例: 0.0.0.0/0, ::/0 を tag:<connector-tag> に許可）
- grants: コネクタタグへの TCP/UDP 53 を最小付与（DNS ピア発見用）、必要に応じて autogroup:internet
- nodeAttrs: tailscale.com/app-connectors にアプリ定義（connectors にタグ、domains に対象ドメイン）

プリセットアプリを Apps 画面で追加した場合は nodeAttrs の presetAppID が自動設定される。

最小サンプル（policy.json; 必要箇所のみ抜粋・編集して利用）:

```
{
  "tagOwners": {
    "tag:github-app-connector": ["group:admins"]
  },
  "autoApprovers": {
    "routes": {
      "tag:github-app-connector": ["0.0.0.0/0", "::/0"]
    }
  },
  "grants": [
    {
      "src": ["tag:github-app-connector"],
      "dst": ["autogroup:internet:*"],
      "proto": "all"
    },
    {
      "src": ["autogroup:members"],
      "dst": ["tag:github-app-connector:53"],
      "proto": "tcp,udp"
    }
  ],
  "nodeAttrs": [
    {
      "target": ["tag:github-app-connector"],
      "appConnectors": [
        {
          "domains": [
            "github.com",
            "api.github.com"
          ]
        }
      ]
    }
  ]
}
```

備考:
- プリセットアプリ利用時は `appConnectors[0].presetAppID` が設定され、`domains` は不要
- ドメインは 250 ドメインの上限に注意（全コネクタ合計）

## 4. コネクタ起動例
Linux ノードで:

- advertise-connector と advertise-tags を付与
- 認証は tskey-auth（Auth key）。常設なら ephemeral=false、事前承認するなら preauthorized=true。

例（値はサンプル、実運用は Secrets 管理）:

```
tailscale up \
  --auth-key='tskey-auth-...?...ephemeral=false&preauthorized=true' \
  --advertise-connector \
  --advertise-tags=tag:github-app-connector
```

## 5. SaaS 側 IP 制限（推奨）
- Apps 画面の当該アプリ詳細で「Egress IPs」を確認→SaaS 側の IP アロウリスト設定に登録（CIDR でなく単一IP）
- 冗長化でコネクタを増やす場合は全 egress IP を登録（ローリング交換時の穴を防止）
- 変更検知: コネクタの再作成やリージョン変更で Egress IP が変わる可能性があるため、変更時の運用プロセス（通知→SaaS 側更新→完了確認）を Runbook に明記

## 6. 制約
- コネクタは Linux のみ
- 広告ルート 10K 超はクライアントに支障
- 全アプリ合計 250 ドメイン上限

## 7. API 利用（最小）
- PAT: tskey-api-... を Bearer で使用
- OAuth クライアント（推奨）: スコープ最小化、トークンは1時間で期限

デバイス一覧（tailnet は '-' 省略記法）:

```
curl -H "Authorization: Bearer $TAILSCALE_API_TOKEN" \
  "https://api.tailscale.com/api/v2/tailnet/-/devices"
```

  CI での扱い（推奨）:
  - ネットワーク依存を避けるため、デフォルトはスキップ（トークンが未設定ならスキップ終了）
  - スモーク専用ワークフローを `workflow_dispatch` の手動実行/限定ブランチにする

## 8. セキュリティ運用
- Secrets は .env.local（Git ignore 済）や環境変数で注入。リポジトリ未コミットを維持。
- ローテーション手順を別紙（運用 Runbook）に記載。漏えい兆候あれば即 Revoke。

## 9. 受け入れ基準（このドキュメント）
- Apps 追加→Policy 差分→コネクタ起動→SaaS 側 IP 設定の 4 ステップが1ページで完結
- 制約/落とし穴（Linux 限定、250 domains、10K routes）を明記
- API の最小スモーク（デバイス一覧）の手順が明記

## 付録 A: よくある SaaS の例
- GitHub: Organization → Settings → Security → IP allow list（Enterprise/Teams により可用性差異）
- Google Workspace: 管理コンソール → セキュリティ → ネットワーク制御（アプリ毎の制限は各製品設定）
- Okta: Security → Networks → IP Zones に Egress IP を allow
- Stripe: Developers → API → Allowed IP addresses（Egress IP を allow）
