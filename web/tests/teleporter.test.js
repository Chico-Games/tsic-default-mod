TSICTestHarness.register({
    name: 'Teleporter: renders destinations',
    file: '/screens/teleporter.html?fromId=1',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Teleporter.Destinations', {
            Destinations: [
                { EntityId: 2, Label: 'Lab', Cooldown: 0 },
                { EntityId: 3, Label: 'Pit', Cooldown: 30 },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Lab') >= 0));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Pit') >= 0));
    },
});

TSICTestHarness.register({
    name: 'Teleporter: clicking destination publishes Travel',
    file: '/screens/teleporter.html?fromId=1',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Teleporter.Destinations', { Destinations: [{ EntityId: 2, Label: 'Lab', Cooldown: 0 }] });
        await new Promise(r => setTimeout(r, 80));
        const row = Array.from(ctx.doc.querySelectorAll('button')).find(b => /Lab/.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(row));
        ctx.clearPublishes();
        row && row.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Teleporter.Travel', { where: p => p.ToId === 2 }));
    },
});

TSICTestHarness.register({
    name: 'Teleporter: rename publishes Teleporter.Rename',
    file: '/screens/teleporter.html?fromId=1',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('rename-input'));
        const input = ctx.doc.getElementById('rename-input');
        input.value = 'Hub';
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-rename').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Teleporter.Rename', { where: p => p.NewName === 'Hub' && p.EntityId === 1 }));
    },
});
