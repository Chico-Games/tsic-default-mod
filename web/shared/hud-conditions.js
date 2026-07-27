// shared/hud-conditions.js — In-game HUD condition chips.
//
// A compact stack of icon+name chips immediately right of the stomach slots, listing
// every condition the player currently has: tag-driven status effects (Well Fed,
// Burning, Overburdened, ...) and the buffs granted by whatever is digesting
// (Swift, Energised, Regenerating, ...). Loaded by hud.js into the #hud-conditions
// shell. The list is bottom-anchored and grows upward, so entry 0 sits lowest —
// C++ emits debuffs first, which puts them nearest the vials.
//
// Channel: tsic.msg.UI.Conditions.State
//   { Conditions: [ { Id, Kind, Duration, RemainingTime, RefreshCount, bFromSelected,
//                     Severity } ] }
//
// Severity is "" for everything that escalates by arriving and leaving, and
// "Hungry" | "Starving" for the hunger family, which escalates in place instead — the
// same three chips lean on harder rather than one renaming itself mid-state.
//
// Sent on change only (see PublishConditionsSnapshot), never per tick, so a settled
// HUD costs nothing. RemainingTime is therefore a snapshot taken at the last change —
// good for the boolean "is this expiring", not for a live countdown.
//
// This file owns ALL presentation: names, icons, colours, timings. C++ only decides
// what counts as a condition, so re-wording a label is a mod edit, not a rebuild.
(function () {
  // Seconds of runway that counts as "about to expire". MUST match
  // GConditionExpiringSeconds in ScpUIDirectorSubsystem_Gameplay.cpp — C++ only
  // rebroadcasts when a condition crosses that line, so a smaller value here would
  // never be reached and a larger one would trigger on a stale RemainingTime.
  var EXPIRING_SECONDS = 5;

  // How long a chip shows its name before collapsing to icon-only.
  var LABEL_HOLD_MS = 3000;

  // The hunger family. These get the "actively costing you something" treatment — a red
  // wash that breathes rather than the flat debuff tint — because unlike Burning or Tazed
  // they are not an event that happens to you, they are a state you are choosing to stay in.
  var HARM = { Hunger: 1, ReducedRegen: 1, CapStamina: 1 };

  // Chips whose name never folds away. Hunger is the headline of its group: the two
  // penalties below it behave like any other chip and collapse to icons once read, but
  // something has to keep saying WHY they are there, for as long as they are there.
  var PINNED = { Hunger: 1 };

  // Icon paths are 24x24, stroked with currentColor so each chip's tint carries through.
  // One distinct shape per condition — at 14px only the silhouette reads, so they lean
  // on outline rather than detail.
  var ICONS = {
    // The bowl, fed and unfed: steaming, then empty with the last of it draining away.
    WellFed:       ['M3 13h18a9 9 0 0 1-18 0z', 'M9 6c0-1 1-1.5 1-2.5M13 6c0-1 1-1.5 1-2.5'],
    Hunger:        ['M3 13h18a9 9 0 0 1-18 0z', 'M12 3v5M9.5 6l2.5 2.5L14.5 6'],
    // What hunger costs: a line trending down, and a bar with a hard ceiling on it.
    ReducedRegen:  ['M3 7l6 6 4-4 7 7', 'M20 11v5h-5'],
    CapStamina:    ['M3 9h11v6H3z', 'M17 10.5v3', 'M10 5.5v13'],
    // Flame.
    Burning:       ['M12 2c3 4 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1.5 1 2.5 2 2.5C12 7 10 5 12 2z'],
    // Dizzy swirl — reads as "stunned" without colliding with the Energised bolt.
    Tazed:         ['M15 8a4 4 0 1 0-3 6.5', 'M9 16a4 4 0 1 0 3-6.5'],
    // Crate pressing down.
    Overburdened:  ['M5 10h14v9H5z', 'M12 2v5M9.5 5l2.5 2.5L14.5 5'],
    // Slashed eye.
    Hidden:        ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z', 'M4 4l16 16'],
    // Heart, and heart + cross for the over-time version.
    Hearty:        ['M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20z'],
    Regenerating:  ['M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20z',
                    'M12 11v5M9.5 13.5h5'],
    // Battery — the stamina pool.
    Enduring:      ['M3 8h14v8H3z', 'M20 10.5v3', 'M6 10.5v3M9.5 10.5v3M13 10.5v3'],
    // Shield.
    Fortified:     ['M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z'],
    // Speed chevrons.
    Swift:         ['M4 7l5 5-5 5', 'M12 7l5 5-5 5'],
    // Lightning bolt.
    Energised:     ['M13 2L5 13h6l-2 9 8-11h-6z'],
    // Circular arrow.
    QuickRecovery: ['M20 12a8 8 0 1 1-2.5-5.8', 'M20 3v4h-4'],
  };

  var LABELS = {
    Hunger:        'Hunger',
    ReducedRegen:  'Reduced Regen',
    CapStamina:    'Cap Stamina',
    Burning:       'Burning',
    Tazed:         'Tazed',
    Overburdened:  'Overburdened',
    WellFed:       'Well Fed',
    Regenerating:  'Regenerating',
    Hearty:        'Hearty',
    Enduring:      'Enduring',
    Fortified:     'Fortified',
    Swift:         'Swift',
    Energised:     'Energised',
    QuickRecovery: 'Quick Recovery',
  };

  // Frame matches the stomach slots and hotbar plinths: dark glass, heavy ink outline,
  // hard offset block shadow. Chips are 22px tall and rest at icon width (26px),
  // widening to fit their label while open.
  var CSS = [
    '#hud-conditions { display:flex; flex-direction:column-reverse; align-items:flex-start; gap:4px; }',

    '#hud-conditions .cond-chip { position:relative; display:flex; align-items:center; gap:0;',
    '  height:22px; max-width:26px; padding:0; overflow:hidden; white-space:nowrap;',
    '  border:2px solid var(--ink-night); border-radius:6px;',
    '  background: linear-gradient(180deg, rgba(58,40,34,0.62), rgba(14,9,8,0.70));',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.14), var(--shadow-block-sm);',
    '  transition: max-width 260ms cubic-bezier(0.22,0.8,0.3,1), opacity 200ms ease,',
    '              transform 260ms cubic-bezier(0.22,0.8,0.3,1),',
    '              box-shadow 160ms ease, border-color 160ms ease; }',
    // Open — label visible. 148px is a ceiling, not a width: max-width can be animated
    // where width:auto cannot, and the chip only ever grows to its content.
    '#hud-conditions .cond-chip.cond-open { max-width:148px; }',

    // Both sit above the harm wash below, which paints across the whole chip.
    '#hud-conditions .cond-ico { flex:0 0 22px; display:flex; align-items:center; justify-content:center;',
    '  position:relative; z-index:1; }',
    '#hud-conditions .cond-ico svg { width:14px; height:14px; display:block;',
    '  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.7)); }',

    '#hud-conditions .cond-label { position:relative; z-index:1; flex:0 0 auto; padding-right:8px;',
    '  font-family:var(--font-display, Georgia, serif); font-size:10px; font-weight:700;',
    '  letter-spacing:0.08em; text-transform:uppercase; line-height:1;',
    '  text-shadow:0 1px 2px rgba(0,0,0,0.8);',
    '  opacity:0; transform:translateX(-4px);',
    '  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22,0.8,0.3,1); }',
    '#hud-conditions .cond-chip.cond-open .cond-label { opacity:1; transform:translateX(0); }',

    // Tints — both already in the HUD palette (behavior-bar blocked / plantable).
    '#hud-conditions .cond-chip[data-kind="Debuff"] { color:#e8a0a0; }',
    '#hud-conditions .cond-chip[data-kind="Buff"]   { color:#a9e2a0; }',
    '#hud-conditions .cond-chip[data-kind="Debuff"] { border-color:#0a0a0a;',
    '  background: linear-gradient(180deg, rgba(74,32,30,0.66), rgba(20,8,8,0.72)); }',

    // Enter — slides out from behind the stomach column.
    '#hud-conditions .cond-chip.cond-enter { animation: cond-in 320ms cubic-bezier(0.22,0.8,0.3,1) both; }',
    '@keyframes cond-in { from { opacity:0; transform:translateX(-14px) scale(0.92); }',
    '                     to   { opacity:1; transform:translateX(0) scale(1); } }',

    // Exit — collapses back toward the stomach, then unmounts.
    '#hud-conditions .cond-chip.cond-exit { opacity:0; transform:translateX(-10px) scale(0.9);',
    '  pointer-events:none; }',

    // Final seconds — a slow breathe plus a slight dim, so an expiring buff reads as
    // fading rather than as a new arrival.
    '#hud-conditions .cond-chip.cond-expiring { animation: cond-pulse 1.15s ease-in-out infinite; }',
    '@keyframes cond-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }',

    // Harm — the hunger family. A deeper red than the flat debuff tint, plus a wash that
    // breathes out from behind the icon so the group reads as ONGOING rather than as
    // something that merely happened. The glow has to be an inset ::after: the chip is
    // overflow:hidden for the label collapse, which would clip an outer halo, and its own
    // animation slot is already taken for good by cond-enter's fill-mode:both.
    '#hud-conditions .cond-chip.cond-harm { color:#f2938c; border-color:#250908;',
    '  background: linear-gradient(180deg, rgba(96,32,27,0.70), rgba(24,7,6,0.76)); }',
    '#hud-conditions .cond-chip.cond-harm::after { content:""; position:absolute; inset:0;',
    '  pointer-events:none; z-index:0;',
    '  background: radial-gradient(125% 150% at 11px 50%, rgba(228,84,70,0.38), rgba(228,84,70,0) 72%);',
    '  animation: cond-harm-breathe 2.6s ease-in-out infinite; }',
    '@keyframes cond-harm-breathe { 0%,100% { opacity:0.18; } 50% { opacity:0.9; } }',

    // Starving — the same chips, leaning on harder. Faster breath and a hotter red, so
    // the escalation is felt without a single chip mounting, unmounting or renaming.
    '#hud-conditions .cond-chip.cond-harm[data-severity="Starving"] { color:#ff9c8e;',
    '  background: linear-gradient(180deg, rgba(122,36,29,0.76), rgba(30,8,6,0.80)); }',
    '#hud-conditions .cond-chip.cond-harm[data-severity="Starving"]::after {',
    '  background: radial-gradient(125% 150% at 11px 50%, rgba(248,92,74,0.52), rgba(248,92,74,0) 72%);',
    '  animation-duration: 1.45s; }',

    // From-selected — a buff the food in the currently-selected hotbar slot is driving.
    // Warm-gold rim + halo matching the highlighted stomach slot, so selecting a food
    // lights up both the slot digesting it AND the effects it is granting. Declared after
    // the kind tints so the gold border wins over the resting ink outline.
    '#hud-conditions .cond-chip.cond-from-selected { border-color: rgba(224,208,170,0.95);',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.14), var(--shadow-block-sm), 0 0 10px rgba(240,220,170,0.55); }',

    // Topped up — another consumable re-granted a buff already running. A single bright
    // swell on the icon rather than a slide, so it reads as "this one, again" instead of
    // being mistaken for a chip arriving.
    '#hud-conditions .cond-chip.cond-refresh .cond-ico { animation: cond-bump 420ms cubic-bezier(0.34,1.56,0.64,1); }',
    '@keyframes cond-bump { 0% { transform:scale(1); filter:none; }',
    '                       45% { transform:scale(1.35); filter:brightness(1.9); }',
    '                       100% { transform:scale(1); filter:none; } }',

    '@media (prefers-reduced-motion: reduce) {',
    '  #hud-conditions .cond-chip, #hud-conditions .cond-label { transition:none; }',
    '  #hud-conditions .cond-chip.cond-enter { animation:none; }',
    '  #hud-conditions .cond-chip.cond-expiring { animation:none; opacity:0.7; }',
    '  #hud-conditions .cond-chip.cond-refresh .cond-ico { animation:none; }',
    // The red stays — it is the meaning, not the motion. Only the breathing stops, held
    // at the bright end so a harm chip still stands out from an ordinary debuff.
    '  #hud-conditions .cond-chip.cond-harm::after { animation:none; opacity:0.75; }',
    '}',
  ].join('\n');

  var host = null;
  var chips = {};        // Id -> { el, labelEl, kind, expiring, holdTimer, exitTimer }

  function el(tag, attrs) {
    if (window.TSIC && window.TSIC.el) return TSIC.el.apply(null, arguments);
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function injectStyles() {
    if (document.getElementById('hud-conditions-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-conditions-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildIcon(id) {
    var svg = TSIC.svg('svg', {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
    (ICONS[id] || ICONS.WellFed).forEach(function (d) {
      svg.appendChild(TSIC.svg('path', { d: d }));
    });
    return svg;
  }

  // Opens a chip's label. Normally it collapses back to icon-only after LABEL_HOLD_MS;
  // pinned, it stays open until something un-pins it (used for the expiring warning,
  // where the whole point is that the name is readable as the chip runs out).
  // Re-opening while already open restarts the hold rather than stacking timers.
  function openLabel(chip, pin) {
    clearTimeout(chip.holdTimer);
    chip.holdTimer = 0;
    chip.el.classList.add('cond-open');
    if (pin) return;
    chip.holdTimer = setTimeout(function () {
      chip.el.classList.remove('cond-open');
    }, LABEL_HOLD_MS);
  }

  // Plays the top-up bump. Restarting a running CSS animation needs the class dropped and
  // a reflow forced before re-adding, or a second top-up inside 420ms would do nothing.
  function bumpChip(chip) {
    clearTimeout(chip.bumpTimer);
    chip.el.classList.remove('cond-refresh');
    void chip.el.offsetWidth;
    chip.el.classList.add('cond-refresh');
    chip.bumpTimer = setTimeout(function () {
      chip.el.classList.remove('cond-refresh');
    }, 460);
  }

  function addChip(id, kind) {
    // A condition can lapse and re-apply inside the exit animation (eating a second
    // helping the moment the first runs out). Drop the outgoing element rather than
    // letting two chips share a data-id.
    var stale = host.querySelector('.cond-chip.cond-exit[data-id="' + id + '"]');
    if (stale) host.removeChild(stale);

    var cls = 'cond-chip cond-enter' + (HARM[id] ? ' cond-harm' : '');
    var chipEl = el('div', { class: cls, 'data-id': id, 'data-kind': kind },
      el('span', { class: 'cond-ico' }, buildIcon(id)),
      el('span', { class: 'cond-label' }, LABELS[id] || id));

    var chip = { el: chipEl, kind: kind, expiring: false, refresh: 0, fromSelected: false,
                 severity: '', holdTimer: 0, exitTimer: 0, bumpTimer: 0 };
    chips[id] = chip;
    host.appendChild(chipEl);

    // Open on the next frame so the collapsed max-width is committed first and the widen
    // animates instead of snapping. Re-read chip.expiring here rather than capturing it:
    // render() sets it synchronously right after this call, and a chip that mounts already
    // inside its final seconds must keep its label pinned, not collapse 3s later.
    requestAnimationFrame(function () { openLabel(chip, chip.expiring || !!PINNED[id]); });
    return chip;
  }

  function removeChip(id) {
    var chip = chips[id];
    if (!chip) return;
    delete chips[id];
    clearTimeout(chip.holdTimer);
    clearTimeout(chip.exitTimer);
    clearTimeout(chip.bumpTimer);

    chip.el.classList.remove('cond-open', 'cond-expiring', 'cond-refresh');
    chip.el.classList.add('cond-exit');
    // Unmount after the collapse+fade. A timer rather than transitionend: a chip removed
    // while the HUD is hidden (display:none) fires no transition and would leak.
    chip.exitTimer = setTimeout(function () {
      if (chip.el.parentNode) chip.el.parentNode.removeChild(chip.el);
    }, 280);
  }

  // A chip that is mid-exit still occupies the DOM until its timer fires, and must not be
  // counted when matching positions — otherwise it gets shuffled to an end of the stack
  // and visibly jumps while fading.
  function nextLiveSibling(el) {
    var n = el.nextSibling;
    while (n && n.classList && n.classList.contains('cond-exit')) n = n.nextSibling;
    return n || null;
  }

  // DOM order must follow the payload's order — the C++ catalogue is fixed, so this only
  // does work when a chip arrives between two existing ones. Walks back to front,
  // anchoring each live chip before the live chip that should follow it.
  function reorder(ids) {
    var next = null;
    for (var i = ids.length - 1; i >= 0; i--) {
      var chip = chips[ids[i]];
      if (!chip) continue;
      if (chip.el.parentNode !== host || nextLiveSibling(chip.el) !== next) {
        host.insertBefore(chip.el, next);
      }
      next = chip.el;
    }
  }

  function render(payload) {
    if (!host) return;
    var list = (payload && payload.Conditions) || [];

    var seen = {};
    var order = [];
    list.forEach(function (c) {
      if (!c || !c.Id) return;
      var id = c.Id;
      seen[id] = true;
      order.push(id);

      var kind = c.Kind === 'Debuff' ? 'Debuff' : 'Buff';
      var remaining = Number(c.RemainingTime) || 0;
      var expiring = remaining > 0 && remaining <= EXPIRING_SECONDS;
      var refresh = Number(c.RefreshCount) || 0;
      var fromSelected = !!c.bFromSelected;
      var severity = c.Severity || '';
      // Pinned chips ignore the hold timer entirely; the expiring pin is the same
      // mechanism, so either reason keeps the name up.
      var pin = expiring || !!PINNED[id];

      var chip = chips[id];
      var mounted = !!chip;
      if (!chip) {
        chip = addChip(id, kind);
      } else if (chip.kind !== kind) {
        chip.kind = kind;
        chip.el.setAttribute('data-kind', kind);
      }

      // Another consumable re-granted a buff already running. Nothing about the chip
      // otherwise changes, so say so: bump the icon and show the name again, which is the
      // whole point — confirming WHICH buff was topped up. Skipped on first mount, where
      // the entry animation already introduces it.
      if (mounted && refresh > chip.refresh) {
        bumpChip(chip);
        openLabel(chip, pin);
      }
      chip.refresh = refresh;

      // Hunger deepening to starving: the same chips lean on harder. Driven off an
      // attribute rather than a class swap so the CSS reads as one ramp.
      if (severity !== chip.severity) {
        chip.severity = severity;
        if (severity) {
          chip.el.setAttribute('data-severity', severity);
        } else {
          chip.el.removeAttribute('data-severity');
        }
      }

      // Gold-highlight the chip when the selected hotbar food is driving this buff.
      // Applies on mount too (chip.fromSelected defaults false), so a chip that arrives
      // already attributed to the selection lights up immediately.
      if (fromSelected !== chip.fromSelected) {
        chip.fromSelected = fromSelected;
        chip.el.classList.toggle('cond-from-selected', fromSelected);
      }

      if (expiring !== chip.expiring) {
        chip.expiring = expiring;
        chip.el.classList.toggle('cond-expiring', expiring);
        // Re-open the label on the way out and hold it there, so the last thing seen is
        // the chip's name rather than an anonymous icon vanishing. Dropping back out of
        // the window (a re-application topped the timer up) resumes the normal collapse.
        openLabel(chip, pin);
      }
    });

    Object.keys(chips).forEach(function (id) {
      if (!seen[id]) removeChip(id);
    });

    reorder(order);
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function' || !window.TSIC || !TSIC.svg) {
      setTimeout(boot, 16);
      return;
    }
    host = document.getElementById('hud-conditions');
    if (!host) { setTimeout(boot, 16); return; }
    injectStyles();
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Conditions.State', render);
    });
  })();
})();
