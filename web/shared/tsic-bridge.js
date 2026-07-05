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
            try { payload = JSON.parse(payloadJson); } catch (e) { payload = payloadJson; }
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
