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
        { label: 'None',          apply(s) { s.targets = []; } },
        { label: 'Primary only',  apply(s) { s.targets = [{ EntityId: 1, Label: 'Open Storage', bIsPrimary: true }]; }, expect: { visualChange: false } },
        { label: 'Primary + alt', apply(s) { s.targets = [
            { EntityId: 1, Label: 'Open Storage', bIsPrimary: true },
            { EntityId: 1, Label: 'Inspect',      bIsPrimary: false },
        ]; } },
        { label: 'Pick-up item',  apply(s) { s.targets = [
            { EntityId: 42, Label: 'Pick up Hammer', bIsPrimary: true },
        ]; } },
        { label: 'Locked door',   apply(s) { s.targets = [
            { EntityId: 9, Label: 'Locked',  bIsPrimary: false },
            { EntityId: 9, Label: 'Inspect', bIsPrimary: false },
        ]; } },
        { label: 'Construction',  apply(s) { s.targets = [
            { EntityId: 7, Label: 'Place',  bIsPrimary: true },
            { EntityId: 7, Label: 'Rotate', bIsPrimary: false },
            { EntityId: 7, Label: 'Cancel', bIsPrimary: false },
        ]; } },
        { label: 'Multiple alts', apply(s) { s.targets = [
            { EntityId: 1, Label: 'Open',    bIsPrimary: true },
            { EntityId: 1, Label: 'Repair',  bIsPrimary: false },
            { EntityId: 1, Label: 'Upgrade', bIsPrimary: false },
            { EntityId: 1, Label: 'Break',   bIsPrimary: false },
        ]; } },
        { label: 'Long label',    apply(s) { s.targets = [
            { EntityId: 1, Label: 'Activate the ancient mechanism', bIsPrimary: true },
        ]; } },
    ],
});
