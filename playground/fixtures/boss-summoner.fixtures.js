// /screens/boss-summoner.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened  (Kind === 'Boss')
// Same Recipe envelope as crafting; "summon a boss" = Start a recipe.
TSICPlayground.register({
    id: 'boss-summoner',
    label: 'Boss Summoner',
    screen: '/screens/boss-summoner.html',
    catalogs: { items: {
        ID_Trophy_Forest: { Name: 'Forest trophy', Category: 'CraftingMaterial' },
        ID_Trophy_Cave:   { Name: 'Cave trophy',   Category: 'CraftingMaterial' },
        ID_Trophy_Beach:  { Name: 'Beach trophy',  Category: 'CraftingMaterial' },
    } },
    initialState() {
        return {
            stationId: 'S_Altar',
            recipes: [
                { RecipeId: 'B_Forest',  Name: 'Greenfell',   bDiscovered: true,  bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Forest',Count:1}] },
                { RecipeId: 'B_Cave',    Name: 'Stonewight',  bDiscovered: false, bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Cave',Count:1}] },
                { RecipeId: 'B_Beach',   Name: 'Tidecaller',  bDiscovered: true,  bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Beach',Count:1}] },
            ],
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Boss', StationId: state.stationId, Recipes: state.recipes, MaterialCounts: {},
        }]];
    },
    scenarios: [
        { label: 'Two unlocked', apply() {} },
        { label: 'All unlocked', apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: true })); } },
        { label: 'All locked',   apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: false })); } },
    ],
});
