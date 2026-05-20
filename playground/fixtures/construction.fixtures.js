// /screens/construction.html subscribes to:
//   tsic.msg.UI.Construction.Available  { Items:[{EntityDefId, Name, Category, IconUrl, bAffordable, Cost:[{ItemId,Count,HaveCount}]}] }
//   tsic.msg.UI.Construction.PreviewState { bCanPlace, FailureReason, RotationAxis }
TSICPlayground.register({
    id: 'construction',
    label: 'Construction',
    screen: '/screens/construction.html',
    catalogs: { items: {
        ID_Wood:  { Name: 'Wood',  Category: 'CraftingMaterial', Weight: 1 },
        ID_Stone: { Name: 'Stone', Category: 'CraftingMaterial', Weight: 2 },
        ID_Iron:  { Name: 'Iron',  Category: 'CraftingMaterial', Weight: 1.5 },
        ID_Nail:  { Name: 'Nail',  Category: 'CraftingMaterial', Weight: 0.05 },
    } },
    initialState() {
        return {
            available: {
                Items: [
                    { EntityDefId: 'CBD_Table_Constructed',    Name: 'Table',    Category: 'Furniture',
                      Cost: [{ItemId:'ID_Wood',Count:6,HaveCount:12}], bAffordable: true },
                    { EntityDefId: 'CBD_Chair_Constructed',    Name: 'Chair',    Category: 'Furniture',
                      Cost: [{ItemId:'ID_Wood',Count:3,HaveCount:12}], bAffordable: true },
                    { EntityDefId: 'CBD_Bookcase_Constructed', Name: 'Bookcase', Category: 'Furniture',
                      Cost: [{ItemId:'ID_Wood',Count:10,HaveCount:12},{ItemId:'ID_Stone',Count:2,HaveCount:0}], bAffordable: false },
                ],
            },
            preview: { bCanPlace: true, FailureReason: '', RotationAxis: 'Yaw' },
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Construction.Available', state.available],
            ['tsic.msg.UI.Construction.PreviewState', state.preview],
        ];
    },
    scenarios: [
        { label: 'Valid placement',     apply(s) { s.preview = { bCanPlace: true,  FailureReason: '', RotationAxis: 'Yaw' }; }, expect: { visualChange: false } },
        { label: 'Blocked (overlap)',   apply(s) { s.preview = { bCanPlace: false, FailureReason: 'Overlap', RotationAxis: 'Yaw' }; } },
        { label: 'Blocked (no floor)',  apply(s) { s.preview = { bCanPlace: false, FailureReason: 'NoFloor', RotationAxis: 'Yaw' }; } },
        { label: 'Blocked (too far)',   apply(s) { s.preview = { bCanPlace: false, FailureReason: 'OutOfRange', RotationAxis: 'Yaw' }; } },
        { label: 'Pitch rotation',      apply(s) { s.preview = { bCanPlace: true,  FailureReason: '', RotationAxis: 'Pitch' }; } },
        { label: 'Roll rotation',       apply(s) { s.preview = { bCanPlace: true,  FailureReason: '', RotationAxis: 'Roll' }; } },
        { label: 'Out of materials',    apply(s) { s.available.Items = s.available.Items.map(it => ({ ...it, bAffordable: false })); } },
        { label: 'All affordable',      apply(s) { s.available.Items = s.available.Items.map(it => ({
            ...it, bAffordable: true,
            Cost: (it.Cost || []).map(c => ({ ...c, HaveCount: c.Count * 4 })),
        })); } },
        { label: 'Many items (12)',     apply(s) { s.available.Items = Array.from({length: 12}, (_, i) => ({
            EntityDefId: 'CBD_Item' + i,
            Name: ['Table','Chair','Bookcase','Bed','Lamp','Stool','Desk','Cabinet','Counter','Shelf','Stand','Rug'][i],
            Category: 'Furniture',
            Cost: [{ItemId:'ID_Wood',Count:5+i,HaveCount:30}],
            bAffordable: i < 8,
        })); } },
        { label: 'High-cost item',      apply(s) { s.available.Items = [
            { EntityDefId: 'CBD_Throne', Name: 'Throne', Category: 'Furniture',
              Cost: [{ItemId:'ID_Wood',Count:200,HaveCount:50},{ItemId:'ID_Iron',Count:80,HaveCount:0},{ItemId:'ID_Stone',Count:50,HaveCount:0}],
              bAffordable: false },
        ]; } },
        { label: 'Empty list',          apply(s) { s.available.Items = []; } },
    ],
});
