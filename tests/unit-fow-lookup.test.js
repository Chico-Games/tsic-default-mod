// Unit tests for shared/fow-lookup.js — the fog-of-war hover parity lookup.
// Mirrors the C++ FFogOfWarGridState::GetValue encoding (ascending flip points,
// explored iff an odd number of flips are <= column).
TSICTestHarness.register({
    name: 'Unit/Fow: missing or empty grid fails open (treated as explored)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const F = ctx.win.TSICFow;
        ctx.expect(ctx.assert.truthy(F, 'TSICFow global should be installed'));
        ctx.expect(ctx.assert.eq(F.build(null), null));
        ctx.expect(ctx.assert.eq(F.exploredAt(null, 5, 5), true));
        ctx.expect(ctx.assert.eq(F.exploredAt(F.build({ CellSize: 0, Lines: [] }), 5, 5), true));
    },
});

TSICTestHarness.register({
    name: 'Unit/Fow: "explored from col 0" row, unexplored rows return false',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const F = ctx.win.TSICFow;
        // Row 1 fully revealed (RevealAll-style flip [0]); row 0 never explored.
        const g = F.build({ GridSize: 4, CellSize: 100, Lines: [{ Y: 1, Flips: [0] }] });
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 50, 150), true));   // row 1, col 0
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 350, 150), true));  // row 1, far col
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 50, 50), false));   // row 0, no flips
        ctx.expect(ctx.assert.eq(F.exploredAt(g, -10, 150), false)); // outside bounds
    },
});

TSICTestHarness.register({
    name: 'Unit/Fow: partial row resolves explored cells by flip parity',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const F = ctx.win.TSICFow;
        // flips [1,3] on row 2 => cols 1,2 explored; cols 0,3 not.
        const g = F.build({ GridSize: 4, CellSize: 100, Lines: [{ Y: 2, Flips: [1, 3] }] });
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 50, 250), false));   // col 0
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 150, 250), true));   // col 1
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 250, 250), true));   // col 2
        ctx.expect(ctx.assert.eq(F.exploredAt(g, 350, 250), false));  // col 3 (even parity)
    },
});
