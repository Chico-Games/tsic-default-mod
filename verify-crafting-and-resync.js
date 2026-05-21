// Verifies two fixes:
//  1. Crafting recipe rows are reachable from btn-close via spatial nav.
//  2. Switching fixtures while Gamepad mode is on auto-lights initial focus
//     in the new fixture (no manual toggle off/on).

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('http://localhost:8765/screens/playground.html#crafting', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });

    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');

    // Wait for initial focus on btn-close.
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.activeElement;
        return a && a.id === 'btn-close';
    }, { timeout: 4000 });
    console.log('Crafting initial:', await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.activeElement;
        return a ? (a.id || a.tagName) : null;
    }));

    // Confirm a recipe row is now in the focusable set.
    const recipeCount = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const all = Array.from(f.contentDocument.querySelectorAll('.tsic-list-row'));
        const focusables = Array.from(f.contentWindow.tsic.focus.__focusableSet());
        return { rows: all.length, focusableRows: all.filter(r => focusables.includes(r)).length };
    });
    console.log('Crafting recipe rows:', recipeCount);

    // Press Up — should reach a recipe row eventually. Crafting has Recipes
    // column on the LEFT and Close at the BOTTOM; pressing Up from Close
    // should walk into the recipes area.
    async function clickDir(label) {
        const btn = await page.evaluateHandle((needle) => {
            return Array.from(document.querySelectorAll('.pg-input-grid .pg-btn'))
                .find(b => b.textContent.trim() === needle);
        }, label);
        await btn.asElement().click();
        await page.waitForTimeout(120);
    }
    await clickDir('Up');
    const after1 = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.activeElement;
        const marker = f.contentDocument.querySelector('[data-tsic-focused]');
        return {
            activeClass: a && a.className,
            markerClass: marker && marker.className,
        };
    });
    console.log('After Up:', after1);

    await clickDir('Left');
    const after2 = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const marker = f.contentDocument.querySelector('[data-tsic-focused]');
        return {
            markerClass: marker && marker.className,
            isRecipeRow: !!(marker && marker.classList && marker.classList.contains('tsic-list-row')),
        };
    });
    console.log('After Left:', after2);

    // Now switch to inventory fixture and verify focus lights up without re-toggle.
    await page.evaluate(() => {
        document.querySelector('.pg-scn[data-id="inventory"]').click();
    });
    // Wait for new iframe load + the host's 80ms resync timer to fire.
    await page.waitForTimeout(500);
    const invSnap = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.activeElement;
        const marker = f.contentDocument.querySelector('[data-tsic-focused]');
        return {
            screenMeta: f.contentDocument.querySelector('meta[name="tsic-screen"]').getAttribute('content'),
            activeId: a ? (a.id || a.tagName) : null,
            markerId: marker ? (marker.id || marker.tagName) : null,
            mode: f.contentDocument.documentElement.getAttribute('data-tsic-input'),
        };
    });
    console.log('After fixture-switch to inventory:', invSnap);

    const recipeReachable = after2.isRecipeRow;
    const resyncWorks = invSnap.mode === 'Gamepad' && !!invSnap.markerId;
    console.log(recipeReachable ? 'PASS — recipe rows reachable' : 'FAIL — could not reach a recipe row');
    console.log(resyncWorks ? 'PASS — fixture switch preserved Gamepad highlight' : 'FAIL — fixture switch did not re-sync Gamepad');

    if (errors.length) {
        console.log('Errors:', errors);
    }
    await browser.close();
    process.exit((recipeReachable && resyncWorks) ? 0 : 1);
})();
