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
        { label: 'Small (3)',       apply(s) { s.Options = Array.from({length: 3},  (_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })); } },
        { label: 'Medium (6)',      apply(s) { s.Options = Array.from({length: 6},  (_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })); }, expect: { visualChange: false } },
        { label: 'Big (24)',        apply(s) { s.Options = Array.from({length: 24}, (_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })); } },
        { label: 'Huge (100)',      apply(s) { s.Options = Array.from({length: 100},(_, i) => ({ OptionId: 'opt' + i, Label: 'Option ' + i })); } },
        { label: 'All disabled',    apply(s) { s.Options = s.Options.map(o => ({ ...o, bDisabled: true })); } },
        { label: 'Half disabled',   apply(s) { s.Options = s.Options.map((o, i) => ({ ...o, bDisabled: i % 2 === 0 })); } },
        { label: 'Long labels',     apply(s) { s.Options = Array.from({length: 6}, (_, i) => ({
            OptionId: 'opt' + i, Label: 'Option with a much longer label, item ' + (i + 1),
        })); } },
        { label: 'Different context', apply(s) { s.Context = 'Select destination'; s.Options = [
            { OptionId: 'beach', Label: 'Beach Hut' },
            { OptionId: 'cave',  Label: 'Cave Camp' },
            { OptionId: 'town',  Label: 'Town Square' },
        ]; } },
        { label: 'Empty',           apply(s) { s.Options = []; } },
    ],
});
