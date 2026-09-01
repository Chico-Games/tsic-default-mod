// shared/welcome-notice.js
//
// The closed-alpha welcome bulletin - a one-shot modal over the title screen.
//
// EDITING THE COPY: nothing in this file. Every word the bulletin shows comes
// from /data/changelog.json, which Scripts/changelog.ps1 generates from
// changelog/releases/*.json in the game repo. To change an entry, edit the
// release file and re-run the release step; to add one for work in flight, use
// `./Scripts/changelog.ps1 add`. See docs/changelog-style.md.
//
// VERSION: the "already seen" identity is the newest release's NAME - the same
// "Alpha 2.0.1" the masthead prints - and not its SHA.
//
// It was the SHA until 2026-09-01, on the reasoning that a SHA changes exactly
// when the build changes while a forgotten version bump would silently re-show
// the bulletin. The first half of that is not true of the SHA we record.
// changelog.ps1 stamps `git rev-parse HEAD` at the moment a release is CUT, and
// a commit cannot contain its own hash, so the recorded SHA is always at least
// one commit behind the build and is re-stamped by every amend. Alpha 2.0.1 was
// re-stamped three times without a byte of gameplay changing; a patch cut the
// day before it ships names a commit that was never built. So it identified
// neither the build nor the release, and re-showed the bulletin on rebuilds
// that had nothing new to say.
//
// The version cannot be forgotten the way that argument feared: `changelog.ps1
// release` takes it as a required argument and writes releases/<version>.json,
// so re-using a number collides with an existing file rather than passing
// silently. What this does give up is an amend AFTER players have seen a
// release - those entries stay unseen, and the next patch number is how you
// force a re-show. A shipped release is frozen anyway.
//
// The SHA stays in the record for crash symbolication, which is the job it can
// actually do. Backfilled builds carry no version and still fall back to it -
// see releaseName(), which is the single source of this identity.
//
// One-off on the switchover: an existing ui.welcome_seen holds a SHA, which
// matches no name, so every player sees the bulletin once more. Intended.
//
// PERSISTENCE: the "already seen" flag rides on the ui.welcome_seen setting,
// which is written through UI.Cmd.Settings.Set and read back off the sticky
// UI.Settings.Value echo - the same path the menu-music slider uses.
// localStorage is NOT an option here: OpenWebInterfaceBrowserSingleton hands
// CEF a cache_path under a fresh FGuid every launch and deletes the old
// folders, so web storage is wiped between sessions and the bulletin would
// greet the player forever.
//
// The setting is absent in the playground and in Chrome. There the bulletin
// always shows, which is what you want while you are working on it.

