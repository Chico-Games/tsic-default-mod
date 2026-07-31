// Unit tests for the case-tolerant payload wrapper in shared/tsic-bridge.js.
//
// Bridged JSON keys come from FProperty::GetAuthoredName(), which only returns
// the authored PascalCase in the EDITOR — NameTypes.h defines
// WITH_CASE_PRESERVING_NAME as WITH_EDITORONLY_DATA, so a cooked runtime
// collapses each FName to whatever casing was registered first anywhere in the
// process. The 2026-07-31 closed-alpha build shipped FScpUIMapPlayer::Position
// as "position" (minimap stuck on the world's origin corner) and
// FScpUIAttributeUpdate::Max as "max" (liquid bars rendered "100 / 1"), while
// their sibling fields were untouched. These tests pin the wrapper that makes
// screen code immune to it.
TSICTestHarness.register({
    name: 'Unit/BridgeCase: mis-cased keys resolve at the authored casing',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const ci = ctx.win.__tsicCaseTolerant;
        ctx.expect(ctx.assert.truthy(ci, '__tsicCaseTolerant should be installed'));

        // The exact shape the cooked build shipped.
        const p = ci({
            Players: [{ PlayerId: 'Player', Name: 'Player', position: { X: 191250, Y: 191250 }, YawDeg: 0 }],
            MinBounds: { X: 0, Y: 0 },
            MaxBounds: { X: 384000, Y: 384000 },
        });
        const me = p.Players[0];
        ctx.expect(ctx.assert.eq(me.Position.X, 191250, 'lower-cased "position" reads as Position'));
        ctx.expect(ctx.assert.eq(me.Position.Y, 191250));
        ctx.expect(ctx.assert.eq(me.Name, 'Player', 'correctly-cased siblings still read'));
        ctx.expect(ctx.assert.eq(p.MaxBounds.X, 384000));

        // FScpUIAttributeUpdate::Max -> "max".
        const attr = ci({ Channel: 'Health', Current: 100, max: 250 });
        ctx.expect(ctx.assert.eq(Number(attr.Max) || 1, 250, 'lower-cased "max" reads as Max'));
    },
});

TSICTestHarness.register({
    name: 'Unit/BridgeCase: exact match wins and missing keys stay undefined',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const ci = ctx.win.__tsicCaseTolerant;

        // An exact hit must never be shadowed by a case-folded sibling — the
        // `key in target` fast path has to win.
        const both = ci({ Name: 'authored', name: 'folded' });
        ctx.expect(ctx.assert.eq(both.Name, 'authored'));
        ctx.expect(ctx.assert.eq(both.name, 'folded'));

        // A genuinely absent key stays undefined rather than matching junk.
        ctx.expect(ctx.assert.eq(ci({ Foo: 1 }).Bar, undefined));

        // Bools keep their `b` prefix over the bridge and must not be mangled.
        ctx.expect(ctx.assert.eq(ci({ bReset: true }).bReset, true));

        // Primitives and null pass straight through.
        ctx.expect(ctx.assert.eq(ci(null), null));
        ctx.expect(ctx.assert.eq(ci(7), 7));
        ctx.expect(ctx.assert.eq(ci('s'), 's'));
    },
});

TSICTestHarness.register({
    name: 'Unit/BridgeCase: arrays and JSON round-trips behave normally',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const ci = ctx.win.__tsicCaseTolerant;

        // Array identity, length, iteration and methods must survive the proxy —
        // map.js and the RLE expanders lean on all of them.
        const arr = ci({ Lines: [{ Y: 0, flips: [1, 2] }, { Y: 1, flips: [3] }] }).Lines;
        ctx.expect(ctx.assert.truthy(Array.isArray(arr), 'wrapped arrays stay arrays'));
        ctx.expect(ctx.assert.eq(arr.length, 2));
        ctx.expect(ctx.assert.eq(arr[0].Flips[1], 2, 'mis-cased key inside an array element'));
        ctx.expect(ctx.assert.eq(arr.map(l => l.Y).join(','), '0,1', 'array methods still work'));

        let count = 0;
        for (const l of arr) { count += l.Flips.length; }
        ctx.expect(ctx.assert.eq(count, 3, 'for...of iterates wrapped elements'));

        // Keys are reported as received; stringify must not invent aliases.
        const o = ci({ Alpha: 1, beta: 2 });
        ctx.expect(ctx.assert.eq(Object.keys(o).join(','), 'Alpha,beta'));
        ctx.expect(ctx.assert.eq(JSON.stringify(o), '{"Alpha":1,"beta":2}'));
    },
});
