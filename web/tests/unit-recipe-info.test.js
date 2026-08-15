// Unit tests for shared/recipe-info.js.
TSICTestHarness.register({
    name: 'Unit/RecipeInfo: render emits heading + ingredients + outputs',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'R_Bread', Name: 'Bread',
            bDiscovered: true, bStationLevelSufficient: true,
            Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }],
            Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }],
        }, { ID_Wheat: 5 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '#host h3'));
        const text = host.textContent;
        ctx.expect(ctx.assert.truthy(/Bread/.test(text)));
        ctx.expect(ctx.assert.truthy(/ID_Wheat x3|Wheat x3/.test(text)));
        ctx.expect(ctx.assert.truthy(/have 5/.test(text)));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: canCraft handles every gating path',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const ok = { RecipeId: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [{ ItemId: 'ID_X', Count: 1 }] };
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(ok, { ID_X: 1 }), true));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(ok, { ID_X: 0 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ ...ok, bDiscovered: false }, { ID_X: 1 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ ...ok, bStationLevelSufficient: false }, { ID_X: 1 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(null, {}), false));
        // No ingredients = always craftable when discovered + level OK.
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ bDiscovered: true, bStationLevelSufficient: true }, {}), true));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: missing recipe renders nothing',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = 'previous';
        ctx.win.TSICRecipeInfo.render(host, null, {});
        ctx.expect(ctx.assert.eq(host.innerHTML, ''));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: undiscovered recipes are masked end to end',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.tsic.itemCatalog = {
            ID_Wheat: { ItemId: 'ID_Wheat', Name: 'Wheat' },
            ID_Bread: { ItemId: 'ID_Bread', Name: 'Bread', Description: 'Smells great.' },
        };
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'RD_Bread_CR', Name: 'Bread',
            bDiscovered: false, bStationLevelSufficient: true, Duration: 4,
            Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }],
            Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }],
        }, { ID_Wheat: 5 });
        const text = host.textContent;
        ctx.expect(ctx.assert.truthy(/\?\?\?/.test(text)));
        // Nothing about what it makes may leak: no name, description, item names,
        // counts or duration.
        ctx.expect(ctx.assert.eq(/Bread/.test(text), false));
        ctx.expect(ctx.assert.eq(/Wheat/.test(text), false));
        ctx.expect(ctx.assert.eq(/Smells great/.test(text), false));
        ctx.expect(ctx.assert.eq(/have 5/.test(text), false));
        ctx.expect(ctx.assert.eq(/4\.0s/.test(text), false));
        // Icons would give it away too.
        ctx.expect(ctx.assert.eq(host.querySelectorAll('img').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: discovered recipe shows real name, description + type',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.tsic.itemCatalog = {
            ID_Wrench_EQ: {
                ItemId: 'ID_Wrench_EQ', Name: 'Wrench', Description: 'A sturdy wrench.',
                Category: 'Equipment', CategoryTag: 'Entity.Inventory.Item.Category.Weapon',
                EquipmentSlot: 'Entity.Inventory.Item.Equipment.Slot.Weapon',
                Weight: 1.5, bEquippable: true,
            },
        };
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'RD_Wrench_CR', Name: 'RD_Wrench_CR',
            bDiscovered: true, bStationLevelSufficient: true, Duration: 2,
            Ingredients: [], Outputs: [{ ItemId: 'ID_Wrench_EQ', Count: 1 }],
        }, {});
        const text = host.textContent;
        // The asset id must never reach the player.
        ctx.expect(ctx.assert.eq(/RD_Wrench_CR/.test(text), false));
        ctx.expect(ctx.assert.truthy(/Wrench/.test(text)));
        ctx.expect(ctx.assert.truthy(/A sturdy wrench\./.test(text)));
        ctx.expect(ctx.assert.truthy(/Weapon/.test(text)));   // human-readable type
        ctx.expect(ctx.assert.truthy(/1\.50 kg/.test(text))); // useful stat
        ctx.expect(ctx.assert.truthy(/2\.0s/.test(text)));    // craft time
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: displayName never yields a raw definition id',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const info = ctx.win.TSICRecipeInfo;
        ctx.win.tsic.itemCatalog = { ID_Bread: { ItemId: 'ID_Bread', Name: 'Bread' } };
        ctx.expect(ctx.assert.eq(info.displayName({ RecipeId: 'RD_Bread_CR', Name: 'RD_Bread_CR', bDiscovered: true,
            Outputs: [{ ItemId: 'ID_Bread', Count: 1 }] }), 'Bread'));
        // Output-less recipe (boss ritual / furniture upgrade) — prettified id.
        ctx.expect(ctx.assert.eq(info.displayName({ RecipeId: 'RD_Contain_BoneHead', bDiscovered: true }),
            'Contain Bone Head'));
        ctx.expect(ctx.assert.eq(info.displayName({ RecipeId: 'RD_Aircon_CN', bDiscovered: true }), 'Aircon'));
        // A proper server-supplied name is passed through untouched.
        ctx.expect(ctx.assert.eq(info.displayName({ RecipeId: 'RD_X_CR', Name: 'First Aid Kit', bDiscovered: true }),
            'First Aid Kit'));
        ctx.expect(ctx.assert.eq(info.displayName({ RecipeId: 'RD_X_CR', Name: 'Anything', bDiscovered: false }), '???'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Catalog: itemTypeLabel + itemSlotLabel are human-readable',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const T = ctx.win.TSIC;
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({ CategoryTag: 'Entity.Inventory.Item.Category.CraftingMaterial' }),
            'Crafting Material'));
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({ CategoryTag: 'Entity.Inventory.Item.Category.Misc' }), 'Miscellaneous'));
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({ CategoryTag: 'Entity.Inventory.Item.Category.Armour' }), 'Armour'));
        // No authored tag — fall back to the coarse bucket.
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({ Category: 'Consumable' }), 'Consumable'));
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({ Category: 'Other' }), 'Item'));
        ctx.expect(ctx.assert.eq(T.itemTypeLabel({}), 'Item'));
        ctx.expect(ctx.assert.eq(T.itemSlotLabel({ EquipmentSlot: 'Entity.Inventory.Item.Equipment.Slot.Backpack' }),
            'Backpack'));
        ctx.expect(ctx.assert.eq(T.itemSlotLabel({}), ''));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: station-level badge surfaces when level insufficient',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, { Name: 'Hat', bDiscovered: true, bStationLevelSufficient: false, RequiredStationLevel: 3 }, {});
        ctx.expect(ctx.assert.truthy(/\(lvl 3\)/.test(host.textContent)));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: only the short ingredient is highlighted',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        // The counts themselves are covered above; what nothing asserted is that a
        // shortfall is VISIBLY different from a satisfied ingredient. Without it the
        // pane reads as a flat list and the player has to do the arithmetic per row.
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.tsic.itemCatalog = {
            ID_Wheat: { ItemId: 'ID_Wheat', Name: 'Wheat' },
            ID_Salt:  { ItemId: 'ID_Salt',  Name: 'Salt' },
        };
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'RD_Bread_CR', Name: 'Bread',
            bDiscovered: true, bStationLevelSufficient: true,
            Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }, { ItemId: 'ID_Salt', Count: 2 }],
            Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }],
        }, { ID_Wheat: 5, ID_Salt: 1 });

        const rows = Array.from(host.querySelectorAll('div'))
            .filter(d => /Wheat x3|Salt x2/.test(d.textContent || ''));
        const wheat = rows.find(d => /Wheat x3/.test(d.textContent));
        const salt  = rows.find(d => /Salt x2/.test(d.textContent));
        ctx.expect(ctx.assert.truthy(wheat && salt, 'both ingredient rows rendered with their counts'));
        ctx.expect(ctx.assert.truthy(/have 5/.test(wheat.textContent), 'held count shown for the satisfied ingredient'));
        ctx.expect(ctx.assert.truthy(/have 1/.test(salt.textContent), 'held count shown for the short ingredient'));

        const colourOf = (el) => ctx.win.getComputedStyle(el).color;
        ctx.expect(ctx.assert.truthy(colourOf(salt) !== colourOf(wheat),
            `short ingredient is marked out (short=${colourOf(salt)}, satisfied=${colourOf(wheat)})`));

        // Enough salt and the highlight must go away — otherwise the "highlight" is
        // just how that row always looks.
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'RD_Bread_CR', Name: 'Bread',
            bDiscovered: true, bStationLevelSufficient: true,
            Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }, { ItemId: 'ID_Salt', Count: 2 }],
            Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }],
        }, { ID_Wheat: 5, ID_Salt: 2 });
        const stocked = Array.from(host.querySelectorAll('div')).filter(d => /Salt x2/.test(d.textContent || ''))[0];
        const stockedWheat = Array.from(host.querySelectorAll('div')).filter(d => /Wheat x3/.test(d.textContent || ''))[0];
        ctx.expect(ctx.assert.eq(colourOf(stocked), colourOf(stockedWheat),
            'a satisfied ingredient carries no shortfall styling'));
    },
});
