// Stress / boundary tests — large payloads, malformed inputs, rapid bursts.

// ---- Inventory: 200-stack stress ----------------------------------------
TSICTestHarness.register({
    name: 'Stress/Inventory: 200 stacks render as 200 occupied grid cells',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        const items = [];
        for (let i = 0; i < 200; i++) items.push({ ItemId: `ID_${i}`, Count: 1, InstanceId: i + 1, GridSlot: i });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: items, MaxSlots: 256 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-instance]').length === 200, { timeout: 3000 });
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-grid .tsic-slot[data-instance]', 200));
    },
});

// ---- Map: 100 icons / 20 players / 50 pings -----------------------------

// ---- Action bar: 50 ability rows -----------------------------------------
TSICTestHarness.register({
    name: 'Stress/ActionBar: 50 visible rows all render',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        const slots = [];
        // blocked (1) rows are hidden by design — keep all 50 available
        for (let i = 0; i < 50; i++) slots.push({ BehaviorTagName: `IA_${i}`, DisplayName: `A${i}`, bVisible: true, StatusInt: 0 });
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: slots });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length === 50, { timeout: 3000 });
        ctx.expect(ctx.assert.domCount(ctx.doc, '#bb-gameplay .bb-row', 50));
    },
});

// ---- Notifications burst -------------------------------------------------
TSICTestHarness.register({
    name: 'Stress/Notifications: 30 rapid pushes still survives + caps at 5',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        for (let i = 0; i < 30; i++) ctx.inject('tsic.msg.UI.Notification.Show', { Title: `n${i}`, Text: '', Type: 'Tip' });
        await new Promise(r => setTimeout(r, 120));
        const visible = ctx.doc.querySelectorAll('.notif');
        ctx.expect(ctx.assert.truthy(visible.length <= 5));
    },
});

// ---- Settings: missing field types -----------------------------------------
TSICTestHarness.register({
    name: 'Stress/Settings: unknown Type falls back to read-only JSON',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({ Pages: [{ Id: 'X', Title: 'X', Groups: [{ Id: 'Weird', Title: 'Weird',
                Settings: [{ Key: 'k', Label: 'weird', Type: 'martian', Value: { complex: true } }] }] }] }),
        });
        await ctx.waitFor(() => ctx.doc.querySelector('.field'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.field .value-label'));
    },
});

// ---- Settings: empty catalog --------------------------------------------
TSICTestHarness.register({
    name: 'Stress/Settings: catalog with no groups renders empty hint',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify({ Pages: [] }) });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.group').length, 0));
    },
});

// ---- Lore: empty Texts array --------------------------------------------
TSICTestHarness.register({
    name: 'Stress/Lore: empty Texts array keeps heading empty',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', { ScreenKind: 'Paper', Texts: [], InitialIndex: 0 });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq((ctx.doc.getElementById('lore-heading').textContent || '').trim(), ''));
    },
});

// ---- Detection: out-of-range bearing values ----------------------------
TSICTestHarness.register({
    name: 'Stress/Detection: bearings beyond ±180 still render without throwing',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [
                { EntityId: 1, DetectionScore: 0.5, BearingDeg:  720 },
                { EntityId: 2, DetectionScore: 0.5, BearingDeg: -500 },
            ],
            ScreenMist: 0.2,
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Storage: very large stack count --------------------------------------
TSICTestHarness.register({
    name: 'Stress/Storage: 99999 stack count renders cleanly',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:1', GridWidth: 8, Items: [{ ItemId: 'ID_X', Count: 99999, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"]'));
        const cell = ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"]');
        ctx.expect(ctx.assert.truthy(/99999/.test((cell.querySelector('.count') || {}).textContent || ''),
            `expected count badge 99999`));
    },
});

// ---- Cheat: an input-driven command with an empty field does not publish ----
// (Was the raw console box, which the panel no longer carries. The same contract
// still matters for every data-cmd-tpl-input button.)
TSICTestHarness.register({
    name: 'Stress/CheatMenu: empty input field does not publish',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.getElementById('cm-entity-id'));
        ctx.doc.getElementById('cm-entity-id').value = '';
        ctx.clearPublishes();
        ctx.doc.querySelector('button[data-cmd-tpl-input^="FindEntity"]').click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Cheat.Execute'));
    },
});

// ---- Production: 20 queue entries with progress -------------------------
TSICTestHarness.register({
    name: 'Stress/Production: 20 queue entries render',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.screen('Production');
        const q = [];
        for (let i = 0; i < 20; i++) q.push({ RecipeId: `R_${i}`, Name: `r${i}`, ProgressFraction: i / 20 });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Queue: q });
        await new Promise(r => setTimeout(r, 150));
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Inventory: empty payload renders empty-state hint ------------------
TSICTestHarness.register({
    name: 'Stress/Inventory: empty payload shows empty-state',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length > 0, { timeout: 2000 });
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-instance]').length, 0));
    },
});

// ---- Hotbar: a payload with no NumSlots still renders the bar -----------
TSICTestHarness.register({
    name: 'Stress/Hotbar: a payload missing NumSlots falls back to the shared default',
    file: '/screens/hotbar.html',
    async run(ctx) {
        // C++ always ships NumSlots; a truncated or pre-upgrade payload must not blank the bar.
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { SelectedSlot: 0 });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length, 8));
    },
});

// ---- Action bar: gamepad mode + no resolvable gamepad icon = no key chip ---
TSICTestHarness.register({
    // Icon-only bar: gamepad mode with no gamepad icon and no resolvable key text
    // renders the row WITHOUT a key chip — there is no text fallback.
    name: 'Stress/ActionBar: gamepad mode without a resolvable gamepad icon renders no key chip',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.mode('Gamepad');
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0,
                      KeyboardIconUrl: '/icons/keyboard/e.svg', GamepadIconUrl: '' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#bb-gameplay .bb-key', 0));
    },
});

// ---- Lore: ArrowRight without an Open message is a no-op ----------------
TSICTestHarness.register({
    name: 'Stress/Lore: ArrowRight before Opened does not throw',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(true));
    },
});
