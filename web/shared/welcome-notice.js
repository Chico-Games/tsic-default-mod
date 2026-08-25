// shared/welcome-notice.js
//
// The closed-alpha welcome bulletin — a one-shot modal over the title screen.
//
// EDITING THE COPY: everything a build-to-build update touches is in the three
// constants at the top of this file. Bump NOTICE_VERSION whenever you want every
// player to see the bulletin again (a new alpha build); leave it alone for a typo
// fix. Newest UPDATES entry first; KNOWN_ISSUES is ordered worst-first.
//
// PERSISTENCE: the "already seen" flag rides on the ui.welcome_seen setting, which
// is written through UI.Cmd.Settings.Set and read back off the sticky
// UI.Settings.Value echo — the same path the menu-music slider uses. localStorage
// is NOT an option here: OpenWebInterfaceBrowserSingleton hands CEF a cache_path
// under a fresh FGuid every launch and deletes the old folders, so web storage is
// wiped between sessions and the bulletin would greet the player forever.
//
// The setting is absent in the playground and in Chrome. There the bulletin always
// shows, which is what you want while you are working on it.

(function () {
    'use strict';

    // ── Bump to re-show the bulletin to everyone ──────────────────────────
    // Convention: the short SHA of the build being shipped, so the flag and the
    // masthead can never drift apart. ../TSIC-BuildArchive/Development names every
    // uploaded build <date>_<time>_<sha> — that folder is the list of builds
    // players actually have, and the UPDATES entries below are one per build.
    const NOTICE_VERSION = 'e9e6cf5c0';

    const ISSUE_LINE = 'Vol.1 — Closed Alpha';
    const DATE_LINE  = 'Build e9e6cf5 · 25 Aug 2026';

    // ── What's new. One entry per uploaded build, newest first. ───────────
    const UPDATES = [
        {
            date: '25 Aug',
            build: 'e9e6cf5',
            title: 'A first launch that settles itself',
            items: [
                'A fresh install now warms its shaders behind a setup screen instead of hitching '
                + 'its way through your first session. It ends when the shaders are actually done, '
                + 'not when a timer says so, and tells you what it compiled.',
                'A guest’s craft and production orders go through. The host was refusing them and '
                + 'saying nothing — the order simply vanished off the guest’s screen.',
                'Fixed a launch that could hang on a black screen and never recover, on Nvidia cards. '
                + 'A shader check fired while the upscaler was still starting up and stalled the frame.',
                'The inventory character is framed head-to-toe again instead of being scaled up and '
                + 'clipped at the edges of its panel.',
                'Television static is half as loud.',
            ],
        },
        {
            date: '25 Aug',
            build: '6d2b9b7',
            title: 'The handbook, and a quieter night',
            items: [
                'Hold <kbd>Tab</kbd> for the staff handbook — every objective as a card, with hints, '
                + 'field notes and a live controls page. In co-op the right panel is the shift roster: '
                + 'who is on, their health, which floor they are on and the way to walk.',
                'The night hazard is gone. It drained 1 health every 8 seconds all night and re-armed '
                + 'the regen block with every bite, so nothing ever healed it back — attrition, not pressure.',
                'Biome ambience is a night-only bed. By day the store plays its jazz and nothing else; '
                + 'the two used to stack and the room tone masked the music.',
                'The flashlight beam stops swinging out of frame on a fast turn, and your own body and '
                + 'worn gear no longer throw a shadow down your own beam.',
                'Guests get the full item catalogue on join — items used to render as raw ids with no '
                + 'description for the whole session.',
                'Dragged furniture moves for guests again. It had been frozen until you let go since 18 Aug.',
            ],
        },
        {
            date: '24 Aug',
            build: '0652fca',
            title: 'Hits that land, and better defaults',
            items: [
                'Hit reactions are physics-driven: enemies flinch on every hit and go down on a break.',
                'Enemies keep their feet on the floor while attacking, shorten their stride on stairs '
                + 'and slow to a walk on a climb.',
                'A tile decides its enemies while you are still a LOD ring away, instead of after it '
                + 'has finished generating.',
                'Crafting materials trimmed from 123 to 30, the research currencies collapsed into one, '
                + 'and every recipe and loot table rebuilt around the shorter list.',
                '45 layout slots that could never spawn anything now do.',
                'Mouse smoothing is off — it was inherited from the engine, not chosen, and it cost aim latency.',
                'New first-launch defaults: native resolution instead of 67%, a 200 FPS cap, and master '
                + 'volume at 60% so a first launch does not open at full blast.',
                'Starvation is a stamina penalty now and cannot move your health bar at all.',
                'The construction ghost renders as a ghost instead of raw checkerboard.',
            ],
        },
        {
            date: '19 Aug',
            build: 'd035c9b',
            title: 'The store learns to make noise',
            items: [
                'A full audio pass: footsteps that read the surface underfoot, weapon impacts that sound '
                + 'like the weapon and not just what it hit, a destruction sound per breakable material, '
                + 'and drag scrapes that sound like a chair on wood.',
                'Every biome has its own room acoustics — the SCP base does not sound like the shop floor.',
                'Break a table and its debris throws the material the table was actually made of.',
                'The torch is now a flashlight, with a beam that replicates to everyone else.',
                'Layout placement refuses any spot that stands inside a wall.',
                'Aisle sign lettering stops z-fighting with the board it sits on.',
                'Guests get the shops, benches and queues the host already had.',
            ],
        },
        {
            date: '15 Aug',
            build: '925c00a',
            title: 'Fifty-two fixes',
            items: [
                'The death screen, the wardrobe, the equipment paperdoll and the repair station were all '
                + 'built and tested and unreachable. They are wired up.',
                'Every new game on a map used to generate the identical world — the seed was hardcoded.',
                'Projectiles replicate: other players can see a bolt in flight and where it stuck.',
                'Ping markers work in co-op instead of only for the host.',
                'Crafting is server-enforced — it checked neither station nor level before.',
                'Reading a note no longer eats it and shows you nothing.',
            ],
        },
    ];

    // ── Known issues. Worst first. ────────────────────────────────────────
    // Every entry is an OPEN issue on the tracker, and `ref` is its number so a
    // player can search before filing a duplicate. Anything closed comes off this
    // list and, if a player would notice, goes into that build's UPDATES entry.
    const KNOWN_ISSUES = [
        { tag: 'Co-op',    ref: 325, text: 'Furniture flashes when a drag starts and again when it settles.' },
        { tag: 'Co-op',    ref: 391, text: 'Lights a guest switches off can keep moving for the host.' },
        { tag: 'Co-op',    ref: 328, text: 'Dragged furniture is driven rather than simulated on other machines, so it can look stiff in transit.' },
        { tag: 'Enemies',  ref: 298, text: 'BoneHead, Gardener and TVHead never break the warehouse boxes blocking their path — they just stop.' },
        { tag: 'Saves',    ref: 380, text: 'Loading a save made after a visit to the Pit sets you on fire on arrival.' },
        { tag: 'Store',    ref: 330, text: 'Furniture near stairs and height changes spawns floating, or hangs off the edge of the steps.' },
        { tag: 'Store',    ref: 359, text: 'Some furniture spawns facing the wrong way, or lying down when it should stand.' },
        { tag: 'Store',    ref: 353, text: 'Aisle sign lettering and framed photos z-fight at some angles — the text flickers as you walk past.' },
        { tag: 'Store',    ref: 373, text: 'Railings generate along edges with no drop, and are missing from some real ones.' },
        { tag: 'Combat',   ref: 377, text: 'Landing on a bed or a sofa from height does no damage at all.' },
        { tag: 'Breakage', ref: 356, text: 'Eighteen materials across fifteen breakable pieces render flat grey once destroyed.' },
        { tag: 'Frames',   ref: 342, text: 'An occasional hard hitch during play that we have not pinned to a cause yet.' },
        { tag: 'Menus',    ref: 323, text: 'Hovering some menu buttons changes their shape and shifts the row.' },
        { tag: 'Menus',    ref: 375, text: 'The Windows cursor shows through the in-game one over menu scrollbars.' },
        { tag: 'Menus',    ref: 376, text: 'The mouse look-speed slider cannot be click-dragged, and sits too low in Controls.' },
        { tag: 'Night',    ref: 258, text: 'Signs cast wrong shadows at night.' },
    ];

    // ─────────────────────────────────────────────────────────────────────

    const CSS = `
/* Sits above the title screen's own stacking. */
#welcome-notice { z-index: 400; }

#welcome-notice .wn-panel {
    width: min(1020px, 94vw);
    height: min(700px, 90vh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
}

/* Header band. The masthead carries its own 4px rule, so the band only
   supplies the padding around it. */
#welcome-notice .wn-head { padding: 18px 18px 0; flex: 0 0 auto; }
#welcome-notice .tsic-masthead { margin-bottom: 12px; }
#welcome-notice .tsic-masthead-title { font-size: 44px; }
#welcome-notice .tsic-masthead-title em {
    display: block;
    font-size: 18px;
    letter-spacing: 0.02em;
    margin-bottom: 2px;
}

/* The thank-you line — one sentence, so the only place body font is set at
   reading size. */
#welcome-notice .wn-letter {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0 0 14px;
}

#welcome-notice .wn-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0 18px;
    display: flex;
    flex-direction: column;
}

/* Both columns are always on screen — the player should not have to discover
   that the known-issues list exists. .tsic-split's 1.1fr/1fr gives the updates
   side the extra room, since its rows wrap least. */
#welcome-notice .wn-pane {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    background: var(--paper-bright);
    border: 2px solid var(--ink-night);
    padding: 12px 14px;
}
#welcome-notice .tsic-eyebrow {
    flex: 0 0 auto;
    margin: 0;
    border-bottom: 4px solid var(--ink-night);
    padding-bottom: 6px;
}

/* ── What's new ── */
#welcome-notice .wn-entry { margin-bottom: 16px; }
#welcome-notice .wn-entry:last-child { margin-bottom: 0; }
#welcome-notice .wn-entry-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-bottom: 2px dashed var(--ink-mute);
    padding-bottom: 4px;
    margin-bottom: 8px;
}
#welcome-notice .wn-entry-date {
    font-family: var(--font-terminal);
    font-size: 14px;
    letter-spacing: 0.08em;
    background: var(--ink-night);
    color: var(--paper-cream);
    padding: 1px 7px;
    flex: 0 0 auto;
}
#welcome-notice .wn-entry-title {
    font-family: var(--font-display);
    font-size: 20px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-night);
}
/* The build's short SHA. Verifiable against ../TSIC-BuildArchive, and the thing
   a player quotes back when they report against a build that is no longer live. */
#welcome-notice .wn-entry-build {
    margin-left: auto;
    flex: 0 0 auto;
    font-family: var(--font-terminal);
    font-size: 12px;
    letter-spacing: 0.06em;
    color: var(--ink-mute);
}
#welcome-notice .wn-entry ul { list-style: none; margin: 0; padding: 0; }
#welcome-notice .wn-entry li {
    font-family: var(--font-body);
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-soft);
    padding: 3px 0 3px 20px;
    position: relative;
}
#welcome-notice .wn-entry li::before {
    content: '>>';
    position: absolute;
    left: 0;
    top: 3px;
    font-family: var(--font-display);
    font-weight: 900;
    color: var(--mag-red);
}
#welcome-notice kbd {
    font-family: var(--font-terminal);
    font-size: 12px;
    background: var(--paper-muted);
    border: 1px solid var(--ink-night);
    padding: 0 5px;
    color: var(--ink-night);
}

/* ── Known issues ── */
#welcome-notice .wn-issue {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--ink-mute);
}
#welcome-notice .wn-issue:last-child { border-bottom: 0; }
#welcome-notice .wn-issue-tag {
    flex: 0 0 78px;
    font-family: var(--font-terminal);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mag-red);
    padding-top: 1px;
}
#welcome-notice .wn-issue-text {
    font-family: var(--font-body);
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-soft);
}
/* The tracker number, so a player can search before filing a duplicate. */
#welcome-notice .wn-issue-ref {
    font-family: var(--font-terminal);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--ink-mute);
    margin-left: 6px;
    white-space: nowrap;
}
#welcome-notice .wn-issue-note {
    font-family: var(--font-body);
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-mute);
    border-top: 2px solid var(--ink-night);
    margin: 12px 0 0;
    padding-top: 10px;
}

/* ── Footer ── */
#welcome-notice .wn-foot {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 18px 16px;
}
#welcome-notice .wn-foot-note {
    font-family: var(--font-terminal);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-mute);
}

/* Narrow windows: the two columns stop being a split and stack, with each pane
   given its own share of the height rather than one long scroll. */
@media (max-width: 820px) {
    #welcome-notice .tsic-split { grid-template-columns: minmax(0, 1fr); grid-auto-rows: 1fr; }
}
`;

    function injectCss() {
        if (document.getElementById('welcome-notice-css')) return;
        const style = document.createElement('style');
        style.id = 'welcome-notice-css';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // dom.js is the house helper; the fallback only exists so the bulletin still
    // renders on a bare test page that has not loaded it.
    const el = (tag, attrs, ...kids) => (window.TSIC && TSIC.el)
        ? TSIC.el(tag, attrs, ...kids)
        : (function () {
            const n = document.createElement(tag);
            for (const k in (attrs || {})) {
                if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
            }
            for (const kid of kids) n.append(kid);
            return n;
        })();

    function buildUpdates() {
        const host = el('div', { class: 'wn-pane', id: 'wn-pane-updates',
                                 'data-tsic-focus-group': 'notice-body' });
        for (const entry of UPDATES) {
            const list = el('ul', {});
            for (const item of entry.items) {
                const li = el('li', {});
                li.innerHTML = item;   // the copy above is the only source, and it carries <kbd>
                list.append(li);
            }
            host.append(el('div', { class: 'wn-entry' },
                el('div', { class: 'wn-entry-head' },
                    el('span', { class: 'wn-entry-date' }, entry.date),
                    el('span', { class: 'wn-entry-title' }, entry.title),
                    entry.build ? el('span', { class: 'wn-entry-build' }, entry.build) : null),
                list));
        }
        return host;
    }

    function buildIssues() {
        const host = el('div', { class: 'wn-pane', id: 'wn-pane-issues',
                                 'data-tsic-focus-group': 'notice-issues' });
        for (const issue of KNOWN_ISSUES) {
            host.append(el('div', { class: 'wn-issue' },
                el('span', { class: 'wn-issue-tag' }, issue.tag),
                el('span', { class: 'wn-issue-text' }, issue.text,
                    issue.ref ? el('span', { class: 'wn-issue-ref' }, '#' + issue.ref) : null)));
        }
        host.append(el('p', { class: 'wn-issue-note' },
            'Found something that is not on this list? Press F8 in game to file it — '
            + 'the report carries your seed and the last few seconds of the log, which is '
            + 'the difference between a fix and a guess.'));
        return host;
    }

    function build() {
        const scrim = el('div', { class: 'tsic-modal-scrim tsic-modal-scrim--dim tsic-anim-overlay',
                                  id: 'welcome-notice', role: 'dialog', 'aria-modal': 'true',
                                  'aria-label': 'Welcome to the closed alpha' });

        const split = el('div', { class: 'tsic-split' },
            el('div', { class: 'tsic-split-col' },
                el('div', { class: 'tsic-eyebrow' }, "What's New"),
                buildUpdates()),
            el('div', { class: 'tsic-split-col' },
                el('div', { class: 'tsic-eyebrow' }, 'Known Issues'),
                buildIssues()));

        const closeBtn = el('button', { class: 'tsic-button lg', id: 'wn-close',
                                        'data-tsic-initial-focus': '' }, 'Close');

        scrim.append(el('div', { class: 'tsic-panel tsic-anim-pop wn-panel' },
            el('div', { class: 'wn-head' },
                el('div', { class: 'tsic-masthead' },
                    el('div', { class: 'tsic-masthead-title' },
                        el('em', {}, 'Welcome to the'),
                        'Closed Alpha.'),
                    el('div', { class: 'tsic-masthead-meta' },
                        el('span', { class: 'tsic-masthead-issue' }, ISSUE_LINE),
                        el('span', { class: 'tsic-masthead-date' }, DATE_LINE))),
                el('p', { class: 'wn-letter' },
                    'Thank you for playing, and for every bug you have reported — '
                    + 'they are why the store gets better each build.')),
            el('div', { class: 'wn-body' }, split),
            el('div', { class: 'wn-foot' },
                el('span', { class: 'wn-foot-note' }, 'F8 files a report · Enter or Esc to close'),
                closeBtn)));

        return { scrim, closeBtn };
    }

    // ── Public API ────────────────────────────────────────────────────────
    //
    // TSIC.WelcomeNotice.show()  — force it open (playground, a "View bulletin" row)
    // TSIC.WelcomeNotice.mount() — open it only if this build's bulletin is unseen
    //
    const SETTING_KEY = 'ui.welcome_seen';

    let openScrim = null;

    function close(markSeen) {
        if (!openScrim) return;
        const scrim = openScrim;
        openScrim = null;

        if (markSeen && window.tsic && tsic.publishMessage) {
            tsic.publishMessage('UI.Cmd.Settings.Set',
                { Key: SETTING_KEY, ValueJson: JSON.stringify(NOTICE_VERSION) });
        }
        if (window.tsic && tsic.focus && tsic.focus.popScope) tsic.focus.popScope();
        document.removeEventListener('keydown', onKeydown, true);
        scrim.remove();
    }

    // Raw DOM keys. In game the web view does NOT hold keyboard focus (see the
    // hard rule in tsic-runtime.js), so this fires in Chrome, the playground and
    // the test harness only — the in-game paths are the two subscriptions in
    // show(). Both are needed; neither covers the other.
    function onKeydown(ev) {
        if (!openScrim) return;
        if (ev.key !== 'Enter' && ev.key !== 'Escape') return;
        // Swallow it. The title screen is the front-end root — its own Esc has
        // nowhere to go — but a bubbling Escape still reaches bootMenu's handler.
        ev.stopPropagation();
        ev.preventDefault();
        close(true);
    }

    function show() {
        if (openScrim) return;
        injectCss();
        const { scrim, closeBtn } = build();
        document.body.appendChild(scrim);
        openScrim = scrim;

        closeBtn.onclick = () => close(true);
        document.addEventListener('keydown', onKeydown, true);

        if (window.tsic && tsic.playSound) tsic.playSound('UI.Open');
        // Modal scope: nav cannot step out onto the menu rows behind the scrim,
        // and UI.Behavior.Back (Esc / gamepad B) pops it through onPop.
        if (window.tsic && tsic.focus && tsic.focus.pushScope) {
            tsic.focus.pushScope(scrim, closeBtn, { onPop: () => close(true) });
        }

        // Enter, in game. It reaches JS as UI.Behavior.MenuConfirm — a pack-only
        // behaviour (BH_MenuConfirm / HK_MenuConfirm, listed in SIT_Menu), because
        // Enter is bound to nothing in menus: HK_Accept is SpaceBar and Enter's only
        // other binding, HK_OpenChat, lives in SIT_Combat.
        //
        // Space and gamepad A are already covered by tsic-focus, which activates the
        // focused Close button on UI.Behavior.Accept — but only once nav is driving
        // (gamepad mode, or after an arrow press). A mouse player pressing Space sees
        // nothing, which is exactly why this listens for its own event rather than
        // leaning on that one.
        if (window.tsic && typeof tsic.on === 'function') {
            tsic.on('tsic.msg.UI.Behavior.MenuConfirm', (p) => {
                if (!openScrim) return;
                if (p && p.Phase && p.Phase !== 'Started') return;
                close(true);
            });
        }
    }

    // Opens once the setting says this build's bulletin has not been seen.
    //
    // The echo is sticky, so subscribing is enough to receive the current value.
    // No value at all (Chrome, the playground, a build without the key) falls
    // through to the timeout and shows the bulletin — the right default for a
    // thing whose whole job is to be seen.
    function mount(opts) {
        const o = opts || {};
        const waitMs = typeof o.waitMs === 'number' ? o.waitMs : 1200;
        let settled = false;

        const decide = (seenVersion) => {
            if (settled) return;
            settled = true;
            if (seenVersion === NOTICE_VERSION) return;
            show();
        };

        if (!window.tsic || typeof tsic.on !== 'function') { decide(null); return; }

        tsic.on('tsic.msg.UI.Settings.Value', (p) => {
            if (!p || p.Key !== SETTING_KEY) return;
            let value = null;
            try { value = JSON.parse(p.ValueJson || 'null'); } catch (e) { /* absent or malformed */ }
            decide(value);
        });
        setTimeout(() => decide(null), waitMs);
    }

    window.TSIC = window.TSIC || {};
    window.TSIC.WelcomeNotice = { mount, show, close: () => close(false), NOTICE_VERSION };
})();
