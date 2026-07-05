// /screens/paper.html subscribes via shared/lore.js to:
//   tsic.msg.UI.LoreScreen.Opened  { ScreenKind, Texts:[{Heading, Body}], InitialIndex }
TSICPlayground.register({
    id: 'lore',
    label: 'Lore / Paper',
    screen: '/screens/paper.html',
    initialState() { return {
        Texts: [
            { Heading: 'The Store',   Body: 'In the beginning the store was open. Always open. Always lit.' },
            { Heading: 'The Stock',   Body: 'Items were once arranged on shelves by mortal hands. Now they drift.' },
            { Heading: 'The Closing', Body: 'On the day of closing the lights went out. The doors did not open again.' },
        ],
        InitialIndex: 0,
    }; },
    project(s) { return [['tsic.msg.UI.LoreScreen.Opened', { Texts: s.Texts, InitialIndex: s.InitialIndex }]]; },
    scenarios: [
        { label: 'Three entries',  apply() {} },
        { label: 'One entry',      apply(s) { s.Texts = [s.Texts[0]]; s.InitialIndex = 0; } },
        { label: 'Start at last',  apply(s) { s.InitialIndex = s.Texts.length - 1; } },
        { label: 'Start mid',      apply(s) {
            s.Texts = [...s.Texts, { Heading: 'Aftermath', Body: 'The shelves are still here. So are the things on them.' }];
            s.InitialIndex = 2;
        } },
        { label: 'Long body',      apply(s) { s.Texts = [{
            Heading: 'A long letter',
            Body: Array.from({length: 8}, (_, i) => 'Paragraph ' + (i + 1) + ': it is dark in here and the only light comes from the cooler. We have rationed the bread but the bread is no longer bread. We do not understand what is happening but we have begun to write it down. Perhaps someone will read this. Perhaps no one will. The clock on the wall has stopped.').join('\n\n'),
        }]; s.InitialIndex = 0; } },
        { label: 'Many entries',   apply(s) { s.Texts = Array.from({length: 10}, (_, i) => ({
            Heading: 'Entry ' + (i + 1),
            Body: 'Body for entry ' + (i + 1) + '. The store remembers.',
        })); s.InitialIndex = 0; } },
        { label: 'Empty headings', apply(s) { s.Texts = [
            { Heading: '', Body: 'A page with no title.' },
            { Heading: '', Body: 'And another.' },
        ]; s.InitialIndex = 0; } },
        { label: 'Empty',          apply(s) { s.Texts = []; } },
    ],
});
