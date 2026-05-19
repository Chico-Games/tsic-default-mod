// /screens/new-store.html subscribes to:
//   tsic.msg.UI.Menu.Layouts       { Layouts:[{LayoutId, Name}] }
//   tsic.msg.UI.Mod.InstalledList  { Mods:[{ModId, Name, Author, bEnabled}] }
//   tsic.msg.UI.Mod.LoadOrder      { Order:[modId] }
TSICPlayground.register({
    id: 'new-store',
    label: 'New Store',
    screen: '/screens/new-store.html',
    initialState() { return {
        layouts: [
            { LayoutId: 'L_Default', Name: 'Default Floor' },
            { LayoutId: 'L_Beach',   Name: 'Beach Hut' },
            { LayoutId: 'L_Cave',    Name: 'Cave Camp' },
        ],
        mods: [
            { ModId: 'mod.example.bigger-loot', Name: 'Bigger Loot', Author: 'example', bEnabled: true },
            { ModId: 'mod.foo.shop-overhaul',   Name: 'Shop Overhaul', Author: 'foo',   bEnabled: false },
        ],
        order: ['mod.example.bigger-loot', 'mod.foo.shop-overhaul'],
    }; },
    project(s) {
        return [
            ['tsic.msg.UI.Menu.Layouts',      { Layouts: s.layouts }],
            ['tsic.msg.UI.Mod.InstalledList', { Mods: s.mods }],
            ['tsic.msg.UI.Mod.LoadOrder',     { Order: s.order }],
        ];
    },
    scenarios: [
        { label: 'Default',     apply() {} },
        { label: 'No mods',     apply(s) { s.mods = []; s.order = []; } },
        { label: 'No layouts',  apply(s) { s.layouts = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Mod.SetLoadOrder') state.order = payload.Order || [];
    },
});
