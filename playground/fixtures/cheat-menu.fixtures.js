// /screens/cheat-menu.html subscribes to:
//   tsic.msg.UI.Cheat.Catalog  { Items, Creatures, FurnitureDefault, FurnitureConstructed, ConstructionItems, Recipes, Equippables, Weapons, HeadGear, BodyArmor, LegArmor, Shoes, Gloves }
//     each entry: { InternalName, DisplayName, IconUrl? }
//   tsic.msg.UI.Players.List  { Players:[{PlayerId, Name, bIsHost}] }
TSICPlayground.register({
    id: 'cheat-menu',
    label: 'Cheat Menu',
    screen: '/screens/cheat-menu.html',
    initialState() {
        return {
            catalog: {
                Items: [
                    { InternalName: 'ID_Bread',  DisplayName: 'Bread' },
                    { InternalName: 'ID_Wood',   DisplayName: 'Wood' },
                    { InternalName: 'ID_Stone',  DisplayName: 'Stone' },
                    { InternalName: 'ID_Axe',    DisplayName: 'Axe' },
                    { InternalName: 'ID_Hammer', DisplayName: 'Hammer' },
                ],
                Creatures: [
                    { InternalName: 'CH_Customer', DisplayName: 'Customer' },
                    { InternalName: 'CH_Mimic',    DisplayName: 'Mimic' },
                ],
                FurnitureDefault:     [{ InternalName: 'FD_Table_DF',  DisplayName: 'Table' }],
                FurnitureConstructed: [{ InternalName: 'FD_Table_Constructed_DF', DisplayName: 'Constructed Table' }],
                ConstructionItems:    [{ InternalName: 'CI_TableData', DisplayName: 'Table Construction Item' }],
                Recipes:              [{ InternalName: 'R_Bread', DisplayName: 'Bread recipe' }],
                Equippables:          [{ InternalName: 'ID_Axe',  DisplayName: 'Axe' }],
                Weapons:               [{ InternalName: 'ID_Axe',  DisplayName: 'Axe' }],
                HeadGear:             [{ InternalName: 'ID_Hat',  DisplayName: 'Hat' }],
                BodyArmor:            [{ InternalName: 'ID_Coat', DisplayName: 'Coat' }],
                LegArmor:             [{ InternalName: 'ID_Pants',DisplayName: 'Pants' }],
                Shoes:                [{ InternalName: 'ID_Boots',DisplayName: 'Boots' }],
                Gloves:               [{ InternalName: 'ID_Gloves',DisplayName: 'Gloves' }],
            },
            players: [
                { PlayerId: 1, Name: 'Ziggy',  bIsHost: true },
                { PlayerId: 2, Name: 'Friend', bIsHost: false },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Cheat.Catalog', state.catalog],
            ['tsic.msg.UI.Players.List', { Players: state.players }],
        ];
    },
    scenarios: [
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'Empty items',      apply(s) { s.catalog.Items = []; } },
        { label: 'Empty everything', apply(s) {
            for (const k of Object.keys(s.catalog)) s.catalog[k] = [];
        } },
        { label: 'Huge items list',  apply(s) {
            s.catalog.Items = Array.from({length: 40}, (_, i) => ({
                InternalName: 'ID_Item' + i, DisplayName: 'Item ' + i,
            }));
        } },
        { label: 'Solo lobby',       apply(s) { s.players = [{ PlayerId: 1, Name: 'Ziggy', bIsHost: true }]; } },
        // Player-list isn't rendered by cheat-menu directly (its tabbed UI
        // doesn't surface it in the headless screenshot view), so player-only
        // toggles don't move pixels even though the inject fires.
        { label: 'Four-player lobby',apply(s) { s.players = [
            { PlayerId: 1, Name: 'Ziggy',   bIsHost: true },
            { PlayerId: 2, Name: 'Friend',  bIsHost: false },
            { PlayerId: 3, Name: 'Stranger',bIsHost: false },
            { PlayerId: 4, Name: 'Newbie',  bIsHost: false },
        ]; }, expect: { visualChange: false } },
        { label: 'Many creatures',   apply(s) { s.catalog.Creatures = Array.from({length: 12}, (_, i) => ({
            InternalName: 'CH_Enemy' + i, DisplayName: ['Customer','Mimic','Spider','Wraith','Stalker','Crawler','Ghost','Beast','Worm','Thing','Other','Shade'][i],
        })); } },
    ],
});
