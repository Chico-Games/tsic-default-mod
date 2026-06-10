// /screens/test-interaction.html subscribes to:
//   tsic.msg.UI.Interaction.Targets  { Targets:[{EntityId, Label}] }
TSICPlayground.register({
    id: 'interaction',
    label: 'Interaction',
    screen: '/screens/test-interaction.html',
    initialState() { return { targets: [
        { EntityId: 1, Label: 'Open Storage' },
    ] }; },
    project(state) { return [['tsic.msg.UI.Interaction.Targets', { Targets: state.targets }]]; },
    scenarios: [
        { label: 'None',           apply(s) { s.targets = []; } },
        { label: 'Open Storage',   apply(s) { s.targets = [{ EntityId: 1, Label: 'Open Storage' }]; } },
        { label: 'Pick-up item',   apply(s) { s.targets = [{ EntityId: 42, Label: 'Pick up Hammer' }]; } },
        { label: 'Locked door',    apply(s) { s.targets = [{ EntityId: 9, Label: 'Locked' }]; } },
        { label: 'Long label',     apply(s) { s.targets = [{ EntityId: 1, Label: 'Activate the ancient mechanism' }]; } },
    ],
});
