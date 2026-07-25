// shared/hud-hotbar-wheel.js — hold-to-open radial hotbar selector.
//
// WHY THIS EXISTS: the 10-slot hotbar is driven by the number row, which a
// gamepad doesn't have. Without a wheel, a controller player can only step
// through slots one bumper-press at a time — the genre's answer (Conan Exiles,
// Rust, Red Dead) is a radial you hold open and flick to. Keyboard gets it too
// on Q, since it beats reaching for 7/8/9/0 mid-fight.
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
// Channels:
//   tsic.msg.UI.Behavior.HotbarWheel  { Phase }
//   tsic.msg.UI.Hotbar.Changed        { SlotIndices, SelectedSlot }
//   tsic.msg.UI.Inventory.Updated     (OwnerId === 'Player') → icons/counts
// Publishes: UI.Cmd.Hotbar.Select { SlotIndex }
// Depends on: shared/dom.js, shared/icons.js, shared/tsic-runtime.js
(function () {
  var SLOT_COUNT = 10;
  // Matches TSICInventory.FISTS_HOTBAR_SLOT — slot 0 stows whatever is out.
  var FISTS_SLOT = 0;
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
    '  font-family:Georgia,"Libre Baskerville",serif; color:#f0e7d4;',
    '}',
    '#hud-hotbar-wheel .wslot img { width:100%; height:100%; object-fit:contain; padding:9px;',
    '  pointer-events:none; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6)); }',
    '#hud-hotbar-wheel .wslot .fists-glyph { width:100%; height:100%; padding:12px; color:#e4d9c0;',
    '  pointer-events:none; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.6)); }',
    '#hud-hotbar-wheel .wslot .key {',
    '  position:absolute; top:3px; left:4px; min-width:15px; padding:0 4px;',
    '  font-family:var(--font-display,inherit); font-size:13px; font-weight:700; line-height:1.35;',
    '  text-align:center; color:#f3ecda; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.62); border:1px solid var(--ink-night,#0e0908); border-radius:5px;',
    '}',
    '#hud-hotbar-wheel .wslot .count {',
    '  position:absolute; bottom:3px; right:4px; padding:2px 4px; line-height:1;',
    '  font-family:var(--font-display,inherit); font-size:11px; font-weight:700; color:#fff;',
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
    '  text-align:center; font-family:Georgia,"Libre Baskerville",serif; color:#f3ecda;',
    '  text-shadow:0 2px 4px rgba(0,0,0,0.9); pointer-events:none; max-width:190px;',
    '}',
    '#hud-hotbar-wheel .label .nm { font-size:16px; letter-spacing:0.04em; }',
    '#hud-hotbar-wheel .label .hint { font-size:11px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.65; }',
  ].join('\n');

  var lastHotbar = null;
  var itemsByInstance = new Map();
  var open = false;
  var aimX = 0, aimY = 0;
  var aimSlot = -1;
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

  function slotItem(i) {
    var slots = (lastHotbar && lastHotbar.SlotIndices) || [];
    var inv = slots[i];
    if (inv === undefined || inv === null || inv < 0) return null;
    return itemsByInstance.get(inv) || null;
  }

  // Angle for slot i: straight up is slot 1 (the first ITEM slot), running
  // clockwise. Fists (slot 0) sits at the bottom, away from the item ring.
  function angleFor(i) {
    if (i === FISTS_SLOT) return Math.PI / 2;           // bottom
    var step = (Math.PI * 2) / (SLOT_COUNT - 1);
    return -Math.PI / 2 + (i - 1) * step;
  }

  // Nearest slot to the current aim vector; -1 while inside the dead zone.
  function resolveAim() {
    var dist = Math.sqrt(aimX * aimX + aimY * aimY);
    if (dist < DEAD_ZONE) return -1;
    var target = Math.atan2(aimY, aimX);
    var best = -1, bestDelta = Infinity;
    for (var i = 0; i < SLOT_COUNT; i++) {
      var d = Math.abs(Math.atan2(Math.sin(target - angleFor(i)), Math.cos(target - angleFor(i))));
      if (d < bestDelta) { bestDelta = d; best = i; }
    }
    return best;
  }

  function applyAim() {
    if (!hostEl) return;
    var next = resolveAim();
    if (next === aimSlot) return;
    aimSlot = next;
    var kids = hostEl.querySelectorAll('.wslot');
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('aim', i === aimSlot);
    }
    renderLabel();
    if (aimSlot >= 0 && window.tsic && tsic.playSound) tsic.playSound('UI.Focus', 0.2);
  }

  function renderLabel() {
    if (!hostEl) return;
    var label = hostEl.querySelector('.label');
    if (!label) return;
    label.innerHTML = '';
    var nm = TSIC.el('div', { class: 'nm' });
    var hint = TSIC.el('div', { class: 'hint' });
    if (aimSlot < 0) {
      nm.textContent = 'Hotbar';
      hint.textContent = 'Aim to choose';
    } else if (aimSlot === FISTS_SLOT) {
      nm.textContent = 'Fists';
      hint.textContent = 'Stow weapon';
    } else {
      var item = slotItem(aimSlot);
      var cat = (window.tsic && window.tsic.itemCatalog) || {};
      var desc = item ? cat[item.ItemId] : null;
      nm.textContent = item ? ((desc && desc.Name) || item.ItemId) : 'Empty';
      hint.textContent = 'Slot ' + ((aimSlot + 1) % 10);
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

    for (var i = 0; i < SLOT_COUNT; i++) {
      var a = angleFor(i);
      var slot = TSIC.el('div', { class: 'wslot' + (i === current ? ' current' : '') });
      slot.style.left = (cx + Math.cos(a) * RADIUS) + 'px';
      slot.style.top = (cy + Math.sin(a) * RADIUS) + 'px';
      if (i === FISTS_SLOT) {
        slot.appendChild(TSIC.fistsIcon({ class: 'fists-glyph' }));
      } else {
        var item = slotItem(i);
        if (item && item.ItemId) {
          slot.appendChild(TSIC.iconImg(TSIC.itemIconUrl(item.ItemId)));
          if ((item.Count || 1) > 1) {
            slot.appendChild(TSIC.el('span', { class: 'count' }, String(item.Count)));
          }
        }
      }
      slot.appendChild(TSIC.el('span', { class: 'key' }, String((i + 1) % 10)));
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
    aimX = 0; aimY = 0; aimSlot = -1;
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
    // Releasing inside the dead zone is a cancel, not a pick of slot 0 —
    // otherwise a mis-tap would silently stow the player's weapon.
    if (commit && aimSlot >= 0) {
      publish('UI.Cmd.Hotbar.Select', { SlotIndex: aimSlot });
      if (window.tsic && tsic.playSound) tsic.playSound('UI.Accept', 0.35);
    }
    aimSlot = -1;
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
        itemsByInstance = new Map();
        var items = p.Items || [];
        for (var k = 0; k < items.length; k++) {
          // Keyed by InstanceId to match hud-hotbar.js — SlotIndex is a volatile
          // array position and would orphan the lookup on any stack change.
          if (items[k] && typeof items[k].InstanceId === 'number') {
            itemsByInstance.set(items[k].InstanceId, items[k]);
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
