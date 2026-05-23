(function () {
    function whenReady(cb) { if (window.tsic) { cb(); return; } setTimeout(() => whenReady(cb), 16); }

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
                { Id: 'Controls', Title: 'Controls', Settings: [
                    { Key: 'gameplay.fov',     Label: 'Field of view',  Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                    { Key: 'gameplay.inv_key', Label: 'Inventory key',  Type: 'keybind',
                      Bindings: [{ Slot: 0, Display: 'Tab', Key: 'Tab' }] },
                ] },
            ] },
        ],
        Footer: { AnyDirty: false, RestartRequired: false, ApplyCountdownSeconds: -1 },
    };

    let activePageId = null;
    let lastCatalog = null;
    let pendingRebind = null;
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

    function publishRebind(actionId, keyName) {
        tsic.publishMessage('UI.Cmd.Settings.RebindKey', { ActionId: actionId, Key: keyName });
    }

    function publishAction(key) {
        tsic.publishMessage('UI.Cmd.Settings.Action', { Key: key });
    }

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
        } else if (type === 'keybind') {
            const slot0 = (s.Bindings && s.Bindings[0]) || { Display: String(v || '<unbound>') };
            const btn = document.createElement('button');
            btn.className = 'field-rebind';
            btn.type = 'button';
            btn.textContent = slot0.Display || '<unbound>';
            btn.disabled = isDisabled;
            btn.onclick = () => {
                if (pendingRebind && pendingRebind.btn) pendingRebind.btn.classList.remove('waiting');
                pendingRebind = { actionId: s.Key, btn };
                btn.classList.add('waiting');
                btn.textContent = 'press a key…';
            };
            ctl.appendChild(btn);
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

    function renderTabs(catalog) {
        const host = document.getElementById('tabs');
        if (!host) return;
        host.innerHTML = '';
        const pages = (catalog && catalog.Pages) || [];
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
            btn.onclick = () => { activePageId = p.Id; renderTabs(lastCatalog); renderPage(); };
            host.appendChild(btn);
        }
    }

    function renderPage() {
        const host = document.getElementById('page');
        if (!host) return;
        host.innerHTML = '';
        const page = lastCatalog && (lastCatalog.Pages || []).find(p => p.Id === activePageId);
        if (!page) {
            host.textContent = '(no settings yet)';
            return;
        }
        for (const g of (page.Groups || [])) {
            const sec = document.createElement('div');
            sec.className = 'group';
            const h = document.createElement('h3');
            h.textContent = g.Title || g.Id || '';
            sec.appendChild(h);
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
        renderTabs(lastCatalog);
        renderPage();
        renderFooter(lastCatalog.Footer);
    }

    function onValue(payload) {
        if (!payload || !payload.Key) return;
        try { localState[payload.Key] = JSON.parse(payload.ValueJson || 'null'); } catch (e) {}
    }

    function onFooter(payload) {
        renderFooter(payload);
    }

    function onApplyToast(payload) {
        const count = document.getElementById('apply-countdown');
        if (count && payload) count.textContent = String(Math.ceil(payload.CountdownSeconds || 0));
        const toast = document.getElementById('apply-toast');
        if (toast) toast.hidden = !payload || (payload.CountdownSeconds || 0) <= 0;
    }

    function goBack() { tsic.publishMessage('UI.Cmd.Settings.Back', {}); }
    function doRevert() { tsic.publishMessage('UI.Cmd.Settings.Revert', {}); }
    function doReset() {
        tsic.publishMessage('UI.Cmd.Settings.ResetDefaults', { PageId: activePageId || '' });
    }

    function onGlobalKey(e) {
        if (pendingRebind) {
            e.preventDefault(); e.stopPropagation();
            const btn = pendingRebind.btn;
            if (e.key !== 'Escape') {
                publishRebind(pendingRebind.actionId, e.key);
                btn.textContent = e.key;
            } else {
                btn.textContent = '<cancelled>';
            }
            btn.classList.remove('waiting');
            pendingRebind = null;
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            goBack();
        }
    }

    whenReady(() => {
        tsic.on('tsic.msg.UI.Settings.Catalog', onCatalog);
        tsic.on('tsic.msg.UI.Settings.Value', onValue);
        tsic.on('tsic.msg.UI.Settings.Footer', onFooter);
        tsic.on('tsic.msg.UI.Settings.ApplyToast', onApplyToast);
        window.addEventListener('keydown', onGlobalKey, true);
        const backBtn = document.getElementById('btn-back');     if (backBtn)  backBtn.onclick  = goBack;
        const resetBtn = document.getElementById('btn-reset');   if (resetBtn) resetBtn.onclick = doReset;
        const keepBtn = document.getElementById('btn-keep');     if (keepBtn)  keepBtn.onclick  = () => tsic.publishMessage('UI.Cmd.Settings.Apply', { SettingsJson: '{}' });
        const revertBtn = document.getElementById('btn-revert'); if (revertBtn)revertBtn.onclick= doRevert;
        onCatalog({ Json: JSON.stringify(STATIC_CATALOG) });
    });
})();
