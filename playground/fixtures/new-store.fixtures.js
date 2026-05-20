// /screens/new-store.html subscribes to:
//   tsic.msg.UI.Menu.Layouts       { Layouts:[{LayoutId, DisplayName}] }
//   tsic.msg.UI.Mod.InstalledList  { Mods:[{ModId, DisplayName, Author, bEnabled}] }
//   tsic.msg.UI.Mod.LoadOrder      { Order:[modId] }
TSICPlayground.register({
    id: 'new-store',
    label: 'New Store',
    screen: '/screens/new-store.html',
    initialState() { return {
        layouts: [
            { LayoutId: 'L_Default', DisplayName: 'Default Floor' },
            { LayoutId: 'L_Beach',   DisplayName: 'Beach Hut' },
            { LayoutId: 'L_Cave',    DisplayName: 'Cave Camp' },
        ],
        mods: [
            { ModId: 'mod.example.bigger-loot', DisplayName: 'Bigger Loot',   Author: 'example', bEnabled: true },
            { ModId: 'mod.foo.shop-overhaul',   DisplayName: 'Shop Overhaul', Author: 'foo',     bEnabled: false },
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
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'No mods',          apply(s) { s.mods = []; s.order = []; } },
        { label: 'All mods enabled', apply(s) { s.mods = s.mods.map(m => ({ ...m, bEnabled: true })); } },
        { label: 'All mods off',     apply(s) { s.mods = s.mods.map(m => ({ ...m, bEnabled: false })); } },
        { label: 'Many mods (6)',    apply(s) { s.mods = Array.from({length: 6}, (_, i) => ({
            ModId: 'mod.author.example_' + i,
            DisplayName: ['Bigger Loot','Shop Overhaul','Cheats Plus','Faster Day','Hard Mode','Custom Recipes'][i],
            Author: ['example','foo','bar','baz','qux','quux'][i],
            bEnabled: i % 2 === 0,
        })); s.order = s.mods.map(m => m.ModId); } },
        { label: 'No layouts',       apply(s) { s.layouts = []; } },
        // The new-store page renders layouts as part of an internal carousel
        // not surfaced in the headless screenshot; layout-count changes don't
        // move pixels in this view. Inject still fires.
        { label: 'One layout',       apply(s) { s.layouts = [s.layouts[0]]; }, expect: { visualChange: false } },
        { label: 'Many layouts',     apply(s) { s.layouts = [
            { LayoutId: 'L_Default',  DisplayName: 'Default Floor' },
            { LayoutId: 'L_Beach',    DisplayName: 'Beach Hut' },
            { LayoutId: 'L_Cave',     DisplayName: 'Cave Camp' },
            { LayoutId: 'L_Mountain', DisplayName: 'Mountain Pass' },
            { LayoutId: 'L_Forest',   DisplayName: 'Forest Edge' },
            { LayoutId: 'L_Cellar',   DisplayName: 'Cellar' },
        ]; }, expect: { visualChange: false } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Mod.SetLoadOrder') state.order = payload.Order || [];
    },
});
