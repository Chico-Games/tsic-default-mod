// shared/tsic-bridge.js
//
// Creates window.tsic on top of the WebUI plugin's native V8 binding system.
// The C++ side binds a UTSICWebBridgeObject as "tsicbridge" via
// UWebInterface::Bind(), so ue.tsicbridge.* methods are available before
// page scripts run (permanent bindings are injected at browser creation).
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

    // ue.tsicbridge is bound by C++ via WebUI's Bind("tsicbridge", BridgeObj).
    // bJSBindingToLoweringEnabled lowercases both the binding name and all
    // UFUNCTION names. All calls return Promises (CEF multi-process IPC).

    window.tsic = {
        _subs: {},
        _lastSticky: {},

        send: function (name, payload) {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return;
            ue.tsicbridge.send(name, JSON.stringify(payload === undefined ? null : payload));
        },

        request: function (name, payload) {
            if (typeof ue === 'undefined' || !ue.tsicbridge) {
                return Promise.reject(new Error('tsicbridge not available'));
            }
            return ue.tsicbridge.request(name, JSON.stringify(payload === undefined ? null : payload))
                .then(function (resultJson) {
                    try { return JSON.parse(resultJson); } catch (e) { return resultJson; }
                });
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

        describe: function () {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return Promise.resolve([]);
            return ue.tsicbridge.describe().then(function (json) {
                try { return JSON.parse(json); } catch (e) { return []; }
            });
        },

        describeMessages: function () {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return Promise.resolve([]);
            return ue.tsicbridge.describemessages().then(function (json) {
                try { return JSON.parse(json); } catch (e) { return []; }
            });
        },

        publishMessage: function (tag, payload) {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return;
            ue.tsicbridge.publishmessage(tag, JSON.stringify(payload === undefined ? {} : payload));
        },

        setInteractiveRects: function (rects) {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return;
            ue.tsicbridge.setinteractiverects(JSON.stringify(rects || []));
        },

        // Hand the CEF browser keyboard focus (true) or return it to the game
        // viewport / Enhanced Input (false). Driven exclusively by text-field
        // focus tracking in tsic-runtime.js — do not call this from page code.
        setFocusCapture: function (capture) {
            if (typeof ue === 'undefined' || !ue.tsicbridge) return;
            ue.tsicbridge.setfocuscapture(!!capture);
        },

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
        if (ue.tsicbridge && ue.tsicbridge.requestcachereplay) {
            ue.tsicbridge.requestcachereplay();
        }
    }
    ensureInterface();
})();
