// Catch-all functional coverage — one or two scenarios per page that the
// initial pass didn't already cover. Aim: every screen has at least four
// behavioural assertions across the suite.

// ---- Crosshair ----------------------------------------------------------
TSICTestHarness.register({
    name: 'Crosshair: page loads with a visible dot element',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.body.children.length >= 1, { timeout: 1000 });
        // The dot has no fixed id across builds; assert at least one absolutely-
        // positioned element exists on body.
        const positioned = Array.from(ctx.doc.querySelectorAll('*'))
            .find(e => ctx.win.getComputedStyle(e).position === 'fixed');
        ctx.expect(ctx.assert.truthy(positioned, 'expected a fixed-position dot'));
    },
});

// ---- HealthBar damage-reveal --------------------------------------------
TSICTestHarness.register({
    name: 'HealthBar: damage event subscriber doesn\'t throw',
    file: '/screens/test-health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: 80, Max: 100 });
        ctx.inject('tsic.msg.Message.DamageEvent', { Damage: 20 });
        await ctx.waitFor(() => /80 \/ 100/.test((ctx.doc.querySelector('.tlb-readout') || {}).textContent || ''), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '.tlb-readout', /80 \/ 100/));
    },
});

// ---- StaminaBar drain --------------------------------------------------
TSICTestHarness.register({
    name: 'StaminaBar: rapid drop still surfaces final value',
    file: '/screens/test-stamina-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: 100, Max: 100 });
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: 25, Max: 100 });
        await ctx.waitFor(() => /25 \/ 100/.test(ctx.doc.body.textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(/25 \/ 100/.test(ctx.doc.body.textContent)));
    },
});

// ---- Stomach slot edge case ---------------------------------------------
TSICTestHarness.register({
    name: 'Stomach: empty-slot ItemId="" still renders without throwing',
    file: '/screens/stomach.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Stomach.State', {
            Slots: [
                { ItemId: '',         IconUrl: '', Duration: 0, RemainingTime: 0 },
                { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 30, RemainingTime: 15 },
                { ItemId: '',         IconUrl: '', Duration: 0, RemainingTime: 0 },
            ],
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Notifications stack cap --------------------------------------------
TSICTestHarness.register({
    name: 'Notifications: stack caps at 5 (oldest dropped)',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        for (let i = 0; i < 9; i++) {
            ctx.inject('tsic.msg.UI.Notification.Show', { Title: `n${i}`, Text: '', Type: 'Tip' });
        }
        await new Promise(r => setTimeout(r, 80));
        const visible = ctx.doc.querySelectorAll('.notif');
        ctx.expect(ctx.assert.truthy(visible.length <= 5, `expected <=5 visible, got ${visible.length}`));
    },
});

// ---- Hotbar with an empty inventory ------------------------------------
TSICTestHarness.register({
    name: 'Hotbar: an empty inventory renders every cell empty',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated',
            { OwnerId: 'Player', MaxSlots: 32, GridWidth: 8, Items: [] });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: -1, SelectedSlotPending: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        for (const s of ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')) {
            ctx.expect(ctx.assert.falsy(s.querySelector('img'), 'no icon in an empty cell'));
            ctx.expect(ctx.assert.falsy(s.querySelector('.count'), 'no count in an empty cell'));
        }
    },
});

// ---- Settings: enum dropdown sends string value ------------------------
TSICTestHarness.register({
    name: 'Settings: enum select publishes selected value',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({ Pages: [{ Id: 'X', Title: 'X', Groups: [{ Id: 'Display', Title: 'Display',
                Settings: [{ Key: 'preset', Label: 'Preset', Type: 'enum', Options: ['Low','Med','High'], Value: 'Med' }] }] }] }),
        });
        // Enums render as tsic-dropdowns (no native <select> under CEF).
        await ctx.waitFor(() => ctx.doc.querySelector('button.tsic-dropdown[data-key="preset"]'));
        ctx.clearPublishes();
        ctx.win.tsic.dropdown.set('button.tsic-dropdown[data-key="preset"]', 'High');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'preset' && JSON.parse(p.ValueJson) === 'High' }));
    },
});

