# ALM Player Block Setup

## 1) Add Block Files
Copy the `block/alm-player/` folder into your site repo at:
```
blocks/alm-player/
```

## 2) Register the Block in UE
Add the block definition to these files in your site repo:

### `component-definition.json`
Add an entry under the `Blocks` group:
```
{
  "title": "ALM Player",
  "id": "alm-player",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": {
          "name": "ALM Player",
          "model": "alm-player"
        }
      }
    }
  }
}
```

### `component-models.json`
Add model:
```
{
  "id": "alm-player",
  "fields": [
    {
      "component": "text",
      "valueType": "string",
      "required": true,
      "name": "courseId",
      "label": "Course ID",
      "description": "Use v2 format like course:123456 (numeric also accepted). OAuth config is read from placeholders (almAuthUrl)."
    }
  ]
}
```

### `component-filters.json`
Allow block in section (optional):
```
"alm-player"
```

## 3) Deploy Runtime OAuth + Refresh
Go to `runtime/app/` and deploy:
```
aio app deploy
```

Set these env vars in `runtime/app/.env` (do not commit):
- `ALM_CLIENT_ID`
- `ALM_CLIENT_SECRET`
- `ALM_BASE_URL` (default `https://captivateprime.adobe.com`)

Runtime action URL example:
```
https://<namespace>.adobeioruntime.net/api/v1/web/alm-runtime/alm-oauth
```

## 4) Add Placeholder
Create a `placeholders` page in your site and add:
- Key: `almAuthUrl`
- Text: `<runtime-url>`

Optional for multi-user environments:
- Enter the user email in the popup before login to scope refresh tokens per user.

Check:
```
https://<site>.aem.page/placeholders.json
```

## 5) Use the Block
```
ALM Player
course:123456
```

The block first tries `/alm-refresh` in the background. If no refresh token exists,
it opens OAuth in a popup, stores `access_token` + `expires_in` in `localStorage`,
and loads the player across all course blocks.

Multi-user note:
- Use the `email` query param on `almAuthUrl` so each user gets their own refresh token.
