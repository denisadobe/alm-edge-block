# Runtime OAuth Helper

## Purpose
Handles ALM OAuth on the server side and returns an `access_token` in HTML for the popup.

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

Use the returned URL as `almAuthUrl` in placeholders.
