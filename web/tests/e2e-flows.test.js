// End-to-end-style flows. Each scenario chains multiple state changes on
// one page to exercise a realistic user path. Cross-page navigation isn't
// simulated here (each scenario reloads a single page); instead these
// scenarios drive multi-step interactions inside a single page.

// ---- Cheat menu: every preset has a data-cmd-tpl that publishes ---------
TSICTestHarness.register({
    name: 'E2E/CheatMenu: every data-cmd-tpl button publishes a Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl]'));
        const buttons = Array.from(ctx.doc.querySelectorAll('button[data-cmd-tpl]'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 6, `expected at least 6 preset buttons, got ${buttons.length}`));
        for (const b of buttons) {
            ctx.clearPublishes();
            b.click();
            const expected = b.getAttribute('data-cmd-tpl').replaceAll('{p}', '0').trim();
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
                { where: p => p.Command === expected }));
        }
    },
});

// ---- Map → place ping → ping markers flash ------------------------------

// ---- Map → R resets view ------------------------------------------------

// ---- Map → Esc closes -------------------------------------------------

// ---- ActionBar: live device-family swap ---------------------------------
TSICTestHarness.register({
    name: 'E2E/ActionBar: KBM-then-Gamepad swap re-renders icon family',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.mode('MouseAndKeyboard');
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0,
                      KeyboardIconUrl: '/icons/keyboard/e.svg', GamepadIconUrl: '/icons/gamepad/face-bottom.svg' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row .bb-key img'));
        ctx.expect(ctx.assert.truthy(/keyboard/.test(ctx.doc.querySelector('.bb-key img').src)));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(/gamepad/.test(ctx.doc.querySelector('.bb-key img').src)));
    },
});

// ---- Lore → arrow nav + close ---------------------------------------
TSICTestHarness.register({
    name: 'E2E/Lore: open paper → right twice → close → Pause.Resume',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [
                { Heading: 'A', Body: 'a', GroupTitle: '' },
                { Heading: 'B', Body: 'b', GroupTitle: '' },
                { Heading: 'C', Body: 'c', GroupTitle: '' },
            ],
            InitialIndex: 0,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'A');
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'C'));
        ctx.clearPublishes();
        ctx.doc.getElementById('lore-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Close'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});
