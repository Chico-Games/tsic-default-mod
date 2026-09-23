// Mouse-interaction coverage: every clickable element on every page.

// ---- Pause menu: every button -----------------------------------------
TSICTestHarness.register({
    name: 'Mouse/PauseMenu: Resume/Settings/Quit each publish a different command',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        const map = [
            [/resume/i, 'UI.Cmd.Pause.Resume'],
            [/settings/i, 'UI.Cmd.Pause.Settings'],
            [/quit|return to main menu/i, 'UI.Cmd.Pause.QuitToMenu'],
        ];
        for (const [rx, channel] of map) {
            ctx.clearPublishes();
            const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => rx.test(b.textContent || ''));
            ctx.expect(ctx.assert.truthy(btn, `expected a button matching ${rx}`));
            btn && btn.click();
            ctx.expect(ctx.assert.published(ctx.handle, channel));
        }
    },
});

// ---- MainMenu: every button -----------------------------------------
TSICTestHarness.register({
    name: 'Mouse/MainMenu: every button publishes the right command',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        const cases = [
            [/start|new/i, 'UI.Cmd.Menu.Navigate'],
            [/load|save/i, 'UI.Cmd.Menu.Navigate'],
            [/mods/i,      'UI.Cmd.Menu.Navigate'],
            [/settings/i,  'UI.Cmd.Menu.Navigate'],
            [/credits/i,   'UI.Cmd.Menu.Navigate'],
            [/exit|quit/i, 'UI.Cmd.Menu.Exit'],
        ];
        for (const [rx, expected] of cases) {
            const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => rx.test(b.textContent || ''));
            if (!btn) continue;
            ctx.clearPublishes();
            btn.click();
            ctx.expect(ctx.assert.published(ctx.handle, expected, { where: () => true }));
        }
    },
});

// ---- Interaction prompt is display-only --------------------------------
TSICTestHarness.register({
    name: 'Mouse/Interaction: prompt is display-only — clicks do not publish',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [
            { EntityId: 11, Label: 'Open' },
            { EntityId: 12, Label: 'Inspect' },
        ]});
        await ctx.waitFor(() => /Open/.test(ctx.doc.getElementById('interaction-prompt').textContent));
        ctx.clearPublishes();
        ctx.doc.getElementById('interaction-prompt').click();
        // Activation goes through Enhanced Input (the interact ability), not UI.
        const pubs = ctx.publishes().filter(p => p.channel.indexOf('UI.Cmd.Interaction.') === 0);
        ctx.expect(ctx.assert.eq(pubs.length, 0, 'prompt is display-only — clicks should not publish'));
    },
});

// ---- Save/Load: each slot's Load button -------------------------------
TSICTestHarness.register({
    name: 'Mouse/SaveLoad: each slot publishes LoadSlot with its SlotId',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: [
            { SlotId: 's1', Label: 'A', TimestampIso: '2026-05-18T00:00:00Z' },
            { SlotId: 's2', Label: 'B', TimestampIso: '2026-05-17T00:00:00Z' },
        ]});
        await new Promise(r => setTimeout(r, 80));
        const buttons = Array.from(ctx.doc.querySelectorAll('#slots .save-slot'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 2));
        ctx.clearPublishes();
        for (const b of buttons) b.click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Menu.LoadSlot');
        ctx.expect(ctx.assert.eq(pubs.length, buttons.length));
        // Both slot ids should appear.
        const ids = pubs.map(p => p.payload.SlotId).sort();
        ctx.expect(ctx.assert.eq(ids.includes('s1') && ids.includes('s2'), true));
    },
});

// ---- Hotbar: clicking every visible slot fires Select with its index --
TSICTestHarness.register({
    name: 'Mouse/Hotbar: clicking every slot publishes Select with the right index',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Hotbar.Changed', {
            NumSlots: 4, SelectedSlot: 0, SelectedSlotPending: -1, Hooks: [
                { ItemId: 'ID_Axe', Count: 1, LoadedAmmo: -1, SpareAmmo: 0, SlotIndex: 0 },
                { ItemId: 'ID_Bread', Count: 2, LoadedAmmo: -1, SpareAmmo: 0, SlotIndex: 1 },
                { ItemId: '', Count: 0, LoadedAmmo: -1, SpareAmmo: 0, SlotIndex: 2 },
                { ItemId: 'ID_Nail', Count: 3, LoadedAmmo: -1, SpareAmmo: 0, SlotIndex: 3 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-hotbar #hotbar-row .tsic-slot').length === 4);
        ctx.clearPublishes();
        const slots = ctx.doc.querySelectorAll('#hud-hotbar #hotbar-row .tsic-slot');
        for (let i = 0; i < slots.length; i++) slots[i].click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Hotbar.Select');
        // Bare hooks are selectable too — selecting one is how you end up bare-handed.
        ctx.expect(ctx.assert.eq(pubs.length, 4));
        ctx.expect(ctx.assert.truthy(pubs.every((p, i) => p.payload.SlotIndex === i)));
    },
});
