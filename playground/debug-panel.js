// Live "what's going on" summary for the playground.
//
// Renders a vertical stack of sections that update in response to host
// callbacks:
//
//   FIXTURE      id, screen URL, opt-in flag for the focus engine
//   INPUT MODE   Mode / Device / Focus from the most recent Mode.Changed
//   FOCUS        engine snapshot + active element (selector, text, rect)
//                + WHY the active element got focus (last cause attribution)
//   CHANNELS     subscribed channel count + collapsible list
//   HISTORY      reverse-chronological event log (publish / inject / scenario
//                / fixture-load / focus-move), 80 entries max
//   ERRORS       any iframe error.message captured by window.onerror
//
// The host owns the iframe ref and pumps facts in via:
//   debugPanel.onFixtureLoaded(fixture)
//   debugPanel.onIframeReady(iframeWindow, handle)
//   debugPanel.onPublish(channel, payload)
//   debugPanel.onInject(channel, payload)
//   debugPanel.onScenario(label)
//   debugPanel.onModeChanged(payload)
//   debugPanel.error(msg)
//
// The panel polls the focus engine + activeElement every 250ms so D-pad
// movements outside of channel publishes (mouse hovers, page-internal
// .focus() calls) still update the readout.
(function (global) {
    const NS = global.TSICPlaygroundDebug = global.TSICPlaygroundDebug || {};

    const HISTORY_MAX = 80;
    const state = {
        root: null,
        fixture: null,
        iframeWin: null,
        handle: null,
        mode: { Mode: 'MouseAndKeyboard', Device: 'kbm', Focus: 'game' },
        history: [],            // [{t, kind, text}]
        lastFocusKey: null,     // dedupes focus-change log entries
        lastFocusCause: null,   // last cause we attributed to a focus move
        errors: [],
        pollTimer: null,
    };

    const REFS = {};

    // -- helpers ---------------------------------------------------------

    function fmtTime(t) {
        const d = new Date(t);
        return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    }
    function fmtRect(el) {
        try {
            const r = el.getBoundingClientRect();
            return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`;
        } catch (e) { return '?'; }
    }
    function elementKey(el) {
        if (!el) return '(none)';
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        const id = el.id ? '#' + el.id : '';
        const cls = (el.className && typeof el.className === 'string')
            ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
            : '';
        return tag + id + cls;
    }
    function elementSummary(el) {
        if (!el) return '(none)';
        if (el.ownerDocument && el === el.ownerDocument.body) return '(body — no focused element)';
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'select') {
            const opt = el.options && el.options[el.selectedIndex];
            const t = opt ? (opt.textContent || opt.value || '') : '';
            if (t) return `select "${t.trim().slice(0, 40)}"`;
        }
        if (tag === 'input' || tag === 'textarea') {
            const v = (el.value || '').toString();
            const ph = el.getAttribute('placeholder') || '';
            if (v) return `${tag} "${v.slice(0, 40)}"`;
            if (ph) return `${tag} (placeholder: "${ph.slice(0, 30)}")`;
            return `${tag} (empty)`;
        }
        const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (txt) return `${tag} "${txt.slice(0, 60)}"`;
        const aria = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        if (aria) return `${tag} [${aria.slice(0, 40)}]`;
        return tag + (el.id ? '#' + el.id : '');
    }
    function focusOptIn(win) {
        if (!win || !win.document) return null;
        const meta = win.document.querySelector('meta[name="tsic-focus"]');
        return !!(meta && meta.getAttribute('content') === 'enabled');
    }

    function push(kind, text) {
        state.history.unshift({ t: Date.now(), kind, text });
        while (state.history.length > HISTORY_MAX) state.history.pop();
        renderHistory();
    }

    // -- rendering -------------------------------------------------------

    function makeSection(host, label) {
        const sec = document.createElement('div');
        sec.className = 'pg-dbg-sec';
        const h = document.createElement('div');
        h.className = 'pg-dbg-h';
        h.textContent = label;
        const body = document.createElement('div');
        body.className = 'pg-dbg-body';
        sec.appendChild(h);
        sec.appendChild(body);
        host.appendChild(sec);
        return body;
    }

    NS.mount = function (root) {
        state.root = root;
        root.innerHTML = '';
        root.classList.add('pg-dbg');

        REFS.fixture  = makeSection(root, 'FIXTURE');
        REFS.mode     = makeSection(root, 'INPUT MODE');
        REFS.focus    = makeSection(root, 'FOCUS');
        REFS.channels = makeSection(root, 'SUBSCRIBED CHANNELS');
        REFS.history  = makeSection(root, 'ACTIVITY');
        REFS.errors   = makeSection(root, 'ERRORS');

        renderAll();

        // Polling heartbeat so focus moves that happen entirely inside the
        // iframe (mouse hover, page-internal .focus() calls, dropdown
        // pushScope/popScope) still surface.
        if (state.pollTimer) clearInterval(state.pollTimer);
        state.pollTimer = setInterval(() => { renderFocus(); }, 250);
    };

    function renderAll() {
        renderFixture();
        renderMode();
        renderFocus();
        renderChannels();
        renderHistory();
        renderErrors();
    }

    function renderFixture() {
        if (!REFS.fixture) return;
        REFS.fixture.innerHTML = '';
        if (!state.fixture) { REFS.fixture.textContent = '(no fixture loaded)'; return; }
        const row1 = document.createElement('div');
        row1.innerHTML = `<span class="pg-dbg-k">id:</span> <code>${state.fixture.id}</code>`;
        const row2 = document.createElement('div');
        row2.innerHTML = `<span class="pg-dbg-k">screen:</span> <code>${state.fixture.screen}</code>`;
        const row3 = document.createElement('div');
        const optIn = focusOptIn(state.iframeWin);
        const verdict = optIn === null
            ? '?'
            : optIn
                ? 'yes (uses controller focus engine)'
                : 'no (HUD / passive — engine intentionally off)';
        row3.innerHTML = `<span class="pg-dbg-k">controller nav:</span> <code class="${optIn ? '' : 'muted'}">${verdict}</code>`;
        REFS.fixture.appendChild(row1);
        REFS.fixture.appendChild(row2);
        REFS.fixture.appendChild(row3);
    }

    function renderMode() {
        if (!REFS.mode) return;
        REFS.mode.innerHTML = '';
        const m = state.mode || {};
        REFS.mode.innerHTML = `<span class="pg-dbg-k">Mode:</span> <code>${m.Mode || '?'}</code> · <span class="pg-dbg-k">Device:</span> <code>${m.Device || '?'}</code> · <span class="pg-dbg-k">Focus:</span> <code>${m.Focus || '?'}</code>`;
    }

    function renderFocus() {
        if (!REFS.focus) return;
        REFS.focus.innerHTML = '';
        const win = state.iframeWin;
        if (!win) { REFS.focus.textContent = '(no iframe)'; return; }
        const engine = win.tsic && win.tsic.focus;
        const optIn = focusOptIn(win);
        const optEl = document.createElement('div');
        if (optIn) {
            optEl.innerHTML = `<span class="pg-dbg-k">opt-in:</span> <code>yes</code>`;
        } else {
            optEl.innerHTML = `<span class="pg-dbg-k">opt-in:</span> <code class="muted">no — this screen is mouse / passive</code>`;
        }
        REFS.focus.appendChild(optEl);

        if (!engine || typeof engine.snapshot !== 'function') {
            const r = document.createElement('div');
            r.innerHTML = optIn
                ? '<span class="pg-dbg-k">engine:</span> <code class="warn">not installed yet (deferred script loading)</code>'
                : '<span class="pg-dbg-k">engine:</span> <code class="muted">not loaded on this page</code>';
            REFS.focus.appendChild(r);
            return;
        }

        let snap = null;
        try { snap = engine.snapshot(); } catch (e) {}
        const active = win.document && win.document.activeElement;
        const focused = win.document && win.document.querySelector('[data-tsic-focused]');
        const target = focused || (active && active !== win.document.body ? active : null);

        function row(label, value, opts) {
            const r = document.createElement('div');
            r.className = 'pg-dbg-fact';
            r.innerHTML = `<span class="pg-dbg-k">${label}</span> <code class="${opts && opts.cls || ''}">${value}</code>`;
            REFS.focus.appendChild(r);
        }
        if (snap) {
            row('Mode',         snap.mode);
            row('Enabled',      snap.enabled);
            row('Focusable',    snap.focusable);
            row('Scope depth',  snap.scope);
        }
        row('Active',   elementKey(target));
        row('Text',     elementSummary(target));
        row('Position', target ? fmtRect(target) : '—');

        // Stable-selector breadcrumb if the engine exposes it.
        if (target && typeof engine.__stableSelector === 'function') {
            try {
                const sel = engine.__stableSelector(target);
                row('Selector', sel || '?');
            } catch (e) {}
        }

        // Cause attribution: how did focus end up here?
        if (state.lastFocusCause) row('Last move', state.lastFocusCause);

        // Detect a focus change since the last poll and log it.
        const key = elementKey(target);
        if (key !== state.lastFocusKey) {
            const prev = state.lastFocusKey;
            state.lastFocusKey = key;
            if (prev !== null) {
                const reason = state.lastFocusCause ? ` · via ${state.lastFocusCause}` : '';
                push('focus', `focus: ${prev} → ${key}${reason}`);
            }
        }
    }

    function renderChannels() {
        if (!REFS.channels) return;
        REFS.channels.innerHTML = '';
        const handle = state.handle;
        if (!handle || typeof handle.channels !== 'function') {
            REFS.channels.textContent = '(no handle)'; return;
        }
        let chans = [];
        try { chans = handle.channels(); } catch (e) {}
        const head = document.createElement('div');
        head.innerHTML = `<span class="pg-dbg-k">count:</span> <code>${chans.length}</code>`;
        REFS.channels.appendChild(head);
        const ul = document.createElement('ul');
        ul.className = 'pg-dbg-list';
        for (const c of chans.sort()) {
            const li = document.createElement('li');
            li.innerHTML = `<code>${c}</code>`;
            ul.appendChild(li);
        }
        REFS.channels.appendChild(ul);
    }

    function renderHistory() {
        if (!REFS.history) return;
        REFS.history.innerHTML = '';
        if (state.history.length === 0) { REFS.history.textContent = '(no activity yet)'; return; }
        const ul = document.createElement('ul');
        ul.className = 'pg-dbg-hist';
        for (const ent of state.history) {
            const li = document.createElement('li');
            li.className = 'pg-dbg-hist-row pg-dbg-' + ent.kind;
            li.innerHTML = `<span class="t">${fmtTime(ent.t).slice(11)}</span> <span class="kind">${ent.kind}</span> <span class="msg">${ent.text}</span>`;
            ul.appendChild(li);
        }
        REFS.history.appendChild(ul);
    }

    function renderErrors() {
        if (!REFS.errors) return;
        REFS.errors.innerHTML = '';
        if (state.errors.length === 0) { REFS.errors.textContent = '(none)'; return; }
        const ul = document.createElement('ul');
        ul.className = 'pg-dbg-hist';
        for (const e of state.errors.slice(-10).reverse()) {
            const li = document.createElement('li');
            li.className = 'pg-dbg-hist-row pg-dbg-fail';
            li.innerHTML = `<span class="t">${fmtTime(e.t).slice(11)}</span> <span class="msg">${e.text}</span>`;
            ul.appendChild(li);
        }
        REFS.errors.appendChild(ul);
    }

    // -- host-facing API -------------------------------------------------

    NS.onFixtureLoaded = function (fixture) {
        state.fixture = fixture;
        state.iframeWin = null;
        state.handle = null;
        state.history = [];
        state.errors = [];
        state.lastFocusKey = null;
        state.lastFocusCause = null;
        push('fixture', `loaded: ${fixture && fixture.id}`);
        renderAll();
    };
    NS.onIframeReady = function (win, handle) {
        state.iframeWin = win;
        state.handle = handle;
        // Attach an error listener to the iframe so script failures show up.
        try {
            win.addEventListener('error', (ev) => {
                state.errors.push({ t: Date.now(), text: (ev && (ev.message || (ev.error && ev.error.message))) || 'error' });
                renderErrors();
                push('error', (ev && (ev.message || (ev.error && ev.error.message))) || 'error');
            });
        } catch (e) {}
        push('fixture', `iframe ready`);
        renderAll();
    };
    NS.onPublish = function (channel, payload) {
        if (channel === 'UI.Cmd.Sound.Play') return; // noise filter
        const phase = payload && payload.Phase;
        const phaseS = phase ? ` (${phase})` : '';
        push('publish', `→ ${channel}${phaseS}`);
    };
    NS.onInject = function (channel, payload) {
        // Mode.Changed is its own section, but log it too — it's load-bearing.
        if (channel === 'tsic.msg.UI.Input.Mode.Changed') {
            state.mode = payload || state.mode;
            renderMode();
            push('mode', `Mode=${(payload || {}).Mode}, Device=${(payload || {}).Device}, Focus=${(payload || {}).Focus}`);
            state.lastFocusCause = `Mode.Changed → ${(payload || {}).Mode}`;
            return;
        }
        if (channel && channel.indexOf('tsic.msg.UI.Input.') === 0) {
            const phase = payload && payload.Phase;
            const v = payload && payload.Value;
            const dir = v && (v.X || v.Y)
                ? ` (${v.X >= 0.4 ? '→' : v.X <= -0.4 ? '←' : ''}${v.Y >= 0.4 ? '↑' : v.Y <= -0.4 ? '↓' : ''})`
                : '';
            push('inject', `← ${channel}${phase ? ` ${phase}` : ''}${dir}`);
            state.lastFocusCause = `${(payload || {}).Action || channel} ${phase || ''}${dir}`;
            return;
        }
        push('inject', `← ${channel}`);
    };
    NS.onScenario = function (label) {
        push('scenario', `scenario applied: ${label}`);
        state.lastFocusCause = `scenario: ${label}`;
    };
    NS.error = function (msg) {
        state.errors.push({ t: Date.now(), text: String(msg) });
        push('error', String(msg));
        renderErrors();
    };

})(window);
