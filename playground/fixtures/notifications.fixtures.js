// /screens/test-notifications.html subscribes to:
//   tsic.msg.UI.Notification.Show  { Type, Title, Text, IconUrl }
TSICPlayground.register({
    id: 'notifications',
    label: 'Notifications',
    screen: '/screens/test-notifications.html',
    initialState() { return { nextId: 0, lastToast: null }; },
    project(state) {
        // Sticky channel — when a scenario sets lastToast, re-inject re-fires
        // the toast. To force a re-spawn on repeat clicks we bump nextId.
        if (!state.lastToast) return [];
        return [['tsic.msg.UI.Notification.Show', { ...state.lastToast, _id: state.nextId }]];
    },
    scenarios: [
        { label: 'Tip',          apply(s) { s.nextId++; s.lastToast = { Type: 'Tip',     Title: 'Welcome',  Text: 'Press Tab to open inventory.' }; } },
        { label: 'Success',      apply(s) { s.nextId++; s.lastToast = { Type: 'Success', Title: 'Crafted',  Text: 'You crafted bread.' }; } },
        { label: 'Warning',      apply(s) { s.nextId++; s.lastToast = { Type: 'Warning', Title: 'Heavy',    Text: 'You are overburdened.' }; } },
        { label: 'Error',        apply(s) { s.nextId++; s.lastToast = { Type: 'Error',   Title: 'Failed',   Text: 'Not enough materials.' }; } },
        { label: 'Info',         apply(s) { s.nextId++; s.lastToast = { Type: 'Info',    Title: 'Server',   Text: 'A friend joined the game.' }; } },
        { label: 'Long body',    apply(s) { s.nextId++; s.lastToast = { Type: 'Tip',
            Title: 'Stamina', Text: 'Sprinting drains stamina faster than walking; rest to regain it. Pacing matters when you carry heavy loads.' }; } },
        { label: 'Long title',   apply(s) { s.nextId++; s.lastToast = { Type: 'Warning',
            Title: 'The nightmare approaches once again',
            Text: 'Get inside before dark.' }; } },
        { label: 'Title only',   apply(s) { s.nextId++; s.lastToast = { Type: 'Success', Title: 'Saved' }; } },
        { label: 'Stack 5',      apply(s) {
            // Bump 5 times — host re-projects only once per scenario click,
            // so this is best-effort: just refresh with a new title to show
            // the stacking behaviour. Click the scenario rapidly to stack.
            s.nextId++;
            s.lastToast = { Type: 'Tip', Title: 'Burst #' + s.nextId, Text: 'Repeat-click to stack.' };
        } },
    ],
});
