// /screens/boss-summoner.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened  (Kind === 'Boss')
// Same Recipe envelope as crafting; "summon a boss" = Start a recipe.
TSICPlayground.register({
    id: 'boss-summoner',
    label: 'Boss Summoner',
    screen: '/screens/boss-summoner.html',
    catalogs: { items: {
        ID_Trophy_Forest:   { Name: 'Forest trophy',   Category: 'CraftingMaterial' },
        ID_Trophy_Cave:     { Name: 'Cave trophy',     Category: 'CraftingMaterial' },
        ID_Trophy_Beach:    { Name: 'Beach trophy',    Category: 'CraftingMaterial' },
        ID_Trophy_Mountain: { Name: 'Mountain trophy', Category: 'CraftingMaterial' },
        ID_Trophy_Void:     { Name: 'Void trophy',     Category: 'CraftingMaterial' },
    } },
    initialState() {
        return {
            stationId: 'S_Altar',
            recipes: [
                { RecipeId: 'B_Forest', Name: 'Greenfell',  bDiscovered: true,  bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Forest',Count:1}] },
                { RecipeId: 'B_Cave',   Name: 'Stonewight', bDiscovered: false, bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Cave',Count:1}] },
                { RecipeId: 'B_Beach',  Name: 'Tidecaller', bDiscovered: true,  bStationLevelSufficient: true,
                  Ingredients: [{ItemId:'ID_Trophy_Beach',Count:1}] },
            ],
            haveTrophies: { ID_Trophy_Forest: 1, ID_Trophy_Cave: 0, ID_Trophy_Beach: 1 },
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Boss', StationId: state.stationId, Recipes: state.recipes,
            MaterialCounts: state.haveTrophies,
        }]];
    },
    scenarios: [
        { label: 'Two unlocked',       apply() {}, expect: { visualChange: false } },
        { label: 'All unlocked',       apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: true })); } },
        { label: 'All locked',         apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: false })); } },
        { label: 'Five bosses',        apply(s) { s.recipes = [
            { RecipeId: 'B_Forest',   Name: 'Greenfell',   bDiscovered: true,  bStationLevelSufficient: true,
              Ingredients: [{ItemId:'ID_Trophy_Forest',Count:1}] },
            { RecipeId: 'B_Cave',     Name: 'Stonewight',  bDiscovered: true,  bStationLevelSufficient: true,
              Ingredients: [{ItemId:'ID_Trophy_Cave',Count:1}] },
            { RecipeId: 'B_Beach',    Name: 'Tidecaller',  bDiscovered: true,  bStationLevelSufficient: true,
              Ingredients: [{ItemId:'ID_Trophy_Beach',Count:1}] },
            { RecipeId: 'B_Mountain', Name: 'Peakwalker',  bDiscovered: false, bStationLevelSufficient: true,
              Ingredients: [{ItemId:'ID_Trophy_Mountain',Count:1}] },
            { RecipeId: 'B_Void',     Name: 'Hollow King', bDiscovered: false, bStationLevelSufficient: true,
              Ingredients: [{ItemId:'ID_Trophy_Void',Count:3}] },
        ]; } },
        { label: 'Trophies for all',   apply(s) {
            s.haveTrophies = { ID_Trophy_Forest: 3, ID_Trophy_Cave: 3, ID_Trophy_Beach: 3, ID_Trophy_Mountain: 3, ID_Trophy_Void: 3 };
            s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: true }));
        } },
        // boss-summoner page doesn't render trophy counts or station-level
        // status visibly; the inject still fires.
        { label: 'No trophies',        apply(s) { s.haveTrophies = {}; }, expect: { visualChange: false } },
        { label: 'Station level low',  apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bStationLevelSufficient: false, RequiredStationLevel: 5 })); }, expect: { visualChange: false } },
    ],
});
