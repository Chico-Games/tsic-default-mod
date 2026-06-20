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

    // Browser can't resolve UE-only /tex/ or /runtime/ paths. Screens load
    // /tex/item-icon/<id> for every stack and /runtime/*.imgsrc for live
    // textures — without this stub the browser fires hundreds of 404-bound
    // requests per page load. Swap any matching URL to a 1x1 transparent
    // PNG data URL so no request is ever made.
    const TEX_STUB = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

    // …except item icons, where a transparent pixel makes slots look empty.
    // PREVIEW-ONLY: map the item id (by keyword) to a Game-Icons.net icon via
    // the Iconify API, tinted cream to match the HUD. In-game the /tex/ scheme
    // resolves for real via UE and this host code never runs, so the real game
    // is unaffected. Keys are matched as substrings of the lower-cased id, so
    // list more-specific terms first (e.g. "pickaxe" before "axe").
    const ICON_PACK = {
        pickaxe: 'war-pick', pick: 'war-pick', mining: 'war-pick',
        axe: 'battle-axe', hammer: 'claw-hammer', knife: 'bowie-knife',
        sword: 'broadsword', blade: 'broadsword', spear: 'spear-hook',
        bread: 'bread-slice', apple: 'shiny-apple', fruit: 'shiny-apple',
        steak: 'steak', meat: 'meat', salmon: 'salmon', fish: 'salmon',
        water: 'water-drop', drink: 'water-drop', bottle: 'water-drop',
        plank: 'wood-pile', wood: 'wood-pile', log: 'wood-pile',
        coal: 'coal-pile', ore: 'stone-block', stone: 'rock', rock: 'rock',
        steel: 'metal-bar', metal: 'metal-bar', iron: 'metal-bar', gold: 'gold-bar',
        key: 'key', ammo: 'ammo-box', bullet: 'ammo-box',
        pistol: 'pistol-gun', rifle: 'pistol-gun', gun: 'pistol-gun',
        bandage: 'bandage-roll', medkit: 'bandage-roll', heal: 'bandage-roll',
        elixir: 'round-bottom-flask', potion: 'round-bottom-flask', flask: 'round-bottom-flask',
        battery: 'battery-pack-alt',
        // Wearables (equipment paper-doll).
        helmet: 'crested-helmet', hat: 'crested-helmet', cap: 'crested-helmet', hood: 'crested-helmet',
        coat: 'leather-vest', jacket: 'leather-vest', armor: 'leather-vest', vest: 'leather-vest', chest: 'leather-vest', shirt: 'leather-vest',
        boot: 'boots', boots: 'boots', shoe: 'boots',
        glove: 'gloves', ring: 'ring', amulet: 'gem-pendant', necklace: 'gem-pendant',
    };
    const ICON_FALLBACK = 'cardboard-box';
    function placeholderIconUrl(url) {
        const m = /\/tex\/item-icon\/([^/?#]+)/i.exec(url);
        const id = (m ? decodeURIComponent(m[1]) : '').toLowerCase();
        let icon = ICON_FALLBACK;
        for (const k in ICON_PACK) { if (id.includes(k)) { icon = ICON_PACK[k]; break; } }
        return 'https://api.iconify.design/game-icons:' + icon + '.svg?color=%23f0e7d4&width=64&height=64';
    }

    function stubTexScheme(win) {
        try {
            const ImgProto = win.HTMLImageElement && win.HTMLImageElement.prototype;
            if (!ImgProto || ImgProto.__tsicTexStubInstalled) return;
            const desc = Object.getOwnPropertyDescriptor(ImgProto, 'src');
            if (!desc || !desc.set) return;
            Object.defineProperty(ImgProto, 'src', {
                configurable: true,
                enumerable: desc.enumerable,
                get: desc.get,
                set(v) {
                    if (typeof v === 'string') {
                        if (/^\/tex\/item-icon\//i.test(v)) v = placeholderIconUrl(v);
                        else if (/^(tex|pak):/i.test(v) || /^\/tex\//i.test(v) || /^\/runtime\//i.test(v)) v = TEX_STUB;
                    }
                    desc.set.call(this, v);
                },
            });
            ImgProto.__tsicTexStubInstalled = true;
        } catch (e) { /* sandboxed cross-origin iframe — best-effort */ }
    }

    // Live-refresh: poll the iframe's screen + every shared CSS/JS it imports
    // and reload the iframe whenever any of those files change on disk.
    //   - Polls each watched URL at POLL_MS with `cache: 'no-store'`
    //   - Compares a cheap djb2 hash of the response body
    //   - On change, fires loadIframe() (which cache-busts the URL)
    // Toggled by the LIVE checkbox in the toolbar; OFF disables the timer.
    function setupLiveRefresh() {
        const POLL_MS = 800;
        const checkbox = el('pg-live');
        if (!checkbox) return;

        const hashes = new Map();       // canonical-url -> last hash
        let pollTimer = null;
        let pollBusy = false;
        let suppressUntilLoad = false;  // skip polling between reload trigger and iframe 'load'

        function djb2(s) {
            let h = 5381;
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
            return h;
        }
        async function fetchHash(url) {
            try {
                const r = await fetch(url, { cache: 'no-store' });
                if (!r.ok) return null;
                return djb2(await r.text());
            } catch (e) { return null; }
        }
        function collectWatched() {
            const iframe = el('pg-iframe');
            if (!iframe || !iframe.contentDocument) return [];
            const urls = new Set();
            const base = (iframe.src || '').split('?')[0];
            if (base && !base.startsWith('about:')) urls.add(base);
            const doc = iframe.contentDocument;
            doc.querySelectorAll('link[rel=stylesheet][href]').forEach(l => urls.add(l.href.split('?')[0]));
            doc.querySelectorAll('script[src]').forEach(s => urls.add(s.src.split('?')[0]));
            return [...urls];
        }
        async function tick() {
            if (!checkbox.checked || pollBusy || suppressUntilLoad) return;
            pollBusy = true;
            try {
                const urls = collectWatched();
                for (const url of urls) {
                    const h = await fetchHash(url);
                    if (h == null) continue;
                    const prev = hashes.get(url);
                    if (prev != null && prev !== h) {
                        logRow('info', `live-refresh: ${url.split('/').pop()} changed → reloading`);
                        hashes.clear();
                        suppressUntilLoad = true;
                        if (activeFixture) loadIframe();
                        return;
                    }
                    hashes.set(url, h);
                }
            } finally { pollBusy = false; }
        }
        function start() { if (!pollTimer) pollTimer = setInterval(tick, POLL_MS); }
        function stop()  { if (pollTimer)  { clearInterval(pollTimer); pollTimer = null; } }

        checkbox.addEventListener('change', () => {
            hashes.clear();
            if (checkbox.checked) { logRow('info', 'live-refresh: ON');  start(); }
            else                  { logRow('info', 'live-refresh: OFF'); stop();  }
        });

        // Re-baseline whenever the iframe navigates to a new screen / reloads.
        el('pg-iframe').addEventListener('load', () => {
            hashes.clear();
            suppressUntilLoad = false;
        });

        if (checkbox.checked) start();
    }

    function loadIframe() {
        const iframe = el('pg-iframe');
        const onLoad = () => {
            iframe.removeEventListener('load', onLoad);
            activeWin = iframe.contentWindow;
            stubTexScheme(activeWin);
            // Mouse-wheel emulation: let a fixture map wheel deltas onto state
            // (e.g. the hotbar cycling its selected slot, as in game). Bound to
            // this iframe window — replaced wholesale on the next fixture load.
            activeWin.addEventListener('wheel', (ev) => {
                if (!activeFixture || typeof activeFixture.onWheel !== 'function') return;
                ev.preventDefault();
                try { activeFixture.onWheel(activeState, ev.deltaY); }
                catch (e) {
                    logRow('fail', `onWheel threw: ${e.message}`);
                    if (global.TSICPlaygroundDebug) global.TSICPlaygroundDebug.error(`onWheel threw: ${e.message}`);
                    return;
                }
                projectAndInject();
            }, { passive: false });
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
            // Let the input pane refresh its focus-engine readout AND
            // re-sync Gamepad mode if the playground had it on — otherwise
            // every fixture swap drops the new iframe back to KBM mode and
            // the user has to toggle Gamepad off/on to see the focus ring.
            setTimeout(() => {
                if (!global.TSICPlaygroundInput) return;
                const fn = global.TSICPlaygroundInput.__onIframeReloaded
                    || global.TSICPlaygroundInput.__lastRefresh;
                if (fn) {
                    try { fn(); } catch (e) {}
                }
            }, 80);
        };
        iframe.addEventListener('load', onLoad);
        // Cache-bust query forces WebCore to fetch the screen fresh — needed
        // so the LIVE auto-refresh (and the manual Reload button) actually
        // picks up on-disk edits instead of serving the in-memory copy.
        const screen = activeFixture.screen;
        iframe.src = screen + (screen.includes('?') ? '&' : '?') + '_pg=' + Date.now();
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
        // Continuous controls (e.g. cooldown sliders). Each control mutates
        // state on `input` and re-projects, giving live preview. Optional
        // `read(state)` syncs the slider UI back to current state on render
        // and after scenarios run; without it the slider position is purely
        // the user's drag history.
        const controls = activeFixture.controls || [];
        for (const ctrl of controls) {
            // Toggle (checkbox) control — compact row, mutates a boolean.
            if (ctrl.type === 'toggle') {
                const row = document.createElement('label');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 4px;cursor:pointer;font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:0.5px;color:var(--pg-dim,#a59b89);text-transform:uppercase;';
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = ctrl.read ? !!ctrl.read(activeState) : !!ctrl.value;
                box.style.cssText = 'cursor:pointer;accent-color:var(--pg-accent, #e0a86a);';
                const txt = document.createElement('span');
                txt.textContent = ctrl.label;
                box.addEventListener('change', () => {
                    try { ctrl.apply(activeState, box.checked); }
                    catch (e) { logRow('fail', `toggle "${ctrl.label}" threw: ${e.message}`); return; }
                    projectAndInject();
                });
                row.appendChild(box);
                row.appendChild(txt);
                host.appendChild(row);
                continue;
            }

            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;padding:8px 4px 2px;margin-top:6px;border-top:1px solid var(--pg-line, rgba(224,204,168,0.08));';

            const labelRow = document.createElement('div');
            labelRow.style.cssText = 'display:flex;justify-content:space-between;font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:1px;color:var(--pg-dim,#a59b89);text-transform:uppercase;';
            const labelText = document.createElement('span');
            labelText.textContent = ctrl.label;
            const valueText = document.createElement('span');
            valueText.style.color = 'var(--pg-accent, #e0a86a)';
            labelRow.appendChild(labelText);
            labelRow.appendChild(valueText);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = ctrl.min != null ? ctrl.min : 0;
            slider.max = ctrl.max != null ? ctrl.max : 1;
            slider.step = ctrl.step != null ? ctrl.step : 0.01;
            const initial = ctrl.read ? ctrl.read(activeState) : (ctrl.value != null ? ctrl.value : 0);
            slider.value = initial;
            slider.style.cssText = 'width:100%;cursor:pointer;accent-color:var(--pg-accent, #e0a86a);';

            function fmt(v) { return ctrl.format ? ctrl.format(v) : String(v); }
            valueText.textContent = fmt(parseFloat(slider.value));

            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                valueText.textContent = fmt(v);
                try { ctrl.apply(activeState, v); }
                catch (e) {
                    logRow('fail', `control "${ctrl.label}" threw: ${e.message}`);
                    return;
                }
                projectAndInject();
            });

            wrap.appendChild(labelRow);
            wrap.appendChild(slider);
            host.appendChild(wrap);
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

    // Screen-fixture → category. Element fixtures set fixture.category directly
    // (see elements.fixtures.js); for the ~40 screen fixtures we keep the
    // mapping here so adding a category never means touching 40 files.
    // A fixture missing from both falls into "Other" (so new screens still show).
    const CATEGORY_ORDER = [
        'Menus & Flow', 'HUD', 'Inventory & Equipment', 'Crafting & Building',
        'Storage & Transport', 'World & Map', 'Terminal', 'Social', 'Enemies', 'Misc',
        'Elements', 'Other',
    ];
    const CATEGORY_MAP = {
        'main-menu': 'Menus & Flow', 'pause-menu': 'Menus & Flow', 'new-store': 'Menus & Flow',
        'settings': 'Menus & Flow', 'save-load': 'Menus & Flow', 'mods': 'Menus & Flow',
        'credits': 'Menus & Flow', 'loading-screen': 'Menus & Flow', 'death-screen': 'Menus & Flow',
        'store-maze': 'Menus & Flow',

        'in-game': 'HUD',
        'health-bar': 'HUD', 'stamina-bar': 'HUD', 'crosshair': 'HUD', 'behavior-bar': 'HUD',
        'hotbar': 'HUD', 'interaction': 'HUD', 'notifications': 'HUD', 'circular-progress': 'HUD',
        'detection': 'HUD', 'ping': 'HUD', 'ping-markers': 'HUD', 'stomach': 'HUD',

        'inventory': 'Inventory & Equipment', 'equipment': 'Inventory & Equipment',
        'wardrobe': 'Inventory & Equipment', 'quantity-picker': 'Inventory & Equipment',

        'crafting': 'Crafting & Building', 'production': 'Crafting & Building',
        'construction': 'Crafting & Building', 'construction-carousel': 'Crafting & Building',
        'repair': 'Crafting & Building', 'upgrade': 'Crafting & Building',

        'storage': 'Storage & Transport', 'universal-storage': 'Storage & Transport',
        'universal-storage-setup': 'Storage & Transport', 'teleporter': 'Storage & Transport',

        'map': 'World & Map',

        'terminal-tier1': 'Terminal', 'terminal-tier2': 'Terminal', 'terminal-tier3': 'Terminal',

        'chat': 'Social', 'voice-chat': 'Social',

        'boss-summoner': 'Enemies', 'cage': 'Enemies',

        'bug-report': 'Misc', 'cheat-menu': 'Misc', 'lore': 'Misc', 'selection': 'Misc',
    };
    function categoryOf(fx) { return fx.category || CATEGORY_MAP[fx.id] || 'Other'; }

    function makeScreenRow(fx) {
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
        return row;
    }

    function renderScreenList() {
        const list = el('pg-screens');
        list.innerHTML = '';
        const sorted = TSICPlayground.fixtures.slice().sort((a, b) => a.label.localeCompare(b.label));

        const groups = new Map();
        for (const fx of sorted) {
            const cat = categoryOf(fx);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(fx);
        }
        const cats = [
            ...CATEGORY_ORDER.filter(c => groups.has(c)),
            ...[...groups.keys()].filter(c => !CATEGORY_ORDER.includes(c)),
        ];

        for (const cat of cats) {
            const fxs = groups.get(cat);
            const wrap = document.createElement('div');
            wrap.className = 'pg-cat';

            const header = document.createElement('div');
            header.className = 'pg-cat-h';
            const caret = document.createElement('span');
            caret.className = 'pg-cat-caret'; caret.textContent = '▾';
            const name = document.createElement('span'); name.textContent = cat;
            const count = document.createElement('span');
            count.className = 'pg-cat-count'; count.textContent = fxs.length;
            header.appendChild(caret); header.appendChild(name); header.appendChild(count);
            header.addEventListener('click', () => wrap.classList.toggle('collapsed'));
            wrap.appendChild(header);

            const rows = document.createElement('div');
            rows.className = 'pg-cat-rows';
            for (const fx of fxs) rows.appendChild(makeScreenRow(fx));
            wrap.appendChild(rows);

            list.appendChild(wrap);
        }

        const filter = el('pg-filter');
        filter.addEventListener('input', () => {
            const q = filter.value.trim().toLowerCase();
            for (const wrap of list.children) {
                const rows = wrap.querySelector('.pg-cat-rows');
                if (!rows) continue;
                let visible = 0;
                for (const row of rows.children) {
                    const show = !q || row.textContent.toLowerCase().includes(q);
                    row.style.display = show ? '' : 'none';
                    if (show) visible++;
                }
                wrap.style.display = visible ? '' : 'none';
                if (q) wrap.classList.remove('collapsed');  // expand so matches show
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
        setupLiveRefresh();
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
