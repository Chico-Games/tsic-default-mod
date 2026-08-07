# Menu Style Guide

Rules for building **menu screens** — main menu, pause, settings, save/load, mods,
inventory, storage, crafting, production, construction, terminal, credits.

**Not the HUD.** HUD components (`shared/hud-*.js`, `hud.css`) invert this language:
translucent dark plates, `.tsic-chip--dark`, `--tsic-text` white-on-scene. Menus are
**paper**. Don't mix the two vocabularies in one element.

Source of truth is the CSS, in load order:

| File | Owns |
| --- | --- |
| `shared/base.css` | tokens, reset, stages, scrollbars. `@import`s `tsic-ui.css` at the top. |
| `shared/tsic-ui.css` | layout primitives, list rows, typography, tabs, dropdowns, context menus, focus mirrors |
| `shared/components.css` | buttons, panels, inputs, row-buttons, slots, bars, masthead/cover, stickers/badges |

---

## 1. The look

Late-80s gaming-magazine print. A menu is a **page of a magazine**, not a window:
cream paper, heavy black borders, hard offset block shadows with **no blur**, one
loud red, one loud yellow. Zero border-radius, zero glow, zero gradients-as-decoration
(the only gradients are halftone dot fields and the striped bar fill).

Three ideas do most of the work:

1. **The plate.** Everything interactive is a print plate sitting *above* the page —
   a hard offset shadow, lifted on hover, slammed flush on press.
2. **The halftone.** Dot fields carry depth instead of blur or opacity.
3. **The department conceit.** Menu rows are magazine articles: a department number
   on the left, a page number on the right, `>>` as the bullet.

---

## 2. Tokens

**Never write a raw hex in a menu.** Every value below already exists.

### Paper (fills)

| Token | Value | Use |
| --- | --- | --- |
| `--paper-cream` | `#f0e8d0` | panel fill; the default page |
| `--paper-bright` | `#fffdf3` | *inset* surfaces — list panes, inputs, slots, row-buttons |
| `--paper-muted` | `#e3d8b8` | hover fill, disabled fill, bar tracks, scrollbar track |
| `--paper-soft` | `#ede4cb` | active/pressed row fill |
| `--paper` | `#f4ecd8` | legacy; prefer `--paper-cream` |

The rhythm is **cream panel → bright inset → muted on hover**. If a surface reads
"you can put things in it" (a list, a field, a slot), it's `--paper-bright`.

### Ink (text, borders, shadows)

| Token | Value | Use |
| --- | --- | --- |
| `--ink-night` | `#0a0a0a` | all borders, all shadows, primary text |
| `--ink-soft` | `#4a4239` | secondary text, eyebrows, meta, inactive tabs |
| `--ink-mute` | `#6c6357` | disabled text, dashed rules, toggle-off track |
| `--ink` | `#1a1612` | legacy body ink |

`--border-black` is an alias of `--ink-night`. Borders and shadows are *always*
`--ink-night` — never a tinted or translucent border on a menu surface.

### Accents

| Token | Value | Use |
| --- | --- | --- |
| `--mag-red` | `#e60000` | **the** accent: primary buttons, selection, `>>`, active tab, focus, danger |
| `--mag-red-dark` | `#c70000` | link hover, overburdened state |
| `--mag-red-deep` | `#a80000` | ghost-button press |
| `--mag-yellow` | `#ffcc00` | stickers, corner labels, stack counts, rebind hover, capacity warning |

Red is overloaded on purpose — it means "this one" whether that's selected, primary,
focused, or dangerous. **Yellow is punctuation, never a surface.** It never fills
anything larger than a chip.

### Dark tokens — do not use on paper

`--bg-deep`, `--bg-panel`, `--tsic-text` (`#ffffff`), `--tsic-text-dim` belong to the
HUD and to scrims. `body` inherits `color: var(--tsic-text)` (white), so **text placed
outside a stage or panel is invisible.** Always sit inside `.tsic-stage--*` or
`.tsic-panel` — both set `color` to ink.

### `--cat-*` is legacy

`--cat-paper`, `--cat-ink`, `--cat-green`, `--cat-shadow`… are back-compat aliases
remapped onto this palette. They still resolve; **don't author new code with them.**

### Geometry

