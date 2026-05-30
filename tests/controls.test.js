// Controls tab (rebind + analog prefs). Field names match the C++ bridge's
// authored-name serialization (bools drop the leading 'b': InvertMouseY, etc).

const CONTROLS_STATE = {
    Entries: [
        { BehaviorTagName: 'Input.Behavior.Crouch', DisplayName: 'Crouch', SituationTagName: 'Input.Situation.Gameplay',
          HotkeyId: 'HK_Crouch', KeyboardKeyText: 'Left Control', GamepadKeyText: 'Gamepad Right Thumbstick',
          Remappable: true, Toggleable: true, HoldToggle: 0, SharedByCount: 1 },
        { BehaviorTagName: 'Input.Behavior.Interact', DisplayName: 'Interact', SituationTagName: 'Input.Situation.Gameplay',
          HotkeyId: 'HK_Interact', KeyboardKeyText: 'E', GamepadKeyText: 'Gamepad Face Button Bottom',
          Remappable: true, Toggleable: false, HoldToggle: 0, SharedByCount: 2 },
    ],
    MouseSensitivity: 1, GamepadSensitivity: 0.5, GamepadDeadzone: 0.15, InvertMouseY: false, InvertGamepadY: false,
};

async function openControlsTab(ctx) {
    ctx.inject('tsic.msg.UI.Settings.ControlsState', CONTROLS_STATE);
    await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-tab')).some(b => b.textContent === 'Controls'));
    Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Controls').click();
    await ctx.waitFor(() => ctx.doc.querySelector('.binding-row'));
}

TSICTestHarness.register({
    name: 'Controls: renders a Controls tab with binding rows from ControlsState',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        ctx.expect(ctx.assert.domCount(ctx.doc, '.binding-row', 2));
        const crouch = Array.from(ctx.doc.querySelectorAll('.binding-row')).find(r => r.dataset.behavior === 'Input.Behavior.Crouch');
        ctx.expect(crouch ? null : 'crouch row missing');
        ctx.expect(crouch && crouch.querySelector('select.holdtoggle') ? null : 'crouch (toggleable) should have a Hold/Toggle select');
        // The interact row should surface its "shared by 2" hint.
        const interact = Array.from(ctx.doc.querySelectorAll('.binding-row')).find(r => r.dataset.behavior === 'Input.Behavior.Interact');
        ctx.expect(interact && interact.querySelector('.shared-note') ? null : 'interact should show shared-by note');
        // Analog controls present.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#page input[type="range"]'));
    },
});

TSICTestHarness.register({
    name: 'Controls: rebind button publishes BeginRebind with HotkeyId + device',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        ctx.clearPublishes();
        const kbBtn = ctx.doc.querySelector('.binding-row[data-behavior="Input.Behavior.Interact"] .bind-btn[data-gamepad="0"]');
        kbBtn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.BeginRebind',
            { where: p => p.HotkeyId === 'HK_Interact' && p.Gamepad === false }));
        ctx.expect(ctx.doc.getElementById('rebind-modal') && !ctx.doc.getElementById('rebind-modal').hidden
            ? null : 'capture modal should be visible');
    },
});

TSICTestHarness.register({
    name: 'Controls: conflict capture shows Replace dialog and confirms',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        // Simulate the manager capturing a key that conflicts with another behaviour.
        ctx.inject('tsic.msg.UI.Settings.RebindCapture',
            { Capturing: false, HotkeyId: 'HK_Interact', CapturedKeyText: 'F', Conflict: true, ConflictBehavior: 'Input.Behavior.Crouch' });
        await ctx.waitFor(() => ctx.doc.getElementById('rebind-replace'));
        ctx.clearPublishes();
        ctx.doc.getElementById('rebind-replace').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ConfirmRebind'));
        ctx.expect(ctx.doc.getElementById('rebind-modal').hidden ? null : 'modal should close after confirm');
    },
});

TSICTestHarness.register({
    name: 'Controls: cancelling capture publishes CancelRebind',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        const kbBtn = ctx.doc.querySelector('.binding-row[data-behavior="Input.Behavior.Interact"] .bind-btn[data-gamepad="0"]');
        kbBtn.click();
        await ctx.waitFor(() => ctx.doc.querySelector('#rebind-actions button'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#rebind-actions button').click(); // Cancel
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.CancelRebind'));
    },
});

TSICTestHarness.register({
    name: 'Controls: sensitivity slider publishes UI.Cmd.Settings.Set',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        ctx.clearPublishes();
        const slider = ctx.doc.querySelector('#page input[type="range"]'); // first = mouse sensitivity
        slider.value = '2';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', { where: p => p.Key === 'mouse_sensitivity' }));
    },
});

TSICTestHarness.register({
    name: 'Controls: hold/toggle dropdown publishes Set hold_toggle',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        ctx.clearPublishes();
        const sel = ctx.doc.querySelector('.binding-row[data-behavior="Input.Behavior.Crouch"] select.holdtoggle');
        sel.value = 'toggle';
        sel.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', {
            where: p => {
                if (p.Key !== 'hold_toggle') return false;
                try { const v = JSON.parse(p.ValueJson); return v.behavior === 'Input.Behavior.Crouch' && v.toggle === true; }
                catch (e) { return false; }
            },
        }));
    },
});

TSICTestHarness.register({
    name: 'Controls: reset bindings publishes UI.Cmd.Settings.ResetControls',
    file: '/screens/settings.html',
    async run(ctx) {
        await openControlsTab(ctx);
        await ctx.waitFor(() => ctx.doc.getElementById('btn-reset-controls'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-reset-controls').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ResetControls'));
    },
});
