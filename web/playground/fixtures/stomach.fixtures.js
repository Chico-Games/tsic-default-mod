// /screens/stomach.html subscribes to:
//   tsic.msg.UI.Stomach.State  { Slots:[{ItemId, IconUrl, Duration, RemainingTime}] }
TSICPlayground.register({
    id: 'stomach',
    label: 'Stomach',
    screen: '/screens/stomach.html',
    initialState() { return { slots: [
        { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 45 },
        { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 10 },
        {}, {},
    ] }; },
    project(state) { return [['tsic.msg.UI.Stomach.State', { Slots: state.slots }]]; },
    scenarios: [
        { label: 'Empty',          apply(s) { s.slots = [{}, {}, {}, {}]; } },
        { label: 'One slot',       apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 50 },
            {}, {}, {},
        ]; } },
        { label: 'Two slots',      apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 50 },
            { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 50 },
            {}, {},
        ]; } },
        { label: 'Fresh (3 full)', apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 60 },
            { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 60 },
            { ItemId: 'ID_Pie',   IconUrl: '/tex/item-icon/ID_Pie',   Duration: 60, RemainingTime: 60 },
            {},
        ]; } },
        { label: 'Mid-digest',     apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 30 },
            { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 30 },
            {}, {},
        ]; } },
        { label: 'Almost gone',    apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 4 },
            {}, {}, {},
        ]; } },
        { label: 'Mixed timers',   apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 55 },
            { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 25 },
            { ItemId: 'ID_Pie',   IconUrl: '/tex/item-icon/ID_Pie',   Duration: 60, RemainingTime: 6 },
            { ItemId: 'ID_Stew',  IconUrl: '/tex/item-icon/ID_Stew',  Duration: 60, RemainingTime: 58 },
        ]; } },
        { label: 'Full (4 slots)', apply(s) { s.slots = [
            { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 40 },
            { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 50 },
            { ItemId: 'ID_Pie',   IconUrl: '/tex/item-icon/ID_Pie',   Duration: 60, RemainingTime: 35 },
            { ItemId: 'ID_Stew',  IconUrl: '/tex/item-icon/ID_Stew',  Duration: 90, RemainingTime: 75 },
        ]; } },
        { label: 'Long-duration',  apply(s) { s.slots = [
            { ItemId: 'ID_Stew',  IconUrl: '/tex/item-icon/ID_Stew',  Duration: 600, RemainingTime: 480 },
            {}, {}, {},
        ]; } },
    ],
});
