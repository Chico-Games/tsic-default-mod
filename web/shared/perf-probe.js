// shared/perf-probe.js — opt-in, page-side performance instrument.
//
// Exposes window.TSICPerf. Loading this file costs one object literal; NOTHING
// runs until start() is called. That is deliberate and load-bearing:
//
//   * An always-on requestAnimationFrame loop is not a free observer here. CEF
//     captures the whole offscreen page at the cadence of its dominant
//     animation (see the PERF note in hud-minimap.js), so a permanent RAF
//     probe pins the entire UI at 60Hz capture whether or not anything moved.
//     The instrument would then be a meaningful share of what it measures.
//   * The predecessor of this file was a "TEMP-PERF-PROBE (remove before
//     commit)" block inlined in tsic-runtime.js that shipped to the Steam
//     closed alpha, where it held a capture-phase pointermove listener on
//     document and published a cheat command every 5 seconds for the life of
//     every session. Its data is what identified issue #177 — hence keeping a
//     probe at all — but it must not be the resting state.
//
// Driven from Gauntlet via ScpMechanicsTestDriver::RequestWebUIEval, e.g.
//   TSICPerf.start()                       -> "ok"
//   TSICPerf.mark('Explore')               -> "ok"     (phase label)
//   JSON.stringify(TSICPerf.stop())        -> summary JSON
// and by hand in a live session through: WebUI.EvalJS Root TSICPerf.start()
(function () {
  'use strict';
  if (window.TSICPerf) return;

  var running = false;
  var phase = 'default';
  var phases = Object.create(null);
  var rafHandle = 0;
  var prevFrame = 0;
  var startedAt = 0;

  // Wrapped bridge dispatch, restored on stop().
  var origDispatch = null;

  function bucket(name) {
    var b = phases[name];
    if (b) return b;
    b = phases[name] = {
      frames: 0, frameMsTotal: 0, frameMsMax: 0, over25: 0, over100: 0,
      frameMs: [],
      pointerEvents: 0, pointerGapTotal: 0, pointerGapMax: 0, prevPointer: 0,
      dispatches: 0, dispatchChars: 0, dispatchMsTotal: 0, dispatchMsMax: 0,
      seconds: 0, startedAt: 0,
    };
    b.startedAt = now();
    return b;
  }

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function onFrame() {
    if (!running) return;
    var t = now();
    var b = bucket(phase);
    if (prevFrame) {
      var d = t - prevFrame;
      b.frames++;
      b.frameMsTotal += d;
      if (d > b.frameMsMax) b.frameMsMax = d;
      if (d > 25) b.over25++;
      if (d > 100) b.over100++;
      // Capped sample set: percentiles need the distribution, but an unbounded
      // array over a long soak is its own leak. 20k frames ~= 5.5 min at 60fps;
      // past that we keep the aggregates and stop growing.
      if (b.frameMs.length < 20000) b.frameMs.push(d);
    }
    prevFrame = t;
    rafHandle = requestAnimationFrame(onFrame);
  }

  function onPointerMove() {
    if (!running) return;
    var b = bucket(phase);
    var t = now();
    if (b.prevPointer) {
      var d = t - b.prevPointer;
      b.pointerGapTotal += d;
      if (d > b.pointerGapMax) b.pointerGapMax = d;
    }
    b.prevPointer = t;
    b.pointerEvents++;
  }

  // Measures what the C++ -> JS bridge actually costs the renderer. DispatchToJS
  // hands the page JavaScript SOURCE containing the whole payload, so the time
  // spent inside __dispatch (JSON.parse plus every subscriber's handler) is the
  // renderer main-thread cost of a message — the thing that makes the cursor
  // stutter when a channel's payload grows over a session.
  function wrapDispatch() {
    if (!window.tsic || typeof window.tsic.__dispatch !== 'function') return;
    origDispatch = window.tsic.__dispatch;
    var inner = origDispatch;
    window.tsic.__dispatch = function (channel, payloadJson, metaJson) {
      if (!running) return inner.call(this, channel, payloadJson, metaJson);
      var b = bucket(phase);
      var t0 = now();
      try {
        return inner.call(this, channel, payloadJson, metaJson);
      } finally {
        var d = now() - t0;
        b.dispatches++;
        b.dispatchChars += (payloadJson && payloadJson.length) || 0;
        b.dispatchMsTotal += d;
        if (d > b.dispatchMsMax) b.dispatchMsMax = d;
      }
    };
  }

  function unwrapDispatch() {
    if (origDispatch && window.tsic) window.tsic.__dispatch = origDispatch;
    origDispatch = null;
  }

  function pct(sorted, p) {
    if (!sorted.length) return 0;
    var i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
    return sorted[i];
  }

  function summarizeBucket(name, b) {
    var sorted = b.frameMs.slice().sort(function (x, y) { return x - y; });
    var secs = Math.max((b.seconds || (now() - b.startedAt)) / 1000, 1e-6);
    return {
      phase: name,
      seconds: +secs.toFixed(3),
      frames: b.frames,
      fps: +(b.frames / secs).toFixed(1),
      frameP50Ms: +pct(sorted, 50).toFixed(2),
      frameP95Ms: +pct(sorted, 95).toFixed(2),
      frameP99Ms: +pct(sorted, 99).toFixed(2),
      frameMaxMs: +b.frameMsMax.toFixed(2),
      framesOver25Ms: b.over25,
      framesOver100Ms: b.over100,
      pointerEvents: b.pointerEvents,
      pointerHz: +(b.pointerEvents / secs).toFixed(1),
      pointerAvgGapMs: b.pointerEvents > 1
        ? +(b.pointerGapTotal / (b.pointerEvents - 1)).toFixed(2) : 0,
      pointerMaxGapMs: +b.pointerGapMax.toFixed(2),
      dispatches: b.dispatches,
      dispatchKB: +(b.dispatchChars / 1024).toFixed(1),
      dispatchKBPerSec: +((b.dispatchChars / 1024) / secs).toFixed(2),
      dispatchTotalMs: +b.dispatchMsTotal.toFixed(2),
      dispatchMaxMs: +b.dispatchMsMax.toFixed(2),
      // The headline for issue #177: share of wall time the renderer's main
      // thread spent inside bridge dispatch. Rises as a channel's payload grows.
      dispatchShare: +(b.dispatchMsTotal / (secs * 1000)).toFixed(4),
    };
  }

  function closePhase() {
    var b = phases[phase];
    if (b) b.seconds = now() - b.startedAt;
  }

  window.TSICPerf = {
    /** Begin sampling. Idempotent. */
    start: function () {
      if (running) return 'already-running';
      phases = Object.create(null);
      phase = 'default';
      running = true;
      startedAt = now();
      prevFrame = 0;
      bucket(phase);
      wrapDispatch();
      document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
      rafHandle = requestAnimationFrame(onFrame);
      return 'ok';
    },

    /** Close the current phase and label everything after this point. */
    mark: function (name) {
      if (!running) return 'not-running';
      closePhase();
      phase = String(name || 'default');
      var b = bucket(phase);
      b.startedAt = now();
      prevFrame = 0;
      return 'ok';
    },

    /** Read the summary WITHOUT stopping — for periodic sampling during a soak. */
    peek: function () {
      closePhase();
      var out = { running: running, seconds: +((now() - startedAt) / 1000).toFixed(3), phases: [] };
      for (var k in phases) out.phases.push(summarizeBucket(k, phases[k]));
      return out;
    },

    /** Stop sampling and return the summary. */
    stop: function () {
      if (!running) return { running: false, phases: [] };
      closePhase();
      running = false;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      rafHandle = 0;
      document.removeEventListener('pointermove', onPointerMove, { capture: true });
      unwrapDispatch();
      var out = { running: false, seconds: +((now() - startedAt) / 1000).toFixed(3), phases: [] };
      for (var k in phases) out.phases.push(summarizeBucket(k, phases[k]));
      return out;
    },

    isRunning: function () { return running; },
  };

  // Auto-arm for a manual investigation: append ?tsicperf=1 to the page URL.
  if (String(location.search || '').indexOf('tsicperf=1') !== -1) {
    // Defer so tsic-bridge.js has installed window.tsic and the wrap can take.
    setTimeout(function () { window.TSICPerf.start(); }, 0);
  }
})();
