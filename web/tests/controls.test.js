// Device binding tabs (Keyboard & Mouse / Controller): rebind + analog prefs.
// Payload field names mirror the C++ structs verbatim — the bridge serializes
// with SkipStandardizeCase, so bools keep their b prefix (bToggleable,
// bCapturing, bGamepad, …).

const CONTROLS_STATE = {
    Entries: [
        // BehaviorsLabel === DisplayName -> the subtext is an echo and must be hidden.
        { HotkeyId: 'HK_Crouch', DisplayName: 'Crouch', BehaviorsLabel: 'Crouch', Category: 'Movement',
          KeyboardKeyText: 'Left Control', GamepadKeyText: 'Gamepad Right Thumbstick',
          bKeyboardRemappable: true, bGamepadRemappable: true,
          bToggleable: true, HoldToggle: 0, ToggleBehaviorTagName: 'Input.Behavior.Crouch',
          KeyboardConflictsWith: '', GamepadConflictsWith: '', KeyboardSharedWith: '', GamepadSharedWith: '' },
        { HotkeyId: 'HK_Interact', DisplayName: 'Interact', BehaviorsLabel: 'Interact, Open Storage', Category: 'Interaction',
          KeyboardKeyText: 'E', GamepadKeyText: 'Gamepad Face Button Bottom',
          bKeyboardRemappable: true, bGamepadRemappable: true,
          bToggleable: false, HoldToggle: 0, ToggleBehaviorTagName: '',
          KeyboardConflictsWith: 'Take All', GamepadConflictsWith: '',
          KeyboardSharedWith: '', GamepadSharedWith: 'Jump' },
        // Keyboard-only action: unbound + locked on gamepad -> hidden from the Controller tab.
        { HotkeyId: 'HK_KbOnly', DisplayName: 'Screenshot', BehaviorsLabel: 'Screenshot', Category: 'Interface',
          KeyboardKeyText: 'F12', GamepadKeyText: '',
          bKeyboardRemappable: true, bGamepadRemappable: false,
          bToggleable: false, HoldToggle: 0, ToggleBehaviorTagName: '',
          KeyboardConflictsWith: '', GamepadConflictsWith: '', KeyboardSharedWith: '', GamepadSharedWith: '' },
    ],
    MouseSensitivity: 1, GamepadSensitivity: 0.5, GamepadDeadzone: 0.15, bInvertMouseY: false, bInvertGamepadY: false,
};

async function openDeviceTab(ctx, title) {
    ctx.inject('tsic.msg.UI.Settings.ControlsState', CONTROLS_STATE);
    await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-tab')).some(b => b.textContent === title));
    Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === title).click();
    await ctx.waitFor(() => ctx.doc.querySelector('.binding-row'));
}

function pressEscape(ctx) {
    ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

TSICTestHarness.register({
    name: 'Controls: Keyboard & Mouse tab renders one keyboard button per action',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.expect(ctx.assert.domCount(ctx.doc, '.binding-row', 3));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.bind-btn[data-gamepad="1"]', 0));
        const crouch = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"]');
        ctx.expect(crouch ? null : 'crouch row missing');
        ctx.expect(crouch && crouch.querySelectorAll('.bind-btn').length === 1
            ? null : 'exactly one bind button per row on a device tab');
        ctx.expect(crouch && crouch.querySelector('.field-toggle') ? null : 'crouch (toggleable) should have a Hold/Toggle pill');
        const interact = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"]');
        ctx.expect(interact && interact.querySelector('.shared-note') ? null : 'interact should list its behaviours');
        // Only the mouse analog prefs live on this tab.
        const sliders = Array.from(ctx.doc.querySelectorAll('#page input[type="range"]'));
        ctx.expect(sliders.length === 1 ? null : `KB&M tab should have 1 slider (mouse sensitivity), got ${sliders.length}`);
    },
});

