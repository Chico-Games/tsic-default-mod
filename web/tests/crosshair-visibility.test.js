// Crosshair hide-in-menus (shared/hud-crosshair.js), hosted by the thin fixture
// test-crosshair.html.
//
// The regression these guard: the component keyed off UI.Input.Mode.Changed and
// read `p.Device === 'mouse' && p.Focus === 'ui'`. FScpUIInputMode carries ONE
// field, `Mode` — Device and Focus never existed, so the condition was always
// false and the crosshair stayed lit over the map, the inventory and every other
// screen. The bridge does not complain about a field that isn't there, and no
// test covered the behaviour, so it was invisible until HudReadoutsTest asserted
// it against the live CEF DOM.
//
// The rule now matches cursor.js's GAMEPLAY_SCREENS suppression, because the two
// are complementary: whatever hides the crosshair must show the cursor.

const CROSSHAIR_PARTS = ['hud-crosshair', 'hud-crosshair-hand', 'hud-crosshair-cat',
    'hud-crosshair-progress', 'hud-crosshair-bloom'];

TSICTestHarness.register({
    name: 'Crosshair: hidden while a menu screen is current, back on return to InGame',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const dot = ctx.doc.getElementById('hud-crosshair');

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !dot.classList.contains('hidden'));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => dot.classList.contains('hidden'));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !dot.classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(!dot.classList.contains('hidden'),
            'crosshair must come back once the screen closes'));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: every crosshair part hides together, not just the dot',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !ctx.doc.getElementById('hud-crosshair').classList.contains('hidden'));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Inventory' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-crosshair').classList.contains('hidden'));

        // The collar and bloom are crosshair furniture — leaving either behind
        // floats a ring over an open menu.
        for (const id of CROSSHAIR_PARTS) {
            const el = ctx.doc.getElementById(id);
            if (!el) continue;
            ctx.expect(ctx.assert.truthy(el.classList.contains('hidden'),
                `#${id} must hide with the crosshair`));
        }
    },
});

TSICTestHarness.register({
    name: 'Crosshair: an overlay hides it even while InGame is still the screen',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const dot = ctx.doc.getElementById('hud-crosshair');
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        ctx.inject('tsic.msg.UI.Overlay.Changed', { Stack: [] });
        await ctx.waitFor(() => !dot.classList.contains('hidden'));

        // Chat, the bug reporter and the pause overlay all push here without
        // changing the screen, and each of them takes the mouse.
        ctx.inject('tsic.msg.UI.Overlay.Changed', { Stack: ['ChatInput'] });
        await ctx.waitFor(() => dot.classList.contains('hidden'));

        ctx.inject('tsic.msg.UI.Overlay.Changed', { Stack: [] });
        await ctx.waitFor(() => !dot.classList.contains('hidden'));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: UI.Input.Mode.Changed alone never hides it (device is not focus)',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const dot = ctx.doc.getElementById('hud-crosshair');
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !dot.classList.contains('hidden'));

        // The real payload shape — one field. Switching input device while
        // playing must not blank the crosshair.
        ctx.inject('tsic.msg.UI.Input.Mode.Changed', { Mode: 'MouseAndKeyboard' });
        ctx.inject('tsic.msg.UI.Input.Mode.Changed', { Mode: 'Gamepad' });
        ctx.expect(ctx.assert.truthy(!dot.classList.contains('hidden'),
            'input device changes must not hide the crosshair during gameplay'));
    },
});
