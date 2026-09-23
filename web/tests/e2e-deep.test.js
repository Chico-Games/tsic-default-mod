// Deeper end-to-end flows: state changes seen across multiple sequential
// payloads on one page (server "acks" → page rerenders → user reacts again).

// (Removed: 'E2E/ActionBar: rapid screen flips keep the right group visible'.
//  That tested screen-based gameplay/menu-group toggling and the #bb-menu bar,
//  which only existed in the deleted screens/action-bar.html. The live
//  gameplay bar (hud-action-bar.js) is not screen-gated, and the menu action
//  bar is not yet wired into the shell — tracked as a separate follow-up.)

// ---- Save/Load → Load slot ----------------------------------------
TSICTestHarness.register({
    name: 'E2E/SaveLoad: every slot Load button publishes with its SlotId',
    file: '/screens/save-load.html',
    async run(ctx) {
        const slots = Array.from({ length: 4 }, (_, i) => ({ SlotId: 'slot' + i, Label: 'S' + i, TimestampIso: '2026-05-18T00:00:00Z' }));
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: slots });
        await new Promise(r => setTimeout(r, 60));
        const buttons = Array.from(ctx.doc.querySelectorAll('#slots .save-slot'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 4));
        ctx.clearPublishes();
        for (const b of buttons.slice(0, 4)) b.click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Menu.LoadSlot');
        ctx.expect(ctx.assert.eq(pubs.length, 4));
    },
});

// ---- ActionBar: hash-quality changes redraw rows -----------------------
TSICTestHarness.register({
    name: 'E2E/ActionBar: re-broadcast with new status redraws rows',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="available"]'));
        // Status 1 (blocked) rows are HIDDEN from the bar entirely; status 2
        // (cooldown) stays visible with its own status stamp.
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 1 }] });
        await ctx.waitFor(() => !ctx.doc.querySelector('#bb-gameplay .bb-row'));
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 2, CooldownPct: 0.5 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="cooldown"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#bb-gameplay .bb-row[data-status="cooldown"]'));
    },
});

// ---- Notifications: subsequent pushes append to the stack -------------
TSICTestHarness.register({
    name: 'E2E/Notifications: rapid pushes shown in column-reverse order (newest on top)',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'first',  Text: '', Type: 'Tip' });
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'second', Text: '', Type: 'Tip' });
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'third',  Text: '', Type: 'Tip' });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.notif').length === 3);
        const titles = Array.from(ctx.doc.querySelectorAll('.notif-title')).map(e => e.textContent);
        // Stack order in DOM is insertion order; CSS does flex-direction:
        // column-reverse so visual top is the newest.
        ctx.expect(ctx.assert.eq(titles, ['first','second','third']));
    },
});
