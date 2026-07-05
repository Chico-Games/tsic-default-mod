// Functional coverage for the gameplay behavior bar (shared/hud-behavior-bar.js),
// hosted by /screens/test-behavior-bar.html. Screen-based visibility and the menu
// bar (#bb-menu) lived only in the deleted screens/action-bar.html; the live
// component hides its shell (#bb-shell-gameplay) when nothing is visible and is
// not screen-gated.
TSICTestHarness.register({
    name: 'BehaviorBar: bVisible=false entry is skipped',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [
                { BehaviorTagName: 'IA_A', DisplayName: 'A', bVisible: true,  StatusInt: 0 },
                { BehaviorTagName: 'IA_B', DisplayName: 'B', bVisible: false, StatusInt: 0 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length === 1);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#bb-gameplay .bb-row', 1));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: empty payload hides the gameplay group',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_A', DisplayName: 'A', bVisible: true, StatusInt: 0 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row'));
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [] });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#bb-shell-gameplay'));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: cooldown sweep appears for partial cooldowns only',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [
                { BehaviorTagName: 'IA_A', DisplayName: 'A', bVisible: true, StatusInt: 0, CooldownPercent: 0.0, KeyboardIconUrl: '/icons/keyboard/a.svg' },
                { BehaviorTagName: 'IA_B', DisplayName: 'B', bVisible: true, StatusInt: 0, CooldownPercent: 0.4, KeyboardIconUrl: '/icons/keyboard/b.svg' },
                { BehaviorTagName: 'IA_C', DisplayName: 'C', bVisible: true, StatusInt: 0, CooldownPercent: 1.0, KeyboardIconUrl: '/icons/keyboard/c.svg' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length === 3);
        // Only the middle row (0 < pct < 1) has the sweep div.
        const sweeps = ctx.doc.querySelectorAll('#bb-gameplay .bb-cd-sweep');
        ctx.expect(ctx.assert.eq(sweeps.length, 1));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: sub-text truncates beyond ~30 chars',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        const long = 'A'.repeat(60);
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'Use', SubText: long, bVisible: true, StatusInt: 0 }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-sub'));
        const sub = ctx.doc.querySelector('#bb-gameplay .bb-sub').textContent;
        ctx.expect(ctx.assert.truthy(sub.length <= 30, `expected truncation, got ${sub.length} chars`));
    },
});

TSICTestHarness.register({
    // Wire contract (BehaviorBarStatusToWire, mirrored by STATUS[] in hud-behavior-bar.js):
    // 0 available, 1 blocked, 2 cooldown, 3 single-use-used. Blocked rows are hidden, so
    // StatusInt 1 must not render while the others map to their colour class.
    name: 'BehaviorBar: status colour classes mapped from StatusInt (blocked hidden)',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [
                { BehaviorTagName: 'IA_A', DisplayName: 'A', bVisible: true, StatusInt: 0 },
                { BehaviorTagName: 'IA_B', DisplayName: 'B', bVisible: true, StatusInt: 1 },
                { BehaviorTagName: 'IA_C', DisplayName: 'C', bVisible: true, StatusInt: 2 },
                { BehaviorTagName: 'IA_D', DisplayName: 'D', bVisible: true, StatusInt: 3 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length === 3);
        const rows = ctx.doc.querySelectorAll('#bb-gameplay .bb-row');
        ctx.expect(ctx.assert.eq(rows[0].dataset.status, 'available'));
        ctx.expect(ctx.assert.eq(rows[1].dataset.status, 'cooldown'));
        ctx.expect(ctx.assert.eq(rows[2].dataset.status, 'single-use-used'));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="blocked"]'),
            'StatusInt 1 (blocked) must be hidden'));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: entry renders its DisplayName',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{ BehaviorTagName: 'IA_Sprint', DisplayName: 'Sprint', bVisible: true, StatusInt: 0 }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-name'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#bb-gameplay .bb-name').textContent, 'Sprint'));
    },
});
