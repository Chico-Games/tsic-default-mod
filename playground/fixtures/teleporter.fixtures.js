// /screens/teleporter.html subscribes to:
//   tsic.msg.UI.Teleporter.Destinations  { Destinations:[{EntityId, Label, Cooldown}] }
// fromId read from URL query.
TSICPlayground.register({
    id: 'teleporter',
    label: 'Teleporter',
    screen: '/screens/teleporter.html?fromId=1',
    initialState() { return { destinations: [
        { EntityId: 2, Label: 'Beach Hut', Cooldown: 0 },
        { EntityId: 3, Label: 'Cave Camp', Cooldown: 8 },
        { EntityId: 4, Label: 'Town',      Cooldown: 0 },
    ] }; },
    project(state) { return [['tsic.msg.UI.Teleporter.Destinations', { Destinations: state.destinations }]]; },
    scenarios: [
        { label: 'Three destinations',  apply() {}, expect: { visualChange: false } },
        { label: 'One destination',     apply(s) { s.destinations = s.destinations.slice(0, 1); } },
        { label: 'Six destinations',    apply(s) { s.destinations = [
            { EntityId: 2, Label: 'Beach Hut',  Cooldown: 0 },
            { EntityId: 3, Label: 'Cave Camp',  Cooldown: 8 },
            { EntityId: 4, Label: 'Town',       Cooldown: 0 },
            { EntityId: 5, Label: 'Mountain',   Cooldown: 0 },
            { EntityId: 6, Label: 'Forest',     Cooldown: 15 },
            { EntityId: 7, Label: 'Cellar',     Cooldown: 0 },
        ]; } },
        { label: 'Many destinations',   apply(s) { s.destinations = Array.from({length: 10}, (_, i) => ({
            EntityId: 100 + i,
            Label: ['Beach','Cave','Town','Mountain','Forest','Cellar','Workshop','Vault','Bridge','Field'][i],
            Cooldown: i % 3 === 0 ? 0 : 5 + i,
        })); } },
        { label: 'All cooling down',    apply(s) { s.destinations = s.destinations.map(d => ({ ...d, Cooldown: 15 })); } },
        { label: 'Mixed cooldowns',     apply(s) { s.destinations = [
            { EntityId: 2, Label: 'Beach Hut',   Cooldown: 0 },
            { EntityId: 3, Label: 'Cave Camp',   Cooldown: 3 },
            { EntityId: 4, Label: 'Town',        Cooldown: 30 },
            { EntityId: 5, Label: 'Mountain',    Cooldown: 0 },
        ]; } },
        { label: 'Long labels',         apply(s) { s.destinations = [
            { EntityId: 2, Label: 'The Beach Hut By The Cliffside',  Cooldown: 0 },
            { EntityId: 3, Label: 'The Deep Cave Camp Near Hollow',  Cooldown: 0 },
        ]; } },
        { label: 'No destinations',     apply(s) { s.destinations = []; } },
    ],
});