| Thing | Value |
| --- | --- |
| Border radius | **`0`.** Only exception: switch pills (`11–12px`) and status dots (`50%`). |
| Panel border | `4px solid var(--ink-night)` |
| Plate border (buttons, context menu, dropdown portal, sticker) | `3px` |
| Inset border (list pane, input, slot, dropdown, divider) | `2px` |
| Tab-bar underline | `4px` |
| Shadow | `--shadow-block-sm` `2px 2px 0`, `--shadow-block` `4px 4px 0` (default), `--shadow-block-lg` `6px 6px 0` — all `0` blur, all `--ink-night` |
| Stack / row gap | `12px`; `--sm` variants `6px`; split columns `8px` |
| Panel padding | `18px` |

### Item grid

`--tsic-slot: clamp(38px, calc((100vw - 560px) / 16), 68px)`, `--tsic-slot-gap: 6px`,
`--tsic-slot-rows: 6`. Derive columns, row heights and scroll caps from these — never
hardcode slot pixels.

**Do not rescope `--tsic-slot` per screen.** It is one global size, and the clamp already
sizes it for the widest layout the player can open (storage's two 8-wide grids either side
of the 300px rail); above ~1500px wide it simply is 68px. Storage used to scope itself to
54px, which meant every cell in the bag changed size the moment a container was opened. A
screen that cannot fit at the shared size should drop a column, not shrink the grid.

---

## 3. Type

Five faces, each with **one job**. Using the wrong face is the fastest way to make a
screen look off-language.

| Token | Face | Job |
| --- | --- | --- |
| `--font-display` | Bebas Neue → Bahnschrift Condensed → Impact | Every headline, button, list row, tab, dropdown, empty state. Always `text-transform: uppercase` with positive letter-spacing. |
| `--font-terminal` | VT323 → Consolas | **Numbers and machine text**: counts, capacities, timestamps, dates, values, `Dept.` labels. |
| `--font-body` | Inter → Segoe UI | Eyebrows, badges, field labels, and the only place real sentences live. |
| `--font-action` | Russo One | Stickers only. |
| `--font-pixel` | Press Start 2P | Slot stack counts only (`9px`). |

`--font-hand` (three handwriting faces) is for lore notes — **never menu chrome**.

### Scale

| Class | Size | Tracking |
| --- | --- | --- |
| `.tsic-masthead-title` | `56px` (`64px` inside `.tsic-cover`) | `-0.02em`, line-height `0.9` |
| `.tsic-cover .tsic-masthead-title em` | `24px` italic, **block** kicker above the focal word | `0.02em` |
| `.tsic-title--lg` | `42px` | `0.04em` |
| `.tsic-title` | `28px` | `0.06em` |
| `.tsic-row-button` | `22px` | `0.06em` |
| `.tsic-button` | `18px` (`.sm` 15, `.lg` 26) | `0.12em` |
| `.tsic-title--sm` | `18px` | `0.10em` |
| `.tsic-tab` | `16px` | `0.08em` |
| `.tsic-list-row` | `14px` | `0.04em` |
| `.tsic-meta` | `13px` terminal | `0.04em` |
| `.tsic-eyebrow` / `.tsic-byline` / `.tsic-badge` | `10px`, weight `800` | `0.18em` / `0.08em` |

The masthead is the only place with **negative** tracking — it's set tight because it's
set huge. Everything else opens up as it shrinks: the smaller the type, the wider the
tracking.

---

## 4. Two archetypes

Pick one. Don't invent a third.

### A. Cover page — front-end / full-screen menus

Main menu, settings, save/load, mods, credits, new-store, death, loading. Centred
"magazine cover" on a halftone field.

```html
<body>
  <div class="tsic-stage--magazine-gradient">
    <div class="tsic-panel tsic-cover" style="--tsic-cover-width: 580px;">

      <div class="tsic-masthead">
        <div class="tsic-masthead-title">
          <em>Pick up where</em>
          You Left Off.
        </div>
        <div class="tsic-masthead-meta">
          <span class="tsic-masthead-issue">Dept. 12</span>
          <span class="tsic-masthead-date">Welcome back!</span>
        </div>
      </div>

      <!-- page content -->

      <div class="tsic-cover-rows" data-tsic-focus-group="actions">
        <button class="tsic-row-button" data-tsic-initial-focus>
          <span class="tsic-row-dept">Fire Exit</span>
          Back to Main
          <span class="tsic-row-pg">PG. 01</span>
        </button>
      </div>
    </div>
  </div>
</body>
```

