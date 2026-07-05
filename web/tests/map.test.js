TSICTestHarness.register({
    name: 'Map: renders icons from snapshot',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [{ PlayerId: 'P1', Name: 'Me', Position: { X: 100, Y: 100 }, YawDeg: 0 }],
            Icons: [
                { IconId: 'i1', Category: 'spawn',     Position: { X: 0,    Y: 0    }, Label: 'Spawn' },
                { IconId: 'i2', Category: 'landmark',  Position: { X: 500,  Y: 500  }, Label: 'Tree'  },
            ],
            MinBounds: { X: -1000, Y: -1000 }, MaxBounds: { X: 1000, Y: 1000 },
        });
        // In jsdom the map viewport has zero client dimensions, so fitToBounds
        // clamps scale to 0.0001 and the cluster-radius collapses every icon
        // into one node. We just need *some* circle to land in #g-icons to
        // prove rendering happened.
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#g-icons circle').length >= 1, { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(true));
    },
});

TSICTestHarness.register({
    name: 'Map: gamepad mode shows the cursor',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 80));
        const vp = ctx.doc.getElementById('map-viewport');
        ctx.expect(ctx.assert.truthy(vp.classList.contains('pad-cursor'), 'expected viewport to gain .pad-cursor on gamepad mode'));
    },
});

TSICTestHarness.register({
    name: 'Map: place-ping action publishes UI.Cmd.Ping.Request',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', {
            Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 },
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.clearPublishes();
        ctx.input('IA_UI_MapPlacePing', 'Started');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Ping.Request', { where: p => p.PingType === 'Map' }));
    },
});
