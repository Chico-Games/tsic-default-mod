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

    // Static catalog for Audio/Video/Gameplay. The "Controls" tab is built
    // dynamically from UI.Settings.ControlsState (rebinds can't be captured in JS;
    // the C++ input manager drives capture — see HandleCmdSettingsBeginRebind).
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
                          { Value: '1920x1080', Label: '1920x1080' },
                          { Value: '2560x1440', Label: '2560x1440' },
                          { Value: '3840x2160', Label: '3840x2160' },
                      ],
                      Value: '2560x1440' },
                ] },
            ] },
            { Id: 'GameplayCollection', Title: 'Gameplay', Groups: [
                { Id: 'Camera', Title: 'Camera', Settings: [
                    { Key: 'gameplay.fov', Label: 'Field of view', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                ] },
            ] },
        ],
        Footer: { AnyDirty: false, RestartRequired: false, ApplyCountdownSeconds: -1 },
    };

    const CONTROLS_PAGE_ID = 'ControlsCollection';
    const SITUATION_TITLES = {
        'Input.Situation.Combat': 'Gameplay',
        'Input.Situation.Construction': 'Construction',
        'Input.Situation.UI.Map': 'Map',
    };

    let activePageId = null;
    let lastCatalog = null;
    let controlsState = null;
    let activeRebind = null;   // { hotkeyId, bGamepad, btn }
    const localState = {};

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
            valueLabel.textContent = s.Display !== undefined ? s.Display : String(v);
            slider.oninput = () => {
                let n = Number(slider.value);
                if (Number.isNaN(n)) return;
                n = Math.max(min, Math.min(max, n));
                slider.value = String(n);
                localState[s.Key] = n;
                valueLabel.textContent = String(n);
                publishSet(s.Key, n);
            };
            ctl.appendChild(slider);
            ctl.appendChild(valueLabel);
        } else if (type === 'bool') {
            const tog = document.createElement('div');
            tog.className = 'field-toggle' + (v ? ' on' : '') + (isDisabled ? ' disabled' : '');
            if (!isDisabled) {
                tog.onclick = () => {
                    localState[s.Key] = !(localState[s.Key] !== undefined ? localState[s.Key] : v);
                    tog.classList.toggle('on', localState[s.Key]);
                    publishSet(s.Key, localState[s.Key]);
                };
            }
            ctl.appendChild(tog);
        } else if (type === 'enum' || Array.isArray(s.Options)) {
            const sel = document.createElement('select');
            sel.disabled = isDisabled;
            for (const opt of (s.Options || [])) {
                const o = document.createElement('option');
                o.value = String(opt.Value !== undefined ? opt.Value : opt);
                o.textContent = String(opt.Label !== undefined ? opt.Label : opt);
                if (o.value === String(v)) o.selected = true;
                sel.appendChild(o);
            }
            sel.onchange = () => {
                localState[s.Key] = sel.value;
                publishSet(s.Key, localState[s.Key]);
            };
            ctl.appendChild(sel);
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
        keyCapInto(btn, isGamepad ? entry.GamepadKeyText : entry.KeyboardKeyText, isGamepad);
        btn.onclick = () => beginRebind(entry.HotkeyId, isGamepad, btn);
        return btn;
    }

    function buildBindingRow(entry) {
        const row = document.createElement('div');
        row.className = 'field binding-row';
        row.dataset.behavior = entry.BehaviorTagName;

        const lbl = document.createElement('label');
        lbl.textContent = entry.DisplayName || entry.BehaviorTagName;
        if (entry.SharedByCount > 1) {
            const note = document.createElement('span');
            note.className = 'shared-note';
            note.textContent = `shared by ${entry.SharedByCount}`;
            lbl.appendChild(note);
        }
        row.appendChild(lbl);

        const ctl = document.createElement('div');
        ctl.className = 'field-control';

        if (!entry.Remappable) {
            const locked = document.createElement('span');
            locked.className = 'bind-locked';
            locked.textContent = entry.KeyboardKeyText || 'System';
            ctl.appendChild(locked);
        } else {
            ctl.appendChild(buildRebindButton(entry, false));
            ctl.appendChild(buildRebindButton(entry, true));

            if (entry.Toggleable) {
                const sel = document.createElement('select');
                sel.className = 'holdtoggle';
                [['hold', 'Hold'], ['toggle', 'Toggle']].forEach(([val, text]) => {
                    const o = document.createElement('option');
                    o.value = val; o.textContent = text;
                    if ((entry.HoldToggle === 1) === (val === 'toggle')) o.selected = true;
                    sel.appendChild(o);
                });
                sel.onchange = () => {
                    publishSet('hold_toggle', { behavior: entry.BehaviorTagName, toggle: sel.value === 'toggle' });
                };
                ctl.appendChild(sel);
            }
        }
        row.appendChild(ctl);
        return row;
    }

    function sliderRow(label, key, value, min, max, step) {
        return buildField({ Key: key, Label: label, Type: 'range', Min: min, Max: max, Step: step, Value: value });
    }
    function toggleRow(label, key, value) {
        return buildField({ Key: key, Label: label, Type: 'bool', Value: value });
    }

    function renderControlsPage(host) {
        const cs = controlsState || { Entries: [] };
        const bySituation = {};
        const order = [];
        for (const e of (cs.Entries || [])) {
            if (!bySituation[e.SituationTagName]) { bySituation[e.SituationTagName] = []; order.push(e.SituationTagName); }
            bySituation[e.SituationTagName].push(e);
        }
        for (const sit of order) {
            const sec = makeGroup(SITUATION_TITLES[sit] || sit);
            for (const e of bySituation[sit]) sec.appendChild(buildBindingRow(e));
            host.appendChild(sec);
        }

        const inp = makeGroup('Input');
        inp.appendChild(sliderRow('Mouse sensitivity', 'mouse_sensitivity', cs.MouseSensitivity, 0.1, 3, 0.05));
        inp.appendChild(sliderRow('Gamepad sensitivity', 'gamepad_sensitivity', cs.GamepadSensitivity, 0.05, 1, 0.05));
        inp.appendChild(sliderRow('Gamepad stick deadzone', 'gamepad_deadzone', cs.GamepadDeadzone, 0, 0.9, 0.01));
        inp.appendChild(toggleRow('Invert mouse Y', 'invert_mouse_y', cs.InvertMouseY));
        inp.appendChild(toggleRow('Invert gamepad Y', 'invert_gamepad_y', cs.InvertGamepadY));
        host.appendChild(inp);

        const resetRow = document.createElement('div');
        resetRow.className = 'field';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'tsic-button';
        resetBtn.id = 'btn-reset-controls';
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reset bindings to defaults';
        resetBtn.onclick = () => tsic.publishMessage('UI.Cmd.Settings.ResetControls', {});
        resetRow.appendChild(resetBtn);
        host.appendChild(resetRow);
    }

    // ---- Rebind capture flow (C++-driven) ----

    function ensureModal() {
        let modal = document.getElementById('rebind-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'rebind-modal';
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
        document.getElementById('wrap').appendChild(modal);
        return modal;
    }

    function showCaptureModal() {
        const modal = ensureModal();
        document.getElementById('rebind-msg').textContent = 'Press a key…  (Esc to cancel)';
        const actions = document.getElementById('rebind-actions');
        actions.innerHTML = '';
        const cancel = document.createElement('button');
        cancel.className = 'tsic-button';
        cancel.textContent = 'Cancel';
        cancel.onclick = cancelRebind;
        actions.appendChild(cancel);
        modal.hidden = false;
    }

    function showConflictModal(cap) {
        const modal = ensureModal();
        document.getElementById('rebind-msg').textContent =
            `${cap.CapturedKeyText} is already bound to ${behaviorName(cap.ConflictBehavior)} — replace?`;
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
    }

    function hideModal() {
        const modal = document.getElementById('rebind-modal');
        if (modal) modal.hidden = true;
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = null;
    }

    function behaviorName(tag) {
        if (!controlsState) return tag;
        const e = (controlsState.Entries || []).find(x => x.BehaviorTagName === tag);
        return e ? e.DisplayName : tag;
    }

    function beginRebind(hotkeyId, bGamepad, btn) {
        if (activeRebind && activeRebind.btn) activeRebind.btn.classList.remove('waiting');
        activeRebind = { hotkeyId, bGamepad, btn };
        if (btn) btn.classList.add('waiting');
        tsic.publishMessage('UI.Cmd.Settings.BeginRebind', { HotkeyId: hotkeyId, Gamepad: !!bGamepad });
        showCaptureModal();
    }

    function cancelRebind() {
        tsic.publishMessage('UI.Cmd.Settings.CancelRebind', {});
        hideModal();
    }

    function onRebindCapture(cap) {
        if (!cap) return;
        if (cap.Capturing) { showCaptureModal(); return; }
        if (cap.Conflict) { showConflictModal(cap); return; }
        // No conflict (applied) or cancelled — close. ControlsState refresh re-renders.
        hideModal();
    }

    // ---- Page / tab plumbing ----

    function allPages() {
        const pages = ((lastCatalog && lastCatalog.Pages) || []).slice();
        if (controlsState) {
            pages.push({ Id: CONTROLS_PAGE_ID, Title: 'Controls' });
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
            btn.className = 'tsic-tab' + (p.Id === activePageId ? ' active' : '');
            btn.type = 'button';
            btn.dataset.pageId = p.Id;
            btn.textContent = p.Title || p.Id;
            btn.onclick = () => { activePageId = p.Id; renderTabs(); renderPage(); };
            host.appendChild(btn);
        }
    }

    function renderPage() {
        const host = document.getElementById('page');
        if (!host) return;
        host.innerHTML = '';
        if (activePageId === CONTROLS_PAGE_ID) {
            renderControlsPage(host);
            return;
        }
        const page = lastCatalog && (lastCatalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) {
            host.textContent = '(no settings yet)';
            return;
        }
        for (const g of (page.Groups || [])) {
            const sec = makeGroup(g.Title || g.Id || '');
            for (const s of (g.Settings || [])) sec.appendChild(buildField(s));
            host.appendChild(sec);
        }
    }

    function renderFooter(footer) {
        const restart = document.getElementById('restart-required');
        const toast = document.getElementById('apply-toast');
        const count = document.getElementById('apply-countdown');
        if (restart) restart.hidden = !(footer && footer.RestartRequired);
        if (toast) {
            const active = footer && typeof footer.ApplyCountdownSeconds === 'number' && footer.ApplyCountdownSeconds >= 0;
            toast.hidden = !active;
            if (active && count) count.textContent = String(Math.ceil(footer.ApplyCountdownSeconds));
        }
    }

    function onCatalog(payload) {
        if (!payload) return;
        let parsed = null;
        try { parsed = JSON.parse(payload.Json || '{}'); } catch (e) {}
        lastCatalog = parsed || {};
        renderTabs();
        renderPage();
        renderFooter(lastCatalog.Footer);
    }

    function onControlsState(payload) {
        if (!payload) return;
        controlsState = payload;
        renderTabs();
        if (activePageId === CONTROLS_PAGE_ID) renderPage();
    }

    function onValue(payload) {
        if (!payload || !payload.Key) return;
        try { localState[payload.Key] = JSON.parse(payload.ValueJson || 'null'); } catch (e) {}
    }

    function onFooter(payload) { renderFooter(payload); }

    function onApplyToast(payload) {
        const count = document.getElementById('apply-countdown');
        if (count && payload) count.textContent = String(Math.ceil(payload.CountdownSeconds || 0));
        const toast = document.getElementById('apply-toast');
        if (toast) toast.hidden = !payload || (payload.CountdownSeconds || 0) <= 0;
    }

    function goBack() { tsic.publishMessage('UI.Cmd.Settings.Back', {}); }
    function doRevert() { tsic.publishMessage('UI.Cmd.Settings.Revert', {}); }
    function doReset() {
        if (activePageId === CONTROLS_PAGE_ID) {
            tsic.publishMessage('UI.Cmd.Settings.ResetControls', {});
            return;
        }
        tsic.publishMessage('UI.Cmd.Settings.ResetDefaults', { PageId: activePageId || '' });
    }

    function onGlobalKey(e) {
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

    tsic.on('tsic.msg.UI.Settings.Catalog', onCatalog);
    tsic.on('tsic.msg.UI.Settings.ControlsState', onControlsState);
    tsic.on('tsic.msg.UI.Settings.RebindCapture', onRebindCapture);
    tsic.on('tsic.msg.UI.Settings.Value', onValue);
    tsic.on('tsic.msg.UI.Settings.Footer', onFooter);
    tsic.on('tsic.msg.UI.Settings.ApplyToast', onApplyToast);
    window.addEventListener('keydown', onGlobalKey, true);
    const backBtn = document.getElementById('btn-back');     if (backBtn)  backBtn.onclick  = goBack;
    const resetBtn = document.getElementById('btn-reset');   if (resetBtn) resetBtn.onclick = doReset;
    const keepBtn = document.getElementById('btn-keep');     if (keepBtn)  keepBtn.onclick  = () => tsic.publishMessage('UI.Cmd.Settings.Apply', { SettingsJson: '{}' });
    const revertBtn = document.getElementById('btn-revert'); if (revertBtn)revertBtn.onclick= doRevert;
    // Fallback only: if a real catalog was already delivered (sticky replay on
    // subscribe), don't clobber it with the placeholder.
    if (!lastCatalog) onCatalog({ Json: JSON.stringify(STATIC_CATALOG) });
})();
