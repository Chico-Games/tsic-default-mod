// Cheat-menu map teleport picker.
//
// Hosted on /screens/in-game.html, NOT /screens/map.html: the latter is a dead
// duplicate carrying its own inline map implementation and never loads
// screen-manager or shared/screens/map.js, so a test pointed at it would exercise
// code the game does not run.
//
// The map opened as {"mode":"teleport"} reveals
// fog for the VIEW only, shows every POI, and turns a click into a
// TeleportToTileLayer for the tile under the cursor on the selected layer.

// 5x5 world, 500uu tiles. Layer mask: bit0 = sky, bit1 = underground.
// Tile (E2,N2) is index 2*5+2 = 12 — give that one both layers, and leave the
// rest with neither so a refusal is testable.
const WORLD = { MinBounds: { X: 0, Y: 0 }, MaxBounds: { X: 2500, Y: 2500 } };
const TILE_GRID = Object.assign({
    WorldSize: 5,
    TileSizeUnits: 500,
    BiomePalette: ['ShopFloor'],
    BiomeColors: ['#88ccff'],
    BiomeRLE: [{ Value: 0, Count: 25 }],
    HeightRLE: [{ Value: 3, Count: 25 }],
    SkyHeightRLE: [{ Value: 0, Count: 12 }, { Value: 2, Count: 1 }, { Value: 0, Count: 12 }],
    UndergroundHeightRLE: [{ Value: 0, Count: 12 }, { Value: 1, Count: 1 }, { Value: 0, Count: 12 }],
    LayerMaskRLE: [{ Value: 0, Count: 12 }, { Value: 3, Count: 1 }, { Value: 0, Count: 12 }],
}, WORLD);

async function openPicker(ctx) {
    ctx.inject('tsic.msg.UI.Map.TileGrid', TILE_GRID);
    ctx.inject('tsic.msg.UI.Map.Snapshot', Object.assign({ Players: [], Icons: [] }, WORLD));
    ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map', ParamsJson: JSON.stringify({ mode: 'teleport', player: 1 }) });
    await ctx.waitFor(() => {
        const bar = ctx.doc.querySelector('#tp-bar');
        return bar && bar.style.display === 'flex';
    });
    // The click handler ignores presses outside the viewport rect, so the
    // overlay has to have been laid out before a click means anything.
    await ctx.waitFor(() => {
        const vp = ctx.doc.querySelector('#map-viewport');
        const r = vp && vp.getBoundingClientRect();
        return r && r.width > 10 && r.height > 10;
    });
}

// Click the centre of tile (E,N) by converting tile -> world -> local -> client.
//
// The pan/zoom fit runs against a container the harness gives no size, so the
// map's own scale can land on NaN. That is a harness artefact, not the code under
// test, so pin a known 1:1 transform first — the assertion is about which tile a
// click resolves to, not about the fit.
function clickTile(ctx, east, north) {
    const vp = ctx.doc.querySelector('#map-viewport');
    const M = ctx.win.__tsicMap;
    const rect = vp.getBoundingClientRect();
    const wx = (north + 0.5) * 500;
    const wy = (east + 0.5) * 500;
    const loc = M.worldToLocal(wx, wy);
    // Pan so the target tile sits under the viewport centre, then click there.
    // Clicking wherever the tile happens to land would put most of a 2500uu world
    // outside the viewport, and the handler correctly ignores out-of-bounds presses.
    M.state.scale = 1;
    M.state.panX = rect.width / 2 - loc.x;
    M.state.panY = rect.height / 2 - loc.y;
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const W = ctx.win;
    vp.dispatchEvent(new W.MouseEvent('mousedown', { button: 0, clientX, clientY, bubbles: true }));
    W.dispatchEvent(new W.MouseEvent('mouseup', { button: 0, clientX, clientY, bubbles: true }));
}

TSICTestHarness.register({
    name: 'MapTeleport: teleport mode reveals fog for the view only',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Fog is in play and unpainted — normally the veil covers everything.
        ctx.inject('tsic.msg.UI.Map.Fow', {});
        await openPicker(ctx);
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowVeiled, false,
            'the veil must lift in teleport mode so tiles are pickable'));
        // Revealing is render-side: no HideFOW / server fog command is sent.
        const fogCmds = ctx.handle.publishes().filter(p =>
            p.channel === 'UI.Cmd.Cheat.Execute' && /HideFOW|ResetFOW/i.test((p.payload && p.payload.Command) || ''));
        ctx.expect(ctx.assert.eq(fogCmds.length, 0, 'must not touch the real fog grid'));
    },
});

TSICTestHarness.register({
    name: 'MapTeleport: clicking a tile teleports to that tile on the chosen layer',
    file: '/screens/in-game.html',
    async run(ctx) {
        await openPicker(ctx);
        ctx.clearPublishes();
        // Asymmetric tile on purpose: E2/N2 would pass even if east and north were
        // swapped, and the signature is (player, EAST, NORTH, layer).
        clickTile(ctx, 1, 3);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'TeleportToTileLayer 1 1 3 Floor' }));

        // Switch layer; the same click must now name that layer.
        ctx.doc.querySelector('#tp-bar .tp-layer[data-layer="Sky"]').click();
        ctx.clearPublishes();
        clickTile(ctx, 2, 2);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'TeleportToTileLayer 1 2 2 Sky' }));
    },
});

TSICTestHarness.register({
    name: 'MapTeleport: a tile without the chosen layer refuses instead of teleporting',
    file: '/screens/in-game.html',
    async run(ctx) {
        await openPicker(ctx);
        ctx.doc.querySelector('#tp-bar .tp-layer[data-layer="Underground"]').click();
        ctx.clearPublishes();
        // (E0,N0) has mask 0 — no sky, no underground.
        clickTile(ctx, 0, 0);
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(
            ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Cheat.Execute').length, 0,
            'no command for a layer that is not there'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#tp-note', /no underground/i));
    },
});

TSICTestHarness.register({
    name: 'MapTeleport: a pan is not a teleport click',
    file: '/screens/in-game.html',
    async run(ctx) {
        await openPicker(ctx);
        const vp = ctx.doc.querySelector('#map-viewport');
        const rect = vp.getBoundingClientRect();
        const W = ctx.win;
        ctx.clearPublishes();
        const x = rect.left + 120, y = rect.top + 120;
        vp.dispatchEvent(new W.MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true }));
        W.dispatchEvent(new W.MouseEvent('mousemove', { clientX: x + 60, clientY: y + 40, bubbles: true }));
        W.dispatchEvent(new W.MouseEvent('mouseup', { button: 0, clientX: x + 60, clientY: y + 40, bubbles: true }));
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(
            ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Cheat.Execute').length, 0,
            'dragging the map must not fire a teleport'));
    },
});

TSICTestHarness.register({
    name: 'MapTeleport: opening the map normally afterwards is not in picker mode',
    file: '/screens/in-game.html',
    async run(ctx) {
        await openPicker(ctx);
        // Leave and re-open the way the map hotkey does — no params.
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => {
            const bar = ctx.doc.querySelector('#tp-bar');
            return bar && bar.style.display === 'none';
        });
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('#map-viewport').classList.contains('is-teleport'), false));
    },
});
