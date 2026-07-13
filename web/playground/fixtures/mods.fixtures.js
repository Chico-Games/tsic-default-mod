// /screens/mods.html subscribes to:
//   tsic.msg.UI.Mod.IoConfig        { GameId, ApiKey, Env }
//   tsic.msg.UI.Mod.InstalledList   { Mods:[{ModId, DisplayName, Version, bEnabled, bLocked, bShipped}] }
//   tsic.msg.UI.Mod.LoadOrder       { Order:[modId, ...] }
//   tsic.msg.UI.Mod.InstallFailed   { ModId, Reason }
//   tsic.msg.UI.Mod.Subscriptions   { Subs:[{NameId, ModIoId, DisplayName, bHasUpdate, bInstalled}] }
//   tsic.msg.UI.Mod.UpdateProgress  { NameId, State('checking'|'downloading'|'done'|'failed'), Error }
TSICPlayground.register({
    id: 'mods',
    label: 'Mods',
    screen: '/screens/mods.html',
    initialState() { return {
        ioConfig: { GameId: 1234, ApiKey: 'fake-key', Env: 'test' },
        installed: [
            { ModId: 'com.chicogames.default',  DisplayName: 'TSIC Base Game', Version: '1.0', bEnabled: true,  bLocked: true,  bShipped: true },
            { ModId: 'mod.example.bigger-loot', DisplayName: 'Bigger Loot',    Version: '1.0', bEnabled: true,  bLocked: false, bShipped: false },
            { ModId: 'mod.foo.shop-overhaul',   DisplayName: 'Shop Overhaul',  Version: '0.3', bEnabled: false, bLocked: false, bShipped: true },
            { ModId: 'mod.bar.cheats',          DisplayName: 'Cheats Plus',    Version: '2.1', bEnabled: false, bLocked: false, bShipped: false },
        ],
        order: ['com.chicogames.default', 'mod.example.bigger-loot', 'mod.foo.shop-overhaul', 'mod.bar.cheats'],
        subs: [],
        progress: null,
        lastFail: null,
    }; },
    project(state) {
        const out = [
            ['tsic.msg.UI.Mod.IoConfig',      state.ioConfig],
            ['tsic.msg.UI.Mod.InstalledList', { Mods: state.installed }],
            ['tsic.msg.UI.Mod.LoadOrder',     { Order: state.order }],
        ];
        if (state.subs.length) out.push(['tsic.msg.UI.Mod.Subscriptions', { Subs: state.subs }]);
        if (state.progress) out.push(['tsic.msg.UI.Mod.UpdateProgress', state.progress]);
        if (state.lastFail) out.push(['tsic.msg.UI.Mod.InstallFailed', state.lastFail]);
        return out;
    },
    scenarios: [
        { label: 'Split columns',  apply() {}, expect: { visualChange: false } },
        { label: 'No mods',        apply(s) { s.installed = []; s.order = []; } },
        { label: 'All active',     apply(s) { s.installed.forEach(m => { m.bEnabled = true; }); } },
        { label: 'All inactive',   apply(s) { s.installed.forEach(m => { if (!m.bLocked) m.bEnabled = false; }); } },
        { label: 'Many mods (9)',  apply(s) {
            s.installed = [s.installed[0]].concat(Array.from({length: 8}, (_, i) => ({
                ModId: 'mod.author.example_' + i,
                DisplayName: ['Bigger Loot','Shop Overhaul','Cheats Plus','Faster Day','Hard Mode','Custom Recipes','New Enemies','Better UI'][i],
                Version: '1.' + i,
                bEnabled: i % 2 === 0,
                bLocked: false,
            })));
            s.order = s.installed.map(m => m.ModId);
        } },
        { label: 'Update ready',   apply(s) {
            s.subs = [{ NameId: 'mod.example.bigger-loot', ModIoId: 42, DisplayName: 'Bigger Loot', bHasUpdate: true, bInstalled: true }];
        } },
        { label: 'Downloading',    apply(s) {
            s.subs = [{ NameId: 'mod.example.bigger-loot', ModIoId: 42, DisplayName: 'Bigger Loot', bHasUpdate: true, bInstalled: true }];
            s.progress = { NameId: 'mod.example.bigger-loot', State: 'downloading', Error: '' };
        } },
        { label: 'Update failed',  apply(s) {
            s.progress = { NameId: 'mod.example.bigger-loot', State: 'failed', Error: 'Network error' };
        } },
        { label: 'mod.io off',     apply(s) { s.ioConfig = {}; } },
        { label: 'Live mod.io',    apply(s) { s.ioConfig = { GameId: 1234, ApiKey: 'live-key', Env: 'live' }; } },
        { label: 'Failed install', apply(s) { s.lastFail = { ModId: 'mod.example.bigger-loot', Reason: 'Network error' }; } },
        { label: 'Reordered',      apply(s) { s.order = ['com.chicogames.default', 'mod.bar.cheats', 'mod.example.bigger-loot', 'mod.foo.shop-overhaul']; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Mod.SetLoadOrder') state.order = payload.Order || [];
        if (channel === 'UI.Cmd.Mod.SetEnabled') {
            const m = state.installed.find(x => x.ModId === payload.ModId);
            if (m) m.bEnabled = !!payload.Enabled;
        }
        if (channel === 'UI.Cmd.Mod.Uninstall') {
            state.installed = state.installed.filter(x => x.ModId !== payload.NameId);
            state.order = state.order.filter(id => id !== payload.NameId);
        }
    },
});
