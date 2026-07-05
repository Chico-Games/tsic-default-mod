TSICTestHarness.register({
    name: 'CheatMenu: God Mode button publishes Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl]'));
        ctx.clearPublishes();
        const god = Array.from(ctx.doc.querySelectorAll('button[data-cmd-tpl]')).find(b => /god/i.test(b.textContent || ''));
        god && god.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => /^ScpGod\s+\d+$/.test(p.Command || '') }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: GiveItem composes command from catalog selection',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('cm-give'));
        // Simulate the catalog arriving and pick the first item.
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            Items: [{ DisplayName: 'Bread', InternalName: '/Game/Items/ID_Bread', Description: '' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item').options.length > 0);
        ctx.doc.getElementById('cm-item-count').value = '3';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-give').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'GiveItem ID_Bread 3 1' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: SpawnFurniture uses catalog short-name',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('cm-spawn-furn'));
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            FurnitureDefault: [{ DisplayName: 'Table', InternalName: '/Game/Furniture/FD_Table', Description: '' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-furn').options.length > 0);
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-spawn-furn').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'SpawnFurniture FD_Table' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: custom command pass-through',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('cm-custom-go'));
        ctx.doc.getElementById('cm-custom-cmd').value = 'stat fps';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-custom-go').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'stat fps' }));
    },
});
