// Functional coverage for the gameplay + menu action bar visibility / rendering.
TSICTestHarness.register({
    name: 'ActionBar/Visibility: every menu screen hides the gameplay group',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', { Slots: [{ InputName: 'IA_X', AbilityName: 'X', bVisible: true, StatusInt: 0 }] });
        const MENU = ['Inventory','Storage','Crafting','Production','Upgrade','Teleporter','BossSummoner','UniversalStorage','Construction','Map','Settings','PauseMenu','SaveLoad','Mods','Credits','NewStore'];
        for (const s of MENU) {
            ctx.screen(s);
            await new Promise(r => setTimeout(r, 30));
            const hidden = ctx.doc.getElementById('ab-gameplay').classList.contains('hidden');
            ctx.expect(ctx.assert.truthy(hidden, `expected #ab-gameplay hidden on screen=${s}`));
        }
    },
});

TSICTestHarness.register({
    name: 'ActionBar/Visibility: non-menu screen shows the gameplay group',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', { Slots: [{ InputName: 'IA_X', AbilityName: 'X', bVisible: true, StatusInt: 0 }] });
        for (const s of ['InGame','Hotbar','Equipment','HealthBar','Notifications','Ping','Detection','Crosshair']) {
            ctx.screen(s);
            await new Promise(r => setTimeout(r, 20));
            ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('ab-gameplay').classList.contains('hidden'),
                `expected #ab-gameplay visible on screen=${s}`));
        }
    },
});

TSICTestHarness.register({
    name: 'ActionBar: bVisible=false slot is skipped',
    file: '/screens/action-bar.html',
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
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', { Slots: [] });
        ctx.screen('InGame');
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('ab-gameplay').classList.contains('hidden'),
            'expected #ab-gameplay hidden when slots are empty'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: cooldown sweep appears for partial cooldowns only',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_A', AbilityName: 'A', bVisible: true, StatusInt: 0, CooldownPercent: 0.0 },
                { InputName: 'IA_B', AbilityName: 'B', bVisible: true, StatusInt: 0, CooldownPercent: 0.4 },
                { InputName: 'IA_C', AbilityName: 'C', bVisible: true, StatusInt: 0, CooldownPercent: 1.0 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-gameplay .ab-row').length === 3);
        // Only the middle row has the sweep div.
        const sweeps = ctx.doc.querySelectorAll('#ab-gameplay .ab-cd-sweep');
        ctx.expect(ctx.assert.eq(sweeps.length, 1));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: sub-text truncates beyond ~30 chars',
    file: '/screens/action-bar.html',
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
    file: '/screens/action-bar.html',
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
    name: 'ActionBar: bracketed name fallback strips IA_UI_ prefix in menu group',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.MenuContext', {
            Entries: [{ ActionName: 'IA_UI_SomeAction', Label: '', Priority: 10 }],
        });
        ctx.screen('Crafting');
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-menu .ab-row').length >= 1);
        const txt = ctx.doc.querySelector('#ab-menu .ab-name').textContent;
        ctx.expect(ctx.assert.eq(txt, 'SomeAction'));
    },
});
