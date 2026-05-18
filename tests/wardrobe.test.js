TSICTestHarness.register({
    name: 'Wardrobe: filters cosmetic slots',
    file: '/screens/wardrobe.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [
                { SlotTag: 'Equip.Weapon',  ItemId: 'ID_Axe',  IconUrl: '' },
                { SlotTag: 'Cosmetic.Head', ItemId: 'ID_Hat',  IconUrl: '' },
                { SlotTag: 'Outfit.Body',   ItemId: 'ID_Coat', IconUrl: '' },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        // The Weapon (non-cosmetic) slot should be filtered out.
        ctx.expect(ctx.assert.eq(ctx.doc.body.textContent.indexOf('Equip.Weapon'), -1));
    },
});

TSICTestHarness.register({
    name: 'Wardrobe: clicking a slot publishes Unequip',
    file: '/screens/wardrobe.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player', Slots: [{ SlotTag: 'Cosmetic.Head', ItemId: 'ID_Hat', IconUrl: '' }],
        });
        await new Promise(r => setTimeout(r, 80));
        const slot = ctx.doc.querySelector('.tsic-slot');
        ctx.clearPublishes();
        slot && slot.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Unequip', { where: p => p.SlotTag === 'Cosmetic.Head' }));
    },
});

TSICTestHarness.register({
    name: 'Wardrobe: requests character preview on activate',
    file: '/screens/wardrobe.html',
    async run(ctx) {
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Show'));
    },
});
