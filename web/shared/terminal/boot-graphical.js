// shared/terminal/boot-graphical.js
//
// Graphical boot sequences for the GUI shells. Tier-1 boots as a text BIOS POST
// (boot.js + console-core.js); the tier-2 "Durham OS" desktop and tier-3
// "SCiPnet" topology instead play a graphical boot OVERLAY before revealing the
// live UI. This module owns ONLY the scripted sequence + timing (pure
// orchestration); each shell supplies a `view` adapter that does the real DOM,
// exactly like boot.js/runBoot. Unit-testable with a fake view.
//
// view (tier-2): line(text), addModule(name), setProgress(0..1), blinkDisk(),
//                alive()->bool, done()
// view (tier-3): line(text,{cls,instant,skip})->Promise (types char-by-char,
//                resolving when the line is fully revealed), glitch(),
//                breach(on), alive()->bool, done()
// opts: { skip?:()=>bool, instant?:bool }. run() calls view.done() exactly once.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.boot = NS.boot || {};

  // Resolve after `ms`, or immediately when instant / already skipping.
  function wait(ms, opts) {
    if (opts && (opts.instant || (opts.skip && opts.skip()))) return Promise.resolve();
    return new Promise(function (res) { setTimeout(res, ms); });
  }
  function skipping(opts) { return !!(opts && opts.skip && opts.skip()); }

  // ── Tier-2: Durham OS GUI splash ──────────────────────────────────
  const T2_MODULES = ['KERNEL.SYS', 'VIDEO.DRV', 'MOUSE.DRV', 'DISK.DRV', 'FONTS.DAT', 'DESK.EXE'];

  async function runTier2(view, opts) {
    opts = opts || {};
    const mods = opts.modules || T2_MODULES;
    await wait(250, opts);
    for (let i = 0; i < mods.length; i++) {
      if (!view.alive()) return;
      if (skipping(opts)) break;
      view.addModule(mods[i]);
      view.blinkDisk();
      view.setProgress((i + 1) / mods.length);
      await wait(opts.instant ? 0 : 320, opts);
    }
    if (view.alive() && !skipping(opts)) {
      view.setProgress(1);
      view.line('Starting desktop…');
      await wait(opts.instant ? 0 : 500, opts);
    }
    if (view.alive()) view.done();
  }

  // ── Tier-3: SCiPnet hijack reveal ─────────────────────────────────
  const T3_ACT1 = [
    { text: 'SCiPNET SECURE SHELL // NODE RAISA-04' },
    { text: 'ESTABLISHING UPLINK............ OK' },
    { text: 'RAISA HANDSHAKE................ OK' },
    { text: 'AUTHENTICATING CLEARANCE [L-4]' },
    { text: 'VERIFYING CREDENTIALS ███████░░' },
  ];
  const T3_ACT2_BREACH = [
    { text: '!! ANOMALOUS ACCESS — TRACE INITIATED' },
  ];
  const T3_ACT2_OVERRIDE = [
    { text: 'OVERRIDE INJECTED ::: KATIE//ROOT' },
    { text: 'RAISA LOCKOUT BYPASSED' },
    { text: 'CLEARANCE OVERRIDE ACTIVE — L-∞' },
  ];
  const T3_ACT3 = [
    { text: 'MAPPING SUBNET.................' },
    { text: 'ACCESS GRANTED.', cls: 'ok' },
  ];

  // Lines are TYPED out one character at a time (v1 BIOS feel) — the cadence
  // lives in the shell's overlay (view.line returns a Promise we await); the
  // short waits below are just the beats BETWEEN lines/acts. instant + skip are
  // threaded into each line so a fast-forward flushes mid-type, not just between.
  async function runTier3(view, opts) {
    opts = opts || {};
    const lo = function (cls) { return { cls: cls, instant: opts.instant, skip: opts.skip }; };
    // Act 1 — authentic SCiPNET secure login.
    for (let i = 0; i < T3_ACT1.length; i++) {
      if (!view.alive()) return;
      if (skipping(opts)) { view.done(); return; }
      await view.line(T3_ACT1[i].text, lo());
      await wait(opts.instant ? 0 : 45, opts);
    }
    // Act 2 — the hijack: glitch, alarm-red breach, then Katie's override.
    if (view.alive() && !skipping(opts)) {
      view.glitch();
      await wait(opts.instant ? 0 : 130, opts);
      view.breach(true);
      for (let i = 0; i < T3_ACT2_BREACH.length; i++) {
        await view.line(T3_ACT2_BREACH[i].text, lo('danger'));
        await wait(opts.instant ? 0 : 110, opts);
      }
      view.glitch();
      await wait(opts.instant ? 0 : 110, opts);
      view.breach(false);
      for (let i = 0; i < T3_ACT2_OVERRIDE.length; i++) {
        if (skipping(opts)) break;
        await view.line(T3_ACT2_OVERRIDE[i].text, lo());
        await wait(opts.instant ? 0 : 55, opts);
      }
    }
    // Act 3 — network online.
    if (view.alive() && !skipping(opts)) {
      for (let i = 0; i < T3_ACT3.length; i++) {
        await view.line(T3_ACT3[i].text, lo(T3_ACT3[i].cls));
        await wait(opts.instant ? 0 : 75, opts);
      }
    }
    if (view.alive()) view.done();
  }

  NS.boot.tier2 = { MODULES: T2_MODULES, run: runTier2 };
  NS.boot.tier3 = {
    ACT1: T3_ACT1, ACT2_BREACH: T3_ACT2_BREACH, ACT2_OVERRIDE: T3_ACT2_OVERRIDE, ACT3: T3_ACT3,
    run: runTier3,
  };
})(window);
