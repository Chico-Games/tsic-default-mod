// /screens/behavior-bar.html hosts the LIVE gameplay behavior bar
// (shared/hud-behavior-bar.js), which renders entries arriving on:
//   tsic.msg.UI.BehaviorBar.Entries  { Entries:[{ DisplayName, SubText,
//       StatusInt, bVisible, KeyboardKeyText, GamepadKeyText, BehaviorTagName,
//       CooldownPercent }] }
//   tsic.msg.UI.Input.Mode.Changed   { Mode }  (Gamepad → gamepad glyphs)
//
// StatusInt: 0 available · 1 blocked (hidden) · 2 cooldown · 3 single-use-used.
TSICPlayground.register({
    id: 'behavior-bar',
    label: 'Behavior Bar',
    screen: '/screens/behavior-bar.html',
    initialState() {
        return {
            device: 'kbm',
            entries: [
                { DisplayName: 'Open',   SubText: 'Locker', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E',     GamepadKeyText: 'Face Bottom', BehaviorTagName: 'IA_Interact' },
                { DisplayName: 'Attack',                    StatusInt: 0, bVisible: true, KeyboardKeyText: 'LMB',   GamepadKeyText: 'Right Trigger', BehaviorTagName: 'IA_Attack' },
                { DisplayName: 'Dash',                      StatusInt: 2, bVisible: true, KeyboardKeyText: 'Shift', GamepadKeyText: 'Left Shoulder', BehaviorTagName: 'IA_Dash', CooldownPercent: 0.45 },
            ],
        };
    },
    project(s) {
        const gp = s.device === 'gamepad';
        return [
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: gp ? 'Gamepad' : 'MouseAndKeyboard', Device: s.device, Focus: 'game' }],
            ['tsic.msg.UI.BehaviorBar.Entries', { Entries: s.entries }],
        ];
    },
    controls: [
        {
            type: 'toggle',
            label: 'Gamepad glyphs',
            read(s) { return s.device === 'gamepad'; },
            apply(s, v) { s.device = v ? 'gamepad' : 'kbm'; },
        },
    ],
    scenarios: [
        { label: 'Interact only', apply(s) { s.entries = [
            { DisplayName: 'Open', SubText: 'Door', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E', GamepadKeyText: 'Face Bottom', BehaviorTagName: 'IA_Interact' },
        ]; } },
        { label: 'Combat',        apply(s) { s.entries = [
            { DisplayName: 'Attack', StatusInt: 0, bVisible: true, KeyboardKeyText: 'LMB',   GamepadKeyText: 'Right Trigger', BehaviorTagName: 'IA_Attack' },
            { DisplayName: 'Block',  StatusInt: 0, bVisible: true, KeyboardKeyText: 'RMB',   GamepadKeyText: 'Left Trigger',  BehaviorTagName: 'IA_Block' },
            { DisplayName: 'Dash',   StatusInt: 2, bVisible: true, KeyboardKeyText: 'Shift', GamepadKeyText: 'Left Shoulder', BehaviorTagName: 'IA_Dash', CooldownPercent: 0.7 },
        ]; } },
        { label: 'Cooldown',      apply(s) { s.entries = [
            { DisplayName: 'Dash', StatusInt: 2, bVisible: true, KeyboardKeyText: 'Shift', GamepadKeyText: 'Left Shoulder', BehaviorTagName: 'IA_Dash', CooldownPercent: 0.35 },
        ]; } },
        { label: 'Single-use used', apply(s) { s.entries = [
            { DisplayName: 'Throw', SubText: 'Rock', StatusInt: 3, bVisible: true, KeyboardKeyText: 'Q', GamepadKeyText: 'Face Left', BehaviorTagName: 'IA_Throw' },
        ]; } },
        { label: 'Long sub-text', apply(s) { s.entries = [
            { DisplayName: 'Open', SubText: 'A very long station name that should clip', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E', GamepadKeyText: 'Face Bottom', BehaviorTagName: 'IA_Interact' },
        ]; } },
        { label: 'Empty (hidden)', apply(s) { s.entries = []; } },
    ],
});
