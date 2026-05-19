// Renders the playground's Enhanced-Input emulator panel.
// Calls back into onInject(channel, payload) which the host wires to
// the iframe's mock tsic via handle.inject() semantics.
//
// Phase defaults match what the focus engine in shared/tsic-focus.js
// actually consumes:
//   IA_UI_Navigate       — Started fires immediately, Triggered is
//                          throttled to >=180ms (set by the engine).
//   IA_UI_ConfirmAccept  — Started only; Triggered is ignored.
//   IA_UI_CancelBack     — Started only.
// So most quick-fire buttons default to Started.
(function (global) {
    const NS = global.TSICPlaygroundInput = global.TSICPlaygroundInput || {};

    const QUICK = [
        { label: 'Up',        action: 'IA_UI_Navigate', phase: 'Started', value: { X: 0, Y: 1, Z: 0 } },
        { label: 'Down',      action: 'IA_UI_Navigate', phase: 'Started', value: { X: 0, Y: -1, Z: 0 } },
        { label: 'Left',      action: 'IA_UI_Navigate', phase: 'Started', value: { X: -1, Y: 0, Z: 0 } },
        { label: 'Right',     action: 'IA_UI_Navigate', phase: 'Started', value: { X: 1, Y: 0, Z: 0 } },
        { label: 'Confirm',   action: 'IA_UI_ConfirmAccept', phase: 'Started' },
        { label: 'Cancel',    action: 'IA_UI_CancelBack',    phase: 'Started' },
        { label: 'Tab',       action: 'IA_UI_NextTab',       phase: 'Started' },
        { label: 'Inv',       action: 'IA_OpenInventoryMenu', phase: 'Started' },
        { label: 'Pause',     action: 'IA_OpenPauseMenu',     phase: 'Started' },
    ];

    const ACTION_GROUPS = [
        { group: 'Navigation', items: [
            'IA_UI_Navigate', 'IA_UI_ConfirmAccept', 'IA_UI_CancelBack',
            'IA_UI_NextTab', 'IA_UI_PreviousTab',
        ] },
        { group: 'Open / Close', items: [
            'IA_OpenInventoryMenu', 'IA_OpenMapMenu', 'IA_OpenPauseMenu',
        ] },
        { group: 'Inventory', items: [
            'IA_UI_AddToHotbar', 'IA_UI_DropItem', 'IA_UI_TakeAll',
        ] },
        { group: 'Map', items: [
            'IA_UI_MapZoomIn', 'IA_UI_MapZoomOut', 'IA_UI_MapCenterOnPlayer',
            'IA_UI_MapPlacePing', 'IA_UI_MapMove',
        ] },
        { group: 'Action Bar', items: [
            'IA_UI_ActionBar1', 'IA_UI_ActionBar2', 'IA_UI_ActionBar3',
            'IA_UI_ActionBar4', 'IA_UI_ActionBar5',
        ] },
    ];

    const PHASES = ['Started', 'Triggered', 'Completed', 'Canceled'];
    const MODES  = [
        { value: 'MouseAndKeyboard', label: 'Mouse & Keyboard', device: 'kbm' },
        { value: 'Gamepad',          label: 'Gamepad',          device: 'gamepad' },
        { value: 'Touch',            label: 'Touch',            device: 'touch' },
    ];

    function emit(action, phase, value, onInject) {
        const short = action.replace(/^IA_/, '');
        onInject(`tsic.msg.UI.Input.${short}`, {
            Action: action,
            Phase: phase || 'Started',
            Value: value || { X: 1, Y: 0, Z: 0 },
            ElapsedSec: 1 / 60,
            TriggeredSec: 0,
        });
    }

    function mkSelect(groups) {
        const sel = document.createElement('select');
        for (const grp of groups) {
            const og = document.createElement('optgroup');
            og.label = grp.group;
            for (const action of grp.items) {
                const opt = document.createElement('option');
                opt.value = action;
                opt.textContent = action.replace(/^IA_UI_/, '');
                og.appendChild(opt);
            }
            sel.appendChild(og);
        }
        return sel;
    }

    // getCtx(): { win: iframe window, log: (cls, msg) => void } — the host
    // passes this in so the focus diagnostics can reach into the iframe.
    NS.mount = function (root, onInject, getCtx) {
        root.innerHTML = '';
        getCtx = getCtx || (() => ({}));

        // ---- Gamepad mode toggle (top of pane) ----
        const modeBar = document.createElement('div');
        modeBar.className = 'pg-input-mode-bar';
        const padBtn = document.createElement('button');
        padBtn.className = 'pg-btn pg-btn-strong';
        padBtn.textContent = '🎮 Gamepad mode: OFF';
        padBtn.dataset.gamepad = '0';
        modeBar.appendChild(padBtn);
        root.appendChild(modeBar);

        function setGamepad(on) {
            padBtn.dataset.gamepad = on ? '1' : '0';
            padBtn.textContent = on ? '🎮 Gamepad mode: ON' : '🎮 Gamepad mode: OFF';
            padBtn.classList.toggle('on', on);
            modeSel.value = on ? 'Gamepad' : 'MouseAndKeyboard';
            const mode = on ? 'Gamepad' : 'MouseAndKeyboard';
            const device = on ? 'gamepad' : 'kbm';
            onInject('tsic.msg.UI.Input.Mode.Changed', { Mode: mode, Device: device, Focus: focusSel.value });
            if (on) {
                const ctx = getCtx();
                const fEngine = ctx.win && ctx.win.tsic && ctx.win.tsic.focus;
                if (fEngine && typeof fEngine.enable === 'function') {
                    try { fEngine.enable(); } catch (e) {}
                }
            }
            refreshFocusStatus();
        }
        padBtn.addEventListener('click', () => setGamepad(padBtn.dataset.gamepad !== '1'));

        // ---- Quick-fire buttons ----
        const grid = document.createElement('div');
        grid.className = 'pg-input-grid';
        for (const b of QUICK) {
            const btn = document.createElement('button');
            btn.className = 'pg-btn';
            btn.textContent = b.label;
            btn.title = `${b.action}  ·  Phase=${b.phase}`;
            btn.addEventListener('click', () => {
                emit(b.action, b.phase, b.value, onInject);
                // After navigation events the active element changes — refresh.
                setTimeout(refreshFocusStatus, 30);
            });
            grid.appendChild(btn);
        }
        root.appendChild(grid);

        // ---- Action dropdown + phase + send ----
        const actionRow = document.createElement('div');
        actionRow.className = 'pg-input-custom';
        const actionSel = mkSelect(ACTION_GROUPS);
        const phaseSel = document.createElement('select');
        for (const p of PHASES) {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            if (p === 'Started') opt.selected = true;
            phaseSel.appendChild(opt);
        }
        const sendBtn = document.createElement('button');
        sendBtn.className = 'pg-btn';
        sendBtn.textContent = 'Send';
        sendBtn.addEventListener('click', () => {
            emit(actionSel.value, phaseSel.value, null, onInject);
            setTimeout(refreshFocusStatus, 30);
        });
        actionRow.appendChild(actionSel);
        actionRow.appendChild(phaseSel);
        actionRow.appendChild(sendBtn);
        root.appendChild(actionRow);

        // ---- Mode dropdown (precise mode/device combo control) ----
        const modeRow2 = document.createElement('div');
        modeRow2.className = 'pg-input-custom';
        const modeLabel = document.createElement('span');
        modeLabel.className = 'pg-input-label';
        modeLabel.textContent = 'Mode:';
        const modeSel = document.createElement('select');
        for (const m of MODES) {
            const opt = document.createElement('option');
            opt.value = m.value; opt.textContent = m.label; opt.dataset.device = m.device;
            modeSel.appendChild(opt);
        }
        modeSel.addEventListener('change', () => setGamepad(modeSel.value === 'Gamepad'));
        modeRow2.appendChild(modeLabel);
        modeRow2.appendChild(modeSel);
        root.appendChild(modeRow2);

        // ---- Focus dropdown (crosshair.html reads Focus) ----
        const focusRow = document.createElement('div');
        focusRow.className = 'pg-input-custom';
        const focusLbl = document.createElement('span');
        focusLbl.className = 'pg-input-label';
        focusLbl.textContent = 'Focus:';
        const focusSel = document.createElement('select');
        for (const f of ['game', 'ui']) {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            focusSel.appendChild(opt);
        }
        focusSel.addEventListener('change', () => {
            const m = MODES.find(x => x.value === modeSel.value);
            onInject('tsic.msg.UI.Input.Mode.Changed', { Mode: m.value, Device: m.device, Focus: focusSel.value });
        });
        focusRow.appendChild(focusLbl);
        focusRow.appendChild(focusSel);
        root.appendChild(focusRow);

        // ---- Focus-engine diagnostics ----
        const fb = document.createElement('div');
        fb.className = 'pg-focus-block';
        const fh = document.createElement('div');
        fh.className = 'pg-focus-h';
        fh.textContent = 'FOCUS ENGINE';
        fb.appendChild(fh);

        const optInEl = document.createElement('div');
        optInEl.className = 'pg-focus-status';
        fb.appendChild(optInEl);

        // One row per fact for easier scanning.
        const rows = {};
        const FIELDS = [
            { key: 'mode',      label: 'Mode' },
            { key: 'enabled',   label: 'Enabled' },
            { key: 'focusable', label: 'Focusable' },
            { key: 'scope',     label: 'Scope depth' },
            { key: 'active',    label: 'Active' },
            { key: 'text',      label: 'Text' },
            { key: 'rect',      label: 'Position' },
        ];
        for (const f of FIELDS) {
            const row = document.createElement('div');
            row.className = 'pg-focus-row';
            const k = document.createElement('span');
            k.className = 'pg-focus-key';
            k.textContent = f.label;
            const v = document.createElement('span');
            v.className = 'pg-focus-val';
            v.textContent = '—';
            row.appendChild(k);
            row.appendChild(v);
            rows[f.key] = v;
            fb.appendChild(row);
        }

        // describe(): human-readable label for an element. Prefers visible
        // text, falls back to value / placeholder / aria-label, then to tag#id.
        function describe(el) {
            if (!el) return '(none)';
            if (el === el.ownerDocument.body) return '(body — no focused element)';
            const tag = (el.tagName || '').toLowerCase();
            // For native form elements, prefer the rendered/selected value.
            if (tag === 'select') {
                const opt = el.options && el.options[el.selectedIndex];
                const optTxt = opt ? (opt.textContent || opt.value || '') : '';
                if (optTxt) return `select "${optTxt.trim().slice(0, 40)}"`;
            }
            if (tag === 'input' || tag === 'textarea') {
                const v = (el.value || '').toString();
                const ph = el.getAttribute('placeholder') || '';
                if (v) return `${tag} "${v.slice(0, 40)}"`;
                if (ph) return `${tag} (placeholder: "${ph.slice(0, 30)}")`;
                return `${tag} (empty)`;
            }
            // For buttons / links / list rows, the inner text is usually the label.
            const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
            if (txt) return `${tag} "${txt.slice(0, 50)}"`;
            const aria = el.getAttribute('aria-label') || el.getAttribute('title') || '';
            if (aria) return `${tag} [${aria.slice(0, 40)}]`;
            return tag + (el.id ? '#' + el.id : '');
        }
        function rectStr(el) {
            if (!el || !el.getBoundingClientRect) return '—';
            const r = el.getBoundingClientRect();
            return `${Math.round(r.left)},${Math.round(r.top)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
        }
        function idStr(el) {
            if (!el) return '—';
            const tag = (el.tagName || '').toLowerCase();
            const id = el.id ? '#' + el.id : '';
            const cls = (el.className && typeof el.className === 'string')
                ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
                : '';
            return tag + id + cls;
        }

        function refreshFocusStatus() {
            const ctx = getCtx();
            const win = ctx.win;
            if (!win) {
                optInEl.textContent = 'iframe: not loaded';
                for (const k of Object.keys(rows)) rows[k].textContent = '—';
                return;
            }
            const meta = win.document && win.document.querySelector('meta[name="tsic-focus"]');
            const optedIn = !!(meta && meta.getAttribute('content') === 'enabled');
            optInEl.textContent = optedIn
                ? 'Controller nav: yes (page opts in)'
                : 'Controller nav: no (HUD / passive — try Pause Menu, Settings, Save/Load…)';
            optInEl.classList.toggle('warn', false);
            optInEl.classList.toggle('muted', !optedIn);
            const fEngine = win.tsic && win.tsic.focus;
            if (!fEngine || typeof fEngine.snapshot !== 'function') {
                rows.mode.textContent = '—';
                rows.enabled.textContent = optedIn ? 'engine not installed yet (deferred)' : 'engine not loaded';
                rows.focusable.textContent = '—';
                rows.scope.textContent = '—';
                rows.active.textContent = '—';
                rows.text.textContent = '—';
                rows.rect.textContent = '—';
                return;
            }
            try {
                const snap = fEngine.snapshot();
                const focused = win.document.querySelector('[data-tsic-focused]');
                const active = focused || (win.document.activeElement === win.document.body ? null : win.document.activeElement);
                rows.mode.textContent      = String(snap.mode);
                rows.enabled.textContent   = String(snap.enabled);
                rows.focusable.textContent = String(snap.focusable);
                rows.scope.textContent     = String(snap.scope);
                rows.active.textContent    = idStr(active);
                rows.text.textContent      = describe(active);
                rows.rect.textContent      = rectStr(active);
            } catch (e) {
                rows.mode.textContent = 'snapshot threw: ' + e.message;
            }
        }

        // Direct step() buttons — bypass the channel for fast iteration when
        // you want to confirm the page's spatial layout reaches everything.
        const dirRow = document.createElement('div');
        dirRow.className = 'pg-input-grid pg-focus-dirs';
        for (const d of [{l:'↑',d:'up'},{l:'↓',d:'down'},{l:'←',d:'left'},{l:'→',d:'right'}]) {
            const b = document.createElement('button');
            b.className = 'pg-btn';
            b.textContent = d.l;
            b.title = `tsic.focus.step("${d.d}")`;
            b.addEventListener('click', () => {
                const ctx = getCtx();
                const fEngine = ctx.win && ctx.win.tsic && ctx.win.tsic.focus;
                if (fEngine && typeof fEngine.step === 'function') {
                    try { fEngine.step(d.d); } catch (e) {}
                }
                refreshFocusStatus();
            });
            dirRow.appendChild(b);
        }
        fb.appendChild(dirRow);

        const fbtns = document.createElement('div');
        fbtns.className = 'pg-input-custom';
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'pg-btn';
        refreshBtn.textContent = 'Refresh';
        refreshBtn.addEventListener('click', refreshFocusStatus);
        const snapBtn = document.createElement('button');
        snapBtn.className = 'pg-btn';
        snapBtn.textContent = 'Snapshot → log';
        snapBtn.addEventListener('click', () => {
            const ctx = getCtx();
            const fEngine = ctx.win && ctx.win.tsic && ctx.win.tsic.focus;
            if (!fEngine || typeof fEngine.snapshot !== 'function') {
                ctx.log && ctx.log('fail', 'focus engine not installed');
                return;
            }
            try {
                const snap = fEngine.snapshot();
                ctx.log && ctx.log('info', 'FOCUS: ' + JSON.stringify(snap));
                const list = (typeof fEngine.__focusableSet === 'function') ? fEngine.__focusableSet() : null;
                if (list) {
                    const summary = list.map(el => {
                        const tag = el.tagName.toLowerCase();
                        const id = el.id ? '#' + el.id : '';
                        const txt = (el.textContent || '').trim().slice(0, 24);
                        return tag + id + (txt ? `[${txt}]` : '');
                    });
                    ctx.log && ctx.log('info', 'FOCUSABLE(' + list.length + '): ' + summary.join(', '));
                }
            } catch (e) {
                ctx.log && ctx.log('fail', 'snapshot threw: ' + e.message);
            }
        });
        const enableBtn = document.createElement('button');
        enableBtn.className = 'pg-btn';
        enableBtn.textContent = 'enable()';
        enableBtn.addEventListener('click', () => {
            const ctx = getCtx();
            const fEngine = ctx.win && ctx.win.tsic && ctx.win.tsic.focus;
            if (fEngine && typeof fEngine.enable === 'function') { try { fEngine.enable(); } catch (e) {} }
            refreshFocusStatus();
        });
        fbtns.appendChild(refreshBtn);
        fbtns.appendChild(snapBtn);
        fbtns.appendChild(enableBtn);
        fb.appendChild(fbtns);

        root.appendChild(fb);
        refreshFocusStatus();

        // Expose a refresh hook the host can call when the iframe reloads.
        NS.__lastRefresh = refreshFocusStatus;
    };
})(window);
