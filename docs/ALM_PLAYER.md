# ALM Player Block (AEM Edge)

This block embeds Adobe Learning Manager (ALM) courses using the Captivate Prime player and an Adobe I/O Runtime OAuth helper.

**Quick Summary**
1. Deploy the Runtime actions (OAuth + refresh helper).
2. Add the `almAuthUrl` placeholder pointing to the Runtime action.
3. Use the `ALM Player` block with a `courseId`.

---

## File Structure (what to share)

Copy these files to any repo that should support the block:

- `blocks/alm-player/alm-player.js`
- `blocks/alm-player/alm-player.css`
- `blocks/alm-player/_alm-player.json`
- `component-definition.json` (registers the block)
- `component-models.json` (adds the block model)
- `component-filters.json` (if you want it in the Section block list)

---

## Runtime (OAuth Helper)

This runs in Adobe I/O Runtime and exchanges OAuth codes for `access_token`. It also
stores a `refresh_token` to enable background refresh.

### Action URL (example)
```
https://<namespace>.adobeioruntime.net/api/v1/web/alm-runtime/alm-oauth
```

### Environment Variables
Set in the Runtime project `.env` (do not commit secrets):
- `ALM_CLIENT_ID`
- `ALM_CLIENT_SECRET`
- `ALM_BASE_URL` (default: `https://captivateprime.adobe.com`)

### Deploy
```
aio app deploy
```

---

## Placeholders (per site)

Create a `placeholders` page in the site and add this entry:

- Key: `almAuthUrl`
- Text: `https://<namespace>.adobeioruntime.net/api/v1/web/alm-runtime/alm-oauth`

Multi-user environments:
- The runtime scopes refresh tokens by a per-browser session id (sent via OAuth `state`).

Validate:
```
https://<site>.aem.page/placeholders.json
```
Must include `almAuthUrl`.

---

## Using the Block

Add the block and provide only the `courseId` (v2 format):

```
ALM Player
course:123456
```

The block:
1. Tries `/alm-refresh` in the background.
2. If no refresh token exists, opens OAuth login in a popup.
3. Stores `access_token` + `expires_in` in `localStorage` (shared across tabs).
4. Loads the player for any course block on the site.

Multi-user note:
- Refresh tokens are scoped by a per-browser session id (OAuth `state`).

---

## Notes

- Tokens expire. The block uses `expires_in` to refresh automatically. If refresh fails, open the popup again.
- `courseId` can be numeric; it will be normalized to `course:<id>`.
- Default player URL uses `https://captivateprime.adobe.com`.
