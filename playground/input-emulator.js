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
        { label: 'Tab',       action: 'IA_UI_TabNext',       phase: 'Started' },
        { label: 'Inv',       action: 'IA_UI_OpenInventory', phase: 'Started' },
        { label: 'Pause',     action: 'IA_UI_Pause',         phase: 'Started' },
    ];

    const ACTION_GROUPS = [
        { group: 'Navigation', items: [
            'IA_UI_Navigate', 'IA_UI_ConfirmAccept', 'IA_UI_CancelBack',
            'IA_UI_TabNext', 'IA_UI_TabPrev',
        ] },
        { group: 'Open / Close', items: [
            'IA_UI_OpenInventory', 'IA_UI_OpenMap', 'IA_UI_Pause',
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

    const PHASES = ['Started', 'Triggered', 'Completed', 'Ongoing', 'Canceled'];
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

        const statusEl = document.createElement('div');
        statusEl.className = 'pg-focus-status';
        fb.appendChild(statusEl);

        function refreshFocusStatus() {
            const ctx = getCtx();
            const win = ctx.win;
            if (!win) { optInEl.textContent = 'iframe: not loaded'; statusEl.textContent = ''; return; }
            const meta = win.document && win.document.querySelector('meta[name="tsic-focus"]');
            const optedIn = !!(meta && meta.getAttribute('content') === 'enabled');
            optInEl.textContent = optedIn ? 'page opts in: yes' : 'page opts in: NO (engine inactive)';
            optInEl.classList.toggle('warn', !optedIn);
            const fEngine = win.tsic && win.tsic.focus;
            if (!fEngine || typeof fEngine.snapshot !== 'function') {
                statusEl.textContent = 'engine: not installed yet';
                return;
            }
            try {
                const snap = fEngine.snapshot();
                const active = win.document && win.document.activeElement;
                const tag = active && active !== win.document.body ? (active.tagName || '').toLowerCase() : '';
                const id  = active && active.id ? '#' + active.id : '';
                const activeStr = tag ? (tag + id) : '(none)';
                statusEl.textContent =
                    `mode=${snap.mode} · enabled=${snap.enabled} · focusable=${snap.focusable} · scope=${snap.scope} · active=${activeStr}`;
            } catch (e) {
                statusEl.textContent = 'snapshot threw: ' + e.message;
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
