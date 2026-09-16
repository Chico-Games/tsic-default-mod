TSICTestHarness.register({
    name: 'PauseMenu: renders player list',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Players.List', {
            Players: [
                { Id: '1', Name: 'Host',  bIsHost: true  },
                { Id: '2', Name: 'Guest', bIsHost: false },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Host')  >= 0));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Guest') >= 0));
    },
});

// The live module (shared/screens/pause-menu.js) mounted in the real in-game
// shell — /screens/pause-menu.html is a standalone mirror, not what ships.
TSICTestHarness.register({
    name: 'PauseMenu: Save and Quit publishes Menu.Exit',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('PauseMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="PauseMenu"] button'));
        ctx.clearPublishes();
        const quit = Array.from(ctx.doc.querySelectorAll('[data-screen="PauseMenu"] button'))
            .find(b => /save and quit/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(quit, 'pause menu has a Save and Quit button'));
        quit && quit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Exit'));
    },
});

TSICTestHarness.register({
    name: 'PauseMenu: Resume button publishes Pause.Resume',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const resume = Array.from(ctx.doc.querySelectorAll('button')).find(b => /resume/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(resume));
        resume && resume.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

// The live roster rides UI.Multiplayer.State and joins onto UI.Players.List by id: badges,
// health, distance and the day clock, with "unknown" rather than zeros when a teammate's
// pawn is not relevant here.
TSICTestHarness.register({
    name: 'PauseMenu: roster merges live health, distance and day',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('PauseMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="PauseMenu"] #players'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Ziggy',  Color: '#FF0000', bIsHost: true  },
            { Id: 'b', Name: 'Friend', Color: '#00FF00', bIsHost: false },
            { Id: 'c', Name: 'Far',    Color: '#0000FF', bIsHost: false },
        ] });
        ctx.inject('tsic.msg.UI.Multiplayer.State', {
            bLocalIsHost: true, bCanInvite: true, Day: 3, DaySection: 'Time.DaySection.Night',
            Players: [
                { Id: 'a', bIsLocal: true, bIsHost: true, bHasPawn: true, Health: 100, MaxHealth: 100, HealthPct: 1 },
                { Id: 'b', bHasPawn: true, bIsDead: true, Health: 0, MaxHealth: 100, HealthPct: 0, DistanceM: 12.4, BearingDeg: 90 },
                { Id: 'c', bHasPawn: false },
            ],
        });
        const panel = await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="PauseMenu"] .pl-row[data-player="b"]'));
        const text = ctx.doc.querySelector('[data-screen="PauseMenu"] #mp').textContent;
        ctx.expect(ctx.assert.truthy(panel, 'friend row rendered'));
        ctx.expect(ctx.assert.truthy(text.indexOf('Day 3') >= 0, 'day shown'));
        ctx.expect(ctx.assert.truthy(text.indexOf('You') >= 0, 'local badge shown'));
        ctx.expect(ctx.assert.truthy(text.indexOf('Down') >= 0, 'dead badge shown'));
        ctx.expect(ctx.assert.truthy(text.indexOf('12 m') >= 0, 'distance shown'));
        ctx.expect(ctx.assert.truthy(text.indexOf('Out of range') >= 0, 'unknown pawn says so'));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelectorAll('[data-screen="PauseMenu"] .pl-kick').length === 2, 'host sees kick on both guests'));
    },
});
