# Flosi Blocks Kit

This repo packages reusable AEM Edge blocks and related helpers.

## Contents
- `block/alm-player/` – ALM Player block
- `block/target-mbox/` – Adobe Target mbox block (with fallback image support)
- `runtime/app/` – Runtime OAuth helper used by ALM Player
- `docs/` – setup and integration docs

## Available Docs
- `docs/ALM_PLAYER.md`
- `docs/TARGET_MBOX.md`
- `docs/RUNTIME.md`

## Quick Start
1. Copy the desired block folder from `block/<block-name>/` into your site repo `blocks/<block-name>/`.
2. Register it in `component-definition.json`, `component-models.json`, and `component-filters.json`.
3. Follow the block-specific doc under `docs/`.

For ALM runtime setup, use `runtime/app/` and follow `docs/RUNTIME.md`.
