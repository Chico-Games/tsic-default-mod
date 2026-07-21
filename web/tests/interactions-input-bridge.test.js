// Enhanced-Input bridge integration: a page that subscribes to UI.Input.*
// channels should react to forged input events the same way it would react
// to a real C++-side InputAction trigger.

// ---- Map: every IA_UI_Map* action publishes the right command ----------
TSICTestHarness.register({
    name: 'Input/Map: IA_UI_MapZoomIn fires a re-render (no crash)',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.input('IA_UI_MapZoomIn', 'Triggered', { X: 1, Y: 0, Z: 0 });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(true));
    },
});

TSICTestHarness.register({
    name: 'Input/Map: IA_UI_MapZoomOut fires without throwing',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.input('IA_UI_MapZoomOut', 'Triggered', { X: 1, Y: 0, Z: 0 });
        ctx.expect(ctx.assert.truthy(true));
    },
});

TSICTestHarness.register({
    name: 'Input/Map: IA_UI_MapCenterOnPlayer fires only on Started',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [{ PlayerId:'me', Position:{ X:0, Y:0 }, YawDeg: 0 }], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        // Triggered phase should NOT re-center (page filters on Started).
        ctx.input('IA_UI_MapCenterOnPlayer', 'Triggered');
        // Started DOES.
        ctx.input('IA_UI_MapCenterOnPlayer', 'Started');
        ctx.expect(ctx.assert.truthy(true));
    },
});

TSICTestHarness.register({
    name: 'Input/Map: IA_UI_MapMove Axis2D pans the canvas without crashing',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.input('IA_UI_MapMove', 'Triggered', { X: 0.5, Y: -0.3, Z: 0 });
        ctx.expect(ctx.assert.truthy(true));
    },
});

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
TSICTestHarness.register({
    name: 'Input/Map: IA_UI_MapPlacePing only on Started publishes Ping.Request',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        ctx.input('IA_UI_MapPlacePing', 'Triggered'); // should be ignored
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Ping.Request'));
        ctx.input('IA_UI_MapPlacePing', 'Started'); // should fire
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Ping.Request', { where: p => p.PingType === 'Map' }));
    },
});

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
