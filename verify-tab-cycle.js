// Asserts IA_UI_NextTab / IA_UI_PreviousTab cycle the right tab bar.

const { chromium } = require('playwright');

async function inIframe(page, fn) {
    return await page.evaluate((src) => {
        // eslint-disable-next-line no-new-func
        const fn = new Function('f', 'return (' + src + ')(f);');
        return fn(document.getElementById('pg-iframe'));
    }, fn.toString());
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));

    // ---- inventory: simple single-bar case ----
    await page.goto('http://localhost:8765/screens/playground.html#inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(200);

    async function clickPgAction(label) {
        // Use the action dropdown + Send to fire a specific named action.
        await page.evaluate((needle) => {
            const sel = document.querySelector('#pg-input-pane select');
            for (const opt of sel.options) {
                if (opt.value === needle) { sel.value = needle; sel.dispatchEvent(new Event('change', {bubbles:true})); break; }
            }
        }, label);
        const send = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('#pg-input-pane button'))
                .find(b => b.textContent.trim() === 'Send');
        });
        await send.asElement().click();
        await page.waitForTimeout(120);
    }

    const beforeInv = await inIframe(page, (f) => {
        const tabs = Array.from(f.contentDocument.querySelectorAll('#inv-tabs .inv-tab'));
        const active = tabs.find(t => t.classList.contains('active'));
        return { count: tabs.length, activeText: active && active.textContent };
    });
    console.log('Inventory before:', beforeInv);

    await clickPgAction('IA_UI_NextTab');
    const afterNext = await inIframe(page, (f) => {
        const active = f.contentDocument.querySelector('#inv-tabs .inv-tab.active');
        return active && active.textContent;
    });
    console.log('Inventory after NextTab:', afterNext);

    await clickPgAction('IA_UI_PreviousTab');
    const afterPrev = await inIframe(page, (f) => {
        const active = f.contentDocument.querySelector('#inv-tabs .inv-tab.active');
        return active && active.textContent;
    });
    console.log('Inventory after PrevTab:', afterPrev);

    const inventoryOk = beforeInv.activeText !== afterNext && afterNext !== afterPrev && afterPrev === beforeInv.activeText;

    // ---- storage: context-aware (focus on player side vs container side) ----
    // The playground host doesn't react to hashchange, so navigate by
    // clicking the scenario row.
    await page.evaluate(() => {
        document.querySelector('.pg-scn[data-id="storage"]').click();
    });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentDocument
            && f.contentDocument.querySelector('meta[name="tsic-screen"]')
            && f.contentDocument.querySelector('meta[name="tsic-screen"]').getAttribute('content') === 'Storage';
    }, { timeout: 5000 });
    await page.waitForTimeout(300);
    // Gamepad mode persists across fixture switches now, but the new
    // iframe needs a beat for its focus engine to install. Re-toggle off→on
    // to force a clean re-init.
    if (!(await page.evaluate(() => document.querySelector('.pg-input-mode-bar .pg-btn').dataset.gamepad === '1'))) {
        await page.click('.pg-input-mode-bar .pg-btn');
    }
    await page.waitForTimeout(200);

    // Focus a tab button on the PLAYER side. (Fixture lists are empty so we
    // can't focus a row — focusing the player tab bar itself proves the
    // tab-context routing for the engine.)
    await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const tab = f.contentDocument.querySelector('.ss-tabs[data-side="player"] .tsic-tab');
        if (tab) f.contentWindow.tsic.focus.focus(tab, { trust: true });
    });
    const playerBefore = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.querySelector('.ss-tabs[data-side="player"] .tsic-tab.is-active');
        const b = f.contentDocument.querySelector('.ss-tabs[data-side="container"] .tsic-tab.is-active');
        return { player: a && a.textContent, container: b && b.textContent };
    });
    console.log('Storage (player side focused) before:', playerBefore);
    await clickPgAction('IA_UI_NextTab');
    const playerAfter = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const a = f.contentDocument.querySelector('.ss-tabs[data-side="player"] .tsic-tab.is-active');
        const b = f.contentDocument.querySelector('.ss-tabs[data-side="container"] .tsic-tab.is-active');
        return { player: a && a.textContent, container: b && b.textContent };
    });
    console.log('Storage (player side focused) after NextTab:', playerAfter);

    // Focus a tab button on the CONTAINER side.
    await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const tab = f.contentDocument.querySelector('.ss-tabs[data-side="container"] .tsic-tab');
        if (tab) f.contentWindow.tsic.focus.focus(tab, { trust: true });
    });
    await clickPgAction('IA_UI_NextTab');
    const containerAfter = await inIframe(page, (f) => {
        const a = f.contentDocument.querySelector('.ss-tabs[data-side="player"] .tsic-tab.is-active');
        const b = f.contentDocument.querySelector('.ss-tabs[data-side="container"] .tsic-tab.is-active');
        return { player: a && a.textContent, container: b && b.textContent };
    });
    console.log('Storage (container side focused) after NextTab:', containerAfter);

    const storagePlayerSideMoved = playerAfter.player !== playerBefore.player && playerAfter.container === playerBefore.container;
    const storageContainerSideMoved = containerAfter.container !== playerAfter.container && containerAfter.player === playerAfter.player;

    console.log(inventoryOk ? 'PASS — inventory tab cycle works'
                              : 'FAIL — inventory tabs did not cycle as expected');
    console.log(storagePlayerSideMoved ? 'PASS — storage player tab cycles only player'
                                        : 'FAIL — storage player-side NextTab did not isolate to player bar');
    console.log(storageContainerSideMoved ? 'PASS — storage container tab cycles only container'
                                          : 'FAIL — storage container-side NextTab did not isolate to container bar');

    await browser.close();
    process.exit((inventoryOk && storagePlayerSideMoved && storageContainerSideMoved) ? 0 : 1);
})();
