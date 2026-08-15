// §8 QA checklist: "Minimap (§4) and full map agree — same position, same
// revealed area." Both surfaces mount independently off the SAME sticky bridge
// channels (shared/screens/map.js and shared/hud-minimap.js each hold their own
// fog/position state — there is no single shared store), so the risk this
// guards is DRIFT: one surface hearing a broadcast the other misses.
//
// This does not pixel-compare the two fog rasters or player projections (map.js
// reads a boolean grid via shared/fow-lookup.js, the minimap reads an
// alpha-channel image through its own fixed-zoom worldToLocal — the two use
// different internal scale factors with no shared seam to diff them under
// jsdom, and reverse-engineering the minimap's scale from pixel samples proved
// too fragile to be worth keeping here). What IS provable headlessly, and
// cheaply: a single UI.Map.Fow broadcast is recognised as "fog in play" by
// both surfaces at once, so there is no message-routing drift where one hears
// fog and the other doesn't.

TSICTestHarness.register({
    name: 'Map/Minimap agreement: one UI.Map.Fow broadcast reaches both surfaces',
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.win.__tsicMinimap);

        // Before this broadcast, neither surface has seen fog yet.
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.fowMsgs, 0,
            'minimap should not have seen a fog broadcast yet'));

        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [{ PlayerId: 'P1', Name: 'Me', Position: { X: 0, Y: 0 }, YawDeg: 0 }],
            Icons: [], MinBounds: { X: -1000, Y: -1000 }, MaxBounds: { X: 1000, Y: 1000 },
        });
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Map' });
        await ctx.waitFor(() => ctx.win.__tsicMap);

        // ONE broadcast — both surfaces are live at once (minimap is part of the
        // always-mounted HUD; the map screen is open) and both must count it.
        ctx.inject('tsic.msg.UI.Map.Fow', {});

        ctx.expect(ctx.assert.eq(ctx.win.__tsicMap.fowExpected, true,
            'full map should recognise fog as in play from the shared broadcast'));
        await ctx.waitFor(() => ctx.win.__tsicMinimap.fowMsgs >= 1);
        ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.fowMsgs, 1,
            'minimap should have counted exactly the one broadcast the map screen also saw'));
    },
});
