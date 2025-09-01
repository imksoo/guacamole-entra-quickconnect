# Guacamole QuickConnect with Entra ID (OIDC)

This repository provides a minimal Apache Guacamole setup that enables QuickConnect and integrates sign‑in with Microsoft Entra ID (Azure AD) via OpenID Connect. The web app context is set to root, so the UI is served at `http://localhost:8080/`.

Japanese version: see `README-ja.md`.

## First-time Setup
- Build the custom extension JAR:
  - `mvn -f quickconnect-force-recording/pom.xml package`
  - This produces `quickconnect-force-recording/target/quickconnect-force-recording-1.0.0.jar` which is mounted into the Guacamole container by `compose.yml`.
- Prepare the recording storage on the host (guacd writes here):
  - `mkdir -p recordings/rec recordings/ts`
  - `sudo chown -R $USER:$USER recordings`
  - `sudo chmod -R 0777 recordings`  (relax for first run; tighten as needed in your environment)

## What’s Included
- `compose.yml`: Guacamole + guacd via Docker Compose. `WEBAPP_CONTEXT=ROOT`, QuickConnect enabled.
- `.env`: Entra ID (Azure AD) OpenID values consumed by `compose.yml`.

## Prerequisites
- Docker and Docker Compose
- An Entra ID tenant and permission to create App registrations

## Register an Entra ID Application (OIDC)
1) Azure Portal → Azure Active Directory → App registrations → New registration
- Name: e.g., “Apache Guacamole”
- Supported account types: Accounts in this organizational directory only
- Redirect URI (Web): `http://localhost:8080/` (root context)

2) After creating the app, copy these values for your `.env` file:
- Directory (tenant) ID → `ENTRA_TENANT_ID`
- Application (client) ID → `OPENID_CLIENT_ID`

3) Authentication settings
- Platform configurations → Web → add/confirm Redirect URI: `http://localhost:8080/`
- Implicit grant and hybrid flows → check “ID tokens” if you use implicit/hybrid

- Enable ID tokens (implicit/hybrid): In Azure Portal > App registrations > Your app > Authentication > Implicit grant and hybrid flows > check “ID tokens” > Save. This unblocks response_type=id_token.

Note: Modern “Authorization Code Flow + PKCE” does not require enabling implicit ID tokens. If you see error `AADSTS700054: response_type 'id_token' is not enabled`, either enable the above toggle or ensure your client uses code flow.

4) Client secret (recommended for code flow)
- Certificates & secrets → New client secret → copy the value (store securely). If needed by your setup, add it to the environment as another variable and map it in `compose.yml`.

## Configure `.env`
Use `.env.sample` as a reference, then set:
- `ENTRA_TENANT_ID` = Directory (tenant) ID
- `OPENID_CLIENT_ID` = Application (client) ID
- `OPENID_REDIRECT_URI` = `http://localhost:8080/` (must match the Azure registration)

Example:

```
ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
OPENID_CLIENT_ID=11111111-1111-1111-1111-111111111111
OPENID_REDIRECT_URI=http://localhost:8080/
```

## Start with Docker Compose
Run:

```
docker compose up -d
```

Open the UI at `http://localhost:8080/` (root path because `WEBAPP_CONTEXT=ROOT`). Sign in with Entra ID when prompted.

## QuickConnect
- QuickConnect is enabled in `compose.yml`.
- After sign‑in, enter a connection URI in the top bar. Examples:
  - SSH: `ssh://user@host:22`
  - RDP: `rdp://host:3389?username=user`
  - VNC: `vnc://host:5900`

## Troubleshooting
- AADSTS700054: response_type 'id_token' is not enabled
  - Enable ID tokens as described above, or use Authorization Code Flow.
- If you can’t sign in, verify Redirect URI matches exactly and that tenant/client IDs are correct.
