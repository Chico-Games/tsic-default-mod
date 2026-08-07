// The bag must not move when a container opens.
//
// The storage screen is the inventory screen plus a container column. That is a LAYOUT
// contract, not a description: the panel is top-left anchored, the slot size is one global
// clamp, and the pane header / grid / weight bar are drawn to the same measurements on both
// screens. Opening a crate adds a column to the right and moves nothing already on screen.
//
// It has been broken three separate ways — storage scoping --tsic-slot down to 54px, storage
// omitting the greyed backpack-preview cells, and both panels being centred so a third column
// slid the bag sideways — and every one of them looked like "the UI jumps" rather than like a
// CSS bug. None of it is visible to a test that only asserts what rendered; these measure.
//
// Runs against the real shell so the HUD hotbar is present and both screens skip their first
// row for it, exactly as in game.

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
    name: 'BagLayout: the bag column is in the SAME place on the inventory and storage screens',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 },
        });

        await show(ctx, 'Inventory', '#inv-grid');
        const inv = {
            panel: rect(ctx, '#inv-panel'),
            header: rect(ctx, '.inv-panehdr'),
            grid: rect(ctx, '#inv-grid'),
            meter: rect(ctx, '#inv-meter'),
            sort: rect(ctx, '#inv-sort'),
        };

        await show(ctx, 'Storage', '#ss-player-list');
        const sto = {
            panel: rect(ctx, '#ss-panel'),
            header: rect(ctx, '#ss-panel .ss-panehdr'),
            grid: rect(ctx, '#ss-player-list'),
            meter: rect(ctx, '#ss-player-meter'),
            sort: rect(ctx, '#ss-sort-player'),
        };

        // The panel's top-left corner is anchored, so everything hanging off it is fixed. Only
        // the panel's WIDTH and HEIGHT may differ — that is the container column arriving.
        ctx.expect(ctx.assert.eq(sto.panel.top, inv.panel.top, 'panel top is anchored'));
        ctx.expect(ctx.assert.eq(sto.panel.left, inv.panel.left, 'panel left is anchored'));

        for (const part of ['header', 'grid', 'meter', 'sort']) {
            ctx.expect(ctx.assert.eq(JSON.stringify(sto[part]), JSON.stringify(inv[part]),
                `the bag column's ${part} occupies the identical rect on both screens`));
        }
    },
});

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
        const HOTBAR = 8, TIER = 48;
        for (const maxSlots of [24, 32, 40, 48]) {
            for (const [name, gridSel] of [['Inventory', '#inv-grid'], ['Storage', '#ss-player-list']]) {
                await show(ctx, name, gridSel);
                ctx.inject('tsic.msg.UI.Inventory.Updated', {
                    OwnerId: 'Player', GridWidth: 8, MaxSlots: maxSlots,
                    MaxWeight: 80, CurrentWeight: 12, Items: PLAYER_ITEMS,
                });
                await new Promise((r) => setTimeout(r, 80));

                const cells = ctx.doc.querySelectorAll(gridSel + ' .tsic-slot').length;
                const locked = ctx.doc.querySelectorAll(gridSel + ' .tsic-slot.is-locked').length;
                // The panel skips the leading hotbar cells — the live HUD bar draws those.
                ctx.expect(ctx.assert.eq(cells + HOTBAR, TIER,
                    `${name} at ${maxSlots} slots: bag totals ${TIER} cells`));
                ctx.expect(ctx.assert.eq(locked, TIER - maxSlots,
                    `${name} at ${maxSlots} slots: ${TIER - maxSlots} of them are locked`));
            }
        }
    },
});

TSICTestHarness.register({
    name: 'BagLayout: each filter tab is exactly one slot column wide and sits over it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });
        await show(ctx, 'Inventory', '#inv-grid');

        const tabs = ctx.doc.querySelectorAll('#inv-tabs .tsic-tab');
        const cells = ctx.doc.querySelectorAll('#inv-grid .tsic-slot');
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
        // break the shared header height the storage screen matches.
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

TSICTestHarness.register({
    name: 'BagLayout: the inventory rail leaves no dead space under the grid',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });
        await show(ctx, 'Inventory', '#inv-grid');

        // The rail (paper doll + character preview + info card) must never be TALLER than the
        // bag column, or the panel runs on past the weight bar with nothing in the gap. The
        // info card is the slack that absorbs it — it takes whatever the doll leaves.
        const rail = rect(ctx, '.inv-rail');
        const meter = rect(ctx, '#inv-meter');
        ctx.expect(ctx.assert.eq(rail.bottom, meter.bottom,
            'the rail ends level with the weight bar, not below it'));
    },
});

TSICTestHarness.register({
    name: 'BagLayout: both panels are exactly the same height',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2 },
                             ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 } });

        await show(ctx, 'Inventory', '#inv-grid');
        const inv = rect(ctx, '#inv-panel');
        await show(ctx, 'Storage', '#ss-player-list');
        const sto = rect(ctx, '#ss-panel');

        // Everything above the footer is already identical, so the footers carry a shared
        // min-height — without it the inventory's seven hint chips wrap to two rows while
        // storage's six sit on one under a much wider panel, and the two panels close 10px
        // apart. Opening a container must not change the window's height any more than it
        // changes the bag's position.
        ctx.expect(ctx.assert.eq(sto.height, inv.height,
            `panels are the same height (inventory ${inv.height}, storage ${sto.height})`));
        ctx.expect(ctx.assert.eq(sto.top, inv.top, 'and they start at the same y'));
    },
});
