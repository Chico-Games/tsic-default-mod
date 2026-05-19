// /screens/crosshair.html subscribes to:
//   tsic.msg.UI.Input.Mode.Changed  { Mode, Device, Focus }
// Hides dot when Device==='mouse' && Focus==='ui'.
TSICPlayground.register({
    id: 'crosshair',
    label: 'Crosshair',
    screen: '/screens/crosshair.html',
    initialState() { return { mode: 'MouseAndKeyboard', device: 'mouse', focus: 'game' }; },
    project(s) { return [['tsic.msg.UI.Input.Mode.Changed', { Mode: s.mode, Device: s.device, Focus: s.focus }]]; },
    scenarios: [
        { label: 'Visible (game)', apply(s) { s.focus = 'game'; } },
        { label: 'Hidden (ui)',    apply(s) { s.focus = 'ui'; } },
        { label: 'Gamepad',        apply(s) { s.device = 'gamepad'; s.focus = 'game'; } },
    ],
});