TSICTestHarness.register({
    name: 'Controls: Controller tab hides gamepad-locked unbound actions',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Controller');
        ctx.expect(ctx.assert.domCount(ctx.doc, '.binding-row', 2));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.bind-btn[data-gamepad="0"]', 0));
        ctx.expect(ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_KbOnly"]')
            ? 'gamepad-locked unbound action must not render on the Controller tab' : null);
        // Hold/Toggle is per-action, so it shows here too.
        const crouch = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"]');
        ctx.expect(crouch && crouch.querySelector('.field-toggle') ? null : 'Hold/Toggle pill should show on the Controller tab too');
        // Gamepad analog prefs: sensitivity + deadzone.
        const sliders = Array.from(ctx.doc.querySelectorAll('#page input[type="range"]'));
        ctx.expect(sliders.length === 2 ? null : `Controller tab should have 2 sliders, got ${sliders.length}`);
    },
});

TSICTestHarness.register({
    name: 'Controls: rebind buttons publish BeginRebind with the tab device',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.clearPublishes();
        ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"] .bind-btn').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.BeginRebind',
            { where: p => p.HotkeyId === 'HK_Interact' && p.bGamepad === false }));
        const modal = ctx.doc.getElementById('rebind-modal');
        ctx.expect(modal && !modal.hidden ? null : 'capture modal should be visible');
        // Capture has no on-screen buttons — cancel is Esc / Start (reserved keys).
        ctx.expect(ctx.doc.querySelectorAll('#rebind-actions button').length === 0
            ? null : 'capture modal must not render buttons');
        pressEscape(ctx);

        await openDeviceTab(ctx, 'Controller');
        ctx.clearPublishes();
        ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"] .bind-btn').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.BeginRebind',
            { where: p => p.HotkeyId === 'HK_Interact' && p.bGamepad === true }));
        ctx.expect(String(ctx.doc.getElementById('rebind-msg').textContent).indexOf('Start') >= 0
            ? null : 'gamepad capture caption should name Start as the cancel button');
        pressEscape(ctx);
    },
});

TSICTestHarness.register({
    name: 'Controls: Esc during capture publishes CancelRebind and closes the modal',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"] .bind-btn').click();
        await ctx.waitFor(() => !ctx.doc.getElementById('rebind-modal').hidden);
        ctx.clearPublishes();
        pressEscape(ctx);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.CancelRebind'));
        ctx.expect(ctx.doc.getElementById('rebind-modal').hidden ? null : 'modal should close on Esc');
        // The Esc was consumed by the rebind — the screen must not also navigate back.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Settings.Back'));
    },
});

TSICTestHarness.register({
    name: 'Controls: conflict capture shows Replace dialog and confirms',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        // Simulate the manager capturing a key that conflicts with another behaviour.
        ctx.inject('tsic.msg.UI.Settings.RebindCapture',
            { bCapturing: false, HotkeyId: 'HK_Interact', CapturedKeyText: 'F', bConflict: true, ConflictHotkeyText: 'Crouch' });
        await ctx.waitFor(() => ctx.doc.getElementById('rebind-replace'));
        ctx.clearPublishes();
        ctx.doc.getElementById('rebind-replace').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ConfirmRebind'));
        ctx.expect(ctx.doc.getElementById('rebind-modal').hidden ? null : 'modal should close after confirm');
    },
});

TSICTestHarness.register({
    name: 'Controls: conflict dialog Cancel publishes CancelRebind',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.inject('tsic.msg.UI.Settings.RebindCapture',
            { bCapturing: false, HotkeyId: 'HK_Interact', CapturedKeyText: 'F', bConflict: true, ConflictHotkeyText: 'Crouch' });
        await ctx.waitFor(() => ctx.doc.getElementById('rebind-replace'));
        ctx.clearPublishes();
        const buttons = Array.from(ctx.doc.querySelectorAll('#rebind-actions button'));
        const cancel = buttons.find(b => b.textContent === 'Cancel');
        ctx.expect(cancel ? null : 'conflict dialog should keep a Cancel button');
        cancel.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.CancelRebind'));
        ctx.expect(ctx.doc.getElementById('rebind-modal').hidden ? null : 'modal should close after cancel');
    },
});