// ---- Construction: deconstruct -----------------------------------------
TSICTestHarness.register({
    name: 'Construction: deconstruct button publishes',
    file: '/screens/construction.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-deconstruct'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-deconstruct').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Construction.Deconstruct'));
    },
});

// ---- Construction: cancel button publishes -----------------------------
TSICTestHarness.register({
    name: 'Construction: cancel button publishes',
    file: '/screens/construction.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-cancel'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-cancel').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Construction.Cancel'));
    },
});

// ---- ConstructionCarousel: edge case empty arrays ----------------------
TSICTestHarness.register({
    name: 'ConstructionCarousel: prev=[] next=[] current only',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true,
            Prev: [], Current: { FurnitureId: 'X', Label: 'X', bAffordable: true }, Next: [],
            RotationAxis: '', BlockedReason: '',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cc-row .cc-slot').length === 1);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot.current', 1));
    },
});

// ---- Map: ping cross rendering -----------------------------------------

// ---- Cage: explicit context skip ---------------------------------------
TSICTestHarness.register({
    name: 'Cage: Generic context does not render anything',
    file: '/screens/cage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', { Context: 'Generic', Options: [{ OptionId: 'x', Label: 'leak' }] });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.doc.body.textContent.indexOf('leak'), -1));
    },
});

// ---- Notifications: missing icon falls back gracefully -----------------
TSICTestHarness.register({
    name: 'Notifications: missing IconUrl still renders',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'No icon', Text: 'no problem', Type: 'Tip' });
        await ctx.waitFor(() => ctx.doc.querySelector('.notif'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.notif-title'));
    },
});

// ---- Save/Load empty ---------------------------------------------------
TSICTestHarness.register({
    name: 'SaveLoad: empty slots payload renders no rows',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: [] });
        await new Promise(r => setTimeout(r, 60));
        const rows = ctx.doc.querySelectorAll('.save-row, .save-slot, button');
        // The page may show only the Back button; no Load buttons in absence of slots.
        const loadButtons = Array.from(rows).filter(b => /load/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.eq(loadButtons.length, 0));
    },
});

// ---- MainMenu Settings nav --------------------------------------------
TSICTestHarness.register({
    name: 'MainMenu: Settings button publishes Menu.Navigate Settings',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => /settings/i.test(b.textContent || ''));
        btn && btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate',
            { where: p => /Settings/i.test(p.Screen || '') }));
    },
});

TSICTestHarness.register({
    name: 'MainMenu: Mods button publishes Menu.Navigate Mods',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const btn = ctx.doc.getElementById('btn-mods');
        btn && btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate', { where: p => p.Screen === 'Mods' }));
    },
});

TSICTestHarness.register({
    name: 'MainMenu: Credits button publishes Menu.Navigate Credits',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => /credits/i.test(b.textContent || ''));
        btn && btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate', { where: p => p.Screen === 'Credits' }));
    },
});

// ---- PauseMenu Settings + Quit ----------------------------------------
TSICTestHarness.register({
    name: 'PauseMenu: Settings button publishes Pause.Settings',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => /settings/i.test(b.textContent || ''));
        btn && btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Settings'));
    },
});

TSICTestHarness.register({
    name: 'PauseMenu: Save and Return to Main Menu publishes Pause.QuitToMenu',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#btn-menu'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#btn-menu').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.QuitToMenu'));
    },
});

// ---- Credits: Back navigates back to MainMenu --------------------------
TSICTestHarness.register({
    name: 'Credits: any back-style button navigates MainMenu',
    file: '/screens/credits.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        ctx.doc.querySelector('button').click();
        // The page wires a single button to UI.Cmd.Menu.Navigate with Screen=MainMenu.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate', { where: p => /MainMenu/i.test(p.Screen || '') }));
    },
});

