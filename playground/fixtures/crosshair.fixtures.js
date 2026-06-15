// /screens/test-crosshair.html subscribes to:
//   tsic.msg.UI.Input.Mode.Changed  { Mode, Device, Focus }
// Hides dot when Device==='mouse' && Focus==='ui'.
TSICPlayground.register({
    id: 'crosshair',
    label: 'Crosshair',
    screen: '/screens/test-crosshair.html',
    initialState() { return { mode: 'MouseAndKeyboard', device: 'mouse', focus: 'game' }; },
    project(s) { return [['tsic.msg.UI.Input.Mode.Changed', { Mode: s.mode, Device: s.device, Focus: s.focus }]]; },
    // Crosshair page only visually changes on the (mouse,ui) combo — all other
    // device/mode/focus permutations show the same dot. Inject still fires, so
    // these scenarios assert injects but mark visualChange:false explicitly.
    scenarios: [
        { label: 'Visible (game)',    apply(s) { s.mode = 'MouseAndKeyboard'; s.device = 'mouse';   s.focus = 'game'; }, expect: { visualChange: false } },
        { label: 'Hidden (ui)',       apply(s) { s.mode = 'MouseAndKeyboard'; s.device = 'mouse';   s.focus = 'ui'; },   expect: { visualChange: true  } },
        { label: 'Gamepad in game',   apply(s) { s.mode = 'Gamepad';          s.device = 'gamepad'; s.focus = 'game'; }, expect: { visualChange: false } },
        { label: 'Gamepad in UI',     apply(s) { s.mode = 'Gamepad';          s.device = 'gamepad'; s.focus = 'ui'; },   expect: { visualChange: false } },
        { label: 'Touch in game',     apply(s) { s.mode = 'Touch';            s.device = 'touch';   s.focus = 'game'; }, expect: { visualChange: false } },
        { label: 'Touch in UI',       apply(s) { s.mode = 'Touch';            s.device = 'touch';   s.focus = 'ui'; },   expect: { visualChange: false } },
        { label: 'Mode toggle: KBM',  apply(s) { s.mode = 'MouseAndKeyboard'; s.device = 'mouse';   s.focus = 'game'; }, expect: { visualChange: false } },
    ],
});
