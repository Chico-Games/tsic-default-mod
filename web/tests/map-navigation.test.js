// Full-map navigation: pan, cursor-anchored zoom, and centre-on-player.
//
// The Gauntlet MapAndGamepadUITest node drives gamepad zoom and the reset-view fit,
// and explicitly carries the mouse gestures as "no mouse-sim seam" — so drag-pan,
// wheel-anchored zoom and centre-on-player (the gamepad MapCenter behaviour it never
// presses) had nothing asserting them anywhere. They are the three verbs the QA
// section 8 line names, and all three are pure closure state readable through the
// __tsicMap seam, so they belong here rather than in a manual pass.
//
// These run against the real shell (/screens/in-game.html): the map renderer lives in
// shared/screens/map.js and screens/map.html is a dead duplicate.

/** Open the map on a known world with a player at a known position. */
async function openMapWithSnapshot(ctx, playerPos) {
    ctx.inject('tsic.msg.UI.Map.Snapshot', {
        Players: [{ PlayerId: 'P1', Name: 'Me', Position: playerPos, YawDeg: 0 }],
        Icons: [],
        MinBounds: { X: -2000, Y: -2000 }, MaxBounds: { X: 2000, Y: 2000 },
    });
    ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
    await ctx.waitFor(() => ctx.win.__tsicMap && ctx.doc.querySelector('[data-screen="Map"] #map-viewport'));
    // A snapshot that lands during mount() fits against a still-hidden container, so the
    // scale is 0 until onShow's deferred resize refits it. Every verb below divides by
    // scale, so wait for the refit rather than measuring the pre-layout state.
    await ctx.waitFor(() => ctx.win.__tsicMap.state.scale > 0);
    // Fail the fog gate open so the veil is not covering what we drive.
    ctx.win.__tsicMap.disableFogGate();
    return ctx.doc.querySelector('[data-screen="Map"] #map-viewport');
}

function mouse(ctx, target, type, clientX, clientY, extra) {
    const init = Object.assign({ bubbles: true, cancelable: true, clientX, clientY, button: 0 }, extra || {});
    target.dispatchEvent(new ctx.win.MouseEvent(type, init));
}

TSICTestHarness.register({
    name: 'Map/Nav: dragging the viewport pans by the cursor delta',
    tags: ['map'],
    file: '/screens/in-game.html',
    async run(ctx) {
        const vp = await openMapWithSnapshot(ctx, { X: 0, Y: 0 });
        const rect = vp.getBoundingClientRect();
        const state = ctx.win.__tsicMap.state;
        const startX = state.panX;
        const startY = state.panY;

        // mousedown on the viewport, moves and release at the window — the same
        // split the live handlers use, so a pan keeps tracking off-viewport.
        mouse(ctx, vp, 'mousedown', rect.left + 60, rect.top + 60);
        mouse(ctx, ctx.win, 'mousemove', rect.left + 97, rect.top + 83);
        mouse(ctx, ctx.win, 'mouseup', rect.left + 97, rect.top + 83);

        ctx.expect(ctx.assert.eq(Math.round(state.panX - startX), 37, 'panned by the horizontal cursor delta'));
        ctx.expect(ctx.assert.eq(Math.round(state.panY - startY), 23, 'panned by the vertical cursor delta'));

        // A drag must not leave the viewport stuck in the dragging state, which would
        // make every later mouse move pan the map.
        ctx.expect(ctx.assert.falsy(vp.classList.contains('dragging'), 'drag state released on mouseup'));
        const afterX = state.panX;
        mouse(ctx, ctx.win, 'mousemove', rect.left + 300, rect.top + 300);
        ctx.expect(ctx.assert.eq(state.panX, afterX, 'a move after release does not pan'));
    },
});

TSICTestHarness.register({
    name: 'Map/Nav: wheel zoom keeps the point under the cursor fixed',
    tags: ['map'],
    file: '/screens/in-game.html',
    async run(ctx) {
        const vp = await openMapWithSnapshot(ctx, { X: 0, Y: 0 });
        const rect = vp.getBoundingClientRect();
        const state = ctx.win.__tsicMap.state;

        // A point well off centre: a zoom that anchors at the viewport centre instead
        // of the cursor moves it, which is the regression this pins.
        const cursorX = 120;
        const cursorY = 90;
        const localBefore = {
            x: (cursorX - state.panX) / state.scale,
            y: (cursorY - state.panY) / state.scale,
        };
        const scaleBefore = state.scale;

        vp.dispatchEvent(new ctx.win.WheelEvent('wheel', {
            bubbles: true, cancelable: true, deltaY: -120,
            clientX: rect.left + cursorX, clientY: rect.top + cursorY,
        }));

        ctx.expect(ctx.assert.truthy(state.scale > scaleBefore, 'wheel up zoomed in'));
        const localAfter = {
            x: (cursorX - state.panX) / state.scale,
            y: (cursorY - state.panY) / state.scale,
        };
        ctx.expect(ctx.assert.truthy(Math.abs(localAfter.x - localBefore.x) < 0.5,
            `point under the cursor held its X (${localBefore.x} -> ${localAfter.x})`));
        ctx.expect(ctx.assert.truthy(Math.abs(localAfter.y - localBefore.y) < 0.5,
            `point under the cursor held its Y (${localBefore.y} -> ${localAfter.y})`));
    },
});

TSICTestHarness.register({
    name: 'Map/Nav: MapCenter puts the local player under the viewport centre',
    tags: ['map'],
    file: '/screens/in-game.html',
    async run(ctx) {
        const playerPos = { X: 1200, Y: -600 };
        const vp = await openMapWithSnapshot(ctx, playerPos);
        const state = ctx.win.__tsicMap.state;

        // Pan somewhere the player is nowhere near, so centring has work to do.
        state.panX -= 900;
        state.panY += 700;

        ctx.inject('tsic.msg.UI.Behavior.MapCenter', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));

        const loc = ctx.win.__tsicMap.worldToLocal(playerPos.X, playerPos.Y);
        const rect = vp.getBoundingClientRect();
        const screenX = state.panX + loc.x * state.scale;
        const screenY = state.panY + loc.y * state.scale;

        ctx.expect(ctx.assert.truthy(Math.abs(screenX - rect.width / 2) < 2,
            `player sits at the viewport centre horizontally (${screenX} vs ${rect.width / 2})`));
        ctx.expect(ctx.assert.truthy(Math.abs(screenY - rect.height / 2) < 2,
            `player sits at the viewport centre vertically (${screenY} vs ${rect.height / 2})`));
    },
});
