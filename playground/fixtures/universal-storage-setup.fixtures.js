// /screens/universal-storage-setup.html subscribes to:
//   tsic.msg.UI.UniversalStorage.Groups  { GroupNames:[string] }
TSICPlayground.register({
    id: 'universal-storage-setup',
    label: 'Universal-Storage Setup',
    screen: '/screens/universal-storage-setup.html',
    initialState() { return { groups: ['Default', 'Storeroom'] }; },
    project(state) { return [['tsic.msg.UI.UniversalStorage.Groups', { GroupNames: state.groups }]]; },
    scenarios: [
        { label: 'Two groups',  apply() {} },
        { label: 'No groups',   apply(s) { s.groups = []; } },
        { label: 'Many groups', apply(s) { s.groups = ['Default','Storeroom','Cellar','Kitchen','Basement']; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.UniversalStorage.CreateGroup' && payload.GroupName) {
            if (!state.groups.includes(payload.GroupName)) state.groups.push(payload.GroupName);
        }
    },
});
