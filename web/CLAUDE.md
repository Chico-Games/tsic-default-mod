# web/ — CEF/Chromium front-end

This folder is the HTML/CSS/JS front-end for **The Store Is Closed (TSIC)**. It ships
inside the default mod (`com.chicogames.default`), which the game checkout consumes as a
git submodule at `Mods/com.chicogames.default/`. It is served at runtime by the TSICWebUI
plugin's CEF scheme handler (`http://tsic.local/...`, refreshed with the `WebUI.Reload`
console command in-game). Other mods override individual files via their own `web/`
folder (overlay roots are searched before this base content).

## Editing standalone (no game / engine needed)

These are plain web assets — clone this repo on its own and iterate:

- `playground/` — interactive component playground
- `tests/` + `run-tests-headless.js` — headless test harness
- `debug-tools.html` / `debug-tools.ps1` — local debug utilities
- `api.md` — C++ ↔ JS message-bridge reference

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

When working in a full TSIC checkout, `Mods/com.chicogames.default/` is a submodule, so a
UI change is **two commits**: commit + push here (branch `beta`), then bump the submodule
pointer in the parent TSIC repo. `Scripts/commit-defs.ps1 "<message>"` (in the TSIC repo)
does both. Note a freshly `git submodule update`-d checkout lands in **detached HEAD** —
the helper script handles the `beta` checkout automatically.
