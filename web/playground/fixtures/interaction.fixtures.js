// /screens/test-interaction.html subscribes to:
//   tsic.msg.UI.Interaction.Targets  { Targets:[{EntityId, Label, Category}] }
// Category ("crafting"|"production"|"plantable"|"storage"|"door"|"toggle"|
// "loot"|"shop"|"item"|"interact") tints the prompt and adds a symbol.
TSICPlayground.register({
    id: 'interaction',
    label: 'Interaction',
    screen: '/screens/test-interaction.html',
    initialState() { return { targets: [
        { EntityId: 1, Label: 'Open Storage', Category: 'storage' },
    ] }; },
    project(state) { return [['tsic.msg.UI.Interaction.Targets', { Targets: state.targets }]]; },
    scenarios: [
        { label: 'None',             apply(s) { s.targets = []; } },
        { label: 'Open Storage',     apply(s) { s.targets = [{ EntityId: 1, Label: 'Open Storage', Category: 'storage' }]; } },
        { label: 'Pick-up item',     apply(s) { s.targets = [{ EntityId: 42, Label: 'Pick up Hammer', Category: 'item' }]; } },
        { label: 'Crafting station', apply(s) { s.targets = [{ EntityId: 12, Label: 'Craft', Category: 'crafting' }]; } },
        { label: 'Production machine', apply(s) { s.targets = [{ EntityId: 13, Label: 'Use Assembler', Category: 'production' }]; } },
        { label: 'Plantable',        apply(s) { s.targets = [{ EntityId: 14, Label: 'Plant Seed', Category: 'plantable' }]; } },
        { label: 'Locked door',      apply(s) { s.targets = [{ EntityId: 9, Label: 'Locked', Category: 'door' }]; } },
        { label: 'Uncategorised',    apply(s) { s.targets = [{ EntityId: 1, Label: 'Activate the ancient mechanism' }]; } },
    ],
});
