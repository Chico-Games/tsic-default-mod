// shared/hud-hotbar-wheel.js — hold-to-open radial hotbar selector.
//
// WHY THIS EXISTS: the hotbar is driven by the number row, which a gamepad
// doesn't have. Without a wheel, a controller player can only step through
// cells one bumper-press at a time — the genre's answer (Conan Exiles, Rust,
// Red Dead) is a radial you hold open and flick to. Keyboard gets it too on Q,
// since it beats reaching for 7/8 mid-fight.
//
// Input: BH_HotbarWheel (trigger_type Held) → UI.Behavior.HotbarWheel with
//   Started   — open the wheel
//   Triggered — per-frame while held (the aim vector is sampled here)
//   Completed — commit the highlighted slot and close
//
// Aiming: gamepad right-stick via UI.Behavior.Look (already published as an
// axis), mouse via raw pointer movement. Whichever moved last wins, so a
// player on a controller never has to touch the mouse and vice versa.
//
// The ring holds the eight hotbar cells plus a ninth FISTS entry at the bottom, which stows
// whatever is held without moving the selection. It exists because there is no reserved fists
// cell any more: on keyboard you stow by tapping the current number again, and a controller
// needs the same escape hatch somewhere it can aim at.
//
// Channels:
//   tsic.msg.UI.Behavior.HotbarWheel  { Phase }
//   tsic.msg.UI.Hotbar.Changed        { NumSlots, SelectedSlot, SelectedSlotPending }
//   tsic.msg.UI.Inventory.Updated     (OwnerId === 'Player') → icons/counts
// Publishes: UI.Cmd.Hotbar.Select { SlotIndex }, UI.Cmd.Hotbar.Stow {}
// Depends on: shared/dom.js, shared/icons.js, shared/tsic-runtime.js
(function () {
  var DEFAULT_SLOT_COUNT = 8;
  // Sentinel entry index for the fists wedge — never a grid cell.
  var FISTS_ENTRY = -1;
  var RADIUS = 132;         // px from centre to slot centre
  var DEAD_ZONE = 34;       // px of travel before a direction counts as aimed
  var SLOT_PX = 62;

  var CSS = [
    '#hud-hotbar-wheel {',
    '  position:fixed; inset:0; z-index:60; pointer-events:none;',
    '  display:none; align-items:center; justify-content:center;',
    '  background:rgba(8,6,5,0.42); opacity:0; transition:opacity 110ms ease;',
    '}',
    '#hud-hotbar-wheel.open { display:flex; opacity:1; }',
    '#hud-hotbar-wheel .wheel { position:relative; width:' + (RADIUS * 2 + SLOT_PX + 20) + 'px;',
    '  height:' + (RADIUS * 2 + SLOT_PX + 20) + 'px; }',
    // Each slot mirrors the HUD hotbar plinth so the wheel reads as the same
    // object, just rearranged.
    '#hud-hotbar-wheel .wslot {',
    '  position:absolute; width:' + SLOT_PX + 'px; height:' + SLOT_PX + 'px;',
    '  margin-left:' + (-SLOT_PX / 2) + 'px; margin-top:' + (-SLOT_PX / 2) + 'px;',
    '  background:linear-gradient(180deg, rgba(58,40,34,0.55), rgba(14,9,8,0.65));',
    '  border:2px solid var(--ink-night,#0e0908); border-radius:11px;',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.16), inset 0 0 12px rgba(0,0,0,0.5);',
    '  transition: transform 110ms cubic-bezier(0.34,1.56,0.64,1), border-color 110ms ease, box-shadow 110ms ease;',
    '  font-family:var(--font-body); color:#f0e7d4;',
    '}',
    '#hud-hotbar-wheel .wslot img { width:100%; height:100%; object-fit:contain; padding:9px;',
    '  pointer-events:none; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6)); }',
    '#hud-hotbar-wheel .wslot .fists-glyph { width:100%; height:100%; padding:12px; color:#e4d9c0;',
    '  pointer-events:none; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6)); }',
    '#hud-hotbar-wheel .wslot .key {',
    '  position:absolute; top:3px; left:4px; min-width:15px; padding:0 4px;',
    '  font-family:var(--font-display); font-size:13px; font-weight:700; line-height:1.35;',
    '  text-align:center; color:#f3ecda; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.62); border:1px solid var(--ink-night,#0e0908); border-radius:5px;',
    '}',
    '#hud-hotbar-wheel .wslot .count {',
    '  position:absolute; bottom:3px; right:4px; padding:2px 4px; line-height:1;',
    '  font-family:var(--font-display); font-size:11px; font-weight:700; color:#fff;',
    '  text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.70); border:1px solid var(--ink-night,#0e0908); border-radius:5px;',
    '}',
    // Aimed slot: same grow-and-glow language as the HUD hotbar's selection.
    '#hud-hotbar-wheel .wslot.aim {',
    '  transform:scale(1.22); border-color:rgba(224,208,170,0.95);',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.2), 0 0 26px rgba(240,220,170,0.55);',
    '}',
    // The slot that is already equipped, when it is not the one being aimed at.
    '#hud-hotbar-wheel .wslot.current { border-color:rgba(150,145,135,0.9); }',
    '#hud-hotbar-wheel .label {',
    '  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);',
    '  text-align:center; font-family:var(--font-body); color:#f3ecda;',
    '  text-shadow:0 2px 4px rgba(0,0,0,0.9); pointer-events:none; max-width:190px;',
    '}',
    '#hud-hotbar-wheel .label .nm { font-size:16px; letter-spacing:0.04em; }',
    '#hud-hotbar-wheel .label .hint { font-size:11px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.65; }',
  ].join('\n');

  var lastHotbar = null;
  var itemsBySlot = new Map();
  var open = false;
  var aimX = 0, aimY = 0;
  // Currently aimed entry: a grid cell index, FISTS_ENTRY, or null while inside the dead zone.
  var aimEntry = null;
  var hostEl = null;

  function injectStyles() {
    if (document.getElementById('hud-hotbar-wheel-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-hotbar-wheel-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function publish(tag, payload) {
    if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
  }

  function slotCount() {
    var n = lastHotbar && lastHotbar.NumSlots;
    return (typeof n === 'number' && n > 0) ? n : DEFAULT_SLOT_COUNT;
  }

  function slotItem(i) {
    return itemsBySlot.get(i) || null;
  }

  /**
   * Wedge entries: FISTS at the bottom, then every hotbar cell around the ring.
   *
   * There are total+1 evenly spaced positions and fists claims the bottom one, so cell 1 starts
   * just past it and the rest sweep up and over the top back to the other side.
   */
  function entries() {
    var total = slotCount();
    // total + 1 evenly spaced positions: FISTS takes the first, the cells take the rest.
    // Anchoring on the fists angle is what keeps every entry distinct — deriving `start` from
    // an offset instead let a cell land exactly on the fists wedge, and since resolveAim
    // breaks ties with a strict `<` in list order, the cell always won and Fists became
    // unreachable on a controller. Do not reintroduce an offset here.
    var step = (Math.PI * 2) / (total + 1);
    var start = Math.PI / 2;   // bottom of the wheel
    var list = [{ index: FISTS_ENTRY, angle: start }];
    for (var i = 0; i < total; i++) {
      list.push({ index: i, angle: start + step * (i + 1) });
    }
    return list;
  }

  // Nearest entry to the current aim vector; null while inside the dead zone.
  function resolveAim() {
    var dist = Math.sqrt(aimX * aimX + aimY * aimY);
    if (dist < DEAD_ZONE) return null;
    var target = Math.atan2(aimY, aimX);
    var best = null, bestDelta = Infinity;
    var list = entries();
    for (var i = 0; i < list.length; i++) {
      var d = Math.abs(Math.atan2(Math.sin(target - list[i].angle), Math.cos(target - list[i].angle)));
      if (d < bestDelta) { bestDelta = d; best = list[i].index; }
    }
    return best;
  }

  function applyAim() {
    if (!hostEl) return;
    var next = resolveAim();
    if (next === aimEntry) return;
    aimEntry = next;
    var kids = hostEl.querySelectorAll('.wslot');
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('aim', Number(kids[i].dataset.entry) === aimEntry);
    }
    renderLabel();
    if (aimEntry !== null && window.tsic && tsic.playSound) tsic.playSound('UI.Focus', 0.2);
  }

  function renderLabel() {
    if (!hostEl) return;
    var label = hostEl.querySelector('.label');
    if (!label) return;
    label.innerHTML = '';
    var nm = TSIC.el('div', { class: 'nm' });
    var hint = TSIC.el('div', { class: 'hint' });
    if (aimEntry === null) {
      nm.textContent = 'Hotbar';
      hint.textContent = 'Aim to choose';
    } else if (aimEntry === FISTS_ENTRY) {
      nm.textContent = 'Fists';
      hint.textContent = 'Put it away';
    } else {
      var item = slotItem(aimEntry);
      var cat = (window.tsic && window.tsic.itemCatalog) || {};
      var desc = item ? cat[item.ItemId] : null;
      nm.textContent = item ? ((desc && desc.Name) || item.ItemId) : 'Empty';
      hint.textContent = 'Slot ' + (aimEntry + 1);
    }
    label.appendChild(nm);
    label.appendChild(hint);
  }

  function build() {
    injectStyles();
    var root = document.getElementById('hud-hotbar-wheel');
    if (!root) return null;
    root.innerHTML = '';
    var wheel = TSIC.el('div', { class: 'wheel' });
    var cx = RADIUS + SLOT_PX / 2 + 10;
    var cy = cx;
    var current = (lastHotbar && typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;

    var list = entries();
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var isFists = entry.index === FISTS_ENTRY;
      var slot = TSIC.el('div', { class: 'wslot' + (!isFists && entry.index === current ? ' current' : '') });
      slot.dataset.entry = String(entry.index);
      slot.style.left = (cx + Math.cos(entry.angle) * RADIUS) + 'px';
      slot.style.top = (cy + Math.sin(entry.angle) * RADIUS) + 'px';
      if (isFists) {
        slot.appendChild(TSIC.fistsIcon({ class: 'fists-glyph' }));
      } else {
        var item = slotItem(entry.index);
        if (item && item.ItemId) {
          slot.appendChild(TSIC.iconImg(TSIC.itemIconUrl(item.ItemId)));
          if ((item.Count || 1) > 1) {
            slot.appendChild(TSIC.el('span', { class: 'count' }, String(item.Count)));
          }
        }
        slot.appendChild(TSIC.el('span', { class: 'key' }, String(entry.index + 1)));
      }
      wheel.appendChild(slot);
    }
    wheel.appendChild(TSIC.el('div', { class: 'label' }));
    root.appendChild(wheel);
    return root;
  }

  function onPointerMove(e) {
    if (!open) return;
    aimX += e.movementX || 0;
    aimY += e.movementY || 0;
    applyAim();
  }

  function openWheel() {
    if (open) return;
    hostEl = build();
    if (!hostEl) return;
    open = true;
    aimX = 0; aimY = 0; aimEntry = null;
    hostEl.classList.add('open');
    renderLabel();
    document.addEventListener('pointermove', onPointerMove, true);
    if (window.tsic && tsic.playSound) tsic.playSound('UI.Open', 0.3);
  }

  function closeWheel(commit) {
    if (!open) return;
    open = false;
    document.removeEventListener('pointermove', onPointerMove, true);
    if (hostEl) hostEl.classList.remove('open');
    // Releasing inside the dead zone is a cancel, not a pick of cell 0 — otherwise a mis-tap
    // would silently change what the player is holding.
    if (commit && aimEntry !== null) {
      if (aimEntry === FISTS_ENTRY) {
        publish('UI.Cmd.Hotbar.Stow', {});
      } else {
        publish('UI.Cmd.Hotbar.Select', { SlotIndex: aimEntry });
      }
      if (window.tsic && tsic.playSound) tsic.playSound('UI.Accept', 0.35);
    }
    aimEntry = null;
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function' || !window.TSIC || !TSIC.el) {
      setTimeout(boot, 16);
      return;
    }
    injectStyles();
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Hotbar.Changed', function (p) {
        lastHotbar = p || null;
        if (open) { hostEl = build(); hostEl.classList.add('open'); renderLabel(); }
      });
      tsic.on('tsic.msg.UI.Inventory.Updated', function (p) {
        if (!p || p.OwnerId !== 'Player') return;
        itemsBySlot = new Map();
        var items = p.Items || [];
        var total = slotCount();
        for (var k = 0; k < items.length; k++) {
          // Keyed by GridSlot to match hud-hotbar.js — the hotbar IS the leading grid cells.
          var it = items[k];
          if (it && typeof it.GridSlot === 'number' && it.GridSlot >= 0 && it.GridSlot < total) {
            itemsBySlot.set(it.GridSlot, it);
          }
        }
        if (open) { hostEl = build(); hostEl.classList.add('open'); renderLabel(); }
      });

      tsic.on('tsic.msg.UI.Behavior.HotbarWheel', function (e) {
        if (!e) return;
        if (e.Phase === 'Started') { openWheel(); return; }
        if (e.Phase === 'Completed') { closeWheel(true); }
      });

      // Gamepad aiming rides the existing look axis so the wheel needs no new
      // axis behaviour of its own.
      tsic.on('tsic.msg.UI.Behavior.Look', function (e) {
        if (!open || !e) return;
        // Axis behaviours publish { Action, Phase:'Axis', Value:{X,Y,Z} } —
        // the vector is the payload, not bare X/Y fields.
        var v = e.Value || {};
        var x = typeof v.X === 'number' ? v.X : 0;
        var y = typeof v.Y === 'number' ? v.Y : 0;
        if (x === 0 && y === 0) return;
        // Stick values are -1..1 per frame; scale so a full deflection clears
        // the dead zone in a few frames rather than instantly snapping.
        aimX += x * 14;
        aimY += y * 14;
        var mag = Math.sqrt(aimX * aimX + aimY * aimY);
        var cap = RADIUS;
        if (mag > cap) { aimX = aimX / mag * cap; aimY = aimY / mag * cap; }
        applyAim();
      });
    });
  })();
})();
