// Storage-shell quality-of-life: bulk deposit ops, the container capacity
// meter, cross-pane search, container renaming, and the shift-click fit
// preview.
//
// The capacity meter is the important one. Containers enforce weight as a HARD
// block ON TOP of the slot grid, so before this a deposit could be refused with
// visibly empty cells and nothing on screen explaining why.

function ssSeed(ctx, opts) {
    opts = opts || {};
    ctx.setItemCatalog(opts.catalog || {
        ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 },
        ID_Iron: { Name: 'Iron Ore', Category: 'CraftingMaterial', Weight: 5 },
    });
    ctx.inject('tsic.msg.UI.Inventory.Updated', Object.assign({
        OwnerId: 'Storage:42', GridWidth: 8, MaxSlots: 32,
        Items: [{ ItemId: 'ID_Wood', Count: 4, InstanceId: 1, GridSlot: 0 }],
        CurrentWeight: 4, MaxWeight: 30, bCanExceedWeight: false,
    }, opts.container || {}));
    ctx.inject('tsic.msg.UI.Inventory.Updated', Object.assign({
        OwnerId: 'Player', GridWidth: 8, MaxSlots: 32,
        Items: [{ ItemId: 'ID_Iron', Count: 3, InstanceId: 7, GridSlot: 0 }],
        CurrentWeight: 15, MaxWeight: 200, bCanExceedWeight: true,
    }, opts.player || {}));
}

TSICTestHarness.register({
    name: 'Storage/QoL: Store All and Quick Stack publish DepositAll with the right mode',
    file: '/screens/storage.html',
    async run(ctx) {
        ssSeed(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-store-all'));

        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-store-all').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DepositAll', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Storage:42' && p.bMatchingOnly === false,
        }));

        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-quick-stack').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DepositAll', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Storage:42' && p.bMatchingOnly === true,
        }));
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: container capacity meter appears only when weight is a hard block',
    file: '/screens/storage.html',
    async run(ctx) {
        // Hard-capped container: the meter must be visible and reflect the load.
        ssSeed(ctx, { container: { CurrentWeight: 24, MaxWeight: 30, bCanExceedWeight: false } });
        await ctx.waitFor(() => {
            const m = ctx.doc.querySelector('#ss-container-meter');
            return m && m.style.display !== 'none';
        });
        ctx.expect(ctx.assert.domText(ctx.doc, '#ss-cweight-text', /24\.0\/30 kg/));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('#ss-container-meter').dataset.state, 'warning',
            '80% of a hard cap should warn'));

        // A container that can exceed its capacity is slot-limited only — no meter.
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8, MaxSlots: 32,
            Items: [], CurrentWeight: 0, MaxWeight: 30, bCanExceedWeight: true,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-meter').style.display === 'none');
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: a full container shows the meter as full',
    file: '/screens/storage.html',
    async run(ctx) {
        ssSeed(ctx, { container: { CurrentWeight: 30, MaxWeight: 30, bCanExceedWeight: false } });
        await ctx.waitFor(() => {
            const m = ctx.doc.querySelector('#ss-container-meter');
            return m && m.dataset.state === 'full';
        });
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: search dims non-matching cells in BOTH panes without moving them',
    file: '/screens/storage.html',
    async run(ctx) {
        ssSeed(ctx, {
            container: { Items: [
                { ItemId: 'ID_Wood', Count: 4, InstanceId: 1, GridSlot: 0 },
                { ItemId: 'ID_Iron', Count: 2, InstanceId: 2, GridSlot: 1 },
            ] },
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-search'));
        const before = ctx.doc.querySelectorAll('#ss-container-list .tsic-slot').length;

        const box = ctx.doc.querySelector('#ss-search');
        box.value = 'iron';
        box.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));

        await ctx.waitFor(() =>
            ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="1"]').classList.contains('is-filtered'));
        // Iron survives in the container AND the player pane; wood dims.
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="2"]').classList.contains('is-filtered'),
            'iron stays lit in the container'));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.querySelector('#ss-player-list .tsic-slot[data-instance="7"]').classList.contains('is-filtered'),
            'iron stays lit in the player pane'));
        // Rule 48: a filter never changes slot geometry.
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelectorAll('#ss-container-list .tsic-slot').length, before, 'cell count unchanged'));
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: renaming the container publishes Rename on Enter, and Escape reverts',
    file: '/screens/storage.html',
    async run(ctx) {
        ssSeed(ctx, { container: { CustomName: 'Ammo' } });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-name').value === 'Ammo');

        const input = ctx.doc.querySelector('#ss-container-name');
        ctx.clearPublishes();
        input.dispatchEvent(new ctx.win.FocusEvent('focus'));
        input.value = 'Ores';
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Rename', {
            where: p => p.OwnerId === 'Storage:42' && p.Name === 'Ores',
        }));

        // Escape restores the pre-edit value and sends nothing.
        ctx.clearPublishes();
        input.dispatchEvent(new ctx.win.FocusEvent('focus'));
        input.value = 'Scrap';
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        ctx.expect(ctx.assert.eq(input.value, 'Ores', 'Escape reverts the field'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Rename'));
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: hovering a player stack previews whether it fits the container',
    file: '/screens/storage.html',
    async run(ctx) {
        // 3 iron at 5kg each = 15kg, but only 6kg of room: 1 unit fits.
        ssSeed(ctx, { container: { CurrentWeight: 24, MaxWeight: 30, bCanExceedWeight: false } });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-slot[data-instance="7"]'));
        ctx.doc.querySelector('#ss-player-list .tsic-slot[data-instance="7"]')
            .dispatchEvent(new ctx.win.MouseEvent('mouseenter'));
        await ctx.waitFor(() => /Shift-click/.test(ctx.doc.querySelector('#ss-info').textContent));
        ctx.expect(ctx.assert.domText(ctx.doc, '#ss-info', /only 1 of 3 fit/));
    },
});

TSICTestHarness.register({
    name: 'Storage/QoL: auto-sort on close sorts the container before resuming',
    file: '/screens/storage.html',
    async run(ctx) {
        ssSeed(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-auto-sort'));

        // Off by default: closing sends no Sort.
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-close').click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Sort'));

        const box = ctx.doc.querySelector('#ss-auto-sort');
        box.checked = true;
        box.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));

        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Sort', {
            where: p => p.OwnerId === 'Storage:42',
        }));
        // Leave the preference off so the next scenario starts clean.
        box.checked = false;
        box.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));
    },
});
