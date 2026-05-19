// Shell behaviour: load fixture, install reactive mock-tsic on iframe,
// project state to channel injects, decorate publishMessage to feed onPublish.
(function (global) {
    const NS = global.TSICPlaygroundHost = global.TSICPlaygroundHost || {};

    function el(id) { return document.getElementById(id); }
    function fmt(payload) {
        try { return JSON.stringify(payload); } catch (e) { return String(payload); }
    }
    function logRow(cls, line) {
        const list = el('pg-log');
        if (!list) return;
        const e = document.createElement('div');
        e.className = 'pg-log-row ' + cls;
        e.textContent = line;
        list.appendChild(e);
        while (list.children.length > 500) list.removeChild(list.firstChild);
        list.scrollTop = list.scrollHeight;
    }

    let activeFixture = null;
    let activeState = null;
    let activeHandle = null;
    let activeWin = null;

    function resolveCatalogs(fixture, state) {
        if (typeof fixture.catalogs === 'function') return fixture.catalogs(state) || {};
        return fixture.catalogs || {};
    }

    function projectAndInject() {
        if (!activeFixture || !activeHandle) return;
        let pairs = [];
        try { pairs = activeFixture.project(activeState) || []; }
        catch (e) {
            logRow('fail', `project() threw: ${e.message}`);
            if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.error(`project() threw: ${e.message}`);
            return;
        }
        for (const [ch, payload] of pairs) {
            activeHandle.inject(ch, payload);
            logRow('inject', `← ${ch}  ${fmt(payload)}`);
            if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onInject(ch, payload);
        }
    }

    function selectFixture(id) {
        const fixture = TSICPlayground.byId.get(id);
        if (!fixture) return;
        activeFixture = fixture;
        activeState = fixture.initialState();
        location.hash = '#' + id;
        if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onFixtureLoaded(fixture);
        renderScenarios();
        loadIframe();
    }

    function loadIframe() {
        const iframe = el('pg-iframe');
        const onLoad = () => {
            iframe.removeEventListener('load', onLoad);
            activeWin = iframe.contentWindow;
            const cats = resolveCatalogs(activeFixture, activeState);
            activeHandle = global.TSICTestHarness.installMockTsic(activeWin, {
                itemCatalog: cats.items || {},
                recipeCatalog: cats.recipes || {},
            });
            // Decorate the mock's publishMessage so we observe outgoing commands
            // AND feed them through fixture.onPublish for reactive simulation.
            const fake = activeWin.tsic;
            const origPublish = fake.publishMessage.bind(fake);
            fake.publishMessage = function (channel, payload) {
                origPublish(channel, payload);
                logRow('publish', `→ ${channel}  ${fmt(payload)}`);
                if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onPublish(channel, payload);
                if (typeof activeFixture.onPublish === 'function') {
                    try { activeFixture.onPublish(activeState, channel, payload); }
                    catch (e) {
                        logRow('fail', `onPublish threw: ${e.message}`);
                        if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.error(`onPublish threw: ${e.message}`);
                        return;
                    }
                    projectAndInject();
                }
            };
            // Some pages might call tsic.request — return a never-resolving promise.
            if (!fake.request) {
                fake.request = function (channel, payload) {
                    logRow('publish', `→[req] ${channel}  ${fmt(payload)}`);
                    return new Promise(() => {});
                };
            }
            projectAndInject();
            if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onIframeReady(activeWin, activeHandle);
            // Let the input pane refresh its focus-engine readout against
            // the freshly-loaded iframe (give the page's deferred scripts
            // a beat to install tsic-focus on the mock).
            setTimeout(() => {
                if (global.TSICPlaygroundInput && global.TSICPlaygroundInput.__lastRefresh) {
                    try { global.TSICPlaygroundInput.__lastRefresh(); } catch (e) {}
                }
            }, 80);
        };
        iframe.addEventListener('load', onLoad);
        iframe.src = activeFixture.screen;
    }

    function renderScenarios() {
        const host = el('pg-scenarios');
        host.innerHTML = '';
        if (!activeFixture) return;
        const reset = document.createElement('button');
        reset.className = 'pg-btn pg-btn-strong';
        reset.textContent = 'Reset state';
        reset.addEventListener('click', () => {
            activeState = activeFixture.initialState();
            projectAndInject();
        });
        host.appendChild(reset);
        for (const sc of activeFixture.scenarios || []) {
            const b = document.createElement('button');
            b.className = 'pg-btn';
            b.textContent = sc.label;
            b.title = sc.description || '';
            b.addEventListener('click', () => {
                try { sc.apply(activeState); }
                catch (e) {
                    logRow('fail', `scenario "${sc.label}" threw: ${e.message}`);
                    if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.error(`scenario "${sc.label}" threw: ${e.message}`);
                    return;
                }
                if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onScenario(sc.label);
                projectAndInject();
            });
            host.appendChild(b);
        }
    }

    // Fixtures whose target screen has <meta name="tsic-focus" content="enabled">.
    // Updated when more screens opt in — currently 27.
    const FOCUS_ENGINE_IDS = new Set([
        'boss-summoner', 'bug-report', 'cage', 'cheat-menu',
        'construction', 'crafting', 'credits', 'death-screen',
        'equipment', 'interaction', 'inventory', 'lore',
        'main-menu', 'mods', 'new-store', 'pause-menu',
        'production', 'quantity-picker', 'repair', 'save-load',
        'selection', 'settings', 'storage', 'teleporter',
        'universal-storage', 'universal-storage-setup',
        'upgrade', 'wardrobe',
    ]);
    NS.FOCUS_ENGINE_IDS = FOCUS_ENGINE_IDS;

    function renderScreenList() {
        const list = el('pg-screens');
        list.innerHTML = '';
        const sorted = TSICPlayground.fixtures.slice().sort((a, b) => a.label.localeCompare(b.label));
        for (const fx of sorted) {
            const row = document.createElement('div');
            row.className = 'pg-scn';
            const usesFocus = FOCUS_ENGINE_IDS.has(fx.id);
            const dot = document.createElement('span');
            dot.className = 'pg-scn-dot' + (usesFocus ? ' on' : '');
            dot.title = usesFocus ? 'Uses controller focus engine' : 'No focus engine (HUD / passive view)';
            row.appendChild(dot);
            const label = document.createElement('span');
            label.textContent = fx.label;
            row.appendChild(label);
            row.title = fx.screen + (usesFocus ? '  ·  tsic-focus enabled' : '');
            row.dataset.id = fx.id;
            row.addEventListener('click', () => {
                document.querySelectorAll('.pg-scn').forEach(n => n.classList.remove('active'));
                row.classList.add('active');
                selectFixture(fx.id);
            });
            list.appendChild(row);
        }
        const filter = el('pg-filter');
        filter.addEventListener('input', () => {
            const q = filter.value.trim().toLowerCase();
            for (const row of list.children) {
                row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
            }
        });
    }

    function renderTabs() {
        const tabs = document.querySelectorAll('.pg-tab');
        tabs.forEach(t => t.addEventListener('click', () => {
            tabs.forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.pg-pane').forEach(p => p.style.display = 'none');
            const pane = el(t.dataset.pane);
            if (pane) pane.style.display = 'flex';
        }));
    }

    NS.boot = function () {
        if (!global.TSICTestHarness || !global.TSICTestHarness.installMockTsic) {
            console.error('TSICPlayground: shared/test-harness.js not loaded');
            return;
        }
        if (!TSICPlayground.fixtures.length) {
            console.error('TSICPlayground: no fixtures registered');
            return;
        }
        renderScreenList();
        renderTabs();
        if (global.TSICPlaygroundDebug && el('pg-debug')) {
            global.TSICPlaygroundDebug.mount(el('pg-debug'));
        }
        global.TSICPlaygroundInput.mount(
            el('pg-input'),
            (channel, payload) => {
                if (!activeWin || !activeHandle) return;
                activeHandle.inject(channel, payload);
                logRow('inject', `← ${channel}  ${fmt(payload)}`);
                if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.onInject(channel, payload);
            },
            // Diagnostic context for the focus-engine block.
            () => ({ win: activeWin, log: logRow })
        );
        el('pg-reload').addEventListener('click', () => { if (activeFixture) loadIframe(); });
        el('pg-dump').addEventListener('click', () => {
            if (!activeState) return;
            logRow('info', `STATE: ${fmt(activeState)}`);
        });
        el('pg-subscribed').addEventListener('click', () => {
            if (!activeHandle) return;
            logRow('info', `SUBSCRIBED: ${fmt(activeHandle.channels())}`);
        });
        el('pg-clearlog').addEventListener('click', () => { el('pg-log').innerHTML = ''; });
        // Deep-link via hash. Otherwise default to a focus-engine-enabled
        // screen (pause-menu) so the controller-nav demo is visible on first
        // load instead of a HUD page with no engine.
        const initial = (location.hash || '').replace(/^#/, '');
        const fx = initial && TSICPlayground.byId.get(initial);
        const defaultId = TSICPlayground.byId.has('pause-menu')
            ? 'pause-menu'
            : (TSICPlayground.fixtures[0] && TSICPlayground.fixtures[0].id);
        const target = fx ? fx.id : defaultId;
        if (target) {
            const row = document.querySelector(`.pg-scn[data-id="${target}"]`);
            if (row) row.classList.add('active');
            selectFixture(target);
        }
    };
})(window);
