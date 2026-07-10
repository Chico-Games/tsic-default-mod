// /screens/settings.html subscribes to:
//   tsic.msg.UI.Settings.Catalog       { Json: <serialized Pages tree> }
//   tsic.msg.UI.Settings.ControlsState { Entries, MouseSensitivity, … } -> KB&M + Controller tabs
//   tsic.msg.UI.Settings.Value         { Key, ValueJson }
//   tsic.msg.UI.Settings.Footer        { RestartRequired }
// Settings apply instantly; video.* keys open the keep/revert countdown owned
// by the page — drive it by changing a video control.
TSICPlayground.register({
    id: 'settings',
    label: 'Settings',
    screen: '/screens/settings.html',
    initialState() {
        return { catalog: {
            Pages: [
                { Id: 'AudioCollection', Title: 'Audio', Groups: [
                    { Id: 'Levels', Title: 'Levels', Settings: [
                        { Key: 'audio.master', Label: 'Master volume', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.8 },
                        { Key: 'audio.music',  Label: 'Music volume',  Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.5 },
                        { Key: 'audio.sfx',    Label: 'SFX volume',    Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.7 },
                    ] },
                ] },
                { Id: 'VideoCollection', Title: 'Video', Groups: [
                    { Id: 'Display', Title: 'Display', Settings: [
                        { Key: 'video.fullscreen', Label: 'Fullscreen', Type: 'bool', Value: true },
                        { Key: 'video.resolution', Label: 'Resolution', Type: 'enum',
                          Options: [{Value:'1920x1080',Label:'1920x1080'},{Value:'2560x1440',Label:'2560x1440'},{Value:'3840x2160',Label:'3840x2160'}],
                          Value: '2560x1440' },
                    ] },
                ] },
                { Id: 'GameplayCollection', Title: 'Gameplay', Groups: [
                    { Id: 'Controls', Title: 'Controls', Settings: [
                        { Key: 'gameplay.fov',    Label: 'Field of view', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                        { Key: 'gameplay.inv_key',Label: 'Inventory key', Type: 'keybind',
                          Bindings: [{ Slot: 0, Display: 'Tab', Key: 'Tab' }] },
                    ] },
                ] },
            ],
            Footer: { RestartRequired: false },
        },
        controls: {
            Entries: [
                { HotkeyId: 'HK_Crouch', DisplayName: 'Crouch', BehaviorsLabel: 'Crouch',
                  KeyboardKeyText: 'Left Control', GamepadKeyText: 'Gamepad Right Thumbstick Button',
                  bKeyboardRemappable: true, bGamepadRemappable: true,
                  bToggleable: true, HoldToggle: 0, ToggleBehaviorTagName: 'Input.Behavior.Crouch' },
                { HotkeyId: 'HK_Sprint', DisplayName: 'Sprint', BehaviorsLabel: 'Sprint',
                  KeyboardKeyText: 'Left Shift', GamepadKeyText: 'Gamepad Left Thumbstick Button',
                  bKeyboardRemappable: true, bGamepadRemappable: true,
                  bToggleable: true, HoldToggle: 1, ToggleBehaviorTagName: 'Input.Behavior.Sprint' },
                { HotkeyId: 'HK_Interact', DisplayName: 'Interact', BehaviorsLabel: 'Interact, Open Storage',
                  KeyboardKeyText: 'E', GamepadKeyText: 'Gamepad Face Button Bottom',
                  bKeyboardRemappable: true, bGamepadRemappable: true,
                  bToggleable: false, HoldToggle: 0, ToggleBehaviorTagName: '' },
                { HotkeyId: 'HK_Inventory', DisplayName: 'Inventory', BehaviorsLabel: 'Inventory',
                  KeyboardKeyText: 'Tab', GamepadKeyText: 'Gamepad Special Left',
                  bKeyboardRemappable: true, bGamepadRemappable: true,
                  bToggleable: false, HoldToggle: 0, ToggleBehaviorTagName: '' },
                { HotkeyId: 'HK_Map', DisplayName: 'Map', BehaviorsLabel: 'Map',
                  KeyboardKeyText: 'M', GamepadKeyText: '',
                  bKeyboardRemappable: true, bGamepadRemappable: false,
                  bToggleable: false, HoldToggle: 0, ToggleBehaviorTagName: '' },
            ],
            MouseSensitivity: 1, GamepadSensitivity: 0.5, GamepadDeadzone: 0.15,
            bInvertMouseY: false, bInvertGamepadY: false,
        } };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify(state.catalog) }],
            ['tsic.msg.UI.Settings.ControlsState', state.controls],
        ];
    },
    // The settings page only re-renders the visible page (Audio first), so
    // changes to non-displayed pages or to Footer flags don't move the
    // currently-shown pane.  Mark those scenarios visualChange:false; the
    // inject is the assertion that matters.
    scenarios: [
        { label: 'Default',           apply() {},                                                                                  expect: { visualChange: false } },
        { label: 'Restart required',  apply(s) { s.catalog.Footer.RestartRequired = true; } },
        { label: 'Quiet audio',       apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key && f.Key.startsWith('audio.')) f.Value = 0.1;
            }
        } },
        { label: 'Audio muted',       apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key && f.Key.startsWith('audio.')) f.Value = 0;
            }
        } },
        { label: 'Audio max',         apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key && f.Key.startsWith('audio.')) f.Value = 1.0;
            }
        } },
        { label: 'Windowed 1080',     apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key === 'video.fullscreen') f.Value = false;
                if (f.Key === 'video.resolution') f.Value = '1920x1080';
            }
        }, expect: { visualChange: false } },
        { label: 'Wide FOV (110)',    apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key === 'gameplay.fov') f.Value = 110;
            }
        }, expect: { visualChange: false } },
        { label: 'Narrow FOV (60)',   apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key === 'gameplay.fov') f.Value = 60;
            }
        }, expect: { visualChange: false } },
        { label: 'No keybind',        apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Type === 'keybind') f.Bindings = [];
            }
        }, expect: { visualChange: false } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Settings.Set' && payload && payload.Key) {
            let v = null;
            try { v = JSON.parse(payload.ValueJson); } catch (e) {}
            for (const p of state.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key === payload.Key) f.Value = v;
            }
        }
    },
});
