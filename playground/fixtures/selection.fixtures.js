// /screens/selection.html subscribes to:
//   tsic.msg.UI.Selection.Opened  { Context, Options:[{OptionId, Label, IconUrl, bDisabled}] }
TSICPlayground.register({
    id: 'selection',
    label: 'Selection List',
    screen: '/screens/selection.html',
    initialState() { return {
        Context: 'Pick an item',
        Options: Array.from({length: 6}, (_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })),
    }; },
    project(s) { return [['tsic.msg.UI.Selection.Opened', s]]; },
    scenarios: [
        { label: 'Small (3)',  apply(s) { s.Options = s.Options.slice(0, 3); } },
        { label: 'Big (24)',   apply(s) { s.Options = Array.from({length: 24}, (_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })); } },
        { label: 'With disabled', apply(s) { s.Options = s.Options.map((o, i) => ({ ...o, bDisabled: i % 2 === 0 })); } },
        { label: 'Empty',      apply(s) { s.Options = []; } },
    ],
});
