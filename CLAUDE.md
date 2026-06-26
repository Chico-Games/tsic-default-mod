# TSIC-WebUI — CEF/Chromium front-end

This repo is the HTML/CSS/JS front-end for **The Store Is Closed (TSIC)**. It is
consumed as a **git submodule** of [`Chico-Games/TSIC`](https://github.com/Chico-Games/TSIC)
at `Plugins/TSICWebUI/Content/UI/Web/`, and served at runtime by the TSICWebUI
plugin's CEF scheme handler (`http://tsic.local/...`, refreshed with the
`WebUI.Reload` console command in-game).

## Editing standalone (no game / engine needed)

These are plain web assets — clone this repo on its own and iterate:

- `playground/` — interactive component playground
- `tests/` + `run-tests-headless.js` — headless test harness
- `debug-tools.html` / `debug-tools.ps1` — local debug utilities
- `api.md` — C++ ↔ JS message-bridge reference

Requires [Git LFS](https://git-lfs.com) — a few PNG assets are LFS-tracked.

## Architecture (where rendering actually lives)

The live UI is ONE CEF "Root" view. `screens/in-game.html` is the shell; `shared/hud.js`
loads the HUD components (`shared/hud-*.js`) and `screen-manager.js` mounts menu screens
whose logic lives in `shared/screens/*.js`. **Before editing a screen's inline `<script>`,
search `shared/` for the module that actually renders it** — several `screens/*.html` pages
are dead duplicates that are never loaded at runtime. Put rendering in a shared module and
have the HTML just load it.

Core utilities (use these, don't hand-roll): `shared/dom.js` (`TSIC.el()`/`TSIC.svg()`),
`shared/icons.js` (`TSIC.itemIconUrl()`/`TSIC.keyIconUrl()`/`TSIC.iconImg()`),
`shared/tsic-runtime.js` (`tsic.whenReady()`, `tsic.playSound()`).

## Committing from inside the game checkout

When working in a full TSIC checkout, this folder is a submodule, so a UI change is **two
commits**: commit + push here, then bump the submodule pointer in the parent TSIC repo.
`Scripts/commit-webui.ps1 "<message>"` (in the TSIC repo) does both. Note a freshly
`git submodule update`-d checkout lands in **detached HEAD** — `git checkout main` here
before committing.
