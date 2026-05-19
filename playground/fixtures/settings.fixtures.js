// /screens/settings.html subscribes to:
//   tsic.msg.UI.Settings.Catalog  { Json: <serialized catalog> }
//   tsic.msg.UI.Settings.Value    { Key, ValueJson }
// The catalog JSON contains Groups with Settings inside.
TSICPlayground.register({
    id: 'settings',
    label: 'Settings',
    screen: '/screens/settings.html',
    initialState() {
        return { catalog: {
            Groups: [
                { Label: 'Audio', Settings: [
                    { Key: 'audio.master', Label: 'Master volume', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.8 },
                    { Key: 'audio.music',  Label: 'Music volume',  Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.5 },
                    { Key: 'audio.sfx',    Label: 'SFX volume',    Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 0.7 },
                ] },
                { Label: 'Video', Settings: [
                    { Key: 'video.fullscreen', Label: 'Fullscreen', Type: 'bool', Value: true },
                    { Key: 'video.resolution', Label: 'Resolution', Type: 'enum',
                      Options: ['1920x1080','2560x1440','3840x2160'], Value: '2560x1440' },
                ] },
                { Label: 'Gameplay', Settings: [
                    { Key: 'gameplay.fov',    Label: 'Field of view', Type: 'int', Min: 60, Max: 120, Step: 1, Value: 90 },
                    { Key: 'gameplay.inv_key',Label: 'Inventory key', Type: 'keybind', Value: 'Tab' },
                ] },
            ],
        } };
    },
    project(state) {
        return [['tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify(state.catalog) }]];
    },
    scenarios: [
        { label: 'Default',    apply() {} },
        { label: 'Quiet audio',apply(s) {
            for (const g of s.catalog.Groups) for (const f of g.Settings) {
                if (f.Key.startsWith('audio.')) f.Value = 0.1;
            }
        } },
        { label: 'Minimal',    apply(s) {
            s.catalog = { Groups: [{ Label: 'Audio', Settings: [
                { Key: 'audio.master', Label: 'Master', Type: 'range', Min: 0, Max: 1, Step: 0.01, Value: 1 },
            ] }] };
        } },
    ],
    onPublish(state, channel, payload) {
        // Settings page emits UI.Cmd.Settings.Set { Key, ValueJson }
        if (channel === 'UI.Cmd.Settings.Set' && payload && payload.Key) {
            let v = null;
            try { v = JSON.parse(payload.ValueJson); } catch (e) {}
            for (const g of state.catalog.Groups) for (const f of g.Settings) {
                if (f.Key === payload.Key) f.Value = v;
            }
        }
    },
});
