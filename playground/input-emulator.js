// Renders the playground's Enhanced-Input emulator panel.
// Calls back into onInject(channel, payload) which the host wires to
// the iframe's mock tsic via handle.inject() semantics.
(function (global) {
    const NS = global.TSICPlaygroundInput = global.TSICPlaygroundInput || {};

    // Quick-fire buttons for the most-common actions. The full action list
    // lives in the dropdown below so this row stays scannable.
    const QUICK = [
        { label: 'Up',        action: 'IA_UI_Navigate', value: { X: 0, Y: 1, Z: 0 } },
        { label: 'Down',      action: 'IA_UI_Navigate', value: { X: 0, Y: -1, Z: 0 } },
        { label: 'Left',      action: 'IA_UI_Navigate', value: { X: -1, Y: 0, Z: 0 } },
        { label: 'Right',     action: 'IA_UI_Navigate', value: { X: 1, Y: 0, Z: 0 } },
        { label: 'Confirm',   action: 'IA_UI_ConfirmAccept' },
        { label: 'Cancel',    action: 'IA_UI_CancelBack' },
        { label: 'Tab',       action: 'IA_UI_TabNext' },
        { label: 'Inv',       action: 'IA_UI_OpenInventory' },
        { label: 'Pause',     action: 'IA_UI_Pause' },
    ];

    // Every IA_* action a screen subscribes to (or that we plausibly want to
    // simulate). Grouped for the dropdown UI.
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

    const PHASES = ['Triggered', 'Started', 'Completed', 'Ongoing', 'Canceled'];
    const MODES  = [
        { value: 'MouseAndKeyboard', label: 'Mouse & Keyboard', device: 'kbm' },
        { value: 'Gamepad',          label: 'Gamepad',          device: 'gamepad' },
        { value: 'Touch',            label: 'Touch',            device: 'touch' },
    ];

    function emit(action, phase, value, onInject) {
        const short = action.replace(/^IA_/, '');
        onInject(`tsic.msg.UI.Input.${short}`, {
            Action: action,
            Phase: phase || 'Triggered',
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

    NS.mount = function (root, onInject) {
        root.innerHTML = '';

        // ---- Quick-fire buttons ----
        const grid = document.createElement('div');
        grid.className = 'pg-input-grid';
        for (const b of QUICK) {
            const btn = document.createElement('button');
            btn.className = 'pg-btn';
            btn.textContent = b.label;
            btn.title = b.action;
            btn.addEventListener('click', () => emit(b.action, 'Triggered', b.value, onInject));
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
            phaseSel.appendChild(opt);
        }
        const sendBtn = document.createElement('button');
        sendBtn.className = 'pg-btn';
        sendBtn.textContent = 'Send';
        sendBtn.addEventListener('click', () => {
            emit(actionSel.value, phaseSel.value, null, onInject);
        });
        actionRow.appendChild(actionSel);
        actionRow.appendChild(phaseSel);
        actionRow.appendChild(sendBtn);
        root.appendChild(actionRow);

        // ---- Mode dropdown ----
        const modeRow = document.createElement('div');
        modeRow.className = 'pg-input-custom';
        const modeLabel = document.createElement('span');
        modeLabel.className = 'pg-input-label';
        modeLabel.textContent = 'Mode:';
        const modeSel = document.createElement('select');
        for (const m of MODES) {
            const opt = document.createElement('option');
            opt.value = m.value; opt.textContent = m.label; opt.dataset.device = m.device;
            modeSel.appendChild(opt);
        }
        modeSel.addEventListener('change', () => {
            const m = MODES.find(x => x.value === modeSel.value);
            onInject('tsic.msg.UI.Input.Mode.Changed', {
                Mode: m.value, Device: m.device, Focus: 'game',
            });
        });
        modeRow.appendChild(modeLabel);
        modeRow.appendChild(modeSel);
        root.appendChild(modeRow);

        // ---- Focus dropdown (subtle but useful for crosshair.html etc.) ----
        const focusRow = document.createElement('div');
        focusRow.className = 'pg-input-custom';
        const focusLabel = document.createElement('span');
        focusLabel.className = 'pg-input-label';
        focusLabel.textContent = 'Focus:';
        const focusSel = document.createElement('select');
        for (const f of ['game', 'ui']) {
            const opt = document.createElement('option');
            opt.value = f; opt.textContent = f;
            focusSel.appendChild(opt);
        }
        focusSel.addEventListener('change', () => {
            const m = MODES.find(x => x.value === modeSel.value);
            onInject('tsic.msg.UI.Input.Mode.Changed', {
                Mode: m.value, Device: m.device, Focus: focusSel.value,
            });
        });
        focusRow.appendChild(focusLabel);
        focusRow.appendChild(focusSel);
        root.appendChild(focusRow);
    };
})(window);
