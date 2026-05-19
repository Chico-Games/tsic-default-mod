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
        { label: 'Valid placement',   apply(s) { s.preview = { bCanPlace: true,  FailureReason: '', RotationAxis: 'Yaw' }; } },
        { label: 'Blocked placement', apply(s) { s.preview = { bCanPlace: false, FailureReason: 'Overlap', RotationAxis: 'Yaw' }; } },
        { label: 'Out of materials',  apply(s) { s.available.Items = s.available.Items.map(it => ({ ...it, bAffordable: false })); } },
        { label: 'Empty list',        apply(s) { s.available.Items = []; } },
    ],
});
