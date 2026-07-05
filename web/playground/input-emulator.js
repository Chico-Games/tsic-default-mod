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

    // 4 arrows laid out as a d-pad cross. Slot is the d-pad cell name.
    const DPAD = [
        { slot: 'up',    label: '↑', action: 'IA_UI_Navigate', phase: 'Started', value: { X: 0, Y:  1, Z: 0 } },
        { slot: 'left',  label: '←', action: 'IA_UI_Navigate', phase: 'Started', value: { X: -1, Y: 0, Z: 0 } },
        { slot: 'right', label: '→', action: 'IA_UI_Navigate', phase: 'Started', value: { X:  1, Y: 0, Z: 0 } },
        { slot: 'down',  label: '↓', action: 'IA_UI_Navigate', phase: 'Started', value: { X: 0, Y: -1, Z: 0 } },
    ];
    const QUICK = [
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
        // Channel name keeps the IA_ prefix — every consumer in shared/
        // (tsic-focus.js, inventory.html, map.html, etc.) subscribes with the
        // full name. Stripping IA_ here silently broke the entire input panel.
        onInject(`tsic.msg.UI.Input.${action}`, {
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

        // ---- D-pad (IA_UI_Navigate arrows) ----
        const dpad = document.createElement('div');
        dpad.className = 'pg-dpad';
        for (const d of DPAD) {
            const btn = document.createElement('button');
            btn.className = `pg-btn pg-dpad-${d.slot}`;
            btn.textContent = d.label;
            btn.title = `${d.action}  ·  Phase=${d.phase}`;
            btn.addEventListener('click', () => {
                emit(d.action, d.phase, d.value, onInject);
                setTimeout(refreshFocusStatus, 30);
            });
            dpad.appendChild(btn);
        }
        root.appendChild(dpad);

        // ---- Other quick-fire buttons (Confirm/Cancel/Tab/Inv/Pause) ----
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

        // ---- Focus dropdown (hud-crosshair.js reads Focus) ----
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

        // ---- Axis2D virtual joystick ----
        // Drives any axis2d input action (defaults to IA_UI_MapMove). Holding
        // the knob emits a Started event on the first rAF tick, Triggered on
        // every subsequent tick with the normalized X/Y, and Completed with
        // (0,0) on release. ElapsedSec is the real wall-clock delta between
        // ticks so consumers like map.html pan smoothly.
        const axisBlock = document.createElement('div');
        axisBlock.className = 'pg-axis2d';
        const axisH = document.createElement('div');
        axisH.className = 'pg-axis2d-h';
        axisH.textContent = 'AXIS2D';
        axisBlock.appendChild(axisH);

        const axisActionRow = document.createElement('div');
        axisActionRow.className = 'pg-input-custom';
        const axisActionLbl = document.createElement('span');
        axisActionLbl.className = 'pg-input-label';
        axisActionLbl.textContent = 'Action:';
        const axisActionSel = mkSelect(ACTION_GROUPS);
        axisActionSel.value = 'IA_UI_MapMove';
        axisActionRow.appendChild(axisActionLbl);
        axisActionRow.appendChild(axisActionSel);
        axisBlock.appendChild(axisActionRow);

        const axisRow = document.createElement('div');
        axisRow.className = 'pg-axis2d-row';
        const joystick = document.createElement('div');
        joystick.className = 'pg-joystick';
        const knob = document.createElement('div');
        knob.className = 'pg-joystick-knob';
        joystick.appendChild(knob);
        axisRow.appendChild(joystick);

        const readout = document.createElement('div');
        readout.className = 'pg-axis2d-readout';
        const xRead = document.createElement('div');
        const yRead = document.createElement('div');
        const tipRead = document.createElement('div');
        xRead.innerHTML = 'X: <span class="v">0.00</span>';
        yRead.innerHTML = 'Y: <span class="v">0.00</span>';
        tipRead.style.color = '#64748b';
        tipRead.style.fontSize = '10px';
        tipRead.textContent = 'drag the knob — release to snap back';
        readout.appendChild(xRead);
        readout.appendChild(yRead);
        readout.appendChild(tipRead);
        axisRow.appendChild(readout);
        axisBlock.appendChild(axisRow);
        root.appendChild(axisBlock);

        // Deadzone past which the joystick also drives IA_UI_Navigate (same
        // channel the d-pad uses). Below this the cardinal snap is null and
        // no Navigate event fires; above, the dominant axis becomes the
        // direction.
        const NAV_DEADZONE = 0.4;
        const stick = {
            dragging: false,
            centerX: 0, centerY: 0, radius: 0,
            valueX: 0, valueY: 0,
            rafId: 0, lastTickTs: 0, started: false,
            // null when stick is inside the deadzone; otherwise the cardinal
            // direction currently being navigated. Used to detect the moment
            // a new direction begins so we can emit a fresh Started (the
            // focus engine throttles Triggered to 180ms, so without a new
            // Started the user would wait a full window after redirecting).
            navDir: null,
        };

        function measureJoystick() {
            const r = joystick.getBoundingClientRect();
            stick.centerX = r.left + r.width / 2;
            stick.centerY = r.top  + r.height / 2;
            // Travel = outer radius minus knob half-width so the knob stays
            // visually inside the ring at full deflection.
            const knobR = knob.offsetWidth / 2;
            stick.radius = Math.max(1, Math.min(r.width, r.height) / 2 - knobR);
        }

        function setStickValue(clientX, clientY) {
            const dx = clientX - stick.centerX;
            const dy = clientY - stick.centerY;
            const dist = Math.hypot(dx, dy);
            const clamp = dist > stick.radius ? stick.radius / dist : 1;
            // Screen Y points down; stick convention has +Y pointing up.
            stick.valueX = (dx * clamp) / stick.radius;
            stick.valueY = -(dy * clamp) / stick.radius;
            updateKnobPosition();
        }

        function updateKnobPosition() {
            const px = stick.valueX * stick.radius;
            const py = -stick.valueY * stick.radius;
            knob.style.transform = `translate(${px}px, ${py}px)`;
            xRead.innerHTML = `X: <span class="v">${stick.valueX.toFixed(2)}</span>`;
            yRead.innerHTML = `Y: <span class="v">${stick.valueY.toFixed(2)}</span>`;
        }

        function emitAxis(phase, dt) {
            onInject(`tsic.msg.UI.Input.${axisActionSel.value}`, {
                Action: axisActionSel.value,
                Phase: phase,
                Value: { X: stick.valueX, Y: stick.valueY, Z: 0 },
                ElapsedSec: dt,
                TriggeredSec: 0,
            });
        }

        // Cardinal snap: dominant axis wins; ties go to vertical. Returns
        // null when the stick is inside the deadzone.
        function computeNavDir() {
            const x = stick.valueX, y = stick.valueY;
            if (Math.hypot(x, y) < NAV_DEADZONE) return null;
            if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
            return y > 0 ? 'up' : 'down';
        }

        function navDirToValue(dir) {
            switch (dir) {
                case 'up':    return { X:  0, Y:  1, Z: 0 };
                case 'down':  return { X:  0, Y: -1, Z: 0 };
                case 'left':  return { X: -1, Y:  0, Z: 0 };
                case 'right': return { X:  1, Y:  0, Z: 0 };
            }
            return { X: 0, Y: 0, Z: 0 };
        }

        function emitNav(phase, dir) {
            onInject('tsic.msg.UI.Input.IA_UI_Navigate', {
                Action: 'IA_UI_Navigate',
                Phase: phase,
                Value: navDirToValue(dir),
                ElapsedSec: 1 / 60,
                TriggeredSec: 0,
            });
        }

        function tickJoystick(ts) {
            if (!stick.dragging) return;
            const dt = stick.lastTickTs ? (ts - stick.lastTickTs) / 1000 : (1 / 60);
            stick.lastTickTs = ts;
            // (1) Configured axis2d action — raw analog X/Y, every frame.
            emitAxis(stick.started ? 'Triggered' : 'Started', dt);
            stick.started = true;
            // (2) IA_UI_Navigate (same channel as the d-pad) — cardinal snap
            // with auto-repeat. Started fires whenever the direction changes
            // (including the first time past the deadzone). Triggered fires
            // each frame while held in the same direction; the focus engine
            // throttles those to >=180ms so the focus walks at d-pad speed.
            const dir = computeNavDir();
            if (dir !== stick.navDir) {
                if (stick.navDir) emitNav('Completed', stick.navDir);
                if (dir)          emitNav('Started',  dir);
                stick.navDir = dir;
            } else if (dir) {
                emitNav('Triggered', dir);
            }
            stick.rafId = requestAnimationFrame(tickJoystick);
        }

        function onJoystickDown(ev) {
            ev.preventDefault();
            measureJoystick();
            stick.dragging = true;
            stick.started = false;
            stick.lastTickTs = 0;
            joystick.classList.add('dragging');
            setStickValue(ev.clientX, ev.clientY);
            stick.rafId = requestAnimationFrame(tickJoystick);
            window.addEventListener('pointermove', onJoystickMove);
            window.addEventListener('pointerup',   onJoystickUp);
            window.addEventListener('pointercancel', onJoystickUp);
        }

        function onJoystickMove(ev) {
            if (!stick.dragging) return;
            setStickValue(ev.clientX, ev.clientY);
        }

        function onJoystickUp() {
            if (!stick.dragging) return;
            stick.dragging = false;
            joystick.classList.remove('dragging');
            cancelAnimationFrame(stick.rafId);
            stick.valueX = 0;
            stick.valueY = 0;
            updateKnobPosition();
            emitAxis('Completed', 0);
            // If we were navigating, send a matching Navigate Completed so
            // the focus engine can cancel any in-flight repeat state.
            if (stick.navDir) {
                emitNav('Completed', stick.navDir);
                stick.navDir = null;
            }
            window.removeEventListener('pointermove', onJoystickMove);
            window.removeEventListener('pointerup',   onJoystickUp);
            window.removeEventListener('pointercancel', onJoystickUp);
        }

        joystick.addEventListener('pointerdown', onJoystickDown);

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
        dirRow.className = 'pg-dpad';
        for (const d of [{l:'↑',d:'up'},{l:'←',d:'left'},{l:'→',d:'right'},{l:'↓',d:'down'}]) {
            const b = document.createElement('button');
            b.className = `pg-btn pg-dpad-${d.d}`;
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

        // When the host swaps fixtures it builds a fresh mock tsic + fresh
        // focus engine inside the new iframe. That engine defaults to
        // MouseAndKeyboard mode — so even though the playground's Gamepad
        // toggle is still on at the parent level, the new fixture has no
        // ring and pressing buttons does nothing until you toggle twice.
        // Re-inject Mode.Changed and call enable() so the new fixture lights
        // up its initial focus right away.
        NS.__onIframeReloaded = function () {
            if (padBtn.dataset.gamepad === '1') {
                onInject('tsic.msg.UI.Input.Mode.Changed', {
                    Mode: 'Gamepad', Device: 'gamepad', Focus: focusSel.value,
                });
                const ctx = getCtx();
                const fEngine = ctx.win && ctx.win.tsic && ctx.win.tsic.focus;
                if (fEngine && typeof fEngine.enable === 'function') {
                    try { fEngine.enable(); } catch (e) {}
                }
            }
            refreshFocusStatus();
        };
    };
})(window);
