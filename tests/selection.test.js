TSICTestHarness.register({
    name: 'Selection: renders options + click publishes Choose',
    file: '/screens/selection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', {
            Context: 'Generic', Title: 'Pick one',
            Options: [
                { OptionId: 'a', Label: 'Alpha', bDisabled: false },
                { OptionId: 'b', Label: 'Bravo', bDisabled: true  },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const alpha = Array.from(ctx.doc.querySelectorAll('button, .opt')).find(e => /Alpha/.test(e.textContent || ''));
        ctx.expect(ctx.assert.truthy(alpha));
        ctx.clearPublishes();
        alpha && alpha.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Selection.Choose', { where: p => p.OptionId === 'a' }));
    },
});

TSICTestHarness.register({
    name: 'Cage: only renders when Context=Cage',
    file: '/screens/cage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', {
            Context: 'Generic', Options: [{ OptionId: 'x', Label: 'Should-not-render' }],
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.doc.body.textContent.indexOf('Should-not-render'), -1));
        ctx.inject('tsic.msg.UI.Selection.Opened', {
            Context: 'Cage', Options: [{ OptionId: 'y', Label: 'Cage-Option' }],
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Cage-Option') >= 0));
    },
});
