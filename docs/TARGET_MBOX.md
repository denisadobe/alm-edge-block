# Target Mbox Block (AEM Edge)

This block fetches Adobe Target offers using an authored `mbox` name and applies the result to the block container.

**Quick Summary**
1. Ensure Adobe Target (at.js/Launch) is loaded on the page.
2. Add the `Target Mbox` block and author `mbox`.
3. Optionally set `Fallback Image` for no-offer/error/timeout cases.

---

## File Structure (what to share)

Copy these files to any repo that should support the block:

- `blocks/target-mbox/target-mbox.js`
- `blocks/target-mbox/target-mbox.css`
- `blocks/target-mbox/_target-mbox.json`
- `component-definition.json` (registers the block)
- `component-models.json` (adds `mbox` and `fallbackImage` fields)
- `component-filters.json` (if you want it available in Section insert list)

---

## Register in Universal Editor

### `component-definition.json`
Add `target-mbox` definition (or include via wildcard from `blocks/*/_*.json`).

### `component-models.json`
Ensure this model exists:
- `id: target-mbox`
- fields:
  - `mbox` (text, required)
  - `fallbackImage` (reference, optional)

### `component-filters.json`
In the `section` filter list, add:
- `target-mbox`

---

## Authoring

In UE, add a `Target Mbox` block and fill:
- `Mbox Name` (required)
- `Fallback Image` (optional)

---

## Runtime Behavior

The block waits for `window.adobe.target` and then runs:
- `getOffer({ mbox })`
- `applyOffer({ selector, offer })`

Fallback image is rendered when:
- no usable offer content is returned,
- request errors,
- Adobe Target is unavailable within timeout,
- or apply step leaves the block empty.

---

## Debug Tips

1. Use `.aem.page` if Launch/Target is only loaded in preview.
2. In DevTools Network, confirm a delivery call with `execute.mboxes` and your `mbox` name.
3. If response is `204` or no decision content, block should render fallback (if authored).
4. Check console logs prefixed with `target-mbox:`.
