// /screens/stomach.html subscribes to:
//   tsic.msg.UI.Stomach.State  { Slots:[{ItemId, IconUrl, Duration, RemainingTime}] }
TSICPlayground.register({
    id: 'stomach',
    label: 'Stomach',
    screen: '/screens/stomach.html',
    initialState() { return { slots: [
        { ItemId: 'ID_Bread', IconUrl: 'tex://item-icon/ID_Bread', Duration: 60, RemainingTime: 45 },
        { ItemId: 'ID_Apple', IconUrl: 'tex://item-icon/ID_Apple', Duration: 60, RemainingTime: 10 },
        {}, {},
    ] }; },
    project(state) { return [['tsic.msg.UI.Stomach.State', { Slots: state.slots }]]; },
    scenarios: [
        { label: 'Empty',     apply(s) { s.slots = [{}, {}, {}, {}]; } },
        { label: 'Fresh',     apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: 'tex://item-icon/ID_Bread', Duration: 60, RemainingTime: 60 },
            { ItemId: 'ID_Apple', IconUrl: 'tex://item-icon/ID_Apple', Duration: 60, RemainingTime: 60 },
            { ItemId: 'ID_Pie',   IconUrl: 'tex://item-icon/ID_Pie',   Duration: 60, RemainingTime: 60 },
            {},
        ]; } },
        { label: 'Mid-digest',apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: 'tex://item-icon/ID_Bread', Duration: 60, RemainingTime: 30 },
            { ItemId: 'ID_Apple', IconUrl: 'tex://item-icon/ID_Apple', Duration: 60, RemainingTime: 30 },
            {}, {},
        ]; } },
        { label: 'Almost gone',apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: 'tex://item-icon/ID_Bread', Duration: 60, RemainingTime: 4 },
            {}, {}, {},
        ]; } },
    ],
});
