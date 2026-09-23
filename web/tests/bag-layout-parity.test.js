// The storage screen's bag column is a LAYOUT contract, not a description: the slot size is one
// global clamp, the bag is a constant number of cells whatever backpack the player has, and the
// pane header / grid / weight bar keep their measurements. It has been broken by storage scoping
// --tsic-slot down to 54px and by storage omitting the greyed backpack-preview cells, and each
// looked like "the UI jumps" rather than like a CSS bug. None of it is visible to a test that
// only asserts what rendered; these measure.
//
// Runs against the real shell so the HUD is present, exactly as in game. The player's grid is
// two bands inside one column wrapper — the bag, then the hotbar strip under it — so
// #ss-player-list is the whole bag column.

function rect(ctx, sel) {
    const el = ctx.doc.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: +b.top.toFixed(1), left: +b.left.toFixed(1), width: +b.width.toFixed(1),
             height: +b.height.toFixed(1), right: +b.right.toFixed(1), bottom: +b.bottom.toFixed(1) };
}

const PLAYER_ITEMS = [
    { ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 2 },
    { ItemId: 'ID_Wood', Count: 12, InstanceId: 5, GridSlot: 9 },
];

/** Show a screen and wait for its player grid to have rendered. */
async function show(ctx, name, gridSel) {
    ctx.inject('tsic.msg.UI.Screen.Changed', { Name: name });
    ctx.inject('tsic.msg.UI.Inventory.Updated', {
        OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, MaxWeight: 80, CurrentWeight: 12,
        Items: PLAYER_ITEMS,
    });
    ctx.inject('tsic.msg.UI.Inventory.Updated', {
        OwnerId: 'Storage:91', GridWidth: 8, MaxSlots: 32, MaxWeight: 300, CurrentWeight: 40,
        bCanExceedWeight: false, CustomName: 'Crate',
        Items: [{ ItemId: 'ID_Wood', Count: 30, InstanceId: 6, GridSlot: 0 }],
    });
    ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
    await ctx.waitFor(() => ctx.doc.querySelector(gridSel + ' .tsic-slot'), { timeout: 4000 });
    // One more frame so flex/grid sizing has settled before anything is measured.
    await new Promise((r) => setTimeout(r, 60));
}

TSICTestHarness.register({
    name: 'BagLayout: the bag is always 48 cells, whatever backpack tier the player has',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });

        // The whole point of the greyed cells: live + locked is a CONSTANT, so upgrading a
        // backpack turns grey cells live and the grid does not resize, reflow or move. The
        // preview band used to be capped at 16 cells, which made a starter bag two rows
        // shorter than an upgraded one and the panel jump as the player levelled.
        const TIER = 48;
        for (const maxSlots of [24, 32, 40, 48]) {
            await show(ctx, 'Storage', '#ss-player-list');
            ctx.inject('tsic.msg.UI.Inventory.Updated', {
                OwnerId: 'Player', GridWidth: 8, MaxSlots: maxSlots,
                MaxWeight: 80, CurrentWeight: 12, Items: PLAYER_ITEMS,
            });
            await new Promise((r) => setTimeout(r, 80));

            const cells = ctx.doc.querySelectorAll('#ss-player-list .tsic-slot').length;
            const locked = ctx.doc.querySelectorAll('#ss-player-list .tsic-slot.is-locked').length;
            // Bag band + hotbar strip together — the column is the whole bag.
            ctx.expect(ctx.assert.eq(cells, TIER,
                `at ${maxSlots} slots: bag totals ${TIER} cells`));
            ctx.expect(ctx.assert.eq(locked, TIER - maxSlots,
                `at ${maxSlots} slots: ${TIER - maxSlots} of them are locked`));
        }
    },
});

TSICTestHarness.register({
    name: 'BagLayout: each filter tab is exactly one slot column wide and sits over it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });
        await show(ctx, 'Storage', '#ss-player-list');

        // The container pane has no tabs, so these are the player pane's.
        const tabs = ctx.doc.querySelectorAll('#ss-panel .ss-tabs .tsic-tab');
        const cells = ctx.doc.querySelectorAll('#ss-player-list .tsic-slot');
        ctx.expect(ctx.assert.truthy(tabs.length >= 2 && cells.length >= tabs.length, 'tabs and cells present'));

        for (let i = 0; i < tabs.length; i++) {
            const t = tabs[i].getBoundingClientRect();
            const c = cells[i].getBoundingClientRect();
            ctx.expect(ctx.assert.eq(+t.width.toFixed(1), +c.width.toFixed(1),
                `tab ${i} is one slot wide`));
            ctx.expect(ctx.assert.eq(+t.left.toFixed(1), +c.left.toFixed(1),
                `tab ${i} sits over slot column ${i}`));
        }

        // The strip must never wrap onto a second line — that would push the grid down and
        // break the header height both panes share.
        const first = tabs[0].getBoundingClientRect();
        const last = tabs[tabs.length - 1].getBoundingClientRect();
        ctx.expect(ctx.assert.eq(+last.top.toFixed(1), +first.top.toFixed(1),
            'the tab strip stays on one line'));
    },
});

TSICTestHarness.register({
    name: 'BagLayout: storage puts the weight and capacity bars on one line',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });
        await show(ctx, 'Storage', '#ss-player-list');

        const pLab = rect(ctx, '#ss-player-meter .lab');
        const cLab = rect(ctx, '#ss-container-meter .lab');
        const pTrack = rect(ctx, '#ss-player-meter .track');
        const cTrack = rect(ctx, '#ss-container-meter .track');
        ctx.expect(ctx.assert.truthy(cTrack, 'the container capacity bar is shown (weight is a hard block here)'));

        // Both the bars AND their labels — the bag's label row carries the hovered-stack chip
        // and the container's does not, which used to leave the two captions 1.8px apart and
        // reading as misaligned even though the bars themselves were flush.
        ctx.expect(ctx.assert.eq(cTrack.top, pTrack.top, 'the two bars sit on one line'));
        ctx.expect(ctx.assert.eq(cLab.top, pLab.top, 'the two bar captions sit on one line'));

        // And the two SORT plates are the same plate, the same distance in from each grid's
        // right edge, so each reads as belonging to the grid beneath it.
        const pSort = rect(ctx, '#ss-sort-player'), cSort = rect(ctx, '#ss-sort-container');
        const pGrid = rect(ctx, '#ss-player-list'), cGrid = rect(ctx, '#ss-container-list');
        ctx.expect(ctx.assert.eq(cSort.width, pSort.width, 'both SORT buttons are the same width'));
        ctx.expect(ctx.assert.eq(cSort.top, pSort.top, 'both SORT buttons sit on one line'));
        ctx.expect(ctx.assert.eq(+(cGrid.right - cSort.right).toFixed(1),
                                 +(pGrid.right - pSort.right).toFixed(1),
                                 'both SORT buttons are the same inset from their grid'));
    },
});
