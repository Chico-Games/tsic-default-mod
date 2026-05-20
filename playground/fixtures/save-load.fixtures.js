// /screens/save-load.html subscribes to:
//   tsic.msg.UI.Save.Slots  { Slots:[{SlotId, Label, TimestampIso}] }
TSICPlayground.register({
    id: 'save-load',
    label: 'Save / Load',
    screen: '/screens/save-load.html',
    initialState() { return { slots: [
        { SlotId: 'auto',   Label: 'Auto-save',   TimestampIso: '2026-05-19T11:00:00' },
        { SlotId: 'manual', Label: 'Beach Hut',   TimestampIso: '2026-05-18T19:30:00' },
        { SlotId: 'forest', Label: 'Forest Camp', TimestampIso: '2026-05-17T08:12:00' },
    ] }; },
    project(state) { return [['tsic.msg.UI.Save.Slots', { Slots: state.slots }]]; },
    scenarios: [
        { label: 'Three slots',     apply() {}, expect: { visualChange: false } },
        { label: 'Empty',           apply(s) { s.slots = []; } },
        { label: 'Single auto',     apply(s) { s.slots = [{ SlotId: 'auto', Label: 'Auto-save', TimestampIso: '2026-05-19T12:00:00' }]; } },
        { label: 'Just-saved auto', apply(s) {
            const now = new Date().toISOString().slice(0,19);
            s.slots = [
                { SlotId: 'auto', Label: 'Auto-save', TimestampIso: now },
                ...s.slots.slice(1),
            ];
        } },
        { label: 'Many slots (8)',  apply(s) { s.slots = Array.from({length: 8}, (_, i) => ({
            SlotId: 'manual_' + i,
            Label: ['Beach Hut','Forest Camp','Cave','Town','Bridge','Field','Workshop','Vault'][i],
            TimestampIso: '2026-05-' + (10 + i).toString().padStart(2,'0') + 'T12:00:00',
        })); } },
        { label: 'Old saves',       apply(s) { s.slots = s.slots.map(slot => ({
            ...slot, TimestampIso: '2023-01-01T00:00:00',
        })); } },
        { label: 'Long labels',     apply(s) { s.slots = [
            { SlotId: 'a', Label: 'My main run through the woods near the old mill',  TimestampIso: '2026-05-19T11:00:00' },
            { SlotId: 'b', Label: 'Coop session with everyone',                       TimestampIso: '2026-05-18T19:30:00' },
        ]; } },
        { label: 'Unnamed slots',   apply(s) { s.slots = [
            { SlotId: 'a', Label: '', TimestampIso: '2026-05-19T11:00:00' },
            { SlotId: 'b', Label: '', TimestampIso: '2026-05-18T19:30:00' },
        ]; } },
    ],
});
