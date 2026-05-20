// /screens/cage.html subscribes to:
//   tsic.msg.UI.Selection.Opened  (reuses selection screen envelope)
TSICPlayground.register({
    id: 'cage',
    label: 'Cage',
    screen: '/screens/cage.html',
    initialState() { return {
        // cage.html bails on p.Context !== 'Cage'; use the exact string the page expects.
        Context: 'Cage',
        Options: [
            { OptionId: 'ID_CapturedMimic_CE',   Label: 'Captured Mimic' },
            { OptionId: 'ID_CapturedSpider_CE',  Label: 'Captured Spider' },
        ],
    }; },
    project(s) { return [['tsic.msg.UI.Selection.Opened', s]]; },
    scenarios: [
        { label: 'Two captured',  apply(s) { s.Options = [
            { OptionId: 'ID_CapturedMimic_CE',  Label: 'Captured Mimic' },
            { OptionId: 'ID_CapturedSpider_CE', Label: 'Captured Spider' },
        ]; }, expect: { visualChange: false } },
        { label: 'One captured',  apply(s) { s.Options = [{ OptionId: 'ID_CapturedMimic_CE', Label: 'Captured Mimic' }]; } },
        { label: 'Five captured', apply(s) { s.Options = [
            { OptionId: 'ID_CapturedMimic_CE',  Label: 'Captured Mimic' },
            { OptionId: 'ID_CapturedSpider_CE', Label: 'Captured Spider' },
            { OptionId: 'ID_CapturedWraith_CE', Label: 'Captured Wraith' },
            { OptionId: 'ID_CapturedGhost_CE',  Label: 'Captured Ghost' },
            { OptionId: 'ID_CapturedCrawler_CE',Label: 'Captured Crawler' },
        ]; } },
        { label: 'Many captured', apply(s) { s.Options = Array.from({length: 12}, (_, i) => ({
            OptionId: 'ID_Captured' + i, Label: 'Captured ' + ['Mimic','Spider','Wraith','Ghost','Crawler','Stalker','Worm','Thing','Beast','Other','Shade','Form'][i],
        })); } },
        { label: 'Long names',    apply(s) { s.Options = [
            { OptionId: 'ID_Cap1', Label: 'Captured Endless Crawling Thing from the Stockroom' },
            { OptionId: 'ID_Cap2', Label: 'Captured Shopkeeper That Was Not There Before' },
        ]; } },
        { label: 'Empty',         apply(s) { s.Options = []; } },
    ],
});
