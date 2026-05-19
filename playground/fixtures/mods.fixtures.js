// /screens/mods.html subscribes to:
//   tsic.msg.UI.Mod.IoConfig       { GameId, ApiKey, Env }
//   tsic.msg.UI.Mod.InstalledList  { Mods:[{ModId, Name, Version, Author, IconUrl}] }
//   tsic.msg.UI.Mod.LoadOrder      { Order:[modId, ...] }
//   tsic.msg.UI.Mod.InstallFailed  { ModId, Reason }
TSICPlayground.register({
    id: 'mods',
    label: 'Mods',
    screen: '/screens/mods.html',
    initialState() { return {
        ioConfig: { GameId: 1234, ApiKey: 'fake-key', Env: 'test' },
        installed: [
            { ModId: 'mod.example.bigger-loot', Name: 'Bigger Loot',   Version: '1.0', Author: 'example' },
            { ModId: 'mod.foo.shop-overhaul',   Name: 'Shop Overhaul', Version: '0.3', Author: 'foo' },
            { ModId: 'mod.bar.cheats',          Name: 'Cheats Plus',   Version: '2.1', Author: 'bar' },
        ],
        order: ['mod.example.bigger-loot', 'mod.foo.shop-overhaul', 'mod.bar.cheats'],
    }; },
    project(state) {
        return [
            ['tsic.msg.UI.Mod.IoConfig',      state.ioConfig],
            ['tsic.msg.UI.Mod.InstalledList', { Mods: state.installed }],
            ['tsic.msg.UI.Mod.LoadOrder',     { Order: state.order }],
        ];
    },
    scenarios: [
        { label: 'Three mods',  apply() {} },
        { label: 'No mods',     apply(s) { s.installed = []; s.order = []; } },
        { label: 'mod.io off',  apply(s) { s.ioConfig = {}; } },
        { label: 'Failed install', apply(s) { s.lastFail = { ModId: 'mod.example.bigger-loot', Reason: 'Network error' }; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Mod.SetLoadOrder') state.order = payload.Order || [];
    },
});
