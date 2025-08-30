# Guacamole QuickConnect と Entra ID (OIDC)

このリポジトリは、Apache Guacamole を Docker Compose で起動し、QuickConnect を有効化したうえで、Microsoft Entra ID (Azure AD) による OpenID Connect サインインを行う最小構成を提供します。`WEBAPP_CONTEXT` を `ROOT` にしているため、UI は `http://localhost:8080/` で提供されます。

英語版は `README.md` を参照してください。

## 同梱内容
- `compose.yml`: Guacamole と guacd の構成。`WEBAPP_CONTEXT=ROOT`、QuickConnect 有効。
- `.env`: Entra ID (Azure AD) の OpenID 値。`compose.yml` が参照します。

## 前提条件
- Docker / Docker Compose
- Entra ID テナントとアプリ登録の権限

## Entra ID のアプリケーション登録 (OIDC)
1) Azure ポータル → Azure Active Directory → アプリの登録 → 新規登録
- 名前: 例「Apache Guacamole」
- サポートされているアカウントの種類: この組織ディレクトリのアカウントのみ
- リダイレクト URI (Web): `http://localhost:8080/`（ルート）

2) 作成後、以下の値を `.env` に設定します:
- ディレクトリ (テナント) ID → `ENTRA_TENANT_ID`
- アプリケーション (クライアント) ID → `OPENID_CLIENT_ID`

3) 認証設定
- プラットフォーム構成 → Web → リダイレクト URI に `http://localhost:8080/` を追加/確認
- 暗黙的フロー/ハイブリッドフローを使う場合は「ID トークン」を有効化

- Enable ID tokens (implicit/hybrid): In Azure Portal > App registrations > Your app > Authentication > Implicit grant and hybrid flows > check “ID tokens” > Save. This unblocks response_type=id_token.

`AADSTS700054: response_type 'id_token' is not enabled` が出る場合は、上記の設定が正しくされているか再度確認してください。

## `.env` の設定
`.env.sample` を参考に編集し、以下を設定します:
- `ENTRA_TENANT_ID` = ディレクトリ (テナント) ID
- `OPENID_CLIENT_ID` = アプリケーション (クライアント) ID
- `OPENID_REDIRECT_URI` = `http://localhost:8080/`（Azure 登録の値と完全一致させる）

例:

```
ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
OPENID_CLIENT_ID=11111111-1111-1111-1111-111111111111
OPENID_REDIRECT_URI=http://localhost:8080/
```

## Docker Compose で起動
次を実行します:

```
docker compose up -d
```

`compose.yml:12` の `WEBAPP_CONTEXT=ROOT` により、ブラウザで `http://localhost:8080/` にアクセスします。表示に従って Entra ID でサインインしてください。

## QuickConnect の使い方
- QuickConnect は `compose.yml` で有効化済みです。
- サインイン後、トップのバーに接続文字列を入力して接続します。例:
  - SSH: `ssh://user@host:22`
  - RDP: `rdp://host:3389?username=user`
  - VNC: `vnc://host:5900`

## トラブルシューティング
- AADSTS700054: response_type 'id_token' is not enabled
  - 上記の手順で「ID トークン」を有効化するか、認可コードフローを使用します。
- サインインできない場合は、リダイレクト URI が完全一致しているか、テナント/クライアント ID が正しいかを確認してください。
