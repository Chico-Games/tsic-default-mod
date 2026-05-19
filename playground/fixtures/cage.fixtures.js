// /screens/cage.html subscribes to:
//   tsic.msg.UI.Selection.Opened  (reuses selection screen envelope)
TSICPlayground.register({
    id: 'cage',
    label: 'Cage',
    screen: '/screens/cage.html',
    initialState() { return {
        Context: 'Cage contents',
        Options: [
            { OptionId: 'ID_CapturedMimic_CE',   Label: 'Captured Mimic' },
            { OptionId: 'ID_CapturedSpider_CE',  Label: 'Captured Spider' },
        ],
    }; },
    project(s) { return [['tsic.msg.UI.Selection.Opened', s]]; },
    scenarios: [
        { label: 'Two captured', apply() {} },
        { label: 'Empty',        apply(s) { s.Options = []; } },
        { label: 'One captured', apply(s) { s.Options = [{ OptionId: 'ID_CapturedMimic_CE', Label: 'Captured Mimic' }]; } },
    ],
});
