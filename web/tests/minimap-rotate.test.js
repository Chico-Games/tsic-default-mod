// gameplay.minimap_rotate — heading-up minimap.
//
// Asserted through the canvas rather than through a flag: the setting is only
// worth anything if the world layers actually turn under the player, and the
// flag being true proves nothing about the transform. A second player is parked
// due north of the local one in a known colour; where its dot lands tells us
// which way the map is facing.
(function () {
    // Mirrors hud-minimap.js: SIZE 180, ZOOM_FRACTION 0.021 over a 2000cm world.
    const HALF = 90;
    const MATE = '#00ff00';

    function snapshot(yawDeg) {
        return {
            Players: [
                { PlayerId: 'P1', Name: 'Me', Position: { X: 0, Y: 0 }, YawDeg: yawDeg, Color: '#3498db' },
                // +X in world space is "up" on the map, so this sits due north of us.
                { PlayerId: 'P2', Name: 'Mate', Position: { X: 20, Y: 0 }, YawDeg: 0, Color: MATE },
            ],
            Icons: [],
            MinBounds: { X: -1000, Y: -1000 }, MaxBounds: { X: 1000, Y: 1000 },
        };
    }

    // Centroid of the mate's dot, in canvas pixels relative to the centre.
    // Returns null while it isn't drawn yet.
    function findMate(ctx) {
        const cvs = ctx.doc.getElementById('minimap-canvas');
        if (!cvs) return null;
        const px = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data;
        let sx = 0, sy = 0, n = 0;
        for (let y = 0; y < cvs.height; y++) {
            for (let x = 0; x < cvs.width; x++) {
                const i = (y * cvs.width + x) * 4;
                // Pure green fill, distinct from the blue local arrow and the map.
                if (px[i] < 80 && px[i + 1] > 180 && px[i + 2] < 80 && px[i + 3] > 200) {
                    sx += x; sy += y; n++;
                }
            }
        }
        if (!n) return null;
        return { x: sx / n - HALF, y: sy / n - HALF };
    }

    TSICTestHarness.register({
        name: 'Minimap/Rotate: off keeps the map north-up, on turns it under the player',
        file: '/screens/in-game.html',
        async run(ctx) {
            await ctx.waitFor(() => ctx.win.__tsicMinimap);

            ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'gameplay.minimap_rotate', ValueJson: 'false' });
            // Facing world +Y (east on the map) — a yaw that makes the two modes
            // differ. yaw 0 would render identically either way.
            ctx.inject('tsic.msg.UI.Map.Snapshot', snapshot(90));

            let mate = null;
            await ctx.waitFor(() => (mate = findMate(ctx)) !== null, { timeout: 3000 });
            ctx.expect(ctx.assert.truthy(mate.y < -20 && Math.abs(mate.x) < 10,
                'north-up: a player due north draws straight above us, got ' +
                Math.round(mate.x) + ',' + Math.round(mate.y)));

            ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.rotateWithPlayer, false,
                'default is north-up'));

            // Heading-up: facing +Y puts north on our left.
            ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'gameplay.minimap_rotate', ValueJson: 'true' });
            await ctx.waitFor(() => {
                const m = findMate(ctx);
                return m && m.x < -20;
            }, { timeout: 3000 });

            const turned = findMate(ctx);
            ctx.expect(ctx.assert.truthy(turned.x < -20 && Math.abs(turned.y) < 10,
                'heading-up: the same player swings to our left, got ' +
                Math.round(turned.x) + ',' + Math.round(turned.y)));
            ctx.expect(ctx.assert.eq(ctx.win.__tsicMinimap.rotateWithPlayer, true,
                'the setting is live on the HUD'));

            // Distance from the centre is the same in both modes — a rotation, not
            // a rescale or a pan.
            const r0 = Math.hypot(mate.x, mate.y);
            const r1 = Math.hypot(turned.x, turned.y);
            ctx.expect(ctx.assert.truthy(Math.abs(r0 - r1) < 4,
                'rotation preserves the distance to the marker (' +
                Math.round(r0) + ' vs ' + Math.round(r1) + ')'));
        },
    });
})();
