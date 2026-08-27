// shared/tsic-bridge.js
//
// Creates window.tsic on top of whichever UI engine is painting this page.
//
// Two transports, one surface. Under CEF the C++ side binds a
// UTSICWebBridgeObject as "tsicbridge" via UWebInterface::Bind(), so
// ue.tsicbridge.* methods are available before page scripts run (permanent
// bindings are injected at browser creation). Under SolUi there is no object
// to bind -- solui_view_bind_function binds one function at a time -- so C++
// stamps window.__tsic_* individually.
//
// The difference stops here. Everything above this file sees the same
// window.tsic either way, which is the only reason the same pages can be
// drawn by both engines and compared.
//
// The transports also differ in shape: CEF's calls are asynchronous because
// they cross a process boundary, SolUi's return on the spot because it renders
// in ours. `request` is therefore the one that needs real work -- see
// makeSolUiTransport.
//
// This file MUST be loaded before tsic-runtime.js and all screen scripts.
// Use <script src="/shared/tsic-bridge.js" defer></script> as the first
// deferred script in every HTML page.
(function () {
    'use strict';

    // ---- case-tolerant payload access -------------------------------------
    // Bridged JSON keys come from FProperty::GetAuthoredName() (see
    // TSICWebMessageBridge.h, which passes SkipStandardizeCase to keep the
    // authored PascalCase). That name is only reliable in the EDITOR:
    // NameTypes.h defines WITH_CASE_PRESERVING_NAME as WITH_EDITORONLY_DATA,
    // so a cooked runtime collapses every FName to the casing it was FIRST
    // registered with, anywhere in the process. Engine modules register their
    // names long before ours, so a field whose name is a common word can come
    // out of a cooked build re-cased, and `payload.Foo` silently reads
    // undefined while the identical editor build works.
    //
    // Observed in the 2026-07-31 closed-alpha build: FScpUIMapPlayer::Position
    // shipped as "position" (minimap parked on the world's origin corner,
    // since worldToLocal fell back to 0) and FScpUIAttributeUpdate::Max
    // shipped as "max" (every liquid bar rendered Current/1 -> "100 / 1").
    // Sibling fields in the same structs were untouched, which is what makes
    // this so hard to spot: it is per-name, not per-struct.
    //
    // C++ cannot fix this — the authored casing simply does not exist at
    // runtime in a cooked build — and WITH_CASE_PRESERVING_NAME can't be
    // forced on, since it changes FName's layout and would ABI-break against
    // the installed engine's prebuilt binaries. So the wire contract stops
    // depending on casing here instead: payloads are wrapped so a read finds
    // its key whatever case it arrived in, and every screen keeps reading the
    // authored PascalCase.
    //
    // Correctly-cased reads (the overwhelming majority) cost one `in` check;
    // only a miss pays the one-time scan. Wrapping is lazy — nested objects
    // are wrapped when touched, not up front — so a big untouched payload
    // (the TileGrid RLE arrays) costs nothing.
    var ciCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

    function caseTolerant(value) {
        if (value === null || typeof value !== 'object') return value;
        if (ciCache) {
            var hit = ciCache.get(value);
            if (hit) return hit;
        }
        var proxy = new Proxy(value, {
            get: function (target, key, receiver) {
                if (typeof key !== 'string' || key in target) {
                    var direct = Reflect.get(target, key, receiver);
                    // Methods are handed back UNBOUND on purpose. Bound to the
                    // raw target, Array.prototype.map / Symbol.iterator would
                    // read their elements straight off it and hand callers the
                    // unwrapped objects — `for (const l of p.Lines) l.Flips`
                    // would miss a re-cased "flips". Left unbound they run with
                    // `this` === this proxy, so element reads come back through
                    // here and stay case-tolerant all the way down.
                    return (typeof direct === 'function') ? direct : caseTolerant(direct);
                }
                var lower = key.toLowerCase();
                for (var k in target) {
                    if (k.toLowerCase() === lower) return caseTolerant(target[k]);
                }
                return undefined;
            }
        });
        if (ciCache) ciCache.set(value, proxy);
        return proxy;
    }

    // Exposed for the headless suite (tests/bridge-case.test.js).
    window.__tsicCaseTolerant = caseTolerant;

    // Don't clobber an existing window.tsic. In production this file is the
    // first deferred script and window.tsic is undefined, so the real bridge
    // installs normally. Under the test harness, installMockTsic() stamps a
    // mock window.tsic in beforeParse — bailing here preserves it (matching
    // tsic-runtime.js, which is already mock-aware) so the page's publishes
    // and subscriptions stay wired to the mock the runner observes.
    if (window.tsic) return;

    // ---- transports --------------------------------------------------------

    function makeCefTransport() {
        // ue.tsicbridge is bound by C++ via WebUI's Bind("tsicbridge", BridgeObj).
        // bJSBindingToLoweringEnabled lowercases both the binding name and all
        // UFUNCTION names. All calls return Promises (CEF multi-process IPC).
        return {
            name: 'CEF',
            available: function () { return typeof ue !== 'undefined' && !!ue.tsicbridge; },
            send: function (n, j) { ue.tsicbridge.send(n, j); },
            request: function (n, j) {
                return ue.tsicbridge.request(n, j).then(function (resultJson) {
                    try { return JSON.parse(resultJson); } catch (e) { return resultJson; }
                });
            },
            describe: function () { return ue.tsicbridge.describe(); },
            describeMessages: function () { return ue.tsicbridge.describemessages(); },
            publishMessage: function (t, j) { ue.tsicbridge.publishmessage(t, j); },
            setInteractiveRects: function (j) { ue.tsicbridge.setinteractiverects(j); },
            setFocusCapture: function (b) { ue.tsicbridge.setfocuscapture(!!b); },
            requestCacheReplay: function () {
                if (ue.tsicbridge.requestcachereplay) ue.tsicbridge.requestcachereplay();
            }
        };
    }

    function makeSolUiTransport() {
        // Every bound function returns a JSON string synchronously. The names
        // are the ones UTSICSolUiBridgeObject::BindTo stamps on window.
        var pending = {};

        // C++ settles a request by calling back into the page by name. It has
        // no handle to a JS promise -- CEF gets one because the browser hands
        // it a response object -- so the id issued by __tsic_request is the
        // handle, and this is where it is redeemed.
        window.__tsicResolve = function (id, payload, error) {
            var entry = pending[id];
            if (!entry) return;
            delete pending[id];
            if (error) { entry.reject(new Error(error)); return; }
            entry.resolve(payload);
        };

        return {
            name: 'SolUi',
            available: function () { return typeof window.__tsic_send === 'function'; },
            send: function (n, j) { window.__tsic_send(n, j); },
            request: function (n, j) {
                var id = parseInt(window.__tsic_request(n, j), 10);
                if (!id) return Promise.reject(new Error('request was refused'));
                return new Promise(function (resolve, reject) {
                    pending[id] = { resolve: resolve, reject: reject };
                });
            },
            describe: function () { return window.__tsic_describe(); },
            describeMessages: function () { return window.__tsic_describeMessages(); },
            publishMessage: function (t, j) { window.__tsic_publishMessage(t, j); },
            setInteractiveRects: function (j) { window.__tsic_setInteractiveRects(j); },
            setFocusCapture: function (b) { window.__tsic_setFocusCapture(!!b); },
            requestCacheReplay: function () { window.__tsic_requestCacheReplay(); },
            notifyReady: function () { window.__tsic_notifyReady(); }
        };
    }

    // SolUi is probed first because its functions are stamped before any page
    // script runs, so a positive answer here is certain. `ue` may not exist yet
    // under CEF, which is what ensureInterface below waits out.
    var solui = makeSolUiTransport();
    var T = solui.available() ? solui : makeCefTransport();

    // ---- asset URLs --------------------------------------------------------
    //
    // Only SolUi overrides these. Under CEF, shared/icons.js keeps its own
    // defaults ('/tex/item-icon/<id>' and '/runtime/<name>.imgsrc'), which the
    // scheme handler serves.
    //
    // SolUi has no scheme handler: it resolves a page's URLs through the host
    // filesystem, so a synthesised path would 404 as a missing file. Image
    // sources are the mechanism it does have, and both of these resolve to one.
    // icons.js already routes through window.tsic when it is present, so this
    // is the whole of the difference and no screen sees it.
    var assetUrls = (T.name !== 'SolUi') ? null : {
        // Registering the source is what makes the URL resolvable, so the two
        // happen in one call and cannot get out of step.
        itemIconUrl: function (itemId) {
            if (!itemId) return '';
            try { return JSON.parse(window.__tsic_ensureIcon(itemId)) || ''; }
            catch (e) { return ''; }
        },

        // Runtime textures are registered by C++ as they are created, under the
        // bare name, so the leading '/runtime/' the CEF handler routes on would
        // be part of the id here and match nothing.
        runtimeImgUrl: function (name) { return name + '.imgsrc'; }
    };

    window.tsic = {
        _subs: {},
        _lastSticky: {},

        send: function (name, payload) {
            if (!T.available()) return;
            T.send(name, JSON.stringify(payload === undefined ? null : payload));
        },

        request: function (name, payload) {
            if (!T.available()) {
                return Promise.reject(new Error(T.name + ' bridge not available'));
            }
            return T.request(name, JSON.stringify(payload === undefined ? null : payload));
        },

        on: function (name, cb) {
            (this._subs[name] = this._subs[name] || []).push(cb);
            var bucket = this._lastSticky[name];
            if (bucket) {
                var keys = Object.keys(bucket);
                for (var k = 0; k < keys.length; k++) {
                    var entry = bucket[keys[k]];
                    try { cb(entry.payload, entry.meta, name); } catch (e) { console.error(e); }
                }
            }
        },

        off: function (name, cb) {
            var arr = this._subs[name]; if (!arr) return;
            var i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1);
        },

        // A missing ue.tsicbridge kills EVERY JS->C++ call while C++->JS dispatch
        // keeps working (that arrives via ue.interface, a different binding), so
        // the UI looks alive and silently ignores the player. Both sides used to
        // swallow this: the C++ bridge object no-ops on a stale subsystem and
        // these guards no-op on a missing binding, so a half-dead bridge left no
        // trace anywhere. Chromium console output is mirrored into the Unreal log,
        // so warning here makes it greppable. Once only - if the binding is gone
        // it is gone for the page's lifetime, and this fires from click handlers.
        _warnedNoBridge: false,
        _noBridge: function (what) {
            if (T.available()) return false;
            if (!this._warnedNoBridge) {
                this._warnedNoBridge = true;
                console.warn('[tsic-bridge] the ' + T.name + ' bridge is not bound - "' + what +
                    '" and every later JS->C++ call from this page will be dropped.');
            }
            return true;
        },

        // Both transports answer with a JSON string; only CEF's arrives as a
        // promise. Promise.resolve normalises the two without making the SolUi
        // path pretend to be asynchronous anywhere but here.
        describe: function () {
            if (!T.available()) return Promise.resolve([]);
            return Promise.resolve(T.describe()).then(function (json) {
                try { return JSON.parse(json); } catch (e) { return []; }
            });
        },

        describeMessages: function () {
            if (!T.available()) return Promise.resolve([]);
            return Promise.resolve(T.describeMessages()).then(function (json) {
                try { return JSON.parse(json); } catch (e) { return []; }
            });
        },

        publishMessage: function (tag, payload) {
            if (this._noBridge('publishMessage ' + tag)) return;
            T.publishMessage(tag, JSON.stringify(payload === undefined ? {} : payload));
        },

        setInteractiveRects: function (rects) {
            if (this._noBridge('setInteractiveRects')) return;
            T.setInteractiveRects(JSON.stringify(rects || []));
        },

        // Hand the page keyboard focus (true) or return it to the game
        // viewport / Enhanced Input (false). Driven exclusively by text-field
        // focus tracking in tsic-runtime.js — do not call this from page code.
        setFocusCapture: function (capture) {
            if (this._noBridge('setFocusCapture')) return;
            T.setFocusCapture(!!capture);
        },

        // Present only on the SolUi surface; see assetUrls above. icons.js
        // checks for these before falling back to its own CEF-shaped defaults,
        // so leaving them undefined is how the CEF path stays untouched.
        itemIconUrl: assetUrls ? assetUrls.itemIconUrl : undefined,
        runtimeImgUrl: assetUrls ? assetUrls.runtimeImgUrl : undefined,

        // C++ -> JS dispatch. Called from C++ via Call("tsicDispatch", data)
        // which executes ue.interface.tsicDispatch(data). We wire it below.
        __dispatch: function (channel, payloadJson, metaJson) {
            var payload;
            try { payload = caseTolerant(JSON.parse(payloadJson)); } catch (e) { payload = payloadJson; }
            var meta = undefined;
            if (metaJson) { try { meta = JSON.parse(metaJson); } catch (e) {} }
            if (meta && meta.cachedAt) {
                if (!this._lastSticky[channel]) this._lastSticky[channel] = {};
                var subKey = (meta.cacheKey) || '_';
                this._lastSticky[channel][subKey] = { payload: payload, meta: meta };
            }
            var subs = this._subs[channel]; if (!subs) return;
            for (var i = 0; i < subs.length; i++) {
                try { subs[i](payload, meta, channel); } catch (e) { console.error(e); }
            }
        }
    };

    // Wire up C++ -> JS dispatch receiver on ue.interface so Call() can reach it.
    // Call("tsicDispatch", data) executes: ue.interface["tsicDispatch"](data)
    // The data is an FJsonLibraryValue object auto-deserialized to a JS object.
    //
    // After wiring, request a cache replay from C++ so sticky channels get their
    // last-known values dispatched into the freshly-created window.tsic._lastSticky.
    // Page scripts that later call tsic.on() will pick up cached data from there.
    function ensureInterface() {
        if (T.name === 'SolUi') {
            // No `ue` and no interface object: C++ reaches the page by running
            // window.tsic.__dispatch directly, which exists by now. Telling C++
            // the context is live has to come first -- DispatchToJS drops
            // everything sent before it, so a cache replay requested the other
            // way round would be answered into a view still marked not-ready
            // and would silently deliver nothing.
            T.notifyReady();
            T.requestCacheReplay();
            return;
        }

        if (typeof ue === 'undefined') { setTimeout(ensureInterface, 16); return; }
        if (!ue.interface) ue.interface = {};
        ue.interface.tsicDispatch = function (data) {
            var ch = data.Channel || data.channel || '';
            var pj = data.PayloadJson || data.payloadJson || '{}';
            var mj = data.MetaJson || data.metaJson || null;
            window.tsic.__dispatch(ch, pj, mj);
        };
        // Request cached message replay now that __dispatch is wired.
        // requestcachereplay is lowercased by CEF's bJSBindingToLoweringEnabled.
        if (T.available()) {
            T.requestCacheReplay();
        }
    }
    ensureInterface();
})();
