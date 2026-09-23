// The hotbar is the hooks on the front of the basket. Everything it draws comes from one
// payload, UI.Hotbar.Changed: the selection, and Hooks[i] — what hangs on hook i. Nothing else
// in the basket appears on the bar, and the bar never reads the inventory.

const HOOKS = 4;

function hook(itemId, count, extra) {
    return Object.assign({ ItemId: itemId || '', Count: count || (itemId ? 1 : 0), LoadedAmmo: -1, SpareAmmo: 0 }, extra || {});
}

/** Hooks[] of length HOOKS with the given entries placed by index. */
function hooks(byIndex) {
    const out = [];
    for (let i = 0; i < HOOKS; i++) out.push(Object.assign(hook(), (byIndex || {})[i] || {}, { SlotIndex: i }));
    return out;
}

function hotbarChanged(ctx, byIndex, sel) {
    ctx.inject('tsic.msg.UI.Hotbar.Changed', Object.assign(
        { NumSlots: HOOKS, SelectedSlot: 0, SelectedSlotPending: -1, Hooks: hooks(byIndex) }, sel || {}));
}

function slots(ctx) {
    return ctx.doc.querySelectorAll('#hud-hotbar #hotbar-row .tsic-slot');
}

TSICTestHarness.register({
    name: 'Hotbar: renders one cell per hook from Hotbar.Changed',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 0: hook('ID_Axe'), 1: hook('ID_Bread', 4) }, { SelectedSlot: 1 });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        const s = slots(ctx);
        ctx.expect(ctx.assert.eq(s.length, HOOKS));
        ctx.expect(ctx.assert.truthy(s[1].classList.contains('selected'),
            'the drawn cell is the one Hotbar.Changed named'));
        ctx.expect(ctx.assert.truthy(s[0].querySelector('img'), 'hook 0 draws its item'));
        ctx.expect(ctx.assert.falsy(s[3].querySelector('img'), 'a bare hook draws nothing'));
        ctx.expect(ctx.assert.eq(s[2].dataset.slot, '2', 'cells are addressed by hook index'));
        ctx.expect(ctx.assert.falsy(s[2].hasAttribute('data-grid'), 'cells are hooks, not grid cells'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: the stowed cell renders muted, not drawn',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Empty hands on hook 2: stowed, or holding something unholdable.
        hotbarChanged(ctx, { 2: hook('ID_Axe') }, { SelectedSlot: -1, SelectedSlotPending: 2 });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        const s = slots(ctx);
        ctx.expect(ctx.assert.truthy(s[2].classList.contains('selected-inactive'),
            'hook 2 is current but muted'));
        ctx.expect(ctx.assert.falsy(s[2].classList.contains('selected'),
            'nothing renders as drawn while the hands are empty'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: clicking a cell publishes Hotbar.Select',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 0: hook('ID_Axe') });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        ctx.clearPublishes();
        slots(ctx)[2].click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', { where: p => p.SlotIndex === 2 }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: clicking the current cell again publishes the same Select (C++ toggles the stow)',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 3: hook('ID_Axe') }, { SelectedSlot: 3 });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        ctx.clearPublishes();
        slots(ctx)[3].click();
        // The UI never decides stow vs draw — it just names the cell and the server toggles.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', { where: p => p.SlotIndex === 3 }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: cells are not HTML5 drag sources (things are hung in the basket view)',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 2: hook('ID_Axe') });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        const s = slots(ctx);
        ctx.expect(ctx.assert.falsy(s[2].draggable, 'a filled cell is not draggable'));
        ctx.expect(ctx.assert.falsy(s[1].draggable, 'an empty cell is not draggable'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: a stack count renders, and taking the item off its hook clears the cell',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 3: hook('ID_Bread', 6) }, { SelectedSlot: 3 });
        await ctx.waitFor(() => slots(ctx).length === HOOKS && slots(ctx)[3].querySelector('.count'));
        ctx.expect(ctx.assert.eq(slots(ctx)[3].querySelector('.count').textContent, '6'));

        // The hook is bare now: the cell must empty.
        hotbarChanged(ctx, {}, { SelectedSlot: 3 });
        await ctx.waitFor(() => !slots(ctx)[3].querySelector('img'));
        ctx.expect(ctx.assert.falsy(slots(ctx)[3].querySelector('.count'),
            'the cell empties when its hook does'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: an ammo-using hook shows loaded/spare instead of a stack count',
    file: '/screens/in-game.html',
    async run(ctx) {
        hotbarChanged(ctx, { 1: hook('ID_Pistol', 1, { LoadedAmmo: 5, SpareAmmo: 120 }) });
        await ctx.waitFor(() => slots(ctx).length === HOOKS && slots(ctx)[1].querySelector('.count.ammo'));
        ctx.expect(ctx.assert.eq(slots(ctx)[1].querySelector('.count.ammo').textContent, '5/99',
            'each side clamps to two digits'));
    },
});

// ── Held-item name (issue #245) ────────────────────────────────────────────────
// "add a name of held item just above the hotbar so you know what you are holding when the
// icons are confusing or unknown." The caption reads the CURRENT cell — drawn or stowed —
// and takes its text from the item catalog, never from the raw definition id.

TSICTestHarness.register({
    name: 'Hotbar/Name: the drawn cell is captioned with its catalog name',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe: { Name: 'Fire Axe', Category: 'Weapon' },
            ID_Bread: { Name: 'Bread', Category: 'Consumable' },
        });
        const held = { 0: hook('ID_Axe'), 1: hook('ID_Bread', 4) };
        hotbarChanged(ctx, held, { SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name')
            && ctx.doc.querySelector('#hotbar-name').textContent === 'Fire Axe');
        const label = ctx.doc.querySelector('#hotbar-name');
        ctx.expect(ctx.assert.eq(label.textContent, 'Fire Axe', 'caption names the drawn item'));
        ctx.expect(ctx.assert.truthy(label.classList.contains('visible'), 'caption is shown'));
        ctx.expect(ctx.assert.falsy(label.classList.contains('stowed'), 'a drawn item is not marked stowed'));

        // Moving the selection re-captions without a rebuild (the selection-only path).
        hotbarChanged(ctx, held, { SelectedSlot: 1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name').textContent === 'Bread');
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#hotbar-name').textContent, 'Bread'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar/Name: an empty current cell shows no caption, and a stowed one greys out',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Fire Axe' } });
        const held = { 2: hook('ID_Axe') };
        // Hook 3 is bare — nothing in hand, nothing to name.
        hotbarChanged(ctx, held, { SelectedSlot: 3 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#hotbar-name').textContent, '',
            'an empty cell captions nothing'));
        ctx.expect(ctx.assert.falsy(ctx.doc.querySelector('#hotbar-name').classList.contains('visible'),
            'the caption hides rather than showing an empty plate'));

        // Stowed on hook 2: still the current cell, so still named — but marked as not in hand.
        hotbarChanged(ctx, held, { SelectedSlot: -1, SelectedSlotPending: 2 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name').textContent === 'Fire Axe');
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('#hotbar-name').classList.contains('stowed'),
            'a stowed item reads as stowed'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar/Name: an item the catalog never described is prettified, not shown as an id',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({});
        hotbarChanged(ctx, { 0: hook('ID_Tier1Hammer_EQ') }, { SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name')
            && ctx.doc.querySelector('#hotbar-name').textContent.length > 0);
        const text = ctx.doc.querySelector('#hotbar-name').textContent;
        ctx.expect(ctx.assert.eq(text, 'Tier1 Hammer', 'falls back to the prettified definition name'));
        ctx.expect(ctx.assert.falsy(/^ID_/.test(text), 'never puts a raw definition id in front of a player'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar/Name: the caption is out of flow, so it never moves the shelf',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'A Very Long Item Name That Would Wrap' } });
        const held = { 0: hook('ID_Axe') };
        // Empty current cell first: no caption at all.
        hotbarChanged(ctx, held, { SelectedSlot: 3 });
        await ctx.waitFor(() => slots(ctx).length === HOOKS);
        // Measured on a cell the selection never touches: the selected one lifts by design.
        const before = slots(ctx)[1].getBoundingClientRect();

        hotbarChanged(ctx, held, { SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-name').classList.contains('visible'));
        const after = slots(ctx)[1].getBoundingClientRect();

        ctx.expect(ctx.assert.eq(Math.round(after.top), Math.round(before.top),
            'showing the caption does not shift the slots'));
        ctx.expect(ctx.assert.eq(
            ctx.win.getComputedStyle(ctx.doc.querySelector('#hotbar-name')).position, 'absolute',
            'the caption is positioned out of flow'));
    },
});