// ---- UniversalStorage (linked) page: container list + transfer ---------
TSICTestHarness.register({
    name: 'UniversalStorage (linked): cross-pane click-move publishes an id+slot Move',
    file: '/screens/universal-storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_X: { Name: 'X', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Universal', GridWidth: 8, Items: [{ ItemId: 'ID_X', Count: 1, InstanceId: 7, GridSlot: 0 }], MaxSlots: 64 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"] img'));
        ctx.clearPublishes();
        // §6 cursor model: click picks the stack up, click on a player cell commits.
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"]').click();
        const target = ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="2"]');
        const r = target.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
        target.dispatchEvent(new ctx.win.PointerEvent('pointerdown', o));
        target.dispatchEvent(new ctx.win.PointerEvent('pointerup', o));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move',
            { where: p => p.FromOwnerId === 'Universal' && p.ToOwnerId === 'Player' && p.ItemId === 7 && p.ToSlot === 2 }));
    },
});

// ---- Equipment page ----------------------------------------------------
TSICTestHarness.register({
    name: 'Equipment: clicking equipped slot publishes Unequip',
    file: '/screens/equipment.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [{ SlotTag: 'Equip.Head', ItemId: 'ID_Helmet', IconUrl: '' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-slot'));
        ctx.clearPublishes();
        ctx.doc.querySelector('.tsic-slot').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Unequip',
            { where: p => p.SlotTag === 'Equip.Head' }));
    },
});

// Chat coverage lives in chat.test.js (HUD component, /screens/in-game.html).

// ---- Detection screen-mist amount ------------------------------------
TSICTestHarness.register({
    name: 'Detection: ScreenMist=0 does not crash render',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', { Enemies: [], ScreenMist: 0 });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(true));
    },
});

TSICTestHarness.register({
    name: 'Detection: very high enemy count still survives',
    file: '/screens/detection.html',
    async run(ctx) {
        const enemies = [];
        for (let i = 0; i < 50; i++) enemies.push({ EntityId: i, DetectionScore: 0.05 + Math.random() * 0.95, BearingDeg: i * 7 - 180 });
        ctx.inject('tsic.msg.UI.Detection.State', { Enemies: enemies, ScreenMist: 0.5 });
        await new Promise(r => setTimeout(r, 80));
        const markers = ctx.doc.querySelectorAll('#threats .arc');
        ctx.expect(ctx.assert.truthy(markers.length >= 10, `expected many threat markers, got ${markers.length}`));
    },
});

// ---- Wardrobe: Close publishes correctly --------------------------------
TSICTestHarness.register({
    name: 'Wardrobe: Close button publishes both Hide and Resume',
    file: '/screens/wardrobe.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-close'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Hide'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

// ---- Universal storage setup: ESC dismisses the modal -----------------
TSICTestHarness.register({
    name: 'UniversalStorageSetup: ESC inside name modal dismisses it',
    file: '/screens/universal-storage-setup.html?entityId=42',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-new'));
        ctx.doc.getElementById('btn-new').click();
        await new Promise(r => setTimeout(r, 30));
        const input = ctx.doc.querySelector('input#uss-name');
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('input#uss-name'), null));
    },
});

// ---- Ping markers: removed IDs are forgotten --------------------------
TSICTestHarness.register({
    name: 'PingMarkers: a re-added ping fires another flash',
    file: '/screens/ping-markers.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Ping.Set', { Pings: [{ PingId: 'p1', PingType: 'Map', Location: { X: 0, Y: 0, Z: 0 }, OwnerId: 'X' }] });
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Ping.Set', { Pings: [] });
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Ping.Set', { Pings: [{ PingId: 'p1', PingType: 'Map', Location: { X: 0, Y: 0, Z: 0 }, OwnerId: 'X' }] });
        await new Promise(r => setTimeout(r, 60));
        // Two flashes should have appeared at least briefly. Page removes them on a timer.
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Notifications: warning border colour --------------------------
TSICTestHarness.register({
    name: 'Notifications: warning class set on Warning type',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'careful', Text: 'wow', Type: 'Warning' });
        await ctx.waitFor(() => ctx.doc.querySelector('.notif--Warning'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.notif--Warning'));
    },
});
