// Menu-to-menu switching in the SPA shell: one screen visible at a time, and every
// input-mode tag a screen pushes comes back off when it leaves.
//
// These are the two QA section 21 lines that describe soft-locks rather than looks —
// "opening one menu while another is open behaves (replaces/blocks, never overlaps)"
// and "rapidly opening/closing screens doesn't freeze UI or leave input-locked".
// Both are decided by screen-manager.js's show/hide lifecycle, so they are assertable
// here; what stays manual is whether the C++ side honours the tags it is handed.
//
// The Gauntlet UIInputChurnTest node covers the same churn against a real build with
// the cursor/capture assertion this cannot make — but it is not registered in
// Build/Gauntlet/suite-tiers.json, so it never runs.

/** Every screen registered in the shell that this suite drives, with a screen to fall back to. */
const SWITCH_SCREENS = ['Inventory', 'Crafting', 'Production', 'Storage', 'Map'];

function visibleOverlays(ctx) {
    return Array.from(ctx.doc.querySelectorAll('#screen-overlay-host [data-screen]'))
        .filter(el => el.hidden === false)
        .map(el => el.dataset.screen);
}

/** Net input-mode tags still held, from the publish log. */
function heldModeTags(ctx) {
    const held = new Map();
    for (const p of ctx.handle.publishes()) {
        if (p.channel === 'UI.Cmd.Input.AppendModeTag') held.set(p.payload.Tag, (held.get(p.payload.Tag) || 0) + 1);
        if (p.channel === 'UI.Cmd.Input.RemoveModeTag') held.set(p.payload.Tag, (held.get(p.payload.Tag) || 0) - 1);
    }
    return Array.from(held.entries()).filter(([, n]) => n > 0).map(([tag]) => tag);
}

async function showScreen(ctx, name) {
    ctx.inject('tsic.msg.UI.Screen.Changed', { Name: name });
    if (name === 'InGame') {
        await ctx.waitFor(() => visibleOverlays(ctx).length === 0);
        return;
    }
    await ctx.waitFor(() => visibleOverlays(ctx).includes(name));
}

TSICTestHarness.register({
    name: 'Screens/Switch: a second menu replaces the first rather than stacking on it',
    tags: ['screen'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chrome'));

        await showScreen(ctx, 'Inventory');
        ctx.expect(ctx.assert.eq(visibleOverlays(ctx), ['Inventory'], 'inventory is the only overlay up'));

        await showScreen(ctx, 'Crafting');
        ctx.expect(ctx.assert.eq(visibleOverlays(ctx), ['Crafting'], 'crafting replaced inventory'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('[data-screen="Inventory"]').hidden, true,
            'the outgoing screen is hidden, not merely covered'));

        // Two overlays both accepting clicks is the soft-lock shape: the top one takes
        // the pointer while the one underneath still holds the input mode.
        ctx.expect(ctx.assert.truthy(visibleOverlays(ctx).length === 1, 'never two overlays at once'));

        await showScreen(ctx, 'InGame');
        ctx.expect(ctx.assert.eq(visibleOverlays(ctx), [], 'returning to gameplay leaves no overlay up'));
        ctx.expect(ctx.assert.falsy(ctx.doc.body.classList.contains('tsic-overlay-open'),
            'the overlay-open body class is cleared'));
    },
});

TSICTestHarness.register({
    name: 'Screens/Switch: every screen releases its input-mode tag when it leaves',
    tags: ['screen'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chrome'));
        ctx.clearPublishes();

        await showScreen(ctx, 'Inventory');
        const pushed = ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Input.AppendModeTag');
        ctx.expect(ctx.assert.truthy(pushed.length > 0, 'opening a screen pushes an input-mode tag'));

        await showScreen(ctx, 'InGame');
        ctx.expect(ctx.assert.eq(heldModeTags(ctx), [],
            'closing the screen released every tag it pushed'));
    },
});

TSICTestHarness.register({
    name: 'Screens/Churn: cycling every screen leaves nothing open and no tag held',
    tags: ['screen'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chrome'));
        ctx.clearPublishes();

        // Screen-to-screen, then screen-to-gameplay, twice round — the churn that leaves
        // a menu input mode latched with no menu on screen, and the player unable to move.
        for (let pass = 0; pass < 2; pass++) {
            for (const name of SWITCH_SCREENS) {
                await showScreen(ctx, name);
                ctx.expect(ctx.assert.eq(visibleOverlays(ctx).length, 1, `${name} is the only overlay up`));
            }
            await showScreen(ctx, 'InGame');
        }

        ctx.expect(ctx.assert.eq(visibleOverlays(ctx), [], 'no overlay survived the churn'));
        ctx.expect(ctx.assert.eq(heldModeTags(ctx), [], 'no input-mode tag survived the churn'));
        ctx.expect(ctx.assert.falsy(ctx.doc.body.classList.contains('tsic-overlay-open'),
            'the overlay-open body class is cleared'));
        // The HUD has to come back with gameplay: a churn that leaves it torn down is the
        // same session-ending failure as a latched input mode.
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-chrome'), 'HUD survived the churn'));
    },
});
