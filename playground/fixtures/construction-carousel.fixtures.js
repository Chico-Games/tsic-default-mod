// /screens/construction-carousel.html subscribes to:
//   tsic.msg.UI.Construction.Carousel  { Prev:[{Label,IconUrl}], Current, Next, RotationAxis, BlockedReason }
TSICPlayground.register({
    id: 'construction-carousel',
    label: 'Construction Carousel',
    screen: '/screens/construction-carousel.html',
    initialState() {
        return {
            carousel: {
                Prev: [
                    { Label: 'Lamp',  FurnitureId: 'CBD_Lamp' },
                    { Label: 'Stool', FurnitureId: 'CBD_Stool' },
                ],
                Current: { Label: 'Table', FurnitureId: 'CBD_Table_Constructed' },
                Next: [
                    { Label: 'Chair',    FurnitureId: 'CBD_Chair_Constructed' },
                    { Label: 'Bookcase', FurnitureId: 'CBD_Bookcase_Constructed' },
                    { Label: 'Bed',      FurnitureId: 'CBD_Bed_Constructed' },
                ],
                RotationAxis: 'Yaw',
                BlockedReason: '',
            },
        };
    },
    project(state) { return [['tsic.msg.UI.Construction.Carousel', state.carousel]]; },
    scenarios: [
        { label: 'Default',     apply() {} },
        { label: 'Blocked',     apply(s) { s.carousel.BlockedReason = 'Overlap'; } },
        { label: 'No prev/next',apply(s) { s.carousel.Prev = []; s.carousel.Next = []; } },
        { label: 'Roll forward',apply(s) {
            s.carousel.Prev.unshift(s.carousel.Current);
            s.carousel.Current = s.carousel.Next.shift();
        } },
    ],
});
