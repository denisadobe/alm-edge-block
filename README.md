# ALM Edge Block Kit

This repo packages the **ALM Player block** + **Adobe I/O Runtime OAuth helper** for AEM Edge (Franklin).

## Contents
- `block/alm-player/` – block source files
- `runtime/app/` – Runtime OAuth helper (no secrets, no node_modules)
- `docs/` – setup docs

## Quick Start
1. Deploy the Runtime action in `runtime/app/`.
2. Add `almAuthUrl` to your site `placeholders` page (Runtime URL).
3. Use the `ALM Player` block with a `courseId`.

See `docs/ALM_PLAYER.md` for full instructions.
