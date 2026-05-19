// /screens/teleporter.html subscribes to:
//   tsic.msg.UI.Teleporter.Destinations  { Destinations:[{EntityId, Label, Cooldown}] }
// fromId read from URL query.
TSICPlayground.register({
    id: 'teleporter',
    label: 'Teleporter',
    screen: '/screens/teleporter.html?fromId=1',
    initialState() { return { destinations: [
        { EntityId: 2, Label: 'Beach Hut',  Cooldown: 0 },
        { EntityId: 3, Label: 'Cave Camp',  Cooldown: 8 },
        { EntityId: 4, Label: 'Town',       Cooldown: 0 },
    ] }; },
    project(state) { return [['tsic.msg.UI.Teleporter.Destinations', { Destinations: state.destinations }]]; },
    scenarios: [
        { label: 'Three destinations', apply() {} },
        { label: 'One destination',    apply(s) { s.destinations = s.destinations.slice(0, 1); } },
        { label: 'All cooling down',   apply(s) { s.destinations = s.destinations.map(d => ({ ...d, Cooldown: 15 })); } },
        { label: 'No destinations',    apply(s) { s.destinations = []; } },
    ],
});
