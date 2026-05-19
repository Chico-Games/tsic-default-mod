// /screens/lore.html subscribes via shared/lore.js to:
//   tsic.msg.UI.LoreScreen.Opened  { ScreenKind, Texts:[{Heading, Body}], InitialIndex }
TSICPlayground.register({
    id: 'lore',
    label: 'Lore',
    screen: '/screens/lore.html',
    initialState() { return {
        Texts: [
            { Heading: 'The Store',  Body: 'In the beginning the store was open. Always open. Always lit.' },
            { Heading: 'The Stock',  Body: 'Items were once arranged on shelves by mortal hands. Now they drift.' },
            { Heading: 'The Closing',Body: 'On the day of closing the lights went out. The doors did not open again.' },
        ],
        InitialIndex: 0,
    }; },
    project(s) { return [['tsic.msg.UI.LoreScreen.Opened', { Texts: s.Texts, InitialIndex: s.InitialIndex }]]; },
    scenarios: [
        { label: 'Three entries', apply() {} },
        { label: 'Start at last', apply(s) { s.InitialIndex = s.Texts.length - 1; } },
        { label: 'Empty',         apply(s) { s.Texts = []; } },
    ],
});
