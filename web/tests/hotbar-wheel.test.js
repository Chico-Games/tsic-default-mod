// Hold-to-open radial hotbar selector (shared/hud-hotbar-wheel.js).
//
// This file exists because the wheel had NO coverage while its geometry and commit path were
// rewritten for the slot-backed hotbar, and it shipped with a bug the first test here catches:
// a cell landed on exactly the same angle as the FISTS wedge, and since resolveAim breaks ties
// with a strict `<` in list order, the cell always won and Fists was unreachable on a
// controller — the one input path that has no keyboard equivalent.
//
// Aiming rides UI.Behavior.Look (the gamepad right stick), scaled 14px per event against a
// 34px dead zone, so three events in a direction clear it.

const WHEEL_SLOTS = 8;

function openWheel(ctx) {
    ctx.inject('tsic.msg.UI.Behavior.HotbarWheel', { Phase: 'Started' });
}
function closeWheel(ctx) {
    ctx.inject('tsic.msg.UI.Behavior.HotbarWheel', { Phase: 'Completed' });
}
/** Push the aim vector in a direction until it clears the dead zone. */
function aim(ctx, x, y, times) {
    for (let i = 0; i < (times || 4); i++) {
        ctx.inject('tsic.msg.UI.Behavior.Look', { Action: 'Look', Phase: 'Axis', Value: { X: x, Y: y, Z: 0 } });
    }
}
async function seedWheel(ctx, items) {
    ctx.inject('tsic.msg.UI.Inventory.Updated', {
        OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, Items: items || [],
    });
    ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: WHEEL_SLOTS, SelectedSlot: 0, SelectedSlotPending: -1 });
    await new Promise(r => setTimeout(r, 30));
}

TSICTestHarness.register({
    name: 'HotbarWheel: every entry sits on its own angle (Fists must not share with a cell)',
    file: '/screens/in-game.html',
    async run(ctx) {
        await seedWheel(ctx, []);
        openWheel(ctx);
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot').length > 0, { timeout: 3000 });

        const slots = Array.from(ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot'));
        // NumSlots cells plus the synthetic Fists wedge.
        ctx.expect(ctx.assert.eq(slots.length, WHEEL_SLOTS + 1, 'cells + fists'));

        // Positions are set as inline left/top; two entries sharing a position means one of
        // them can never be aimed at.
        const seen = new Map();
        for (const s of slots) {
            const key = Math.round(parseFloat(s.style.left)) + ',' + Math.round(parseFloat(s.style.top));
            ctx.expect(ctx.assert.falsy(seen.has(key),
                'two wheel entries share position ' + key + ': ' + seen.get(key) + ' and ' + s.dataset.entry));
            seen.set(key, s.dataset.entry);
        }
        // The fists wedge must be present and identifiable.
        ctx.expect(ctx.assert.truthy(slots.some(s => s.dataset.entry === '-1'), 'fists wedge exists'));
        closeWheel(ctx);
    },
});

TSICTestHarness.register({
    name: 'HotbarWheel: aiming at the bottom commits Stow, never a Select',
    file: '/screens/in-game.html',
    async run(ctx) {
        await seedWheel(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 1, GridSlot: 0 }]);
        openWheel(ctx);
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot').length > 0, { timeout: 3000 });
        ctx.clearPublishes();

        // Screen coordinates: +Y is down, so the bottom of the wheel is the fists wedge.
        aim(ctx, 0, 1);
        closeWheel(ctx);

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Stow'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Select'));
    },
});

TSICTestHarness.register({
    name: 'HotbarWheel: aiming at a cell commits Select for that cell',
    file: '/screens/in-game.html',
    async run(ctx) {
        await seedWheel(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 1, GridSlot: 0 }]);
        openWheel(ctx);
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot').length > 0, { timeout: 3000 });
        ctx.clearPublishes();

        // Straight up is the far side of the ring from Fists — whichever cell that is, the
        // commit must name a real cell and must not be the stow.
        aim(ctx, 0, -1);
        closeWheel(ctx);

        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Stow'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', {
            where: p => typeof p.SlotIndex === 'number' && p.SlotIndex >= 0 && p.SlotIndex < WHEEL_SLOTS,
        }));
    },
});

TSICTestHarness.register({
    name: 'HotbarWheel: releasing inside the dead zone cancels, committing nothing',
    file: '/screens/in-game.html',
    async run(ctx) {
        await seedWheel(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 1, GridSlot: 0 }]);
        openWheel(ctx);
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot').length > 0, { timeout: 3000 });
        ctx.clearPublishes();

        // One nudge is well inside the 34px dead zone. A mis-tap must not silently change what
        // the player is holding.
        aim(ctx, 0, 1, 1);
        closeWheel(ctx);

        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Select'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Stow'));
    },
});

TSICTestHarness.register({
    name: 'HotbarWheel: cell contents come from the inventory snapshot by GridSlot',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe' }, ID_Bread: { Name: 'Bread' } });
        await seedWheel(ctx, [
            { ItemId: 'ID_Axe', Count: 1, InstanceId: 11, GridSlot: 2 },
            // Past the bar — must not appear on the wheel.
            { ItemId: 'ID_Bread', Count: 4, InstanceId: 12, GridSlot: 19 },
        ]);
        openWheel(ctx);
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot').length > 0, { timeout: 3000 });

        const cell2 = ctx.doc.querySelector('#hud-hotbar-wheel .wslot[data-entry="2"]');
        ctx.expect(ctx.assert.truthy(cell2 && cell2.querySelector('img'), 'cell 2 draws the axe'));
        const withIcons = Array.from(ctx.doc.querySelectorAll('#hud-hotbar-wheel .wslot'))
            .filter(s => s.querySelector('img')).length;
        ctx.expect(ctx.assert.eq(withIcons, 1, 'only the on-bar stack appears; the bag stack does not'));
        closeWheel(ctx);
    },
});
