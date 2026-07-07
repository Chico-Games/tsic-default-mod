// /screens/loading-screen.html has no inputs — it cycles its own flavour text
// and animated dots and does not render progress. (The bar/percentage that
// tracked UI.Loading.Progress was removed.)
TSICPlayground.register({
    id: 'loading-screen',
    label: 'Loading Screen',
    screen: '/screens/loading-screen.html',
    initialState() { return {}; },
    project() { return []; },
});