TSICTestHarness.register({
    name: 'Controls: hold/toggle pill publishes Set hold_toggle and updates its mode word',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Controller');
        const row = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"]');
        ctx.expect(row.querySelector('.mode-word') && row.querySelector('.mode-word').textContent === 'Hold'
            ? null : 'mode word should read Hold before toggling');
        ctx.clearPublishes();
        row.querySelector('.field-toggle').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', {
            where: p => {
                if (p.Key !== 'hold_toggle') return false;
                try { const v = JSON.parse(p.ValueJson); return v.behavior === 'Input.Behavior.Crouch' && v.toggle === true; }
                catch (e) { return false; }
            },
        }));
        ctx.expect(row.querySelector('.mode-word').textContent === 'Toggle'
            ? null : 'mode word should read Toggle after toggling');
    },
});

TSICTestHarness.register({
    name: 'Controls: rows group under category headers in canonical order',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        const headers = Array.from(ctx.doc.querySelectorAll('.binding-group h3')).map(h => h.textContent);
        ctx.expect(JSON.stringify(headers) === JSON.stringify(['Movement', 'Interaction', 'Interface'])
            ? null : 'expected Movement, Interaction, Interface — got ' + headers.join(', '));
        const movement = ctx.doc.querySelector('.binding-group');
        ctx.expect(movement.querySelector('.binding-row[data-hotkey-id="HK_Crouch"]')
            ? null : 'Crouch should sit under Movement');
    },
});

TSICTestHarness.register({
    name: 'Controls: echoed behaviour subtext is hidden, informative subtext kept',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        const crouch = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"]');
        ctx.expect(crouch.querySelector('.shared-note') ? '"Crouch Crouch" echo should be hidden' : null);
        const interact = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"]');
        const note = interact.querySelector('.shared-note');
        ctx.expect(note && note.textContent === 'Open Storage'
            ? null : 'Interact should keep only the non-echo part of its behaviours');
    },
});

TSICTestHarness.register({
    name: 'Controls: same-context conflicts render red with named tooltip; cross-context is tooltip-only',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        const kbBtn = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"] .bind-btn');
        ctx.expect(kbBtn.classList.contains('conflict') ? null : 'same-context conflict should mark the cap red');
        ctx.expect(kbBtn.title.indexOf('Take All') >= 0 ? null : 'conflict tooltip should name the other action');

        await openDeviceTab(ctx, 'Controller');
        const gpBtn = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Interact"] .bind-btn');
        ctx.expect(gpBtn.classList.contains('conflict') ? 'cross-context sharing must NOT mark the cap red' : null);
        ctx.expect(gpBtn.title.indexOf('Jump') >= 0 ? null : 'sharing tooltip should name the other action');
    },
});

TSICTestHarness.register({
    name: 'Focus/Controls: tabs reach the list, bind buttons reach the Hold/Toggle pill',
    file: '/screens/settings.html',
    tags: ['focus'],
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.mode('Gamepad');
        const fx = ctx.focus;
        const f = ctx.win.tsic.focus;
        const delay = (ms) => new Promise(r => setTimeout(r, ms));

        // Down from the tab strip lands on the page content (search box), and the
        // next Down enters the binding list — not the footer buttons.
        f.focus(ctx.doc.querySelector('.tsic-tab.is-active'), { trust: true });
        await delay(8);
        fx.pressDir('down'); await delay(16);
        ctx.expect(ctx.doc.activeElement && ctx.doc.activeElement.id === 'binding-search'
            ? null : 'down from tabs should land on the search box');
        fx.pressDir('down'); await delay(16);
        ctx.expect(ctx.doc.activeElement && ctx.doc.activeElement.closest('.binding-row')
            ? null : 'down from search should enter the binding list, not skip to the footer');

        // Bind button <-> Hold/Toggle pill roundtrip on a toggleable row.
        const crouchBind = ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"] .bind-btn');
        f.focus(crouchBind, { trust: true }); await delay(8);
        fx.pressDir('left'); await delay(16);
        const pill = ctx.doc.activeElement;
        ctx.expect(pill && pill.classList.contains('field-toggle')
            ? null : 'left from the bind button should focus the Hold/Toggle pill');
        fx.pressDir('right'); await delay(16);
        ctx.expect(ctx.doc.activeElement === crouchBind
            ? null : 'right from the pill should return to the bind button');

        // Accept on the focused pill toggles the preference.
        f.focus(ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"] .field-toggle'), { trust: true });
        await delay(8);
        ctx.clearPublishes();
        fx.confirm(); await delay(16);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', { where: p => p.Key === 'hold_toggle' }));
    },
});

