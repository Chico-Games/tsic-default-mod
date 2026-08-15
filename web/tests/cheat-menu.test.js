TSICTestHarness.register({
    name: 'CheatMenu: God Mode button publishes Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl]'));
        ctx.clearPublishes();
        const god = Array.from(ctx.doc.querySelectorAll('button[data-cmd-tpl]')).find(b => /god/i.test(b.textContent || ''));
        god && god.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => /^ScpGod\s+\d+$/.test(p.Command || '') }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: GiveItem composes command from catalog selection',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-give'));
        // Simulate the catalog arriving and pick the first item.
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            Items: [{ DisplayName: 'Bread', InternalName: '/Game/Items/ID_Bread', Description: '' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item').options.length > 0);
        ctx.doc.getElementById('cm-item-count').value = '3';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-give').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'GiveItem ID_Bread 3 0' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: SpawnFurniture uses catalog short-name',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-spawn-furn'));
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            FurnitureDefault: [{ DisplayName: 'Table', InternalName: '/Game/Furniture/FD_Table', Description: '' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-furn').options.length > 0);
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-spawn-furn').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'SpawnFurniture FD_Table' }));
    },
});


TSICTestHarness.register({
    name: 'CheatMenu: opening requests toggle state for the target player',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target'));
        // 0 is "me", resolved server-side to whoever sent the command. A client cannot
        // name itself any other way — it does not know its index in the player array.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.RequestState', { where: p => p.PlayerNum === 0 }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: the target list offers "Me" first and defaults to it',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host', bIsHost: true },
            { Id: 'b', Name: 'Friend', bIsHost: false },
        ]});
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target').options.length === 3);
        const sel = ctx.doc.getElementById('cm-target');
        ctx.expect(ctx.assert.eq(sel.options[0].value, '0'));
        ctx.expect(ctx.assert.eq(sel.options[0].textContent, 'Me'));
        // Selected, not merely present: the panel is open on clients too, and a literal
        // player 1 would send every cheat they run to the host instead.
        ctx.expect(ctx.assert.eq(sel.value, '0'));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: UI.Cheat.State lights the matching toggle only',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-state-key="bGod"]'));
        ctx.inject('tsic.msg.UI.Cheat.State', { PlayerNum: 1, bGod: true, bGhost: false, bFly: false });
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-state-key="bGod"]').classList.contains('cm-on'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('button[data-state-key="bGhost"]').classList.contains('cm-on'), false));
        // A key absent from the payload is unknown, not off.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('button[data-state-key="bKeepItems"]').classList.contains('cm-state-unknown'), true));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('button[data-state-key="bGod"]').classList.contains('cm-state-unknown'), false));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: the no-aggro toggle sends a bare Docile and reads back bDocile',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-state-key="bDocile"]'));
        const btn = ctx.doc.querySelector('button[data-state-key="bDocile"]');

        // NO player number. `Docile` takes an ENABLED flag (-1 = toggle), not a player, so a
        // "{p}" template would send "Docile 1" and the button could only ever turn it ON —
        // it would stop toggling the moment anything else set it.
        ctx.clearPublishes();
        btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', {
            where: p => p.Command === 'Docile',
        }));

        // The pill has no inversion, so it reports DOCILE, and the label has to agree with
        // that. Lit means enemies are not aggroing.
        ctx.inject('tsic.msg.UI.Cheat.State', { PlayerNum: 1, bDocile: true });
        await ctx.waitFor(() => btn.classList.contains('cm-on'));
        ctx.expect(ctx.assert.truthy(/no aggro|docile/i.test(btn.textContent || ''),
            'the label names the docile state the pill reports, got: ' + btn.textContent));

        ctx.inject('tsic.msg.UI.Cheat.State', { PlayerNum: 1, bDocile: false });
        await ctx.waitFor(() => !btn.classList.contains('cm-on'));
        ctx.expect(ctx.assert.eq(btn.classList.contains('cm-state-unknown'), false,
            'bDocile present in the payload is a known state'));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: UI.Cheat.Log renders command and output',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-log'));
        ctx.inject('tsic.msg.UI.Cheat.Log', { Command: 'Pos 1', Output: 'X=100 Y=200 Z=50\n' });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cm-log .cm-log-entry').length === 1);
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-log .cm-log-cmd', /> Pos 1/));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-log .cm-log-out', /X=100 Y=200 Z=50/));
        // A command that prints nothing still echoes, without an empty output row.
        ctx.inject('tsic.msg.UI.Cheat.Log', { Command: 'ScpGod 1', Output: '' });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cm-log .cm-log-entry').length === 2);
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#cm-log .cm-log-out').length, 1));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: changing target player re-requests state for that player',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host', bIsHost: true },
            { Id: 'b', Name: 'Friend', bIsHost: false },
        ]});
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target').options.length === 3);
        ctx.clearPublishes();
        const sel = ctx.doc.getElementById('cm-target');
        sel.value = '2';
        sel.dispatchEvent(new sel.ownerDocument.defaultView.Event('change'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.RequestState', { where: p => p.PlayerNum === 2 }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: teleports the chosen player TO the target player',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-tp-subject'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host',   bIsHost: true },
            { Id: 'b', Name: 'Friend', bIsHost: false },
            { Id: 'c', Name: 'Third',  bIsHost: false },
        ]});
        // Name player 1 as the destination explicitly — the panel now defaults to "Me",
        // which has no index to exclude from the subject list.
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target').options.length === 4);
        const dest = ctx.doc.getElementById('cm-target');
        dest.value = '1';
        dest.dispatchEvent(new dest.ownerDocument.defaultView.Event('change'));
        await ctx.waitFor(() => ctx.doc.getElementById('cm-tp-subject').options.length === 2);
        const subject = ctx.doc.getElementById('cm-tp-subject');
        subject.value = '3';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-tp-player').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'TeleportPlayer 3 1' }));
        // The destination is named on the button so the direction is unambiguous.
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-tp-player', /Teleport to Host/));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: the destination player is not offered as the one to move',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host',   bIsHost: true },
            { Id: 'b', Name: 'Friend', bIsHost: false },
        ]});
        // "Me" excludes nobody, so name player 1 as the destination first.
        const target = ctx.doc.getElementById('cm-target');
        await ctx.waitFor(() => target.options.length === 3);
        target.value = '1';
        target.dispatchEvent(new target.ownerDocument.defaultView.Event('change'));
        await ctx.waitFor(() => ctx.doc.getElementById('cm-tp-subject').options.length === 1);
        // Destination is player 1, so only player 2 can be moved.
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('cm-tp-subject').options[0].value, '2'));
        // Switch the destination to player 2 — now only player 1 can be moved.
        target.value = '2';
        target.dispatchEvent(new target.ownerDocument.defaultView.Event('change'));
        await ctx.waitFor(() => ctx.doc.getElementById('cm-tp-subject').options[0].value === '1');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('cm-tp-subject').options.length, 1));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-tp-player', /Teleport to Friend/));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: tabs swap which panel is visible',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('.cm-tab[data-tab="player"]'));
        // Every panel is in the DOM; exactly one is active at a time.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.cm-panel.is-active').length, 1));
        ctx.doc.querySelector('.cm-tab[data-tab="time"]').click();
        await ctx.waitFor(() => ctx.doc.querySelector('.cm-panel[data-panel="time"]').classList.contains('is-active'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.cm-panel.is-active').length, 1));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('.cm-panel[data-panel="player"]').classList.contains('is-active'), false));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('.cm-tab[data-tab="time"]').classList.contains('is-active'), true));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: multi-input command substitutes every {#id}',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-bulk-count'));
        ctx.doc.getElementById('cm-bulk-count').value = '7';
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-multi^="GiveAllFood"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'GiveAllFood 7 0' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: multi-input command reads the item picker via {i}',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item'));
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            Items: [{ DisplayName: 'Bread', InternalName: '/Mods/ID_Bread_CN', Description: '' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item').options.length > 0);
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-multi^="Eat"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'Eat ID_Bread_CN 0' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: a destructive command needs two clicks',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-danger^="ClearInventory"]'));
        const btn = ctx.doc.querySelector('button[data-cmd-danger^="ClearInventory"]');
        ctx.clearPublishes();
        btn.click();
        // First click only arms it — nothing crosses the bridge.
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Cheat.Execute').length, 0));
        ctx.expect(ctx.assert.eq(btn.classList.contains('cm-armed'), true));
        btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'ClearInventory 0' }));
        ctx.expect(ctx.assert.eq(btn.classList.contains('cm-armed'), false));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: clicking a section binds its cheats to F2-F5',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('.cm-section[data-keys="player/HEALTH"]'));
        // Nothing armed until you pick a section.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.cm-section.is-armed').length, 0));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-keys', /Click a section/));

        const health = ctx.doc.querySelector('.cm-section[data-keys="player/HEALTH"]');
        health.dispatchEvent(new health.ownerDocument.defaultView.Event('mousedown', { bubbles: true }));
        await ctx.waitFor(() => health.classList.contains('is-armed'));
        // Exactly one section owns the keys at a time.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.cm-section.is-armed').length, 1));
        // The bar names itself, not the section — the armed section is identified by
        // its own outline and "— F2-F5" caption.
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-keys', /Hotkeys/));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-keys', /F3.*Hurt/));

        // Arming another section moves the binding rather than adding to it.
        const modes = ctx.doc.querySelector('.cm-section[data-keys="player/MODES"]');
        modes.dispatchEvent(new modes.ownerDocument.defaultView.Event('mousedown', { bubbles: true }));
        await ctx.waitFor(() => modes.classList.contains('is-armed'));
        ctx.expect(ctx.assert.eq(health.classList.contains('is-armed'), false));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.cm-section.is-armed').length, 1));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: an F-key resolves panel state at press time, not bind time',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('.cm-section[data-keys="player/HEALTH"]'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host', bIsHost: true },
            { Id: 'b', Name: 'Friend', bIsHost: false },
        ]});
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target').options.length === 3);

        const health = ctx.doc.querySelector('.cm-section[data-keys="player/HEALTH"]');
        health.dispatchEvent(new health.ownerDocument.defaultView.Event('mousedown', { bubbles: true }));
        await ctx.waitFor(() => health.classList.contains('is-armed'));

        // Change BOTH the target player and the input AFTER arming.
        const target = ctx.doc.getElementById('cm-target');
        target.value = '2';
        target.dispatchEvent(new target.ownerDocument.defaultView.Event('change'));
        ctx.doc.getElementById('cm-hurt').value = '77';

        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.CheatSlot2', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'Hurt 77 2' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: an F-key with nothing armed publishes nothing',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-keys'));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.CheatSlot1', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Cheat.Execute').length, 0));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: an armed picker slot uses the current selection',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('.cm-tab[data-tab="enemies"]'));
        ctx.doc.querySelector('.cm-tab[data-tab="enemies"]').click();
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            Creatures: [
                { DisplayName: 'Janitor', InternalName: '/Game/Enemies/BP_Janitor.BP_Janitor_C' },
                { DisplayName: 'Mimic',   InternalName: '/Game/Enemies/BP_Mimic.BP_Mimic_C' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-creature').options.length === 2);
        const spawn = ctx.doc.querySelector('.cm-section[data-keys="enemies/SPAWN"]');
        spawn.dispatchEvent(new spawn.ownerDocument.defaultView.Event('mousedown', { bubbles: true }));
        await ctx.waitFor(() => spawn.classList.contains('is-armed'));
        // Pick the second creature after arming.
        ctx.doc.getElementById('cm-creature').selectedIndex = 1;
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.CheatSlot1', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'Spawn /Game/Enemies/BP_Mimic.BP_Mimic_C 0' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: the map picker button asks C++ to open the map',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-map-picker'));
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-map-picker').click();
        // C++ decides what "teleport mode" means, so JS only asks.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.MapPicker'));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: item sets, bot profiles and audio slots come from the catalogue',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item-set'));
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            ItemSets:    [{ DisplayName: 'Starter', InternalName: 'Starter' },
                          { DisplayName: 'Endgame', InternalName: 'Endgame' }],
            BotProfiles: [{ DisplayName: 'Wanderer', InternalName: 'Wanderer' }],
            AudioSlots:  [{ DisplayName: 'Enemy.Death.Generic', InternalName: 'Enemy.Death.Generic' },
                          { DisplayName: 'UI.Click', InternalName: 'UI.Click' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-item-set').options.length === 2);
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('cm-bot-profile').options.length, 1));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('cm-audio-slot').options.length, 2));

        // The picker feeds the command, so no typing is involved.
        ctx.doc.getElementById('cm-item-set').value = 'Endgame';
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl-input^="GivePlayerItemsSet"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'GivePlayerItemsSet Endgame 0' }));

        // The audio list is long enough in a real pack to need filtering.
        ctx.doc.getElementById('cm-audio-filter').value = 'click';
        ctx.doc.getElementById('cm-audio-filter').dispatchEvent(
            new ctx.win.Event('input', { bubbles: true }));
        await ctx.waitFor(() => ctx.doc.getElementById('cm-audio-slot').options.length === 1);
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-audio-readout', /1 \/ 2 slots/));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: an empty catalogue list says so rather than looking usable',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-bot-profile'));
        ctx.inject('tsic.msg.UI.Cheat.Catalog', { BotProfiles: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-bot-profile').options.length === 1);
        ctx.expect(ctx.assert.truthy(
            /no bot profiles/i.test(ctx.doc.getElementById('cm-bot-profile').options[0].textContent),
            'an empty list must name itself, got: ' + ctx.doc.getElementById('cm-bot-profile').options[0].textContent));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: search finds a command in another tab and jumps to it',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-search'));
        const box = ctx.doc.getElementById('cm-search');
        box.value = 'chunk info';
        box.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cm-search-results .cm-hit').length > 0);
        // A hit navigates; it must never run the cheat itself.
        ctx.clearPublishes();
        ctx.doc.querySelector('#cm-search-results .cm-hit').click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Cheat.Execute'));
        await ctx.waitFor(() =>
            ctx.doc.querySelector('.cm-panel[data-panel="diag"]').classList.contains('is-active'));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: "all" fans a player command over every player, once each',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-all-players'));
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { Id: 'a', Name: 'Host', bIsHost: true },
            { Id: 'b', Name: 'Two', bIsHost: false },
            { Id: 'c', Name: 'Three', bIsHost: false },
        ]});
        await ctx.waitFor(() => ctx.doc.getElementById('cm-target').options.length === 4);
        const all = ctx.doc.getElementById('cm-all-players');
        all.checked = true;
        all.dispatchEvent(new ctx.win.Event('change', { bubbles: true }));

        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="Heal {p}"]').click();
        const healed = ctx.handle.publishes()
            .filter(p => p.channel === 'UI.Cmd.Cheat.Execute')
            .map(p => p.payload.Command);
        ctx.expect(ctx.assert.eq(healed.join('|'), 'Heal 1|Heal 2|Heal 3'));

        // A command with no player number must NOT be repeated — SkipDays three
        // times would skip three days.
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="SkipOpen"]').click();
        ctx.expect(ctx.assert.eq(
            ctx.handle.publishes().filter(p => p.channel === 'UI.Cmd.Cheat.Execute').length, 1));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: aim-to-fill drops the entity id into every entity field',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-aim-fill]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-aim-fill]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.AimEntity'));
        ctx.inject('tsic.msg.UI.Cheat.AimTarget', { EntityId: 4711, Label: 'FD_ShelfUnit_DF' });
        await ctx.waitFor(() => ctx.doc.getElementById('cm-entity-id').value === '4711');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('cm-tp-entity').value, '4711'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-log', /4711/));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: a bookmark captures the position out of the Pos transcript',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.win.localStorage.removeItem('tsic.cheatMenu.bookmarks');
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-bm-save'));
        ctx.doc.getElementById('cm-bm-name').value = 'Loading bay';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-bm-save').click();
        // Saving asks the world where the player is; it cannot know on its own.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'Pos 0' }));
        ctx.inject('tsic.msg.UI.Cheat.Log', {
            Command: 'Pos 0', Output: 'Player 1 position: X=182450.00, Y=241300.00, Z=1350.00',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cm-bm-list .cm-bookmark').length === 1);
        ctx.expect(ctx.assert.domText(ctx.doc, '#cm-bm-list', /Loading bay \(182450, 241300, 1350\)/));

        ctx.clearPublishes();
        ctx.doc.querySelector('#cm-bm-list .cm-exec').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'TeleportToLocation 0 182450 241300 1350' }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: only non-cheat console lines are hinted client-local',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl="stat fps"]'));

        // `stat fps` is a console command, not a cheat UFUNCTION, so C++ has no flag to
        // read off it. Without the hint a client's frame counter came from the host.
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="stat fps"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'stat fps' && p.bClientLocal === true }));

        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="WebUI.Reload"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'WebUI.Reload' && p.bClientLocal === true }));

        // A real cheat is never hinted. Where it runs is the UFUNCTION's own business —
        // the panel guessing would be how a spawn cheat ends up client-only, leaving an
        // entity the server never heard of.
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="Heal {p}"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'Heal 0' && p.bClientLocal === false }));

        // Including the cosmetic ones: C++ reads BlueprintCosmetic off EnemyHealthBars.
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl="EnemyHealthBars"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
            { where: p => p.Command === 'EnemyHealthBars' && p.bClientLocal === false }));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: the Close button asks to toggle, not to force InGame',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('btn-back'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-back').click();
        // UI.Cmd.GameScreen.Close hardcodes InGame; the toggle returns to whatever
        // screen the panel was opened from, which matters from the main menu.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.CheatMenu'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.GameScreen.Close'));
    },
});
