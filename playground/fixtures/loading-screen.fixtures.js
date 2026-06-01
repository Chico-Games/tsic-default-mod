// /screens/loading-screen.html subscribes to:
//   tsic.msg.UI.Loading.Progress  { Progress, Label }
// Progress is a 0..1 float (clamped server-side) rendered as a bar + percentage.
// Label is the status line. Progress values below mirror the real in-game
// reporters (WorldGen 0.1/0.4/0.6, SaveLoad 0.5 — see ScpLoadingScreenSubsystem).
TSICPlayground.register({
    id: 'loading-screen',
    label: 'Loading Screen',
    screen: '/screens/loading-screen.html',
    initialState() { return { Progress: 0, Label: 'Generating world…' }; },
    project(s) { return [['tsic.msg.UI.Loading.Progress', s]]; },
    scenarios: [
        { label: 'Loading world data',  apply(s) { s.Label = 'Loading world data';   s.Progress = 0.1; } },
        { label: 'Processing world',    apply(s) { s.Label = 'Processing world data'; s.Progress = 0.4; } },
        { label: 'Loading world save',  apply(s) { s.Label = 'Loading world save';    s.Progress = 0.5; } },
        { label: 'Generating mazes',    apply(s) { s.Label = 'Generating mazes';      s.Progress = 0.6; } },
    ],
    controls: [
        {
            label: 'Progress',
            min: 0, max: 1, step: 0.01,
            read(s) { return s.Progress; },
            apply(s, v) { s.Progress = v; },
            format(v) { return Math.round(v * 100) + '%'; },
        },
    ],
});
