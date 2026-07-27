// Unit tests for shared/height-tint.js — the map/minimap height-tint overlay.
// Tiles on the player's level are untinted; above tint white, below tint
// black, alpha grows with |offset| and clamps at +/-4 levels. Pixel row 0 is
// the top of the texture (highest North), matching the world-map orientation.
TSICTestHarness.register({
    name: 'Unit/HeightTint: build validates payload and expands HeightRLE',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const HT = ctx.win.TSICHeightTint;
        ctx.expect(ctx.assert.truthy(HT, 'TSICHeightTint global should be installed'));
        ctx.expect(ctx.assert.eq(HT.build(null), null));
        ctx.expect(ctx.assert.eq(HT.build({ WorldSize: 0 }), null));
        const s = HT.build({ WorldSize: 2, HeightRLE: [{ Value: 3, Count: 2 }, { Value: 7, Count: 2 }] });
        ctx.expect(ctx.assert.eq(s.worldSize, 2));
        ctx.expect(ctx.assert.eq(JSON.stringify(s.heights), JSON.stringify([3, 3, 7, 7])));
    },
});

TSICTestHarness.register({
    name: 'Unit/HeightTint: same level transparent, above white, below black',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const HT = ctx.win.TSICHeightTint;
        // 1x3-ish: use worldSize 3 with heights on North rows 0..2 = [4,5,3,...].
        // Player level 4: height 4 -> transparent, 5 -> white, 3 -> black.
        const heights = [4, 4, 4, 5, 5, 5, 3, 3, 3]; // N0 row=4, N1 row=5, N2 row=3
        const px = HT.levelPixels(heights, 3, 4);
        // N0 (level tiles) land on rowFromTop 2 -> pixels [24..35]: alpha 0.
        ctx.expect(ctx.assert.eq(px[2 * 3 * 4 + 3], 0, 'same level is transparent'));
        // N1 (height 5, +1) land on rowFromTop 1: white with alpha > 0.
        const i1 = 1 * 3 * 4;
        ctx.expect(ctx.assert.eq(px[i1], 255, 'above tint is white'));
        ctx.expect(ctx.assert.truthy(px[i1 + 3] > 0, 'above tint has alpha'));
        // N2 (height 3, -1) land on rowFromTop 0: black with alpha > 0.
        ctx.expect(ctx.assert.eq(px[0], 0, 'below tint is black'));
        ctx.expect(ctx.assert.truthy(px[3] > 0, 'below tint has alpha'));
    },
});

TSICTestHarness.register({
    name: 'Unit/HeightTint: offset alpha grows with distance and clamps at 4',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const HT = ctx.win.TSICHeightTint;
        // worldSize 1 keeps rowFromTop 0; compare alphas across player levels.
        const alphaFor = (h, level) => HT.levelPixels([h], 1, level)[3];
        ctx.expect(ctx.assert.truthy(alphaFor(2, 0) > alphaFor(1, 0), 'alpha grows with +offset'));
        ctx.expect(ctx.assert.truthy(alphaFor(0, 2) > alphaFor(0, 1), 'alpha grows with -offset'));
        ctx.expect(ctx.assert.eq(alphaFor(4, 0), alphaFor(9, 0), '+4 and beyond share one tint'));
        ctx.expect(ctx.assert.eq(alphaFor(0, 4), alphaFor(0, 9), '-4 and beyond share one tint'));
    },
});

TSICTestHarness.register({
    name: 'Unit/HeightTint: getCanvas caches per level',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const HT = ctx.win.TSICHeightTint;
        const s = HT.build({ WorldSize: 2, HeightRLE: [{ Value: 5, Count: 4 }] });
        const a = HT.getCanvas(s, 5);
        ctx.expect(ctx.assert.truthy(a, 'canvas built'));
        ctx.expect(ctx.assert.eq(a.width, 2));
        ctx.expect(ctx.assert.eq(HT.getCanvas(s, 5), a, 'same level returns cached canvas'));
        ctx.expect(ctx.assert.truthy(HT.getCanvas(s, 3) !== a, 'different level builds a new canvas'));
    },
});