- `--tsic-cover-width` defaults to `520px`; `max-width: 92vw`. In use: 520 (main menu),
  580 (save/load), 900 (settings).
- `.tsic-cover` sets `padding: 0` — the masthead and `.tsic-cover-rows` carry their own.
- Stage knobs: `--tsic-stage-paper-alpha` (default `0.35` — the game shows through)
  and `--tsic-stage-dot-strength` (`0.45`).
- **Navigation on a cover page is `.tsic-row-button`, not `.tsic-button`.** Rows are the
  archetype; plate buttons are for actions inside content.
- Give scrolling content a **fixed height** so switching tabs never resizes the cover.
  Settings uses `height: 62vh; min-height: 320px; max-height: 720px` plus
  `scrollbar-gutter: stable`.

### B. Screen panel — in-game modals

Inventory, crafting, production, upgrade, repair, wardrobe, summoner. A scrim over
live gameplay with a fixed-proportion panel and two list columns.

```html
<div class="tsic-modal-scrim">
  <div class="tsic-panel tsic-panel--screen">
    <h2 class="tsic-title" style="margin:0;">Production</h2>

    <div class="tsic-split">
      <div class="tsic-split-col">
        <div class="tsic-eyebrow">Recipes</div>
        <div class="tsic-list-pane"><!-- .tsic-list-row items --></div>
      </div>
      <div class="tsic-split-col">
        <div class="tsic-eyebrow">Details</div>
        <div id="p-info"></div>
        <button class="tsic-button">Add to Queue</button>
      </div>
    </div>

    <div class="tsic-close-row">
      <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
    </div>
  </div>
</div>
```

- `.tsic-panel--screen` is `60vw × 60vh`, clamped `720–1200 × 420–760`. Don't override —
  it exists so panels agree with each other at 1080p *and* 4K.
- `.tsic-split` is `1.1fr / 1fr`, gap `12px`. Left = the list, right = detail + actions.
- Every column gets a `.tsic-eyebrow` header. Every scrolling list is a `.tsic-list-pane`.
- Scrim: default `rgba(13,14,21,0.55)`; `--dim` `0.78`; `--clear` transparent (pause menu,
  which wants the world visible).

**Storage variant.** Storage / universal-storage build an auto-sized `#ss-panel` grid
instead of `--screen`, because two grids side by side can't fit the fixed proportion.
Reuse `shared/storage-shell.js` rather than re-deriving it.

---

## 5. Components

### Buttons — one shape, four roles

`.tsic-button` is the plate: `3px` ink border, `--shadow-block`, `18px` uppercase
display type, `0.12em` tracking, `40px` min-height, plus a `1px` inner hairline
(`::before`) that reads as the plate edge.

The lift is the signature and **never changes between variants**:

- hover → `translate(-2px, -2px)` + `--shadow-block-lg` (rises)
- active → `translate(3px, 3px)` + `1px 1px 0` (slams flush)

| Variant | Rest | Hover |
| --- | --- | --- |
| *(default)* primary | red fill, paper type | `#ff1a1a` |
| `.secondary` / `.cancel` | bright paper, ink type | inverts to solid ink |
| `.danger` (alias `.pink`) | ink fill, drifting red halftone dots, `#ff5a4d` type | floods red |
| `.ghost` | type only, no border/shadow | red rule sweeps in from the left |

Sizes `.sm` / `.lg`. `:disabled` comes last in the cascade — muted paper, mute ink,
`--shadow-block-sm`, animation off — so it always reads disabled regardless of variant.

The `.danger` dot drift is the one continuous animation in the menu system, and it's
already wrapped in `prefers-reduced-motion`. **Don't add a second ambient animation.**

### Row-button — the menu row

`.tsic-row-button` on `--paper-bright`, `2px dashed --ink-mute` top border,
`22px` display caps, red `>>` prefix. Hover slides `padding-left: 14px → 22px` and
nudges the `>>` `2px` right. Optional accessories:

- `.tsic-row-dept` — flush-left terminal-font department label (`Dept. 04`, `Fire Exit`)
- `.tsic-row-pg` — flush-right ink chip page number, `opacity: 0` until hover/focus

### List row — the article row

