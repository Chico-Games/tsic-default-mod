// Regression guard for the fog-of-war reveal race on the map screen (2026-07-27).
//
// The bug: #world-tex and the fog layer are two independent fetches with no
// ordering guarantee, and the basemap reliably wins — its src is declared in the
// template (issued as soon as the overlay HTML is inserted) while the fog request
// waits for the sticky UI.Map.Fow handler at the end of mount(), and the 'fow'
// runtime source doesn't even exist until the first FOW texture is generated.
// Opening the map therefore showed a fully-revealed world for a beat, exposing
// ground the player had never explored. The map now veils every layer
// (#fow-veil) until real fog pixels are painted into the #fow-tex canvas.
//
// These run against the real shell (/screens/in-game.html) because the fog gate
// lives in shared/screens/map.js; screens/map.html is a dead duplicate.
//
// The runtime image source does not exist under the harness, so fog pixels never
// arrive — which is exactly the window under test. Assertions read the gate
// state through window.__tsicMap rather than racing the retry ladder.

TSICTestHarness.register({
    name: 'Map/Fog: basemap stays veiled while fog is in play but unpainted',
    file: '/screens/in-game.html',
    async run(ctx) {
        // A fog broadcast proves fog is in play for this session. Injected before
        // the screen opens so the sticky replay reaches mount(), which is how it
        // behaves in game (both fog channels are cached bridge channels).
        ctx.inject('tsic.msg.UI.Map.Fow', {});
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [{ PlayerId: 'P1', Name: 'Me', Position: { X: 0, Y: 0 }, YawDeg: 0 }],
            Icons: [{ IconId: 'i1', Category: 'spawn', Position: { X: 0, Y: 0 }, Label: 'Spawn' }],
            MinBounds: { X: -1000, Y: -1000 }, MaxBounds: { X: 1000, Y: 1000 },
        });

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="Map"] #fow-veil'));
        await ctx.waitFor(() => ctx.win.__tsicMap);

        // The gate must be closed *because fog is expected*, not because of the
        // unknown-status grace window — otherwise this would pass even if the
        // sticky broadcast never reached the screen.
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowExpected, true,
            'the sticky fog broadcast reached the map screen'));
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowPainted, false,
            'no fog pixels available under the harness'));
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowVeiled, true,
            'gate is closed while fog is expected but unpainted'));

        const veil = ctx.doc.querySelector('[data-screen="Map"] #fow-veil');
        ctx.expect(ctx.assert.truthy(veil.style.display !== 'none',
            'veil element actually covers the map'));

        // The fog layer must be a canvas, not an <img>: assigning a new .src to a
        // live <img> clears its pixels for the whole fetch, which flashed the
        // unexplored world on every fog regen.
        const fowLayer = ctx.doc.querySelector('[data-screen="Map"] #fow-tex');
        ctx.expect(ctx.assert.eq((fowLayer && fowLayer.tagName || '').toLowerCase(), 'canvas',
            'fog layer is a canvas so refreshes never blank it'));

        // And the basemap must not paint at natural resolution before bounds
        // sizing lands — that crop fell outside the world-sized veil.
        const world = ctx.doc.querySelector('[data-screen="Map"] #world-tex');
        ctx.expect(ctx.assert.truthy(world && world.style.width,
            'basemap is explicitly sized from world bounds'));
    },
});

TSICTestHarness.register({
    name: 'Map/Fog: hover chip is suppressed while the fog veil is up',
    file: '/screens/in-game.html',
    async run(ctx) {
        // #hover-chip lives outside #map-content, so it draws OVER the veil: it
        // would label tiles and POIs the veil is hiding. The per-cell fowGrid
        // gate can't cover this — it fails open until the grid arrives, which is
        // the window the veil exists for.
        //
        // Tile coords come straight from world coords (tileAt does not subtract
        // MinBounds), so the world sits in the positive quadrant and WorldSize
        // covers it with a tile to spare — otherwise describeTile returns null
        // for every hover and this test would pass without proving anything.
        // The positive control at the end is what makes that failure loud.
        const WORLD = { MinBounds: { X: 0, Y: 0 }, MaxBounds: { X: 2000, Y: 2000 } };
        ctx.inject('tsic.msg.UI.Map.Fow', {});
        ctx.inject('tsic.msg.UI.Map.TileGrid', Object.assign({
            WorldSize: 5,
            TileSizeUnits: 500,
            BiomePalette: ['SecretFreezer'],
            BiomeColors: ['#88ccff'],
            BiomeRLE: [{ Value: 0, Count: 25 }],
            HeightRLE: [{ Value: 0, Count: 25 }],
        }, WORLD));
        // No players: fitToBounds would centre on the local player, and the
        // centre-hover would then describe the player instead of the POI. With an
        // empty roster the view centres on the map, where the landmark sits.
        ctx.inject('tsic.msg.UI.Map.Snapshot', Object.assign({
            Players: [],
            Icons: [{ IconId: 'i1', Category: 'landmark', Position: { X: 1000, Y: 1000 }, Label: 'SecretRoom' }],
        }, WORLD));
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => ctx.win.__tsicMap && ctx.win.__tsicMap.fowVeiled === true);

        // Gamepad mode hovers the viewport centre, so this needs no real cursor
        // position (and no assumptions about the harness's layout metrics).
        ctx.mode('Gamepad');
        await new Promise((r) => setTimeout(r, 120));

        const chip = ctx.doc.querySelector('[data-screen="Map"] #hover-chip');
        ctx.expect(ctx.assert.eq(chip.style.display, 'none',
            'no tile/POI text leaks through the veil on hover'));

        // Positive control: with the gate open the SAME hover must produce text.
        // Without this, a harness that can never build chip text would let the
        // assertion above pass even with the suppression removed.
        ctx.inject('tsic.msg.Cheats.Map.Fow.Visibility', { bVisible: false });
        await ctx.waitFor(() => {
            const c = ctx.doc.querySelector('[data-screen="Map"] #hover-chip');
            return c && c.style.display === 'block' && (c.textContent || '').length > 0;
        }, { timeout: 3000 });
        ctx.expect(ctx.assert.truthy(
            (ctx.doc.querySelector('[data-screen="Map"] #hover-chip').textContent || '').indexOf('SecretRoom') >= 0,
            'control: the same hover does name the POI once the veil is gone'));
    },
});

