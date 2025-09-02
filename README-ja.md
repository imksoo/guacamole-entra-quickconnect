# Guacamole QuickConnect と Entra ID (OIDC)

このリポジトリは、Apache Guacamole を Docker Compose で起動し、QuickConnect を有効化したうえで、Microsoft Entra ID (Azure AD) による OpenID Connect サインインを行う最小構成を提供します。`WEBAPP_CONTEXT` を `ROOT` にしているため、UI は `http://localhost:8080/` で提供されます。

英語版は `README.md` を参照してください。

## 初回セットアップ
- 自作拡張（JAR）のビルド:
- `mvn -f quickconnect-recording-defaults/pom.xml package`
- 生成物は `quickconnect-recording-defaults/target/quickconnect-recording-defaults-1.6.0.jar` で、`compose.yml` により Guacamole コンテナへマウントされます。
- 録画保存先フォルダ（ホスト側、guacd が書き込み）を準備:
  - `mkdir -p recordings/rec recordings/ts`
  - `sudo chown -R $USER:$USER recordings`
  - `sudo chmod -R 0777 recordings`（初回は緩めに。運用では適切な権限に調整してください）

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

## QUICKCONNECT_DEFAULT_* 環境変数での QuickConnect 既定パラメータ

`quickconnect-recording-defaults` 拡張は、サーバー（Guacamole コンテナ）の環境変数から QuickConnect に付与する既定パラメータを公開する REST API を提供します（Guacamole 1.6 以降の拡張 REST 配下）。

- エンドポイント:
  - `http://localhost:8080/api/ext/quickconnect-recording-defaults/ping`
  - `http://localhost:8080/api/ext/quickconnect-recording-defaults/defaults`
  - `WEBAPP_CONTEXT` が `ROOT` でない場合は `/guacamole` を先頭に付けてください。
- プレフィックス: `QUICKCONNECT_DEFAULT_`（例: `QUICKCONNECT_DEFAULT_ENABLE_FONT_SMOOTHING=true`）
- 変換規則: `QUICKCONNECT_DEFAULT_ENABLE_FONT_SMOOTHING` → `enable-font-smoothing`
- 注意: `QUICKCONNECT_ENABLED=true`（QuickConnect 機能の有効化）とバッティングしないよう `QUICKCONNECT_DEFAULT_` を採用しています。

- 既存の同名パラメータがある場合は上書きします（ユーザー入力や既定より優先します）

Docker Compose の環境変数例（guacamole サービス）:

```
environment:
  QUICKCONNECT_ENABLED: "true"          # QuickConnect 機能の有効化（従来どおり）
  QUICKCONNECT_DEFAULT_ENABLE_FONT_SMOOTHING: "true"
  QUICKCONNECT_DEFAULT_IGNORE_CERT: "true"
  QUICKCONNECT_DEFAULT_SECURITY: "nla"
```

本拡張は REST API のみを使用します。静的 JSON（qc-env.json）や window 変数のフォールバックは廃止しました。

### 動作確認コマンド
- `curl -i http://localhost:8080/api/ext/quickconnect-recording-defaults/ping`
- `curl -s http://localhost:8080/api/ext/quickconnect-recording-defaults/defaults | jq`