`.tsic-list-row` inside a `.tsic-list-pane`: `14px` display caps, `1px dashed` bottom
rule, `.icon` / `.name` / `.right` slots. Hover fills `--paper-muted` and indents `4px`;
`.is-selected` fills solid red with a white `>>`; `.is-locked` mutes to `--ink-mute`.

Non-`<button>` rows **must** carry `data-tsic-focusable` and `tabIndex = -1` — see §7.

### Tabs

The bar treatment keys off the **`data-tsic-tab-bar` attribute**, not a class:
borderless labels sitting on a `4px` ink underline, active tab a solid red block whose
lower edge meets the rule (`bottom: -4px` overlap). No gaps, no vertical dividers.

```html
<div id="tabs" data-tsic-tab-bar></div>   <!-- + .tsic-tab children -->
```

`TSIC.TabFilter.create(hostEl, tabs, onChange)` builds them for you. The attribute also
enables gamepad LB/RB cycling — a tab strip without it is unreachable on a controller.

### Everything else

| Class | Notes |
| --- | --- |
| `.tsic-input` | bright paper, `2px` ink, terminal font. Focus turns the border red — no ring. |
| `.tsic-dropdown` + `.tsic-dropdown-portal` | `tsic-dropdown.js`. Open state fills red. Selected option gets a red `>>`. Use this, never a bare `<select>`. |
| `.tsic-context-menu` / `.tsic-context-item` | `3px` border, `--shadow-block`, pops in over `120ms`. Items must be real `<button>`s. |
| `.tsic-slot` | `56px` default (grids override via `--tsic-slot`). `.count` is a yellow pixel-font chip, bottom-right. |
| `.tsic-bar-track` / `.tsic-bar-fill` | `18px`, `45°` striped red. `--yellow` / `--ink` fill modifiers. |
| `.tsic-sticker` / `.tsic-badge` / `.tsic-corner-label` | Yellow sticker + ink badge + yellow corner tag. Punctuation only. |
| `.tsic-empty` | The empty state. Display caps, centred, `--ink-soft`. Always use it — never a bare `<p>`. |
| `.tsic-divider` (solid `2px`) / `.tsic-divider--dashed` | Dashed separates *peers*; solid separates *sections*. |
| `.tsic-barcode` | Pure-CSS mock barcode for masthead corners. |
| `.tsic-link` | Red, red underline. |

### Motion budget

`80–180ms`, `ease` or `linear`. Buttons move transform/shadow in `90ms` and colour in
`150ms`. Slide-in indents run `120–160ms`. Shared entrances: `.tsic-anim-overlay`
(fade `120ms`) and `.tsic-anim-pop` (`140ms` overshoot). Nothing in a menu animates for
longer than `180ms` except the `.danger` dot drift.

---

## 6. States

Same four states everywhere:

| State | Treatment |
| --- | --- |
| Hover | fill steps `--paper-bright` → `--paper-muted`; plates lift; rows indent |
| Selected | solid `--mag-red` + white type + white `>>` |
| Disabled | `--paper-muted` fill, `--ink-mute` type, `cursor: not-allowed`, no lift, no animation |
| Focused | **mirrors hover exactly** — see below |

### Focus mirrors hover

There is deliberately **no focus ring** in menus (removed 2026-07-06). A focused
control reads exactly like a hovered one. `tsic-focus.js` achieves this by walking the
stylesheets once on `load` and synthesising, for every `:hover` rule, a matching
`html:is([data-tsic-input="Gamepad"], [data-tsic-kbnav]) …[data-tsic-focused]` rule.

**So: write `:hover` and gamepad focus is free — with one trap.**

> The mirror runs **once, at page load**, over `document.styleSheets`. Every SPA screen
> module injects its `<style>` at first *mount*, which is after that. **Those `:hover`
> rules are never mirrored.** If your screen injects CSS at mount time (all
> `shared/screens/*.js` do), hand-write the focused rule next to the hover rule:
>
> ```css
> .my-thing:hover { background: var(--paper-muted); }
> html:is([data-tsic-input="Gamepad"], [data-tsic-kbnav]) .my-thing[data-tsic-focused] {
>   background: var(--paper-muted);
> }
> ```
>
> This is why `tsic-ui.css` carries a hand-written mirror block (§10) for every shared
> component. Add to it rather than duplicating the pattern per screen.

