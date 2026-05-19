// /screens/settings.html subscribes to:
//   tsic.msg.UI.Settings.Catalog    { Json: <serialized Pages tree> }
//   tsic.msg.UI.Settings.Value      { Key, ValueJson }
//   tsic.msg.UI.Settings.Footer     { AnyDirty, RestartRequired, ApplyCountdownSeconds }
//   tsic.msg.UI.Settings.ApplyToast { CountdownSeconds }
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
            Footer: { AnyDirty: false, RestartRequired: false, ApplyCountdownSeconds: -1 },
        } };
    },
    project(state) {
        return [['tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify(state.catalog) }]];
    },
    scenarios: [
        { label: 'Default',    apply() {} },
        { label: 'Restart required', apply(s) { s.catalog.Footer.RestartRequired = true; } },
        { label: 'Quiet audio',apply(s) {
            for (const p of s.catalog.Pages) for (const g of p.Groups) for (const f of g.Settings) {
                if (f.Key && f.Key.startsWith('audio.')) f.Value = 0.1;
            }
        } },
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
