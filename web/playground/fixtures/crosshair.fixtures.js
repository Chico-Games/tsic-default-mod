// /screens/test-crosshair.html subscribes to:
//   tsic.msg.UI.Input.Mode.Changed   { Mode, Device, Focus }
//   tsic.msg.UI.Interaction.Targets  { Targets, bDraggable, bDragging }
// Hides dot when Device==='mouse' && Focus==='ui'. The look target's Category
// drives a subtle halo animation (data-cat); a slightly transparent hand icon
// shows beside the dot while the target is draggable, solid ring while dragging.
TSICPlayground.register({
    id: 'crosshair',
    label: 'Crosshair',
    screen: '/screens/test-crosshair.html',
    initialState() { return { mode: 'MouseAndKeyboard', device: 'mouse', focus: 'game', draggable: false, dragging: false, category: '' }; },
    project(s) {
        var targets = s.category ? [{ EntityId: 1, Label: 'Interact', Category: s.category }] : [];
        return [
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: s.mode, Device: s.device, Focus: s.focus }],
            ['tsic.msg.UI.Interaction.Targets', { Targets: targets, bDraggable: s.draggable, bDragging: s.dragging }],
        ];
    },
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
        { label: 'Looking at draggable', apply(s) { s.draggable = true;  s.dragging = false; }, expect: { visualChange: true } },
        { label: 'Dragging',             apply(s) { s.draggable = true;  s.dragging = true; },  expect: { visualChange: true } },
        { label: 'Dropped / looked away', apply(s) { s.draggable = false; s.dragging = false; }, expect: { visualChange: true } },
        { label: 'Looking at crafting',   apply(s) { s.category = 'crafting'; },   expect: { visualChange: true } },
        { label: 'Looking at production', apply(s) { s.category = 'production'; }, expect: { visualChange: true } },
        { label: 'Looking at plantable',  apply(s) { s.category = 'plantable'; },  expect: { visualChange: true } },
        { label: 'Looking at nothing',    apply(s) { s.category = ''; },           expect: { visualChange: true } },
    ],
});
