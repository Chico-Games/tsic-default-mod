// shared/hud-circular-progress.js — ability progress / throw-charge ring.
// Driven by the 30 Hz UI.CircularProgress.State broadcast (bridge bools keep
// their b-prefix), raised by hold-interact (after its grace delay), throw charge
// and the hammer upgrade.
//
// ONE message fills TWO rings, because the two answer different questions:
//   #hud-circular-progress   in the bottom-right action panel, CIRCLING the key
//                            chip of the action that is running — the thing
//                            filling is the key you are holding
//   #hud-crosshair-progress  a subtle collar on the crosshair, where the player
//                            is actually looking during a hold
//
// Neither is display-gated; both fade in. The panel ring is absolutely
// positioned and re-parented onto its host chip, so it contributes nothing to
// layout. It used to be a display:none -> block block element at the end of the
// bottom-anchored panel, which grew and shrank the panel by 32px and shoved
// every row up and back down on each hold. Styles live in hud.js.
//
// Chip resolution, most specific first. The hold row wins because hold-interact
// and the hammer upgrade are both Interact-holds and the furniture block is what
// the player is reading; PrimaryFire catches the throw charge, which has no
// interaction row of its own. Nothing matched -> the ring parks in the panel
// corner at its old size, so a new charge source can never leave it invisible.
//
// The mount is re-resolved on EVERY broadcast: hud-interaction.js and
// hud-behavior-bar.js both rebuild their chips from scratch (up to 10 Hz on
// cooldown churn), which detaches the ring. That is also why the node is cached
// in a local — once detached, getElementById can no longer find it.
//
// The publisher CLAMPS Elapsed and holds at 100% until the ability broadcasts
// Stop (a maxed throw charge keeps a full ring), so the completion bloom is
// edge-triggered here — a CSS rule keyed off "full" would re-fire every frame.
(function () {
  var CHIP_SELECTORS = [
    '#interaction-hold-prompt:not(.hidden) .bb-key',
    '#interaction-prompt:not(.hidden) .bb-key',
    '#bb-gameplay .bb-row[data-behavior="Input.Behavior.Interact"] .bb-key',
    '#bb-gameplay .bb-row[data-behavior="Input.Behavior.PrimaryFire"] .bb-key',
  ];

  var panelRing = null;   // cached: survives its host chip being rebuilt
  var host = null;        // chip currently hosting the ring, or null when parked
  var wasFull = false;

  function findChip() {
    for (var i = 0; i < CHIP_SELECTORS.length; i++) {
      var chip = document.querySelector(CHIP_SELECTORS[i]);
      if (chip) return chip;
    }
    return null;
  }

  function park(ring) {
    if (host) host.classList.remove('cp-host');
    host = null;
    ring.classList.add('parked');
    var shell = document.getElementById('bb-shell-gameplay');
    if (shell && ring.parentNode !== shell) shell.appendChild(ring);
  }

  function mount(ring, chip) {
    if (host === chip && ring.parentNode === chip) return;
    if (host && host !== chip) host.classList.remove('cp-host');
    host = chip;
    chip.classList.add('cp-host');
    ring.classList.remove('parked');
    chip.appendChild(ring);
  }

  function paint(el, pct, color, active) {
    if (!el) return;
    el.classList.toggle('active', active);
    if (!active) return;
    el.style.setProperty('--cp-p', String(pct));
    if (color) el.style.setProperty('--cp-color', color);
  }

  tsic.on('tsic.msg.UI.CircularProgress.State', function (p) {
    if (!panelRing) panelRing = document.getElementById('hud-circular-progress');
    var collar = document.getElementById('hud-crosshair-progress');
    if (!panelRing && !collar) return;

    var active = !!(p && p.bActive && p.Total > 0);
    var pct = active ? Math.max(0, Math.min(100, (p.Elapsed / p.Total) * 100)) : 0;
    var color = (p && p.Color) || '';

    if (panelRing) {
      // Park on the way down so a stale .cp-host is never left behind on a chip.
      var chip = active ? findChip() : null;
      if (chip) mount(panelRing, chip);
      else park(panelRing);
      paint(panelRing, pct, color, active);
    }
    paint(collar, pct, color, active);
    if (document.body) document.body.classList.toggle('hud-charging', active);

    var full = active && pct >= 99.5;
    if (full && !wasFull) {
      var bloom = document.getElementById('hud-crosshair-bloom');
      if (bloom) {
        if (color) bloom.style.setProperty('--cp-color', color);
        bloom.classList.remove('fire');
        void bloom.offsetWidth;          // restart the one-shot animation
        bloom.classList.add('fire');
      }
    }
    wasFull = full;
  });
})();
