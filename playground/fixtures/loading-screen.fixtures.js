// /screens/loading-screen.html subscribes to:
//   tsic.msg.UI.Loading.Progress  { Progress, Label }
TSICPlayground.register({
    id: 'loading-screen',
    label: 'Loading Screen',
    screen: '/screens/loading-screen.html',
    initialState() { return { Progress: 0.5, Label: 'Generating world…' }; },
    project(s) { return [['tsic.msg.UI.Loading.Progress', s]]; },
    scenarios: [
        { label: '0%',  apply(s) { s.Progress = 0;   s.Label = 'Booting…'; } },
        { label: '25%', apply(s) { s.Progress = 0.25;s.Label = 'Loading assets…'; } },
        { label: '50%', apply(s) { s.Progress = 0.5; s.Label = 'Generating world…'; } },
        { label: '75%', apply(s) { s.Progress = 0.75;s.Label = 'Spawning entities…'; } },
        { label: '100%',apply(s) { s.Progress = 1;   s.Label = 'Ready'; } },
    ],
});
