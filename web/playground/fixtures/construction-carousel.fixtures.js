// /screens/construction-carousel.html subscribes to:
//   tsic.msg.UI.Construction.Carousel  { bActive, Prev:[{Label,IconUrl}], Current, Next, RotationAxis, BlockedReason }
TSICPlayground.register({
    id: 'construction-carousel',
    label: 'Construction Carousel',
    screen: '/screens/construction-carousel.html',
    initialState() {
        return {
            carousel: {
                bActive: true,
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
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'Blocked (overlap)',apply(s) { s.carousel.BlockedReason = 'Overlap'; } },
        { label: 'Blocked (no floor)',apply(s) { s.carousel.BlockedReason = 'NoFloor'; } },
        { label: 'No prev/next',     apply(s) { s.carousel.Prev = []; s.carousel.Next = []; } },
        { label: 'Nothing to build', apply(s) { s.carousel.Prev = []; s.carousel.Next = []; s.carousel.Current = {}; } },
        { label: 'Inactive (hidden)',apply(s) { s.carousel.bActive = false; s.carousel.Prev = []; s.carousel.Next = []; s.carousel.Current = {}; } },
        { label: 'No prev only',     apply(s) { s.carousel.Prev = []; } },
        { label: 'No next only',     apply(s) { s.carousel.Next = []; } },
        { label: 'Long lists',       apply(s) {
            s.carousel.Prev = Array.from({length: 6}, (_, i) => ({ Label: 'Prev ' + i, FurnitureId: 'CBD_Prev' + i }));
            s.carousel.Next = Array.from({length: 6}, (_, i) => ({ Label: 'Next ' + i, FurnitureId: 'CBD_Next' + i }));
        } },
        { label: 'Pitch axis',       apply(s) { s.carousel.RotationAxis = 'Pitch'; } },
        { label: 'Roll axis',        apply(s) { s.carousel.RotationAxis = 'Roll'; } },
        { label: 'Roll forward',     apply(s) {
            s.carousel.Prev.unshift(s.carousel.Current);
            s.carousel.Current = s.carousel.Next.shift();
        } },
        { label: 'Long label',       apply(s) { s.carousel.Current = { Label: 'Constructed reinforced workbench', FurnitureId: 'CBD_LongLabel' }; } },
    ],
});
