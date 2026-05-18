// TSIC SPA test harness.
//
// Provides a fake window.tsic for an iframe-loaded screen so scenarios can
// inject messages and observe what the page publishes back.
//
// Lives in two halves:
//   1. The HOST page (screens/tests.html) loads this file, then for each
//      scenario creates an <iframe> for the target screen. Before the
//      iframe's own scripts run it injects a mock tsic via
//      installMockTsic(iframeWindow). The mock matches the production
//      window.tsic API surface used by all SPA pages.
//   2. Each scenario file under /tests/<name>.js registers itself with
//      TSICTestHarness.scenarios.push({name, file, run}). run(ctx) gets a
//      context object with helpers (inject, expectPublish, expectEl, …) and
//      should return / resolve when done.
//
// The harness is intentionally framework-free — no Jest / Mocha — to keep it
// runnable inside Ultralight without a build step.

(function (global) {
    const NS = global.TSICTestHarness = global.TSICTestHarness || {
        scenarios: [],
        register(scenario) { NS.scenarios.push(scenario); },
    };

    NS.installMockTsic = function (win, options) {
        options = options || {};
        const subscribers = new Map();   // channel -> Set(callbacks)
        const stickyCache = new Map();   // channel -> last payload
        const publishLog  = [];           // {channel, payload, t}

        const fake = {
            on(channel, cb) {
                if (!subscribers.has(channel)) subscribers.set(channel, new Set());
                subscribers.get(channel).add(cb);
                // Replay sticky cache, matching the production bridge.
                if (stickyCache.has(channel)) {
                    try { cb(stickyCache.get(channel)); } catch (e) { console.warn('[harness] cb threw', e); }
                }
                return () => subscribers.get(channel).delete(cb);
            },
            publishMessage(channel, payload) {
                publishLog.push({ channel, payload, t: Date.now() });
                if (subscribers.has(channel)) {
                    for (const cb of subscribers.get(channel)) {
                        try { cb(payload); } catch (e) { console.warn('[harness] cb threw', e); }
                    }
                }
            },
            // No-op modder helpers — pages call them but tests don't need them.
            appendInputModeTag() {},
            removeInputModeTag() {},
            setMenuActionContext() {},
            clearMenuActionContext() {},
            itemCatalog: options.itemCatalog || {},
            recipeCatalog: options.recipeCatalog || {},
            itemName(id) { const d = this.itemCatalog[id]; return d ? (d.Name || id) : id; },
            itemCategory(id) { const d = this.itemCatalog[id]; return d ? d.Category : null; },
            itemIconUrl(id) { return `tex://item-icon/${encodeURIComponent(id)}`; },
        };

        const handle = {
            // Inject a C++ -> JS message into the iframe.
            inject(channel, payload) {
                stickyCache.set(channel, payload);
                if (subscribers.has(channel)) {
                    for (const cb of subscribers.get(channel)) {
                        try { cb(payload); } catch (e) { console.warn('[harness] cb threw', e); }
                    }
                }
            },
            // Fire an Enhanced-Input event as if the C++ bridge published it.
            input(actionName, phase, value) {
                const channel = `tsic.msg.UI.Input.${actionName}`;
                const payload = {
                    Action: actionName,
                    Phase: phase || 'Triggered',
                    Value: value || { X: 0, Y: 0, Z: 0 },
                    ElapsedSec: 1 / 60,
                    TriggeredSec: 0,
                };
                handle.inject(channel, payload);
            },
            // Simulate UI.Screen.Changed (drives router + visibility gates).
            screen(name) { handle.inject('tsic.msg.UI.Screen.Changed', { Name: name }); },
            // Simulate UI.Input.Mode.Changed.
            mode(device) { handle.inject('tsic.msg.UI.Input.Mode.Changed', { Mode: device, Device: device.toLowerCase() }); },
            // Mutate the catalog and fire the change event the SPA listens for.
            setItemCatalog(map) {
                fake.itemCatalog = map || {};
                try { win.dispatchEvent(new Event('tsic-item-catalog')); } catch (e) {}
            },
            setRecipeCatalog(map) {
                fake.recipeCatalog = map || {};
                try { win.dispatchEvent(new Event('tsic-recipe-catalog')); } catch (e) {}
            },
            // Inspection: snapshot + clear of the publish log.
            publishes() { return publishLog.slice(); },
            clearPublishes() { publishLog.length = 0; },
            // Subscriber introspection (used by tests to assert "page subscribed at all").
            channels() { return Array.from(subscribers.keys()); },
        };

        // Install on the iframe's window so the page's `if (window.tsic)` checks pass.
        win.tsic = fake;
        // Expose the handle to the host for scenario authoring.
        win.__tsicTestHandle = handle;
        return handle;
    };

    // Assertion helpers — return strings on failure, null on pass.
    NS.assert = {
        eq(actual, expected, label) {
            const ok = JSON.stringify(actual) === JSON.stringify(expected);
            return ok ? null : `${label || 'expect.eq'}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
        },
        truthy(value, label) {
            return value ? null : `${label || 'expect.truthy'}: got ${JSON.stringify(value)}`;
        },
        published(handle, channel, opts) {
            const matches = handle.publishes().filter(p => p.channel === channel);
            if (matches.length === 0) return `expected publish on '${channel}', got none. Channels published: ${JSON.stringify(handle.publishes().map(p => p.channel))}`;
            if (opts && opts.where) {
                const ok = matches.some(m => opts.where(m.payload));
                if (!ok) return `expected publish on '${channel}' matching predicate; payloads were ${JSON.stringify(matches.map(m => m.payload))}`;
            }
            return null;
        },
        notPublished(handle, channel) {
            const matches = handle.publishes().filter(p => p.channel === channel);
            return matches.length === 0 ? null : `expected NO publish on '${channel}', got ${matches.length}`;
        },
        domText(doc, selector, expected) {
            const el = doc.querySelector(selector);
            if (!el) return `expected '${selector}' to exist`;
            const got = (el.textContent || '').trim();
            if (typeof expected === 'string') {
                return got === expected ? null : `expected '${selector}' text '${expected}', got '${got}'`;
            }
            if (expected instanceof RegExp) {
                return expected.test(got) ? null : `expected '${selector}' text to match ${expected}, got '${got}'`;
            }
            return `unknown expected type for domText`;
        },
        domCount(doc, selector, n) {
            const c = doc.querySelectorAll(selector).length;
            return c === n ? null : `expected ${n} of '${selector}', got ${c}`;
        },
        domExists(doc, selector) {
            return doc.querySelector(selector) ? null : `expected '${selector}' to exist`;
        },
        domHidden(doc, selector) {
            const el = doc.querySelector(selector);
            if (!el) return `expected '${selector}' to exist (so we can assert hidden)`;
            const cs = doc.defaultView.getComputedStyle(el);
            const hidden = (cs.display === 'none' || cs.visibility === 'hidden');
            return hidden ? null : `expected '${selector}' to be hidden, but display=${cs.display} visibility=${cs.visibility}`;
        },
        domVisible(doc, selector) {
            const el = doc.querySelector(selector);
            if (!el) return `expected '${selector}' to exist (so we can assert visible)`;
            const cs = doc.defaultView.getComputedStyle(el);
            const hidden = (cs.display === 'none' || cs.visibility === 'hidden');
            return !hidden ? null : `expected '${selector}' to be visible`;
        },
    };

    // Synthetic DOM event helpers for input simulation inside an iframe.
    NS.events = {
        click(doc, selector) {
            const el = doc.querySelector(selector);
            if (!el) throw new Error(`click: no element '${selector}'`);
            el.click();
        },
        key(doc, key, opts) {
            const init = Object.assign({ key, code: opts && opts.code || `Key${(key || '').toUpperCase()}`, bubbles: true, cancelable: true }, opts || {});
            doc.dispatchEvent(new KeyboardEvent('keydown', init));
            doc.dispatchEvent(new KeyboardEvent('keyup', init));
        },
        keyOn(el, key, opts) {
            const init = Object.assign({ key, code: opts && opts.code || `Key${(key || '').toUpperCase()}`, bubbles: true, cancelable: true }, opts || {});
            el.dispatchEvent(new KeyboardEvent('keydown', init));
            el.dispatchEvent(new KeyboardEvent('keyup', init));
        },
        mouse(doc, selector, type, opts) {
            const el = doc.querySelector(selector);
            if (!el) throw new Error(`mouse: no element '${selector}'`);
            el.dispatchEvent(new MouseEvent(type || 'click', Object.assign({ bubbles: true, cancelable: true, button: 0 }, opts || {})));
        },
    };

    // Tiny "wait until predicate or timeout" helper for async DOM updates.
    NS.waitFor = function (predicate, opts) {
        const timeout = (opts && opts.timeout) || 1000;
        const interval = (opts && opts.interval) || 16;
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const tick = () => {
                let v;
                try { v = predicate(); } catch (e) { v = false; }
                if (v) { resolve(v); return; }
                if (Date.now() - start > timeout) { reject(new Error('waitFor timeout')); return; }
                setTimeout(tick, interval);
            };
            tick();
        });
    };
})(window);
