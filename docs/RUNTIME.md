# Runtime OAuth Helper

## Purpose
Handles ALM OAuth on the server side and refreshes tokens for background use.

## Setup
1. Open `runtime/app/.env` and set:
```
ALM_CLIENT_ID=...
ALM_CLIENT_SECRET=...
ALM_BASE_URL=https://captivateprime.adobe.com
```

2. Deploy:
```
cd runtime/app
# login if needed
# aio login

aio app deploy
```

3. Get URL:
```
aio app get-url
```

Use the returned URL as `almAuthUrl` in placeholders. The refresh endpoint is
`/alm-refresh` in the same runtime package.

Optional:
- OAuth scopes refresh tokens by a per-browser session id (OAuth `state`).
