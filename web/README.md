# TSIC Web Front-End

CEF/Chromium front-end (HTML/CSS/JS) for **The Store Is Closed** (TSIC).

This folder lives inside the **default mod**
([`Chico-Games/tsic-default-mod`](https://github.com/Chico-Games/tsic-default-mod)),
which the game checkout consumes as a git submodule at `Mods/com.chicogames.default/`.
At runtime the TSICWebUI plugin's CEF scheme handler serves these files straight from
disk (`http://tsic.local/...`), picked up on the next page load (`WebUI.Reload`).

Other mods can override individual files by shipping their own `web/` folder — the
scheme handler searches mod overlay roots before this base content.

## Editing without the full game

These are plain HTML/CSS/JS assets — you can clone this repo and iterate on the UI
without an Unreal Engine install or a full game checkout:

- `playground/` — interactive component playground
- `tests/` + `run-tests-headless.js` — headless test harness
- `debug-tools.html` / `debug-tools.ps1` — local debug utilities
- `api.md` — C++ ↔ JS message-bridge reference

Changes reach the game by bumping the submodule pointer in the parent TSIC repo
(`Scripts/commit-defs.ps1 "<message>"` in the TSIC repo does both commits).

> History note: this folder was grafted from the archived
> [`Chico-Games/TSIC-WebUI`](https://github.com/Chico-Games/TSIC-WebUI) repo via
> `git subtree` — full history is preserved in this repo.
