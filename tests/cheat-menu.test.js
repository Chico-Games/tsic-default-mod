TSICTestHarness.register({
    name: 'CheatMenu: God Mode button publishes Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd]'));
        ctx.clearPublishes();
        const god = Array.from(ctx.doc.querySelectorAll('button[data-cmd]')).find(b => /god/i.test(b.textContent || ''));
        god && god.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => /God/i.test(p.Command || '') }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: GiveItem composes command from inputs',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('cm-give'));
        ctx.doc.getElementById('cm-item-id').value = 'ID_Bread';
        ctx.doc.getElementById('cm-item-count').value = '3';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-give').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'GiveItem ID_Bread 3' }));
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
