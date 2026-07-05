# TSIC WebUI

CEF/Chromium front-end (HTML/CSS/JS) for **The Store Is Closed** (TSIC).

This repository is consumed as a **git submodule** of
[`Chico-Games/TSIC`](https://github.com/Chico-Games/TSIC) at:

    Plugins/TSICWebUI/Content/UI/Web/

At runtime the TSICWebUI plugin's CEF scheme handler serves these files from that
path (`http://tsic.local/...`), picked up on the next page load (`WebUI.Reload`).

## Editing without the full game

These are plain HTML/CSS/JS assets — you can clone and iterate on the UI without an
Unreal Engine install or a full game checkout:

- `playground/` — interactive component playground
- `tests/` + `run-tests-headless.js` — headless test harness
- `debug-tools.html` / `debug-tools.ps1` — local debug utilities
- `api.md` — C++ ↔ JS message-bridge reference

> Requires [Git LFS](https://git-lfs.com) — a few PNG assets are LFS-tracked.

Changes reach the game by bumping the submodule pointer in the parent TSIC repo.
