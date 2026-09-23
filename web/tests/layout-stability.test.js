// Layout stability — standing guards for the boxes INSIDE a panel (issue #273).
//
// Scripts/webui-bench/layout.mjs is the instrument: it sweeps every screen at several
// viewport sizes and reports what moved. These are the cheap guards for the specific
// defects it found, so a regression fails the normal web suite rather than waiting for
// someone to remember to run the bench.
//
// All of them load /screens/in-game.html and go through ctx.screen(), because a panel's
// box comes from the shell's CSS and the standalone /screens/*.html pages do not have it.
//
// The shape of every assertion is the same: take the same measurement in two states that
// differ only in DATA, and require the box to be identical. A panel sized by its layout
// rules passes; a panel sized by whatever is in it this frame does not.

function box(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

function sameBox(ctx, a, b, label, dims) {
    for (const d of (dims || ['x', 'y', 'w', 'h'])) {
        ctx.expect(ctx.assert.eq(a[d], b[d], label + ' ' + d));
    }
}

// ── BugReport: the furniture block ─────────────────────────────────────────
//
// The block starts as one line of "Looking for furniture…" and is replaced by the name
// plus four detail rows a frame or two later. The dialog is vertically centred, so that
// growth pushed its top edge up and took Submit and Cancel with it, while the player was
// already reaching for one.

TSICTestHarness.register({
    name: 'Layout/BugReport: the trace result does not move the dialog',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('BugReport');
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture'),
            { timeout: 4000 });
        await new Promise(r => setTimeout(r, 160));

        const panelSel = '[data-screen="BugReport"] .tsic-panel';
        const coldPanel = box(ctx.doc.querySelector(panelSel));
        const coldBlock = box(ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture'));
        const coldSubmit = box(ctx.doc.querySelector('[data-screen="BugReport"] #btn-submit'));

        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', {
            bHasTarget: true,
            DisplayName: 'Weapon Bench',
            DefinitionId: 'FD_WeaponBench_CS',
            MapName: 'Durham Furniture',
            TileIndex: 35192, TileCoord: '120,137', bMoved: false,
        });
        await new Promise(r => setTimeout(r, 160));

        sameBox(ctx, coldBlock, box(ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture')),
            'furniture block');
        sameBox(ctx, coldPanel, box(ctx.doc.querySelector(panelSel)), 'dialog');
        sameBox(ctx, coldSubmit, box(ctx.doc.querySelector('[data-screen="BugReport"] #btn-submit')),
            'submit button');
    },
});