`:focus-visible` on `.tsic-button` does still draw a `3px` ink outline at `4px` offset,
for plain keyboard tabbing.

---

## 7. Required plumbing

Visual correctness isn't enough — a menu that skips this is unusable on a controller,
or eats the player's input.

### Standalone page (`screens/*.html`)

```html
<meta name="tsic-screen"     content="LoadSave">
<meta name="tsic-input-mode" content="InputMode.Menu.MainMenu">
<meta name="tsic-cancel-cmd" content="UI.Cmd.Menu.Back">
<meta name="tsic-focus"      content="enabled">
<meta name="tsic-action-bar-context" content='[]'>
```

**`tsic-input-mode` is not optional.** Without an active input situation, `UI.Behavior.*`
never fires and neither D-pad nor keyboard navigation produces events — the screen is
mouse-only and can look completely dead on a controller. Headless tests cannot catch
this. `router.js` appends the tag on load and releases it on `pagehide`/`beforeunload`.

### SPA overlay (`shared/screens/*.js`)

In-game menus are overlays inside the `in-game.html` shell, not navigations. Same
three concerns, passed to `registerScreen`:

```js
TSIC.registerScreen('Production', {
  inputModeTag: 'InputMode.Menu.Production',
  cancelCmd:    'UI.Cmd.Pause.Resume',
  actionBarContext: [{ ActionName: 'IA_UI_ConfirmAccept', Label: 'Build', Priority: 10 }],
  template: TEMPLATE,
  mount(root, ctx) { /* one-time */ },
  onShow(params, ctx) {}, onHide(ctx) {},
});
```

Scope all screen CSS under `[data-screen="Name"]` and inject it once via an
id-guarded `<style>`.

### Focus attributes

| Attribute | Meaning |
| --- | --- |
| `data-tsic-focus-group="nav"` | Navigation island. Give each region one (`nav`, `actions`, `slot-list`, `setting-list`). |
| `data-tsic-initial-focus` | Exactly one per screen — where focus lands on open. |
| `data-tsic-focusable` | Makes a non-`<button>` focusable. Pair with `tabIndex = -1`. |
| `data-tsic-skip-focus` | Excludes an element. |
| `data-tsic-focus-id` | Stable id so focus memory survives a re-render. |
| `data-tsic-nav-<dir>="selector"` | Override spatial nav for one direction. |
| `data-tsic-tab-bar` | Tab strip → LB/RB cycling. |

Nav is spatial nearest-in-direction with same-row/column overlap preferred, so **visual
layout is navigation order.** If a control is visually orphaned, it's hard to reach.
Nested focusables resolve parent-first: from outside, nav lands on the row; the inner
button is only reachable once focus is inside.

### Boot and sound

```js
tsic.bootMenu(({ on, publish }) => { on('tsic.msg.UI.Foo', render); });
```

`bootMenu` waits for the bridge, then wires Esc and `#btn-close`. Never hand-roll
`whenReady` polling, Esc handlers, or `UI.Cmd.Pause.Resume` publishes.

Sound goes through `tsic.playSound(key, vol)` — never publish `UI.Cmd.Sound.Play`
directly. Existing keys: `UI.Open`, `UI.Accept`, `UI.Focus`, `UI.Error`, `UI.TabSwitch`,
`Pause.Open`, `Pause.Close`, `Container.Open`, `Container.Close`,
`Inventory.Transfer`, `Map.Open`, `Map.Close`, `Map.Ping`, `Map.Reset`, `Ping.Hover`,
`Ping.Confirm`, `Recipe.Added`, `Recipe.Removed`, `Recipe.Completed`,
`Notification.Show`, `Objective.Complete`, `Chat.Send`, `Chat.Receive`.

### DOM and icons

`TSIC.el()` / `TSIC.svg()` from `shared/dom.js`. Icons **only** via
`TSIC.itemIconUrl()` / `TSIC.keyIconUrl()` / `TSIC.iconImg()` — never a hardcoded
`/tex/item-icon/` path (JSON-hydrated definitions are asset-registry-invisible; icons
resolve through a delegate).

---

## 8. Copy

The department conceit is a real system, not decoration — commit to it or drop it,
don't half-apply it.

