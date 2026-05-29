// Functional coverage for the gameplay action bar (shared/hud-action-bar.js),
// hosted by /screens/test-action-bar.html. Screen-based visibility and the menu
// bar (#ab-menu) lived only in the deleted screens/action-bar.html; the live
// component hides its shell (#ab-shell-gameplay) when nothing is visible and is
// not screen-gated.
TSICTestHarness.register({
    name: 'ActionBar: bVisible=false slot is skipped',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_A', AbilityName: 'A', bVisible: true,  StatusInt: 0 },
                { InputName: 'IA_B', AbilityName: 'B', bVisible: false, StatusInt: 0 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-gameplay .ab-row').length === 1);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#ab-gameplay .ab-row', 1));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: empty payload hides the gameplay group',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', { Slots: [{ InputName: 'IA_A', AbilityName: 'A', bVisible: true, StatusInt: 0 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#ab-gameplay .ab-row'));
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', { Slots: [] });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#ab-shell-gameplay'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: cooldown sweep appears for partial cooldowns only',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_A', AbilityName: 'A', bVisible: true, StatusInt: 0, CooldownPercent: 0.0, KeyboardIconUrl: '/icons/keyboard/a.svg' },
                { InputName: 'IA_B', AbilityName: 'B', bVisible: true, StatusInt: 0, CooldownPercent: 0.4, KeyboardIconUrl: '/icons/keyboard/b.svg' },
                { InputName: 'IA_C', AbilityName: 'C', bVisible: true, StatusInt: 0, CooldownPercent: 1.0, KeyboardIconUrl: '/icons/keyboard/c.svg' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-gameplay .ab-row').length === 3);
        // Only the middle row (0 < pct < 1) has the sweep div.
        const sweeps = ctx.doc.querySelectorAll('#ab-gameplay .ab-cd-sweep');
        ctx.expect(ctx.assert.eq(sweeps.length, 1));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: sub-text truncates beyond ~30 chars',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        const long = 'A'.repeat(60);
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [{ InputName: 'IA_X', AbilityName: 'Use', SubText: long, bVisible: true, StatusInt: 0 }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ab-gameplay .ab-sub'));
        const sub = ctx.doc.querySelector('#ab-gameplay .ab-sub').textContent;
        ctx.expect(ctx.assert.truthy(sub.length <= 30, `expected truncation, got ${sub.length} chars`));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: status colour classes mapped from StatusInt 0..3',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_A', AbilityName: 'A', bVisible: true, StatusInt: 0 },
                { InputName: 'IA_B', AbilityName: 'B', bVisible: true, StatusInt: 1 },
                { InputName: 'IA_C', AbilityName: 'C', bVisible: true, StatusInt: 2 },
                { InputName: 'IA_D', AbilityName: 'D', bVisible: true, StatusInt: 3 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-gameplay .ab-row').length === 4);
        const rows = ctx.doc.querySelectorAll('#ab-gameplay .ab-row');
        ctx.expect(ctx.assert.eq(rows[0].dataset.status, 'available'));
        ctx.expect(ctx.assert.eq(rows[1].dataset.status, 'blocked'));
        ctx.expect(ctx.assert.eq(rows[2].dataset.status, 'cooldown'));
        ctx.expect(ctx.assert.eq(rows[3].dataset.status, 'single-use-used'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: name falls back to bracketed InputName (IA_ stripped)',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [{ InputName: 'IA_Sprint', bVisible: true, StatusInt: 0 }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ab-gameplay .ab-name'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#ab-gameplay .ab-name').textContent, 'Sprint'));
    },
});
