// Renders a static panel of "fake C++ pressed a button" buttons.
// Calls back into onInject(channel, payload) which the host wires to
// the iframe's mock tsic via handle.inject() semantics.
(function (global) {
    const NS = global.TSICPlaygroundInput = global.TSICPlaygroundInput || {};

    const BUILTIN = [
        { label: 'Up',        action: 'IA_UI_Navigate', value: { X: 0, Y: 1, Z: 0 } },
        { label: 'Down',      action: 'IA_UI_Navigate', value: { X: 0, Y: -1, Z: 0 } },
        { label: 'Left',      action: 'IA_UI_Navigate', value: { X: -1, Y: 0, Z: 0 } },
        { label: 'Right',     action: 'IA_UI_Navigate', value: { X: 1, Y: 0, Z: 0 } },
        { label: 'Confirm',   action: 'IA_UI_ConfirmAccept' },
        { label: 'Cancel',    action: 'IA_UI_Cancel' },
        { label: 'Tab',       action: 'IA_UI_TabNext' },
        { label: 'Inv',       action: 'IA_UI_OpenInventory' },
        { label: 'Pause',     action: 'IA_UI_Pause' },
        { label: 'Map',       action: 'IA_UI_OpenMap' },
        { label: 'Hotbar+',   action: 'IA_UI_AddToHotbar' },
        { label: 'MapZoomIn', action: 'IA_UI_MapZoomIn' },
        { label: 'MapZoomOut',action: 'IA_UI_MapZoomOut' },
        { label: 'MapCenter', action: 'IA_UI_MapCenterOnPlayer' },
        { label: 'MapPlace',  action: 'IA_UI_MapPlacePing' },
        { label: 'TakeAll',   action: 'IA_UI_TakeAll' },
    ];

    function emit(action, value, onInject) {
        const short = action.replace(/^IA_/, '');
        onInject(`tsic.msg.UI.Input.${short}`, {
            Action: action,
            Phase: 'Triggered',
            Value: value || { X: 1, Y: 0, Z: 0 },
            ElapsedSec: 1 / 60,
            TriggeredSec: 0,
        });
    }

    NS.mount = function (root, onInject) {
        root.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'pg-input-grid';
        for (const b of BUILTIN) {
            const btn = document.createElement('button');
            btn.className = 'pg-btn';
            btn.textContent = b.label;
            btn.title = b.action;
            btn.addEventListener('click', () => emit(b.action, b.value, onInject));
            grid.appendChild(btn);
        }
        root.appendChild(grid);

        const customRow = document.createElement('div');
        customRow.className = 'pg-input-custom';
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = 'IA_Custom_Action';
        const send = document.createElement('button');
        send.className = 'pg-btn';
        send.textContent = 'Send';
        send.addEventListener('click', () => {
            const name = (input.value || '').trim();
            if (!name) return;
            emit(name, null, onInject);
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send.click(); });
        customRow.appendChild(input);
        customRow.appendChild(send);
        root.appendChild(customRow);

        const modeRow = document.createElement('div');
        modeRow.className = 'pg-input-custom';
        const modeInput = document.createElement('input');
        modeInput.type = 'text'; modeInput.placeholder = 'Mode (KBM | Gamepad | Touch)'; modeInput.value = 'KBM';
        const modeBtn = document.createElement('button');
        modeBtn.className = 'pg-btn';
        modeBtn.textContent = 'Set Mode';
        modeBtn.addEventListener('click', () => {
            const mode = (modeInput.value || 'KBM').trim();
            onInject('tsic.msg.UI.Input.Mode.Changed', { Mode: mode, Device: mode.toLowerCase() });
        });
        modeRow.appendChild(modeInput);
        modeRow.appendChild(modeBtn);
        root.appendChild(modeRow);
    };
})(window);
