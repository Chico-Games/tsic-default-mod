TSICTestHarness.register({
    name: 'UniversalStorageSetup: renders existing groups',
    file: '/screens/universal-storage-setup.html?entityId=42',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: ['Vault', 'Garage'] });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Vault')  >= 0));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Garage') >= 0));
    },
});

TSICTestHarness.register({
    name: 'UniversalStorageSetup: clicking Bind publishes LinkGroup',
    file: '/screens/universal-storage-setup.html?entityId=42',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: ['Vault'] });
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        const bind = Array.from(ctx.doc.querySelectorAll('button')).find(b => /bind/i.test(b.textContent || ''));
        bind && bind.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.UniversalStorage.LinkGroup',
            { where: p => p.GroupName === 'Vault' && p.EntityId === 42 }));
    },
});

TSICTestHarness.register({
    name: 'UniversalStorageSetup: empty list shows the empty hint',
    file: '/screens/universal-storage-setup.html?entityId=42',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: [] });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domText(ctx.doc, '#uss-empty', /No groups yet/));
    },
});
