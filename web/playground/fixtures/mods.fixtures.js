// /screens/mods.html subscribes to:
//   tsic.msg.UI.Mod.IoConfig       { GameId, ApiKey, Env }
//   tsic.msg.UI.Mod.InstalledList  { Mods:[{ModId, DisplayName, Version, Author, IconUrl}] }
//   tsic.msg.UI.Mod.LoadOrder      { Order:[modId, ...] }
//   tsic.msg.UI.Mod.InstallFailed  { ModId, Reason }
TSICPlayground.register({
    id: 'mods',
    label: 'Mods',
    screen: '/screens/mods.html',
    initialState() { return {
        ioConfig: { GameId: 1234, ApiKey: 'fake-key', Env: 'test' },
        installed: [
            { ModId: 'mod.example.bigger-loot', DisplayName: 'Bigger Loot',   Version: '1.0', Author: 'example' },
            { ModId: 'mod.foo.shop-overhaul',   DisplayName: 'Shop Overhaul', Version: '0.3', Author: 'foo' },
            { ModId: 'mod.bar.cheats',          DisplayName: 'Cheats Plus',   Version: '2.1', Author: 'bar' },
        ],
        order: ['mod.example.bigger-loot', 'mod.foo.shop-overhaul', 'mod.bar.cheats'],
        lastFail: null,
    }; },
    project(state) {
        const out = [
            ['tsic.msg.UI.Mod.IoConfig',      state.ioConfig],
            ['tsic.msg.UI.Mod.InstalledList', { Mods: state.installed }],
            ['tsic.msg.UI.Mod.LoadOrder',     { Order: state.order }],
        ];
        if (state.lastFail) out.push(['tsic.msg.UI.Mod.InstallFailed', state.lastFail]);
        return out;
    },
    scenarios: [
        { label: 'Three mods',     apply() {}, expect: { visualChange: false } },
        { label: 'No mods',        apply(s) { s.installed = []; s.order = []; } },
        { label: 'One mod',        apply(s) {
            s.installed = [s.installed[0]];
            s.order = [s.installed[0].ModId];
        } },
        { label: 'Many mods (8)',  apply(s) {
            s.installed = Array.from({length: 8}, (_, i) => ({
                ModId: 'mod.author.example_' + i,
                DisplayName: ['Bigger Loot','Shop Overhaul','Cheats Plus','Faster Day','Hard Mode','Custom Recipes','New Enemies','Better UI'][i],
                Version: '1.' + i,
                Author: ['example','foo','bar','baz','qux','quux','corge','grault'][i],
            }));
            s.order = s.installed.map(m => m.ModId);
        } },
        { label: 'mod.io off',     apply(s) { s.ioConfig = {}; } },
        { label: 'Live mod.io',    apply(s) { s.ioConfig = { GameId: 1234, ApiKey: 'live-key', Env: 'live' }; } },
        { label: 'Failed install', apply(s) { s.lastFail = { ModId: 'mod.example.bigger-loot', Reason: 'Network error' }; } },
        { label: 'Reordered',      apply(s) { s.order = ['mod.bar.cheats', 'mod.example.bigger-loot', 'mod.foo.shop-overhaul']; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Mod.SetLoadOrder') state.order = payload.Order || [];
    },
});
