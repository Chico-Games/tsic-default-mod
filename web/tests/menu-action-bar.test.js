// Menu behavior bar (System B) — shared/hud-menu-action-bar.js.
//
// Every menu already published its action context and C++ already resolved the key
// icons; nothing rendered UI.BehaviorBar.MenuContext, so no menu ever showed its
// controls. These cover the three things that regression would look like: rows not
// drawn at all, rows drawn in the wrong order, and the bar failing to go away when
// the context clears.
//
// Runs against the real shell, because the bar is loaded by hud.js.

TSICTestHarness.register({
    name: 'MenuActionBar: renders a row per entry with its label',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.MenuContext', {
            Entries: [
                { ActionName: 'IA_UI_ConfirmAccept', Label: 'Equip', Priority: 10, KeyboardKeyText: 'E' },
                { ActionName: 'IA_UI_CancelBack', Label: 'Back', Priority: 1000, KeyboardKeyText: 'Esc' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-menu .bb-menu-row').length === 2);
        const labels = Array.from(ctx.doc.querySelectorAll('#bb-menu .bb-menu-name'))
            .map(n => n.textContent);
        ctx.expect(ctx.assert.truthy(labels.indexOf('Equip') >= 0, 'expected an Equip row'));
        ctx.expect(ctx.assert.truthy(labels.indexOf('Back') >= 0, 'expected a Back row'));
    },
});

TSICTestHarness.register({
    name: 'MenuActionBar: lower Priority renders first',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Deliberately published out of order — the bar sorts, the publisher does not have to.
        ctx.inject('tsic.msg.UI.BehaviorBar.MenuContext', {
            Entries: [
                { ActionName: 'IA_UI_CancelBack', Label: 'Back', Priority: 1000, KeyboardKeyText: 'Esc' },
                { ActionName: 'IA_UI_DropItem', Label: 'Drop', Priority: 30, KeyboardKeyText: 'Q' },
                { ActionName: 'IA_UI_ConfirmAccept', Label: 'Equip', Priority: 10, KeyboardKeyText: 'E' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-menu .bb-menu-row').length === 3);
        const labels = Array.from(ctx.doc.querySelectorAll('#bb-menu .bb-menu-name'))
            .map(n => n.textContent).join(',');
        ctx.expect(ctx.assert.truthy(labels === 'Equip,Drop,Back',
            'expected Equip,Drop,Back in priority order, got ' + labels));
    },
});

TSICTestHarness.register({
    name: 'MenuActionBar: an empty context hides the bar',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.MenuContext', {
            Entries: [{ ActionName: 'IA_UI_ConfirmAccept', Label: 'Equip', Priority: 10 }],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-menu .bb-menu-row').length === 1);
        // Leaving a screen publishes an empty list (router.js / screen-manager.js both do).
        ctx.inject('tsic.msg.UI.BehaviorBar.MenuContext', { Entries: [] });
        await ctx.waitFor(() =>
            ctx.doc.getElementById('bb-shell-menu').classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.getElementById('bb-shell-menu').classList.contains('hidden'),
            'expected the menu bar to hide once the context cleared'));
    },
});

TSICTestHarness.register({
    name: 'MenuActionBar: an unbound action still names itself',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Nothing bound and nothing resolvable. The gameplay bar drops a row it cannot
        // put a key chip on; a menu row IS the hint, so it has to survive with the label
        // alone rather than vanishing and leaving the action invisible.
        ctx.inject('tsic.msg.UI.BehaviorBar.MenuContext', {
            Entries: [{ ActionName: 'IA_UI_TakeAll', Label: 'Take All', Priority: 20,
                        KeyboardKeyText: '', KeyboardIconUrl: '' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-menu .bb-menu-row'));
        const row = ctx.doc.querySelector('#bb-menu .bb-menu-row');
        ctx.expect(ctx.assert.truthy(/Take All/.test(row.textContent),
            'expected the label to render with no binding, got ' + JSON.stringify(row.textContent)));
        ctx.expect(ctx.assert.truthy(!!row.querySelector('.bb-menu-key'),
            'expected the key cell to exist (empty) so rows stay aligned'));
    },
});
