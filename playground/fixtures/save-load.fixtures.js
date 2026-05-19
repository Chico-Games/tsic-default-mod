// /screens/save-load.html subscribes to:
//   tsic.msg.UI.Save.Slots  { Slots:[{SlotId, Label, TimestampIso}] }
TSICPlayground.register({
    id: 'save-load',
    label: 'Save / Load',
    screen: '/screens/save-load.html',
    initialState() { return { slots: [
        { SlotId: 'auto',   Label: 'Auto-save',    TimestampIso: '2026-05-19T11:00:00' },
        { SlotId: 'manual', Label: 'Beach Hut',    TimestampIso: '2026-05-18T19:30:00' },
        { SlotId: 'forest', Label: 'Forest Camp',  TimestampIso: '2026-05-17T08:12:00' },
    ] }; },
    project(state) { return [['tsic.msg.UI.Save.Slots', { Slots: state.slots }]]; },
    scenarios: [
        { label: 'Three slots', apply() {} },
        { label: 'Empty',       apply(s) { s.slots = []; } },
        { label: 'Single auto', apply(s) { s.slots = [{ SlotId: 'auto', Label: 'Auto-save', TimestampIso: '2026-05-19T12:00:00' }]; } },
    ],
});
