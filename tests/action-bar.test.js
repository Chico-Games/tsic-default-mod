// Gameplay action-bar tests, run against the LIVE component (shared/hud-action-bar.js)
// hosted by /screens/test-action-bar.html. The old menu-bar (#ab-menu) tests were
// removed when the dead screens/action-bar.html was deleted — the menu action bar is
// not yet wired into the live shell (tracked as a separate follow-up).

TSICTestHarness.register({
    name: 'ActionBar: gameplay rows render',
    file: '/screens/test-action-bar.html',
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
    file: '/screens/test-action-bar.html',
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
    // Spamming crouch toggles StatusInt every poll, which legitimately re-broadcasts
    // the slot list. A full innerHTML rebuild recreates the <img>, and CEF shows a
    // blank frame while it re-decodes — that is the flash. The key icon <img> must be
    // reused across a status-only change. render() runs synchronously inside the inject
    // handler, so capture the nodes back-to-back (jsdom can't decode SVGs and fires
    // img.onerror on the next tick, which would tear the node down; CEF keeps it).
    name: 'ActionBar: status change reuses key icon img node (no flash on spam)',
    file: '/screens/test-action-bar.html',
    async run(ctx) {
        const payload = (st) => ({ Slots: [
            { InputName: 'IA_Crouch', AbilityName: 'Crouch', bVisible: true, StatusInt: st,
              KeyboardIconUrl: '/icons/keyboard/c.svg' },
        ]});
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', payload(0));
        const first = ctx.doc.querySelector('#ab-gameplay .ab-row .ab-key img');
        ctx.expect(ctx.assert.truthy(first, 'expected a key icon img after first render'));
        // Crouch press: Available -> Blocked, same icon URL.
        ctx.inject('tsic.msg.UI.ActionBar.Abilities', payload(1));
        const second = ctx.doc.querySelector('#ab-gameplay .ab-row .ab-key img');
        ctx.expect(ctx.assert.truthy(second === first,
            'key icon <img> should be reused across a status-only change, not recreated (recreation flashes)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ab-gameplay .ab-row[data-status="blocked"]'));
    },
});

TSICTestHarness.register({
    name: 'ActionBar: gamepad mode swaps icon family',
    file: '/screens/test-action-bar.html',
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
