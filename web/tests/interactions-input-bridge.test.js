// Enhanced-Input bridge integration: a page that subscribes to UI.Input.*
// channels should react to forged input events the same way it would react
// to a real C++-side InputAction trigger.

// ---- Map: every IA_UI_Map* action publishes the right command ----------




// ---- ActionBar: device-family swap on UI.Input.Mode.Changed -----------
TSICTestHarness.register({
    name: 'Input/ActionBar: live mode swap re-renders with the new icon family',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{
                BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0,
                KeyboardIconUrl: '/icons/keyboard/e.svg', GamepadIconUrl: '/icons/gamepad/face-bottom.svg',
            }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row img'));
        const kbm = ctx.doc.querySelector('.bb-key img').src;
        ctx.expect(ctx.assert.truthy(/keyboard/.test(kbm)));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 30));
        const pad = ctx.doc.querySelector('.bb-key img').src;
        ctx.expect(ctx.assert.truthy(/gamepad/.test(pad)));
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 30));
        const back = ctx.doc.querySelector('.bb-key img').src;
        ctx.expect(ctx.assert.truthy(/keyboard/.test(back)));
    },
});

// ---- Map: place-ping action only on Started -------------------------

// ---- Mode switch on every overlay page (sanity)  ---------------------
TSICTestHarness.register({
    name: 'Input/Mode: switching to Gamepad while crosshair page is up doesn\'t throw',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 30));
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(true));
    },
});
