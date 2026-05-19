// /screens/interaction.html subscribes to:
//   tsic.msg.UI.Interaction.Targets  { Targets:[{EntityId, Label, bIsPrimary}] }
TSICPlayground.register({
    id: 'interaction',
    label: 'Interaction',
    screen: '/screens/interaction.html',
    initialState() { return { targets: [
        { EntityId: 1, Label: 'Open Storage', bIsPrimary: true },
    ] }; },
    project(state) { return [['tsic.msg.UI.Interaction.Targets', { Targets: state.targets }]]; },
    scenarios: [
        { label: 'None',      apply(s) { s.targets = []; } },
        { label: 'Primary only', apply(s) { s.targets = [{ EntityId: 1, Label: 'Open Storage', bIsPrimary: true }]; } },
        { label: 'Primary + alt', apply(s) { s.targets = [
            { EntityId: 1, Label: 'Open Storage', bIsPrimary: true },
            { EntityId: 1, Label: 'Inspect',      bIsPrimary: false },
        ]; } },
        { label: 'Multiple alts', apply(s) { s.targets = [
            { EntityId: 1, Label: 'Open',    bIsPrimary: true },
            { EntityId: 1, Label: 'Repair',  bIsPrimary: false },
            { EntityId: 1, Label: 'Upgrade', bIsPrimary: false },
            { EntityId: 1, Label: 'Break',   bIsPrimary: false },
        ]; } },
    ],
});
