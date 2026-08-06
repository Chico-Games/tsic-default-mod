// shared/reduce-motion.js — game-setting-driven motion gate for the whole web layer.
//
// Two independent switches from the Motion & Comfort settings group, each
// stamped as an attribute on <html> so CSS can key off them with no JS:
//
//   accessibility.reduce_motion  -> html[data-tsic-reduce-motion]
//       Menu backdrops and UI chrome stop animating. Layout and transitions
//       that convey state (a bar filling, a value changing) still update — they
//       just do it instantly.
//
//   accessibility.screen_pulse   -> html[data-tsic-no-screen-pulse]  (when OFF)
//       The gameplay screen effects stop LOOPING: the low-health heartbeat, the
//       stealth breathing, the directional hit flash. The static art behind
//       each one stays, so the player keeps the information.
//
// Deliberately NOT prefers-reduced-motion. Under CEF that media query inherits
// from whatever Windows session the game is running in — RDP and dev boxes set
// it — so it silently froze menus for people who never asked for it. The game
// setting is the only lever. (Pages loaded outside the game, e.g. the
// playground, simply never receive the message and keep full motion.)
//
// Channel: tsic.msg.UI.Settings.Value { Key, ValueJson } — sticky per key, so
// this resolves as soon as the bridge replays the cache, whenever the page loads.
//
// API for JS-driven animation that CSS can't reach (canvas loops, rAF):
//   TSIC.reduceMotion()            -> bool, current state
//   TSIC.onReduceMotion(cb)        -> calls cb(bool) now and on every change
(function (global) {
  var TSIC = global.TSIC = global.TSIC || {};

  var reduceMotion = false;
  var listeners = [];

  function root() { return document.documentElement; }

  function setFlag(attr, on) {
    var el = root();
    if (!el) return;
    if (on) el.setAttribute(attr, '');
    else el.removeAttribute(attr);
  }

  // ValueJson is raw JSON text ("true" / "false"), not a parsed value.
  function asBool(valueJson) {
    return String(valueJson === undefined || valueJson === null ? '' : valueJson).indexOf('true') !== -1;
  }

  function onValue(p) {
    if (!p || !p.Key) return;
    if (p.Key === 'accessibility.reduce_motion') {
      var next = asBool(p.ValueJson);
      if (next === reduceMotion) return;   // sticky replays repeat unchanged values
      reduceMotion = next;
      setFlag('data-tsic-reduce-motion', reduceMotion);
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](reduceMotion); } catch (e) { console.warn('[reduce-motion]', e); }
      }
      return;
    }
    if (p.Key === 'accessibility.screen_pulse') {
      setFlag('data-tsic-no-screen-pulse', !asBool(p.ValueJson));
    }
  }

  TSIC.reduceMotion = function () { return reduceMotion; };

  TSIC.onReduceMotion = function (cb) {
    if (typeof cb !== 'function') return;
    listeners.push(cb);
    try { cb(reduceMotion); } catch (e) { console.warn('[reduce-motion]', e); }
  };

  // Test hook: the headless harness has no bridge, so it drives the flags directly.
  TSIC.__applySettingValue = onValue;

  // Own poll rather than tsic.onReady: this module is deferred alongside
  // tsic-runtime.js, which installs onReady only once the bridge stamps
  // window.tsic — script order does not guarantee it exists yet.
  (function subscribe() {
    if (global.tsic && typeof global.tsic.on === 'function') {
      global.tsic.on('tsic.msg.UI.Settings.Value', onValue);
      return;
    }
    setTimeout(subscribe, 16);
  })();
})(window);
