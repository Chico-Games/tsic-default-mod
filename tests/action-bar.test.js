TSICTestHarness.register({
    name: 'ActionBar: gameplay rows render with key fallback',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_Interact', AbilityName: 'Open Storage', SubText: '3 items', StatusInt: 0, bVisible: true, CooldownPercent: 0 },
                { InputName: 'IA_Flashlight', AbilityName: 'Flashlight',   StatusInt: 0, bVisible: true, CooldownPercent: 0 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#ab-gameplay .ab-row').length >= 2);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#ab-gameplay .ab-row', 2));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: blocked rows get blocked status colour',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [
                { InputName: 'IA_Interact', AbilityName: 'Hack Door', StatusInt: 1, bVisible: true },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ab-gameplay .ab-row[data-status="blocked"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ab-gameplay .ab-row[data-status="blocked"]'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: gameplay group hides on menu screen, menu group shows',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [{ InputName: 'IA_Interact', AbilityName: 'Interact', StatusInt: 0, bVisible: true }],
        });
        ctx.inject('tsic.msg.UI.ActionBar.MenuContext', {
            Entries: [{ ActionName: 'IA_UI_ConfirmAccept', Label: 'Craft', Priority: 10 }],
        });
        ctx.screen('Crafting');
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#ab-gameplay'));
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#ab-menu'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: menu group hides during gameplay',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [{ InputName: 'IA_Interact', AbilityName: 'Interact', StatusInt: 0, bVisible: true }],
        });
        ctx.screen('InGame');
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#ab-gameplay'));
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#ab-menu'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: gamepad mode swaps icon family',
    file: '/screens/action-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', {
            Slots: [{
                InputName: 'IA_Interact', AbilityName: 'Interact', StatusInt: 0, bVisible: true,
                KeyboardIconUrl: '/icons/keyboard/e.svg',
                GamepadIconUrl:  '/icons/gamepad/face-bottom.svg',
            }],
        });
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 60));
        const img = ctx.doc.querySelector('#ab-gameplay .ab-row .ab-key img');
        ctx.expect(ctx.assert.truthy(img));
        ctx.expect(ctx.assert.truthy(img && img.src.indexOf('/icons/gamepad/') > 0, 'expected gamepad glyph URL'));
    },
});