TSICTestHarness.register({
    name: 'Focus/Controls: bumper tab switch lands on the top setting',
    file: '/screens/settings.html',
    tags: ['focus'],
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.mode('Gamepad');
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        // Cycle to the next tab (Controller) via the bumper behaviour.
        ctx.inject('tsic.msg.UI.Behavior.NextTab', { Phase: 'Started' });
        await delay(30);
        const active = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.classList.contains('is-active'));
        ctx.expect(active && active.textContent === 'Controller' ? null : 'NextTab should activate the Controller tab');
        const focusedRow = ctx.doc.activeElement && ctx.doc.activeElement.closest
            && ctx.doc.activeElement.closest('.binding-row');
        ctx.expect(focusedRow && focusedRow === ctx.doc.querySelector('.binding-row')
            ? null : 'focus should land on the first binding row of the new tab, not the footer');
    },
});

TSICTestHarness.register({
    name: 'Focus/Controls: Hold/Toggle keeps focus across the ControlsState echo',
    file: '/screens/settings.html',
    tags: ['focus'],
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.mode('Gamepad');
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        const f = ctx.win.tsic.focus;
        f.focus(ctx.doc.querySelector('.binding-row[data-hotkey-id="HK_Crouch"] .field-toggle'), { trust: true });
        await delay(8);
        ctx.focus.confirm(); // A press -> click -> publishes Set hold_toggle
        await delay(16);
        // The C++ side echoes a fresh ControlsState (HoldToggle updated), which
        // rebuilds the page — focus must come back to the same pill.
        const echoed = JSON.parse(JSON.stringify(CONTROLS_STATE));
        echoed.Entries.find(e => e.HotkeyId === 'HK_Crouch').HoldToggle = 1;
        ctx.inject('tsic.msg.UI.Settings.ControlsState', echoed);
        await delay(16);
        const a = ctx.doc.activeElement;
        ctx.expect(a && a.classList && a.classList.contains('field-toggle')
            && a.closest('.binding-row').dataset.hotkeyId === 'HK_Crouch'
            ? null : 'focus should return to the Crouch pill after the echo rebuild');
        ctx.expect(a.closest('.mode-cell').querySelector('.mode-word').textContent === 'Toggle'
            ? null : 'echoed HoldToggle should render as Toggle');
    },
});

TSICTestHarness.register({
    name: 'Controls: search filters rows and hides emptied groups',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        const search = ctx.doc.getElementById('binding-search');
        ctx.expect(search ? null : 'search box missing');
        search.value = 'crouch';
        search.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        const visibleRows = Array.from(ctx.doc.querySelectorAll('.binding-row')).filter(r => !r.hidden);
        ctx.expect(visibleRows.length === 1 && visibleRows[0].dataset.hotkeyId === 'HK_Crouch'
            ? null : 'only the Crouch row should remain visible');
        const hiddenGroups = Array.from(ctx.doc.querySelectorAll('.binding-group')).filter(g => g.hidden);
        ctx.expect(hiddenGroups.length === 2 ? null : 'groups with no matches should hide');
        search.value = '';
        search.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(Array.from(ctx.doc.querySelectorAll('.binding-row')).every(r => !r.hidden)
            ? null : 'clearing the search should restore all rows');
    },
});

TSICTestHarness.register({
    name: 'Controls: sensitivity slider publishes UI.Cmd.Settings.Set',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        ctx.clearPublishes();
        const slider = ctx.doc.querySelector('#page input[type="range"]'); // mouse sensitivity
        slider.value = '2';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', { where: p => p.Key === 'mouse_sensitivity' }));
    },
});

TSICTestHarness.register({
    name: 'Controls: reset publishes ResetControls with the tab device',
    file: '/screens/settings.html',
    async run(ctx) {
        await openDeviceTab(ctx, 'Keyboard & Mouse');
        await ctx.waitFor(() => ctx.doc.getElementById('btn-reset-controls'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-reset-controls').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ResetControls',
            { where: p => p.bGamepad === false }));

        await openDeviceTab(ctx, 'Controller');
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-reset-controls').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ResetControls',
            { where: p => p.bGamepad === true }));
    },
});
