// Unit tests for shared/behavior-bar.js (tsic.setMenuActionContext / clear).
TSICTestHarness.register({
    name: 'Unit/BehaviorBarJs: setMenuActionContext routes through publishMenuContext',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.expect(ctx.assert.truthy(typeof ctx.win.tsic.setMenuActionContext === 'function'));
        ctx.clearPublishes();
        ctx.win.tsic.setMenuActionContext([
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Use', Priority: 10 },
        ]);
        // setMenuActionContext goes through __tsicPublishMenuActionContext which
        // auto-appends the Back entry.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BehaviorBar.SetMenuContext', {
            where: p => p.Entries.find(e => e.ActionName === 'IA_UI_CancelBack')
                     && p.Entries.find(e => e.Label === 'Use'),
        }));
    },
});

TSICTestHarness.register({
    name: 'Unit/BehaviorBarJs: clearMenuActionContext sends empty array (just auto-Back)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.win.tsic.clearMenuActionContext();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BehaviorBar.SetMenuContext', {
            where: p => p.Entries.length === 1 && p.Entries[0].ActionName === 'IA_UI_CancelBack',
        }));
    },
});

TSICTestHarness.register({
    name: 'Unit/BehaviorBarJs: setMenuActionContext sanitises malformed entries',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.win.tsic.setMenuActionContext([
            { Label: 'no-action' },                      // missing ActionName -> dropped
            { ActionName: 'IA_OK' },                     // missing Label / Priority -> defaulted
            { ActionName: 'IA_PRI', Label: 'x', Priority: 'not-a-number' },  // bad priority -> defaulted to 100
        ]);
        const last = ctx.publishes().slice(-1)[0];
        const okEntries = last.payload.Entries.filter(e => e.ActionName !== 'IA_UI_CancelBack');
        ctx.expect(ctx.assert.eq(okEntries.length, 2));
        const ok = okEntries.find(e => e.ActionName === 'IA_OK');
        ctx.expect(ctx.assert.eq(ok.Priority, 100));
        const pri = okEntries.find(e => e.ActionName === 'IA_PRI');
        ctx.expect(ctx.assert.eq(pri.Priority, 100));
    },
});

TSICTestHarness.register({
    name: 'Unit/BehaviorBarJs: passing a non-array yields auto-Back only',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.win.tsic.setMenuActionContext('not-an-array');
        const last = ctx.publishes().slice(-1)[0];
        ctx.expect(ctx.assert.eq(last.payload.Entries.length, 1));
        ctx.expect(ctx.assert.eq(last.payload.Entries[0].ActionName, 'IA_UI_CancelBack'));
    },
});
