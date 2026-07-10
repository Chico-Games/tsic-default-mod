(function boot() {
    if (!window.tsic) { setTimeout(boot, 16); return; }

    // Activate the Settings input situation while this screen is up so navigation,
    // accept and back are bound (settings is a full screen change off the pause menu,
    // so it does not inherit the pause menu's UI.Generic situation). Balanced by a
    // pagehide remove that fires whether the page is navigated away (LoadURL) or the
    // SPA unmounts it.
    tsic.publishMessage('UI.Cmd.Input.AppendModeTag', { Tag: 'InputMode.Menu.Settings' });
    window.addEventListener('pagehide', () => {
        tsic.publishMessage('UI.Cmd.Input.RemoveModeTag', { Tag: 'InputMode.Menu.Settings' });
    });

    // Static catalog for Audio/Video/Gameplay. The "Keyboard & Mouse" and
    // "Controller" tabs are built dynamically from UI.Settings.ControlsState
    // (rebinds can't be captured in JS; the C++ input manager drives capture —
    // see HandleCmdSettingsBeginRebind).
    const STATIC_CATALOG = {
        Pages: [
            { Id: 'AudioCollection', Title: 'Audio', Groups: [
                { Id: 'Levels', Title: 'Levels', Settings: [
                    { Key: 'audio.master', Label: 'Master volume', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.8 },
                    { Key: 'audio.music',  Label: 'Music volume',  Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.5 },
                    { Key: 'audio.sfx',    Label: 'SFX volume',    Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.7 },
                ] },
            ] },
            { Id: 'VideoCollection', Title: 'Video', Groups: [
                { Id: 'Display', Title: 'Display', Settings: [
                    { Key: 'video.fullscreen', Label: 'Fullscreen', Type: 'bool', Value: true },
                    { Key: 'video.resolution', Label: 'Resolution', Type: 'enum',
                      Options: [
                          { Value: '1280x720',  Label: '1280 × 720 (HD)' },
                          { Value: '1366x768',  Label: '1366 × 768' },
                          { Value: '1600x900',  Label: '1600 × 900' },
                          { Value: '1680x1050', Label: '1680 × 1050 (16:10)' },
                          { Value: '1920x1080', Label: '1920 × 1080 (FHD)' },
                          { Value: '1920x1200', Label: '1920 × 1200 (16:10)' },
                          { Value: '2560x1080', Label: '2560 × 1080 (Ultrawide)' },
                          { Value: '2560x1440', Label: '2560 × 1440 (QHD)' },
                          { Value: '2560x1600', Label: '2560 × 1600 (16:10)' },
                          { Value: '3440x1440', Label: '3440 × 1440 (Ultrawide)' },
                          { Value: '3840x2160', Label: '3840 × 2160 (4K)' },
                      ],
                      Value: '1920x1080' },
                ] },
            ] },
            { Id: 'GameplayCollection', Title: 'Gameplay', Groups: [
                { Id: 'Camera', Title: 'Camera', Settings: [
                    { Key: 'gameplay.fov', Label: 'Field of view', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                ] },
            ] },
        ],
        Footer: { bRestartRequired: false },
    };

    // The single ControlsState feeds two device tabs; each renders one device's
    // bind button per action so the rows fit a two-column grid.
    const KBM_PAGE_ID = 'ControlsKeyboard';
    const GAMEPAD_PAGE_ID = 'ControlsGamepad';
    function isControlsPage(id) { return id === KBM_PAGE_ID || id === GAMEPAD_PAGE_ID; }

    let activePageId = null;
    let lastCatalog = null;
    let controlsState = null;
    let activeRebind = null;   // { hotkeyId, bGamepad, btn }
    let modalScopePushed = false; // conflict prompt focus trap (tsic.focus.pushScope)
    const localState = {};

    // Instant apply: every edit publishes immediately and per-key persistence
    // happens C++-side on Set. The one carve-out is video-mode keys — a bad
    // display change can strand the player, so those open a keep/revert
    // countdown with the pre-change value as the rollback target.
    const KEEP_COUNTDOWN_SECONDS = 10;
    let countdownTimer = null;
    let activePopover = null;    // { el, kind: 'countdown' }
    const videoRevert = {};      // key -> pre-change value while the countdown is open

    function isVideoKey(key) { return String(key).indexOf('video.') === 0; }

    // Structural signature of the last render + per-key value updaters. A
    // Catalog whose structure is unchanged (only Values differ) is patched in
    // place instead of rebuilding the DOM — otherwise a value echo (e.g. while
    // dragging a slider) would destroy and recreate the control mid-interaction
    // and kill the drag.
    let lastStructSig = null;
    const controlUpdaters = {};

    function valueOf(s) {
        if (s.Key in localState) return localState[s.Key];
        return s.Value;
    }

    function publishSet(key, value) {
        try {
            tsic.publishMessage('UI.Cmd.Settings.Set', { Key: key, ValueJson: JSON.stringify(value) });
        } catch (e) {}
    }

    function publishAction(key) {
        tsic.publishMessage('UI.Cmd.Settings.Action', { Key: key });
    }

    // Route every control edit through here. Everything publishes immediately;
    // video-mode keys additionally open the keep/revert countdown, remembering
    // the pre-change value as the rollback target. Repeat edits while the
    // countdown runs join its revert set but keep the ORIGINAL value.
    function applySet(key, value, oldValue) {
        publishSet(key, value);
        if (!isVideoKey(key)) return;
        if (!(key in videoRevert)) videoRevert[key] = oldValue;
        openKeepCountdown();
    }

    // Cap displayed numbers at 2 decimal places, dropping trailing zeros
    // (e.g. 0.6900000000000001 -> "0.69", 50 -> "50", 1.5 -> "1.5").
    function fmt2(n) {
        const num = Number(n);
        if (Number.isNaN(num)) return String(n);
        return String(Number(num.toFixed(2)));
    }

    // ---- Static field rendering (Audio/Video/Gameplay) ----

    function buildField(s) {
        const row = document.createElement('div');
        row.className = 'field';
        const lbl = document.createElement('label');
        lbl.textContent = s.Label || s.Key;
        row.appendChild(lbl);

        const ctl = document.createElement('div');
        ctl.className = 'field-control';
        const type = String(s.Type || '').toLowerCase();
        const v = valueOf(s);
        const isDisabled = !!s.Disabled;

        if (type === 'range' || type === 'number') {
            const min = (typeof s.Min === 'number') ? s.Min : 0;
            const max = (typeof s.Max === 'number') ? s.Max : 1;
            const step = (typeof s.Step === 'number') ? s.Step : 0.01;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = String(min); slider.max = String(max); slider.step = String(step);
            slider.value = String(v);
            slider.disabled = isDisabled;
            const valueLabel = document.createElement('span');
            valueLabel.className = 'value-label';
            valueLabel.textContent = s.Display !== undefined ? s.Display : fmt2(v);
            slider.oninput = () => {
                let n = Number(slider.value);
                if (Number.isNaN(n)) return;
                n = Math.max(min, Math.min(max, n));
                slider.value = String(n);
                const old = (s.Key in localState) ? localState[s.Key] : s.Value;
                localState[s.Key] = n;
                valueLabel.textContent = fmt2(n);
                applySet(s.Key, n, old);
            };
            controlUpdaters[s.Key] = (val) => {
                const n = Number(val);
                if (Number.isNaN(n)) return;
                slider.value = String(n);
                valueLabel.textContent = fmt2(n);
            };
            ctl.appendChild(slider);
            ctl.appendChild(valueLabel);
        } else if (type === 'bool') {
            const tog = document.createElement('div');
            tog.className = 'field-toggle' + (v ? ' on' : '') + (isDisabled ? ' disabled' : '');
            if (!isDisabled) {
                tog.setAttribute('data-tsic-focusable', '');
                tog.tabIndex = 0;
            }
            if (!isDisabled) {
                tog.onclick = () => {
                    const old = localState[s.Key] !== undefined ? localState[s.Key] : v;
                    localState[s.Key] = !old;
                    tog.classList.toggle('on', localState[s.Key]);
                    applySet(s.Key, localState[s.Key], old);
                };
            }
            controlUpdaters[s.Key] = (val) => tog.classList.toggle('on', !!val);
            ctl.appendChild(tog);
        } else if (type === 'enum' || Array.isArray(s.Options)) {
            // tsic-dropdown, NOT a native <select>: CEF renders native select popups
            // through a Slate menu that misplaces/flips under accelerated paint.
            const opts = (s.Options || []).map((opt) => ({
                value: String(opt.Value !== undefined ? opt.Value : opt),
                label: String(opt.Label !== undefined ? opt.Label : opt),
            }));
            const dd = document.createElement('button');
            dd.type = 'button';
            dd.className = 'tsic-dropdown';
            dd.disabled = isDisabled;
            dd.setAttribute('data-tsic-focusable', '');
            dd.setAttribute('data-tsic-options', JSON.stringify(opts));
            dd.setAttribute('data-tsic-value', String(v));
            const ddLabel = document.createElement('span');
            ddLabel.className = 'tsic-dropdown-label';
            const current = opts.find((o) => o.value === String(v));
            ddLabel.textContent = current ? current.label : String(v);
            const ddCaret = document.createElement('span');
            ddCaret.className = 'tsic-dropdown-caret';
            ddCaret.textContent = '▾';
            dd.appendChild(ddLabel);
            dd.appendChild(ddCaret);
            dd.addEventListener('tsic-change', () => {
                // controlUpdaters value echoes call tsic.dropdown.set, which fires
                // tsic-change too — only publish genuine changes.
                const newValue = tsic.dropdown.get(dd);
                if (localState[s.Key] === newValue) return;
                const old = (s.Key in localState) ? localState[s.Key] : String(v);
                localState[s.Key] = newValue;
                applySet(s.Key, newValue, old);
            });
            controlUpdaters[s.Key] = (val) => {
                localState[s.Key] = String(val);
                tsic.dropdown.set(dd, String(val));
            };
            ctl.appendChild(dd);
        } else if (type === 'action') {
            const btn = document.createElement('button');
            btn.className = 'tsic-button';
            btn.type = 'button';
            btn.textContent = s.ButtonText || s.Label;
            btn.disabled = isDisabled;
            btn.onclick = () => publishAction(s.Key);
            ctl.appendChild(btn);
        } else {
            const span = document.createElement('span');
            span.textContent = JSON.stringify(v);
            span.className = 'value-label';
            ctl.appendChild(span);
        }
        row.appendChild(ctl);
        return row;
    }

    // ---- Controls tab rendering (rebind + analog prefs) ----

    function makeGroup(title) {
        const sec = document.createElement('div');
        sec.className = 'group';
        const h = document.createElement('h3');
        h.textContent = title || '';
        sec.appendChild(h);
        return sec;
    }

    function keyCapInto(btn, keyText, isGamepad) {
        btn.innerHTML = '';
        const url = (window.TSIC && TSIC.keyIconUrl) ? TSIC.keyIconUrl(keyText, isGamepad) : '';
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = keyText;
            img.onerror = () => {
                img.remove();
                const span = document.createElement('span');
                span.className = 'key-text';
                span.textContent = keyText || 'Unbound';
                btn.appendChild(span);
            };
            btn.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.className = 'key-text';
            span.textContent = keyText || 'Unbound';
            btn.appendChild(span);
        }
    }

    function buildRebindButton(entry, isGamepad) {
        const btn = document.createElement('button');
        btn.className = 'bind-btn';
        btn.type = 'button';
        btn.dataset.hotkeyId = entry.HotkeyId;
        btn.dataset.gamepad = isGamepad ? '1' : '0';
        const keyText = isGamepad ? entry.GamepadKeyText : entry.KeyboardKeyText;
        keyCapInto(btn, keyText, isGamepad);
        const remappable = isGamepad ? entry.bGamepadRemappable : entry.bKeyboardRemappable;
        if (remappable === false) {
            btn.classList.add('locked');
            btn.disabled = true;
        } else {
            btn.onclick = () => beginRebind(entry.HotkeyId, isGamepad, btn);
        }
        // Same key in the same context is a real conflict (red); in a different
        // context it is deliberate sharing, surfaced in the tooltip only.
        const conflicts = isGamepad ? entry.GamepadConflictsWith : entry.KeyboardConflictsWith;
        const shared = isGamepad ? entry.GamepadSharedWith : entry.KeyboardSharedWith;
        const tips = [];
        if (keyText) tips.push(keyText);
        if (conflicts) {
            btn.classList.add('conflict');
            tips.push('Also bound to ' + conflicts + ' in the same context');
        }
        if (shared) tips.push('Also used by ' + shared + ' (different context)');
        if (tips.length) btn.title = tips.join('\n');
        return btn;
    }

    // The description under an action name is its behaviour list; most hotkeys back a
    // single behaviour with the same name, which would just echo it ("Build Build") —
    // show only the parts that add information.
    function bindingNote(entry) {
        const name = entry.DisplayName || entry.HotkeyId;
        return String(entry.BehaviorsLabel || '')
            .split(',').map(s => s.trim())
            .filter(s => s && s !== name)
            .join(', ');
    }

    function buildBindingRow(entry, isGamepad) {
        const row = document.createElement('div');
        row.className = 'binding-row';
        row.dataset.hotkeyId = entry.HotkeyId;

        const name = document.createElement('label');
        name.className = 'binding-name';
        name.textContent = entry.DisplayName || entry.HotkeyId;
        const note = bindingNote(entry);
        if (note) {
            const sub = document.createElement('span');
            sub.className = 'shared-note';
            sub.textContent = note;
            name.appendChild(sub);
        }
        // Names ellipsize rather than widen the layout — full text in the tooltip.
        name.title = (entry.DisplayName || entry.HotkeyId) + (note ? ' — ' + note : '');
        row.appendChild(name);

        const leader = document.createElement('div');
        leader.className = 'binding-leader';
        row.appendChild(leader);

        // Hold/Toggle is a per-ACTION preference, so it appears on both device tabs;
        // the word next to the pill states the current mode outright.
        const mode = document.createElement('div');
        mode.className = 'mode-cell';
        if (entry.bToggleable && entry.ToggleBehaviorTagName) {
            const tog = document.createElement('div');
            tog.className = 'field-toggle' + (entry.HoldToggle === 1 ? ' on' : '');
            // Reachable by gamepad/keyboard nav; Accept fires the click handler.
            tog.setAttribute('data-tsic-focusable', '');
            tog.tabIndex = 0;
            const word = document.createElement('span');
            word.className = 'mode-word';
            word.textContent = entry.HoldToggle === 1 ? 'Toggle' : 'Hold';
            tog.onclick = () => {
                const next = !tog.classList.contains('on');
                tog.classList.toggle('on', next);
                word.textContent = next ? 'Toggle' : 'Hold';
                publishSet('hold_toggle', { behavior: entry.ToggleBehaviorTagName, toggle: next });
            };
            mode.appendChild(tog);
            mode.appendChild(word);
        }
        row.appendChild(mode);

        const bind = document.createElement('div');
        bind.className = 'bind-cell';
        bind.appendChild(buildRebindButton(entry, isGamepad));
        row.appendChild(bind);
        return row;
    }

    function sliderRow(label, key, value, min, max, step) {
        return buildField({ Key: key, Label: label, Type: 'range', Min: min, Max: max, Step: step, Value: value });
    }
    function toggleRow(label, key, value) {
        return buildField({ Key: key, Label: label, Type: 'bool', Value: value });
    }

    // Category headers render in a fixed canonical order; anything unrecognized
    // (e.g. a modded hotkey with its own category) lands after them, Other last.
    const CATEGORY_ORDER = ['Movement', 'Interaction', 'Combat', 'Building', 'Map', 'Hotbar', 'Interface'];

    // Search text survives re-renders — every applied rebind refreshes ControlsState,
    // which rebuilds the page, and losing the filter mid-search would be jarring.
    let bindingFilter = '';

    function applyBindingFilter(host) {
        const needle = bindingFilter.trim().toLowerCase();
        for (const group of host.querySelectorAll('.binding-group')) {
            let visible = 0;
            for (const row of group.querySelectorAll('.binding-row')) {
                const hit = !needle || (row.dataset.search || '').indexOf(needle) >= 0;
                row.hidden = !hit;
                if (hit) visible++;
            }
            group.hidden = visible === 0;
        }
    }

    // One device's view of the ControlsState: searchable, category-grouped binding
    // rows, that device's analog prefs, and a per-device reset. An entry shows on a
    // tab when it is bound or remappable on that device; bound-but-locked renders
    // the greyed cap.
    function renderControlsPage(host, isGamepad) {
        const cs = controlsState || { Entries: [] };

        const toolbar = document.createElement('div');
        toolbar.className = 'bindings-toolbar';
        const search = document.createElement('input');
        search.id = 'binding-search';
        search.type = 'text';
        search.placeholder = 'Search bindings…';
        search.value = bindingFilter;
        search.oninput = () => { bindingFilter = search.value; applyBindingFilter(host); };
        // Down from the search enters the first visible row's control — the rows'
        // focusables are right-aligned, so nothing below overlaps the search box
        // and spatial nav would otherwise skip the whole list to the footer.
        search.setAttribute('data-tsic-nav-down',
            '#page .binding-row :is([data-tsic-focusable], .bind-btn)');
        toolbar.appendChild(search);
        for (const caption of ['Mode', 'Binding']) {
            const cap = document.createElement('span');
            cap.className = 'col-caption';
            cap.textContent = caption;
            toolbar.appendChild(cap);
        }
        host.appendChild(toolbar);

        const entries = (cs.Entries || []).filter((e) => {
            const remappable = isGamepad ? e.bGamepadRemappable !== false : e.bKeyboardRemappable !== false;
            const bound = !!(isGamepad ? e.GamepadKeyText : e.KeyboardKeyText);
            return remappable || bound;
        });
        const byCat = new Map();
        for (const e of entries) {
            const cat = e.Category || 'Other';
            if (!byCat.has(cat)) byCat.set(cat, []);
            byCat.get(cat).push(e);
        }
        const extraCats = Array.from(byCat.keys())
            .filter(c => CATEGORY_ORDER.indexOf(c) < 0 && c !== 'Other').sort();
        const cats = CATEGORY_ORDER.filter(c => byCat.has(c)).concat(extraCats);
        if (byCat.has('Other')) cats.push('Other');
        for (const cat of cats) {
            const sec = makeGroup(cat);
            sec.classList.add('binding-group');
            for (const e of byCat.get(cat)) {
                const row = buildBindingRow(e, isGamepad);
                row.dataset.search = (e.DisplayName + ' ' + (e.BehaviorsLabel || '') + ' '
                    + (isGamepad ? e.GamepadKeyText : e.KeyboardKeyText)).toLowerCase();
                sec.appendChild(row);
            }
            host.appendChild(sec);
        }
        applyBindingFilter(host);

        const inp = makeGroup(isGamepad ? 'Gamepad' : 'Mouse');
        if (isGamepad) {
            inp.appendChild(sliderRow('Gamepad sensitivity', 'gamepad_sensitivity', cs.GamepadSensitivity, 0.05, 1, 0.05));
            inp.appendChild(sliderRow('Gamepad stick deadzone', 'gamepad_deadzone', cs.GamepadDeadzone, 0, 0.9, 0.01));
            inp.appendChild(toggleRow('Invert gamepad Y', 'invert_gamepad_y', cs.bInvertGamepadY));
        } else {
            inp.appendChild(sliderRow('Mouse sensitivity', 'mouse_sensitivity', cs.MouseSensitivity, 0.1, 3, 0.05));
            inp.appendChild(toggleRow('Invert mouse Y', 'invert_mouse_y', cs.bInvertMouseY));
        }
        host.appendChild(inp);

        const resetRow = document.createElement('div');
        resetRow.className = 'field';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'tsic-button';
        resetBtn.id = 'btn-reset-controls';
        resetBtn.type = 'button';
        resetBtn.textContent = isGamepad ? 'Reset controller bindings' : 'Reset keyboard bindings';
        resetBtn.onclick = () => tsic.publishMessage('UI.Cmd.Settings.ResetControls', { bGamepad: !!isGamepad });
        resetRow.appendChild(resetBtn);
        host.appendChild(resetRow);
    }

    // ---- Rebind capture flow (C++-driven) ----

    function ensureModal() {
        let modal = document.getElementById('rebind-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'rebind-modal';
        modal.className = 'settings-modal';
        modal.hidden = true;
        const panel = document.createElement('div');
        panel.className = 'panel';
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.id = 'rebind-msg';
        panel.appendChild(msg);
        const row = document.createElement('div');
        row.className = 'tsic-button-row';
        row.id = 'rebind-actions';
        panel.appendChild(row);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        return modal;
    }

    // Capture has no buttons: cancel is Esc / Start (reserved keys, handled by the
    // C++ input manager; the window Esc handler below covers keyboard users whose
    // Esc reaches CEF first). Any on-screen button would be unreachable anyway —
    // every gamepad press is captured as the binding.
    function showCaptureModal() {
        const modal = ensureModal();
        const gamepad = activeRebind && activeRebind.bGamepad;
        document.getElementById('rebind-msg').textContent = gamepad
            ? 'Press a button…  (Start to cancel)'
            : 'Press a key…  (Esc to cancel)';
        document.getElementById('rebind-actions').innerHTML = '';
        modal.hidden = false;
    }

    function showConflictModal(cap) {
        const modal = ensureModal();
        document.getElementById('rebind-msg').textContent =
            `${cap.CapturedKeyText} is already bound to ${cap.ConflictHotkeyText} — replace?`;
        const actions = document.getElementById('rebind-actions');
        actions.innerHTML = '';
        const replace = document.createElement('button');
        replace.className = 'tsic-button';
        replace.id = 'rebind-replace';
        replace.textContent = 'Replace';
        replace.onclick = () => { tsic.publishMessage('UI.Cmd.Settings.ConfirmRebind', {}); hideModal(); };
        const cancel = document.createElement('button');
        cancel.className = 'tsic-button';
        cancel.textContent = 'Cancel';
        cancel.onclick = cancelRebind;
        actions.appendChild(replace);
        actions.appendChild(cancel);
        modal.hidden = false;
        // Focus-trap the prompt so controller users can pick Replace; a Back that
        // pops the scope (B) abandons the pending rebind like Esc/Start do.
        if (tsic.focus && tsic.focus.pushScope && !modalScopePushed) {
            modalScopePushed = true;
            tsic.focus.pushScope(modal.querySelector('.panel'), cancel, {
                onPop: () => { modalScopePushed = false; if (activeRebind) cancelRebind(); },
            });
        }
    }

    function hideModal() {
        const modal = document.getElementById('rebind-modal');
        if (modal) modal.hidden = true;
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = null;
        if (modalScopePushed) {
            modalScopePushed = false;
            if (tsic.focus && tsic.focus.popScope) tsic.focus.popScope();
        }
    }

    function beginRebind(hotkeyId, bGamepad, btn) {
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = { hotkeyId, bGamepad, btn };
        if (btn) btn.classList.add('waiting');
        tsic.publishMessage('UI.Cmd.Settings.BeginRebind', { HotkeyId: hotkeyId, bGamepad: !!bGamepad });
        showCaptureModal();
    }

    function cancelRebind() {
        tsic.publishMessage('UI.Cmd.Settings.CancelRebind', {});
        hideModal();
    }

    function onRebindCapture(cap) {
        if (!cap) return;
        if (cap.bCapturing) { showCaptureModal(); return; }
        if (cap.bConflict) { showConflictModal(cap); return; }
        // No conflict (applied) or cancelled — close. ControlsState refresh re-renders.
        hideModal();
    }

    // ---- Video keep/revert countdown ----

    // Roll the just-changed video keys back to their pre-change values.
    function revertVideo() {
        for (const k of Object.keys(videoRevert)) {
            const old = videoRevert[k];
            localState[k] = old;
            publishSet(k, old);
            if (controlUpdaters[k]) controlUpdaters[k](old);
            delete videoRevert[k];
        }
    }

    function keepVideo() {
        for (const k of Object.keys(videoRevert)) delete videoRevert[k];
    }

    // One popover at a time. `action`: 'keep' | 'revert'.
    // `viaScopePop` is true when the focus scope was already popped (gamepad/
    // Esc Back handled by tsic-focus), so we must not pop it again.
    function resolvePopover(action, viaScopePop) {
        const p = activePopover;
        if (!p) return;
        activePopover = null;
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        p.el.remove();
        if (!viaScopePop && tsic.focus && tsic.focus.popScope) tsic.focus.popScope();
        if (action === 'keep') keepVideo();
        else if (action === 'revert') revertVideo();
    }

    function popoverButton(id, label, variant, action) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'tsic-button' + (variant ? ' ' + variant : '');
        btn.type = 'button';
        btn.textContent = label;
        btn.onclick = () => resolvePopover(action, false);
        return btn;
    }

    function openPopover(kind, titleText, subNodes, buttons, initialBtn) {
        resolvePopover('cancel', false); // never stack popovers
        const modal = document.createElement('div');
        modal.id = 'settings-popover';
        modal.className = 'settings-modal';
        const panel = document.createElement('div');
        panel.className = 'panel';
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.appendChild(document.createTextNode(titleText));
        if (subNodes && subNodes.length) {
            const sub = document.createElement('div');
            sub.className = 'sub';
            for (const n of subNodes) sub.appendChild(n);
            msg.appendChild(sub);
        }
        panel.appendChild(msg);
        const row = document.createElement('div');
        row.className = 'tsic-button-row';
        for (const b of buttons) row.appendChild(b);
        panel.appendChild(row);
        modal.appendChild(panel);
        document.body.appendChild(modal);
        activePopover = { el: modal, kind };
        // Modal focus scope: gamepad focus stays inside, and a Back press pops
        // the popover (router skips its screen-close via backHandled()). Back
        // resolves to the popover's safe action.
        if (tsic.focus && tsic.focus.pushScope) {
            tsic.focus.pushScope(modal, initialBtn, { onPop: () => {
                if (!activePopover) return; // popped by resolvePopover itself
                resolvePopover(activePopover.kind === 'countdown' ? 'revert' : 'cancel', true);
            } });
        }
    }

    // A video-mode change just applied: give the player a timed escape hatch.
    // Runs at most one countdown; further video edits while it's open join its
    // revert set (applySet) without resetting the timer.
    function openKeepCountdown() {
        if (activePopover) return;
        let remaining = KEEP_COUNTDOWN_SECONDS;
        const count = document.createElement('b');
        count.id = 'popover-countdown';
        count.textContent = String(remaining);
        const sub = [document.createTextNode('Reverting in '), count, document.createTextNode('s')];
        const keepBtn = popoverButton('popover-keep', 'Keep changes', '', 'keep');
        const revertBtn = popoverButton('popover-revert', 'Revert', 'secondary', 'revert');
        openPopover('countdown', 'Keep these settings?', sub, [revertBtn, keepBtn], keepBtn);
        countdownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) { resolvePopover('revert', false); return; }
            count.textContent = String(remaining);
        }, 1000);
    }

    // ---- Page / tab plumbing ----

    function allPages() {
        const pages = ((lastCatalog && lastCatalog.Pages) || []).slice();
        if (controlsState) {
            pages.push({ Id: KBM_PAGE_ID, Title: 'Keyboard & Mouse' });
            pages.push({ Id: GAMEPAD_PAGE_ID, Title: 'Controller' });
        }
        return pages;
    }

    function renderTabs() {
        const host = document.getElementById('tabs');
        if (!host) return;
        host.innerHTML = '';
        const pages = allPages();
        if (!pages.length) return;
        if (!activePageId || !pages.find(p => p.Id === activePageId)) {
            activePageId = pages[0].Id;
        }
        for (const p of pages) {
            const btn = document.createElement('button');
            btn.className = 'tsic-tab' + (p.Id === activePageId ? ' is-active' : '');
            btn.type = 'button';
            btn.dataset.pageId = p.Id;
            btn.textContent = p.Title || p.Id;
            btn.onclick = () => {
                activePageId = p.Id;
                renderTabs();
                renderPage();
                // Land on the new page's top setting (skipping the search box).
                // Bumper tab-cycling routes through this click too; without an
                // explicit target the rebuild orphans focus and the next press
                // fell back to the footer's Back button.
                const first = document.querySelector(
                    '#page :is(button, select, textarea, [data-tsic-focusable], input:not(#binding-search))');
                if (first && window.tsic && tsic.focus && tsic.focus.focus) tsic.focus.focus(first);
            };
            // Down from any tab enters the page content. Spatial nav can't infer
            // this: the page's focusables sit left (search) or right (bind
            // buttons) of most tabs, so the only rect-overlapping candidate
            // below would be the full-width footer buttons.
            btn.setAttribute('data-tsic-nav-down',
                '#page :is(button, input, select, textarea, [data-tsic-focusable])');
            host.appendChild(btn);
        }
    }

    function renderPage() {
        const host = document.getElementById('page');
        if (!host) return;
        host.innerHTML = '';
        // DOM was just wiped — drop the now-stale value-patch updaters before we
        // rebuild (or hand off to a device bindings page, which registers none).
        for (const k in controlUpdaters) delete controlUpdaters[k];
        if (isControlsPage(activePageId)) {
            renderControlsPage(host, activePageId === GAMEPAD_PAGE_ID);
            return;
        }
        const page = lastCatalog && (lastCatalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) {
            host.textContent = '(no settings yet)';
            lastStructSig = null;
            return;
        }
        for (const g of (page.Groups || [])) {
            const sec = makeGroup(g.Title || g.Id || '');
            for (const s of (g.Settings || [])) sec.appendChild(buildField(s));
            host.appendChild(sec);
        }
        lastStructSig = structSig(lastCatalog);
    }

    // Signature of the rendered structure (everything except live Values) +
    // the active page. Two Catalogs with the same signature are interchangeable
    // by value-patching; a different signature requires a full rebuild.
    function structSig(catalog) {
        try {
            const pages = (catalog && catalog.Pages) || [];
            return activePageId + '::' + JSON.stringify(pages.map(p => ({
                i: p.Id,
                g: (p.Groups || []).map(g => ({
                    i: g.Id, t: g.Title,
                    s: (g.Settings || []).map(s => ({
                        k: s.Key, t: s.Type, l: s.Label, d: !!s.Disabled,
                        o: (s.Options || []).map(o => (o && o.Value !== undefined) ? o.Value : o),
                    })),
                })),
            })));
        } catch (e) { return null; }
    }

    // Patch the active page's control values from a structurally-identical
    // Catalog without touching the DOM tree — never destroys a control the user
    // is interacting with (e.g. a slider being dragged).
    function applyValues(catalog) {
        const page = (catalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) return;
        for (const g of (page.Groups || [])) {
            for (const s of (g.Settings || [])) {
                if (!s.Key || !controlUpdaters[s.Key]) continue;
                // An echoed value is the applied truth — move the control.
                localState[s.Key] = s.Value;
                controlUpdaters[s.Key](s.Value);
            }
        }
    }

    function renderFooter(footer) {
        // Tolerate both spellings: the C++ bridge's authored-name serialization
        // drops the leading 'b' (RestartRequired), the static catalog keeps it.
        const restart = document.getElementById('restart-required');
        if (restart) restart.hidden = !(footer && (footer.bRestartRequired || footer.RestartRequired));
    }

    function onCatalog(payload) {
        if (!payload) return;
        let parsed = null;
        try { parsed = JSON.parse(payload.Json || '{}'); } catch (e) {}
        lastCatalog = parsed || {};
        renderFooter(lastCatalog.Footer);
        // Structure unchanged (only Values differ, e.g. a value echo while
        // dragging a slider): patch values in place so we never destroy the
        // control mid-interaction. Otherwise do a full rebuild.
        if (lastStructSig !== null && structSig(lastCatalog) === lastStructSig
            && Object.keys(controlUpdaters).length) {
            applyValues(lastCatalog);
            return;
        }
        // A structurally new catalog is a new source of truth — drop edits from
        // the previous one so buildField re-seeds from it.
        for (const k of Object.keys(localState)) delete localState[k];
        renderTabs(lastCatalog);
        renderPage();
    }

    // Every applied edit echoes a fresh ControlsState, and the rebuild destroys
    // whatever control the player had focused (toggling Hold/Toggle with A would
    // dump focus to <body>, and the next stick press fell back to the footer).
    // Capture a stable identity before the rebuild and re-focus its equivalent.
    function focusIdentity() {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (el.id === 'binding-search') return { search: true };
        if (el.classList && el.classList.contains('tsic-tab')) return { tabId: el.dataset.pageId };
        const row = el.closest && el.closest('.binding-row');
        if (row) return { hotkeyId: row.dataset.hotkeyId, pill: el.classList.contains('field-toggle') };
        return null;
    }

    function restoreFocus(identity) {
        if (!identity) return;
        let el = null;
        if (identity.search) {
            el = document.getElementById('binding-search');
        } else if (identity.tabId) {
            el = document.querySelector('.tsic-tab[data-page-id="' + identity.tabId + '"]');
        } else if (identity.hotkeyId) {
            const row = document.querySelector('.binding-row[data-hotkey-id="' + identity.hotkeyId + '"]');
            if (row) el = identity.pill ? row.querySelector('.field-toggle') : row.querySelector('.bind-btn');
        }
        if (!el) return;
        if (window.tsic && tsic.focus && tsic.focus.focus) tsic.focus.focus(el);
        else el.focus();
    }

    function onControlsState(payload) {
        if (!payload) return;
        const focused = focusIdentity();
        controlsState = payload;
        renderTabs();
        if (isControlsPage(activePageId)) renderPage();
        restoreFocus(focused);
    }

    function onValue(payload) {
        if (!payload || !payload.Key) return;
        let v;
        try { v = JSON.parse(payload.ValueJson || 'null'); } catch (e) { return; }
        // Authoritative saved value (per-key sticky replay when the screen
        // opens, or a later C++ echo): it moves the control.
        localState[payload.Key] = v;
        if (controlUpdaters[payload.Key]) controlUpdaters[payload.Key](v);
    }

    function onFooter(payload) { renderFooter(payload); }

    function goBack() { tsic.publishMessage('UI.Cmd.Settings.Back', {}); }
    function doReset() {
        if (isControlsPage(activePageId)) {
            tsic.publishMessage('UI.Cmd.Settings.ResetControls', { bGamepad: activePageId === GAMEPAD_PAGE_ID });
            return;
        }
        tsic.publishMessage('UI.Cmd.Settings.ResetDefaults', { PageId: activePageId || '' });
    }

    function onGlobalKey(e) {
        if (activePopover) {
            // Esc resolves the countdown to its safe action: revert — the same
            // thing the timeout would do. Mirrors the Back-pop path in openPopover.
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopPropagation();
                resolvePopover('revert', false);
            }
            return;
        }
        if (activeRebind) {
            // Capture is owned by C++; here we only let Esc dismiss the dialog for
            // keyboard users whose Esc reaches CEF (e.g. focused dialog).
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRebind(); }
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            goBack();
        }
    }

    // Build the static structure BEFORE subscribing: tsic.on replays sticky
    // messages synchronously, so the per-key UI.Settings.Value replays (the
    // real saved values) land on an already-built page and move its controls —
    // subscribing first would let the placeholder build wipe them.
    onCatalog({ Json: JSON.stringify(STATIC_CATALOG) });
    tsic.on('tsic.msg.UI.Settings.Catalog', onCatalog);
    tsic.on('tsic.msg.UI.Settings.ControlsState', onControlsState);
    tsic.on('tsic.msg.UI.Settings.RebindCapture', onRebindCapture);
    tsic.on('tsic.msg.UI.Settings.Value', onValue);
    tsic.on('tsic.msg.UI.Settings.Footer', onFooter);
    window.addEventListener('keydown', onGlobalKey, true);
    // Leaving the screen mid-countdown means the user never chose Keep — take
    // the safe path and roll the applied values back before the page goes away.
    window.addEventListener('pagehide', () => {
        if (activePopover && activePopover.kind === 'countdown') resolvePopover('revert', true);
    });
    const backBtn = document.getElementById('btn-back');     if (backBtn)  backBtn.onclick  = goBack;
    const resetBtn = document.getElementById('btn-reset');   if (resetBtn) resetBtn.onclick = doReset;
})();