TSICTestHarness.register({
    name: 'Map/Fog: minimap withholds the basemap until fog can cover it',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Same race on the HUD: the minimap composites world-map and fow into one
        // canvas, and used to blit the basemap whether or not fog had decoded.
        await ctx.waitFor(() => ctx.win.__tsicMinimap);
        ctx.inject('tsic.msg.UI.Map.Fow', {});
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [{ PlayerId: 'P1', Name: 'Me', Position: { X: 0, Y: 0 }, YawDeg: 0 }],
            Icons: [],
            MinBounds: { X: -1000, Y: -1000 }, MaxBounds: { X: 1000, Y: 1000 },
        });
        await new Promise((r) => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.fogPending, true,
            'fog is in play and undecoded, so the basemap is withheld'));

        // Control: the flag must be able to clear, or the assertion above proves
        // nothing. Hiding the fog overlay means there is nothing to wait for.
        ctx.inject('tsic.msg.Cheats.Map.Fow.Visibility', { bVisible: false });
        await ctx.waitFor(() => ctx.win.__tsicMinimap.fogPending === false);
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.fogPending, false,
            'control: basemap is drawn again once fog is not expected'));
    },
});

TSICTestHarness.register({
    name: 'Map/Fog: SetFogOfWarVisible-off lifts the veil (nothing to wait for)',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Fow', {});
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [], Icons: [],
            MinBounds: { X: -500, Y: -500 }, MaxBounds: { X: 500, Y: 500 },
        });
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => ctx.win.__tsicMap && ctx.win.__tsicMap.fowVeiled === true);

        // Hiding the fog overlay means there is no fog to wait for; keeping the
        // map veiled would make the cheat useless.
        ctx.inject('tsic.msg.Cheats.Map.Fow.Visibility', { bVisible: false });
        await ctx.waitFor(() => ctx.win.__tsicMap.fowVeiled === false);

        const veil = ctx.doc.querySelector('[data-screen="Map"] #fow-veil');
        ctx.expect(ctx.assert.eq(veil.style.display, 'none', 'veil lifted with fog hidden'));
    },
});

TSICTestHarness.register({
    name: 'Map/Fog: no fog broadcast at all lifts the veil (fog-off worlds)',
    file: '/screens/in-game.html',
    async run(ctx) {
        // No UI.Map.Fow / UI.Map.FowGrid: worldgen disabled or a dev map. The
        // veil starts closed (unknown status is treated as unsafe) but must give
        // up rather than leave a permanently black map.
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [], Icons: [],
            MinBounds: { X: -500, Y: -500 }, MaxBounds: { X: 500, Y: 500 },
        });
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="Map"] #fow-veil'));
        await ctx.waitFor(() => ctx.win.__tsicMap);
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowExpected, false,
            'no fog channel seen — status is unknown, not expected'));
        // Unknown status must fail CLOSED first: "we have not heard from fog yet"
        // carries the same risk as "fog has not loaded yet". Read inside the
        // grace window (3s), which the harness reaches in milliseconds.
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowVeiled, true,
            'gate starts closed while fog status is unknown'));

        await ctx.waitFor(() => {
            const v = ctx.doc.querySelector('[data-screen="Map"] #fow-veil');
            return v && v.style.display === 'none';
        }, { timeout: 8000 });

        const veil = ctx.doc.querySelector('[data-screen="Map"] #fow-veil');
        ctx.expect(ctx.assert.eq(veil.style.display, 'none',
            'veil lifts when fog is not in play for this session'));
    },
});
