// /screens/loading-screen.html subscribes to:
//   tsic.msg.UI.Loading.Progress  { Progress, Label }
// Progress is currently ignored by the screen (no progress bar) — only Label is rendered.
TSICPlayground.register({
    id: 'loading-screen',
    label: 'Loading Screen',
    screen: '/screens/loading-screen.html',
    initialState() { return { Progress: 0, Label: 'Generating world…' }; },
    project(s) { return [['tsic.msg.UI.Loading.Progress', s]]; },
    scenarios: [
        { label: 'Booting',         apply(s) { s.Label = 'Booting…'; } },
        { label: 'Loading assets',  apply(s) { s.Label = 'Loading assets…'; } },
        { label: 'Generating world', apply(s) { s.Label = 'Generating world…'; } },
        { label: 'Spawning entities', apply(s) { s.Label = 'Spawning entities…'; } },
        { label: 'Connecting',      apply(s) { s.Label = 'Connecting to server…'; } },
        { label: 'Trailing dots',   apply(s) { s.Label = 'Loading world data...'; } },
        { label: 'Long label',      apply(s) { s.Label = 'Streaming detail textures and synchronizing entity state with peers…'; } },
        { label: 'No label',        apply(s) { s.Label = ''; } },
    ],
});