(function () {
    'use strict';

    const DATA_URL = '/data/changelog.json';
    const ISSUE_LINE = 'Vol.1 - Closed Alpha';

    // Populated by load(). Nothing renders until it is.
    let DATA = null;

    // Fails closed. A missing or malformed changelog means no bulletin rather
    // than a half-built modal over the title screen: the bulletin is a
    // courtesy, and the menu behind it still has to work without it.
    function load() {
        if (DATA) return Promise.resolve(DATA);
        return fetch(DATA_URL)
            .then((res) => {
                if (!res.ok) throw new Error(DATA_URL + ' -> HTTP ' + res.status);
                return res.json();
            })
            .then((json) => {
                if (!json || !Array.isArray(json.releases) || json.releases.length === 0) {
                    throw new Error(DATA_URL + ' has no releases');
                }
                DATA = json;
                return DATA;
            });
    }

    const latest = () => (DATA && DATA.releases.length) ? DATA.releases[0] : null;

    // The seen-flag identity: the release's name, so it changes once per release
    // and not once per rebuild. Deliberately the same string the masthead shows,
    // so what the player is told they have seen is what gets recorded. Null
    // until load() resolves, which is why every caller waits on the promise
    // rather than reading this at module scope.
    function noticeVersion() {
        const r = latest();
        return r ? releaseName(r) : null;
    }

    // "25 Aug 2026" from an ISO date, without pulling in a formatter.
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function shortDate(iso, withYear) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        if (!m) return String(iso || '');
        const day = String(parseInt(m[3], 10));
        const mon = MONTHS[parseInt(m[2], 10) - 1] || m[2];
        return withYear ? (day + ' ' + mon + ' ' + m[1]) : (day + ' ' + mon);
    }

    // "Alpha 2.0.0" - channel and number are separate fields so that dropping
    // the channel at launch needs no other change. A backfilled build predates
    // the versioning scheme and carries no number, so it falls back to the SHA,
    // which is exactly what this line read before.
    //
    // This is BOTH the masthead line and the seen-flag identity (noticeVersion).
    // Changing what it returns re-shows the bulletin once for every player, so
    // treat it as a released surface rather than a formatting helper - dropping
    // the channel at launch is exactly such a change, and costs one re-show.
    function releaseName(r) {
        if (!r) return '';
        if (!r.version) return 'Build ' + r.sha;
        return r.channel ? (r.channel + ' ' + r.version) : String(r.version);
    }

    function dateLine() {
        const r = latest();
        return r ? (releaseName(r) + ' · ' + shortDate(r.date, true)) : '';
    }

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
#welcome-notice .wn-cat {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mag-red);
    margin: 10px 0 2px;
}
#welcome-notice .wn-entry > .wn-cat:first-child { margin-top: 4px; }
#welcome-notice .wn-scope {
    font-family: var(--font-terminal);
    font-size: 11.5px;
    letter-spacing: 0.06em;
    color: var(--ink-mute);
    margin: 4px 0 0 20px;
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
#welcome-notice .wn-issue-empty {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-mute);
    padding: 8px 0 12px;
}
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

    // Keep a Changelog's order, which is also the order changelog.ps1 sorts by --
    // not alphabetical, and not the order entries happened to be written in.
    const CATEGORY_ORDER = ['added', 'qol', 'changed', 'fixed', 'removed', 'security'];
    // Reading order: what is new, what is nicer, what moved, what was repaired, what
    // is gone, what was hardened. A player scans for the first three and only reads
    // Fixes if something they hit is in it. Quality of Life sits second because it is
    // additive like Content but smaller in kind -- a convenience rather than a thing
    // to go and find. Must match $CategoryLabels in Scripts/changelog.ps1, which is
    // what writes the file this reads.
    const CATEGORY_LABELS = {
        added: 'Content', qol: 'Quality of Life', changed: 'Changes', fixed: 'Fixes',
        removed: 'Removed', security: 'Security',
    };

    function buildUpdates() {
        const host = el('div', { class: 'wn-pane', id: 'wn-pane-updates',
                                 'data-tsic-focus-group': 'notice-body' });
        for (const release of DATA.releases) {
            // internal entries are stripped by the generator, but a hand-edited
            // file could still carry one, so the guard stays on this side too.
            const items = (release.entries || []).filter((e) => !e.internal);
            if (!items.length) continue;

            // Category, then scope, then the rows -- the same shape the Discord message
            // and the console preview use, so one release reads the same everywhere.
            // A category absent from this release is simply skipped; an entry with no
            // scope gets no subheading and leads its category.
            const body = [];
            for (const cat of CATEGORY_ORDER) {
                // Sorted by scope here, not relied on from the file: a release is
                // frozen in the order its entries were authored, so a scope's rows
                // are not contiguous on their own and the subheading would repeat.
                const inCat = items.filter((e) => e.type === cat)
                    .sort((a, b) => String(a.scope || '').localeCompare(String(b.scope || '')));
                if (!inCat.length) continue;
                body.push(el('div', { class: 'wn-cat' }, CATEGORY_LABELS[cat] || cat));

                let list = null;
                let lastScope = null;
                for (const item of inCat) {
                    const scope = item.scope || '';
                    if (scope !== lastScope) {
                        if (scope) body.push(el('div', { class: 'wn-scope' }, scope));
                        lastScope = scope;
                        list = null;
                    }
                    if (!list) { list = el('ul', {}); body.push(list); }
                    const li = el('li', {});
                    // innerHTML: the copy is authored by us in changelog/releases/*.json
                    // and carries markup such as <kbd>Tab</kbd>. It is not user input.
                    li.innerHTML = item.text;
                    list.append(li);
                }
            }

            host.append(el('div', { class: 'wn-entry' },
                el('div', { class: 'wn-entry-head' },
                    el('span', { class: 'wn-entry-date' }, shortDate(release.date, false)),
                    el('span', { class: 'wn-entry-title' }, release.title),
                    release.sha ? el('span', { class: 'wn-entry-build' }, release.sha) : null),
                ...body));
        }
        return host;
    }

    function buildIssues() {
        const host = el('div', { class: 'wn-pane', id: 'wn-pane-issues',
                                 'data-tsic-focus-group': 'notice-issues' });
        // Opt-in per release (changelog.ps1 -WithKnownIssues) and, when opted in,
        // populated from open issues carrying the known-issue label -- so a row
        // cannot outlive the fix. `scope` is the tag column; it can be blank when
        // the issue carries no scope label. An empty list is the normal case: the
        // column keeps the F8 nudge, which is the part players act on.
        const issues = (latest() && latest().known_issues) || [];
        if (issues.length === 0) {
            host.append(el('div', { class: 'wn-issue-empty' },
                'Nothing tracked for this build.'));
        }
        for (const issue of issues) {
            host.append(el('div', { class: 'wn-issue' },
                el('span', { class: 'wn-issue-tag' }, issue.scope || ''),
                el('span', { class: 'wn-issue-text' }, issue.text,
                    issue.ref ? el('span', { class: 'wn-issue-ref' }, '#' + issue.ref) : null)));
        }
        host.append(el('p', { class: 'wn-issue-note' },
            'Found something that is not on this list? Press F8 in game to file it - '
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
                        el('span', { class: 'tsic-masthead-date' }, dateLine()))),
                el('p', { class: 'wn-letter' },
                    'Thank you for playing, and for every bug you have reported - '
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
                { Key: SETTING_KEY, ValueJson: JSON.stringify(noticeVersion()) });
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

    function showNow() {
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

    // Public show(): resolve the data, then open. Returns a promise so the
    // playground and the tests can await it; a failed load rejects and nothing
    // is drawn.
    function show() {
        return load().then(showNow);
    }

    // Opens once the setting says this build's bulletin has not been seen.
    //
    // The changelog is fetched FIRST: without it there is no bulletin to show
    // and no SHA to compare against, so a failed fetch ends the whole thing
    // quietly rather than showing an empty modal.
    //
    // The settings echo is sticky, so subscribing is enough to receive the
    // current value. No value at all (Chrome, the playground, a build without
    // the key) falls through to the timeout and shows the bulletin - the right
    // default for a thing whose whole job is to be seen.
    function mount(opts) {
        const o = opts || {};
        const waitMs = typeof o.waitMs === 'number' ? o.waitMs : 1200;

        return load().then(() => {
            let settled = false;
            const decide = (seenVersion) => {
                if (settled) return;
                settled = true;
                if (seenVersion === noticeVersion()) return;
                showNow();
            };

            if (!window.tsic || typeof tsic.on !== 'function') { decide(null); return; }

            tsic.on('tsic.msg.UI.Settings.Value', (p) => {
                if (!p || p.Key !== SETTING_KEY) return;
                let value = null;
                try { value = JSON.parse(p.ValueJson || 'null'); } catch (e) { /* absent or malformed */ }
                decide(value);
            });
            setTimeout(() => decide(null), waitMs);
        }).catch((err) => {
            // Deliberately quiet in game: a missing changelog is not the
            // player's problem and must not block the menu.
            if (window.console && console.warn) console.warn('[welcome-notice]', err.message);
        });
    }

    window.TSIC = window.TSIC || {};
    window.TSIC.WelcomeNotice = { mount, show, load, noticeVersion, close: () => close(false) };
})();