- **Masthead.** Italic block kicker + focal phrase: *"Pick up where / You Left Off."*,
  *"The Fine / Print."*, *"The Store is / Closed."* The kicker sets up, the focal
  phrase lands, and the period is part of it.
- **Departments** are the in-world naming layer for destinations. Settings is
  `Dept. 88`, saves are `Dept. 12`, mods are `Dept. 33`; anything that exits is
  `Fire Exit`. Numbers are arbitrary but **stable per destination** — reuse the
  existing number when you link to a screen.
- **Page numbers** (`.tsic-row-pg`) match the department (`PG. 88`), or are a word for
  terminal actions (`END`, `RESET`, `DEV`).
- **Meta line** is one short in-world aside: *"Welcome back!"*, *"Shopping, your way."*
  Never instructions.
- **Buttons name the outcome**, and keep that name through the flow: "Add to Queue",
  "Save and Return to Main Menu", "Leave the Store". Not "Submit", not "OK".
- **Empty states are short and flat**, in `.tsic-empty`: "No saves yet.",
  "No recipes available."
- Numbers are terminal-font; sentences are body-font; anything a player clicks is
  display-font uppercase.

Room to be playful: the main menu's kicker rotates ~30 taglines through
`tsic.kicker(slot, lines, suffix)`. Only the title screen does this.

---

## 9. Traps

Every one of these has cost someone time.

1. **`tsic-ui.css` is loaded only via `@import` from `base.css`.** Pages link
   `base.css` + `components.css`. The playground's live-refresh misses `@import`ed
   sheets — click Reload after editing it.
2. **`.tsic-tab-strip` is not defined anywhere.** `settings.html` carries it, and it
   does nothing. The hook is `data-tsic-tab-bar`.
3. **`.tsic-stage--magazine` (the non-gradient stage) has zero users.** Every live
   menu uses `.tsic-stage--magazine-gradient`.
4. **`screens/<name>.html` is a dead duplicate for any screen with a
   `shared/screens/<name>.js` module** — `inventory`, `map`, `crafting`, `production`,
   `pause-menu`, `construction`, `terminal`, `bug-report`. Editing the HTML changes
   nothing in-game. Search `shared/` before editing any screen.
5. **The hover→focus mirror doesn't see mount-time CSS.** See §6.
6. **Text outside a stage or panel is white on cream.** `body` colour is
   `--tsic-text`. Stages and `.tsic-panel` set ink.
7. **`--cat-*` tokens are legacy aliases.** They resolve; don't author with them.
8. **`docs/ui-art-reference.md` describes the removed UMG/CommonUI stack** —
   `CBS_*`, `CBTNS_*`, `Content/UI/Styles/`. None of it applies. This file supersedes it
   for menus.
9. **`shared/tsic-runtime.js` still ships a `TEMP-PERF-PROBE`** that publishes
   `RAFPROBE`/`MOVEPROBE` cheat commands on a `5s` interval. It's marked
   "remove before commit" and wasn't. Don't copy the pattern; delete it when convenient.

---

## 10. New-menu checklist

- [ ] Archetype chosen: cover page or screen panel — not a new one
- [ ] Inside `.tsic-stage--magazine-gradient` (cover) or `.tsic-modal-scrim` (panel)
- [ ] Zero raw hex; zero border-radius; zero blurred shadows
- [ ] Display font uppercase for anything clickable; terminal font for every number
- [ ] Navigation via `.tsic-row-button` (cover) or `.tsic-list-row` (panel)
- [ ] Tab strips carry `data-tsic-tab-bar`
- [ ] Empty state uses `.tsic-empty`
- [ ] `tsic-input-mode` declared (meta or `inputModeTag`) — verified **in game**, on a controller
- [ ] `tsic-focus` enabled, one `data-tsic-initial-focus`, a `data-tsic-focus-group` per region
- [ ] Non-button focusables have `data-tsic-focusable` + `tabIndex = -1`
- [ ] Mount-time `:hover` rules have hand-written `[data-tsic-focused]` twins
- [ ] Esc/Back closes via `bootMenu` or `cancelCmd`
- [ ] Open/close sound via `tsic.playSound`
- [ ] Icons via `TSIC.itemIconUrl()`; DOM via `TSIC.el()`
- [ ] Scrolling content is height-clamped so tab switches don't resize the panel
- [ ] Department + page number reuse the existing numbers for that destination
