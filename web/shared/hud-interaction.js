// shared/hud-interaction.js — Look-target block at the TOP of the gameplay
// behavior-bar panel (#bb-shell-gameplay > #bb-target > #bb-target-name +
// #interaction-prompt + #interaction-hold-prompt, with #bb-divider below
// separating it from the general input-action rows in #bb-gameplay).
//
// The block is the "furniture header" of the input-action panel:
//   line 1  #bb-target-name        the furniture/item's own name (Targets[0].Name)
//   line 2  #interaction-prompt    tap-interact verb row  [glyph][verb][key chip]
//   line 3  #interaction-hold-prompt  hold-interact verb row [HOLD][verb][key chip]
// so the furniture's own actions always sort ABOVE the generic rows.
//
// All three lines are tinted per category (Targets[0].Category, bridge field
// from FScpUIInteractionTarget) via the shared .cat-<category> palette in
// hud.js (--cat-color); the glyph is shared with the crosshair through
// TSIC.categoryIcon (shared/icons.js), so a given interaction type reads as
// the same colour + symbol everywhere.
//
// The key chip mirrors the behavior bar's rendering: the Interact behaviour's
// resolved key icon is lifted from UI.BehaviorBar.Entries (the row itself is
// suppressed from the generic list while this block shows — hud-behavior-bar.js)
// and swaps with input mode.
//
// Furniture interactable in ANY way gets the name header: tap-interactable,
// hold-only (line 2 drops out, line 3 carries the verb), and drag-only furniture
// (no interaction option at all, but bDraggable — key-less "Drag" verb).
(function () {
  var INTERACT_TAG = 'Input.Behavior.Interact';

  var lastPayload = null;               // last UI.Interaction.Targets payload
  var interactEntry = null;             // behavior-bar entry for the Interact behaviour
  var inputMode = 'MouseAndKeyboard';

  function catIcon(cat) {
    if (!cat || !window.TSIC || !TSIC.categoryIcon || !TSIC.el) return null;
    var svg = TSIC.categoryIcon(cat);
    if (!svg) return null;
    var span = TSIC.el('span', { class: 'cat-icon' });
    span.appendChild(svg);
    return span;
  }

  // Reset any previous .cat-<x> tint on an element, keeping every other class.
  function clearCat(elm) {
    for (var i = elm.classList.length - 1; i >= 0; i--) {
      var c = elm.classList[i];
      if (c.indexOf('cat-') === 0) elm.classList.remove(c);
    }
  }

  // Key chip for the Interact behaviour, mirroring hud-behavior-bar.js's
  // resolution order: publisher-resolved icon URL first, TSIC.keyIconUrl
  // fallback second, nothing when neither resolves (test pages, early boot).
  function interactKeyChip() {
    if (!interactEntry || !window.TSIC || !TSIC.el) return null;
    var isGP = inputMode === 'Gamepad';
    var pubUrl = (isGP ? interactEntry.GamepadIconUrl : interactEntry.KeyboardIconUrl) || '';
    var keyText = isGP ? interactEntry.GamepadKeyText : interactEntry.KeyboardKeyText;
    var svgUrl = TSIC.keyIconUrl ? TSIC.keyIconUrl(keyText, isGP) : '';
    var url = TSIC.preferKeyIconUrl ? TSIC.preferKeyIconUrl(pubUrl, keyText, isGP) : (pubUrl || svgUrl);
    if (!url) return null;
    var chip = TSIC.el('span', { class: 'bb-key' });
    var img = TSIC.el('img', { src: url, alt: keyText || '' });
    // The publisher ALWAYS hands us a /tex/key-icon/<device>/<key> url, so the
    // `!url` return above never fires for a real entry -- a url that is present
    // but does not resolve used to delete the chip outright, leaving a verb with
    // no key and nothing logged anywhere. That is how #451 read as "the key glyph
    // was never built" while the code to draw it was right here.
    //
    // Fall back to whichever of the two sources preferKeyIconUrl did NOT pick,
    // once, before giving up. Guarded so a failing fallback cannot loop.
    img.onerror = function () {
      var alt = url === svgUrl ? pubUrl : svgUrl;
      if (alt && alt !== img.getAttribute('src')) {
        img.onerror = function () { chip.remove(); };
        img.src = alt;
        return;
      }
      chip.remove();
    };
    chip.appendChild(img);
    return chip;
  }

  // Tap-interact verb row: [category glyph][verb][key chip].
  function setLabel(label, target, dragOnly) {
    clearCat(label);
    while (label.firstChild) label.removeChild(label.firstChild);

    var cat = String(target.Category || '');
    var icon = cat ? catIcon(cat) : null;
    if (icon) {
      label.classList.add('cat-' + cat);
      label.appendChild(icon);
    }
    if (dragOnly) {
      // No interaction option — the verb is the drag affordance itself, and the
      // Interact key would be a lie, so no key chip.
      label.appendChild(document.createTextNode('Drag'));
      return;
    }
    label.appendChild(document.createTextNode(target.Label || 'Interact'));
    var chip = interactKeyChip();
    if (chip) label.appendChild(chip);
  }

  // Furniture/item name header. Hidden when the target reports no name.
  function setName(nameEl, target) {
    clearCat(nameEl);
    while (nameEl.firstChild) nameEl.removeChild(nameEl.firstChild);

    var name = String((target && target.Name) || '');
    if (!name) {
      nameEl.classList.add('hidden');
      return;
    }
    var cat = String(target.Category || '');
    var icon = cat ? catIcon(cat) : null;
    if (icon) {
      nameEl.classList.add('cat-' + cat);
      nameEl.appendChild(icon);
    }
    nameEl.appendChild(document.createTextNode(name));
    nameEl.classList.remove('hidden');
  }

  // Hold-interact verb row: [HOLD tag][verb][key chip]. Same key as tap — the
  // distinction is the HOLD qualifier, matching how the ability listens.
  // An unavailable option (trolley basket already taken, trolley on its side)
  // still renders, greyed and with its reason, so the second player can see the
  // affordance exists and why it is refusing them.
  function setHold(holdEl, target) {
    clearCat(holdEl);
    holdEl.classList.remove('interaction-disabled');
    while (holdEl.firstChild) holdEl.removeChild(holdEl.firstChild);
    if (!target || !target.HoldLabel) {
      holdEl.classList.add('hidden');
      return;
    }
    var cat = String(target.Category || '');
    if (cat) holdEl.classList.add('cat-' + cat);
    var status = String(target.HoldStatus || '');
    var blocked = status !== '' && status !== 'Available';
    holdEl.appendChild(TSIC.el ? TSIC.el('span', { class: 'bb-hold-tag' }, 'HOLD') : document.createTextNode('HOLD '));
    holdEl.appendChild(document.createTextNode(target.HoldLabel));
    if (blocked) {
      holdEl.classList.add('interaction-disabled');
      var reason = String(target.HoldSubText || '');
      if (reason && TSIC.el) holdEl.appendChild(TSIC.el('span', { class: 'bb-hold-reason' }, reason));
    } else {
      var chip = interactKeyChip();
      if (chip) holdEl.appendChild(chip);
    }
    holdEl.classList.remove('hidden');
  }

  function holdPromptEl(afterEl) {
    var el = document.getElementById('interaction-hold-prompt');
    if (!el && afterEl && afterEl.parentNode && window.TSIC && TSIC.el) {
      el = TSIC.el('div', { id: 'interaction-hold-prompt', class: 'hidden' });
      afterEl.parentNode.insertBefore(el, afterEl.nextSibling);
    }
    return el;
  }

  function render() {
    var p = lastPayload;
    var block = document.getElementById('bb-target');
    var nameEl = document.getElementById('bb-target-name');
    var label = document.getElementById('interaction-prompt');
    var divider = document.getElementById('bb-divider');
    if (!label || !divider) return;
    var holdEl = holdPromptEl(label);
    var target = p && p.Targets && p.Targets[0];
    if (target) {
      // A target with no tap verb and no hold verb is the C++ drag-only fallback
      // (name/category only, published because the entity is draggable) — title the
      // panel, show a key-less Drag verb instead of the misleading "Interact" fallback.
      var dragOnly = !target.Label && !target.HoldLabel && !!p.bDraggable;
      // Hold-only furniture: C++ fills Status only when a tap option exists, so an
      // empty Status alongside a HoldLabel means there is nothing to tap and the row
      // would render a bare "Interact" that does nothing. (A tap option that simply
      // carries no text DOES set Status, and keeps the "Interact" fallback.)
      var holdOnly = !target.Status && !!target.HoldLabel;
      if (nameEl) setName(nameEl, target);
      if (holdOnly) {
        label.classList.add('hidden');
      } else {
        setLabel(label, target, dragOnly);
        // Grey out single-use options that have already been used. (Status also
        // carries Blocked/Cooldown/Active for future use; only SingleUseUsed greys today.)
        label.classList.toggle('interaction-disabled', String(target.Status || '') === 'SingleUseUsed');
        label.classList.remove('hidden');
      }
      if (block) block.classList.remove('hidden');
      divider.classList.remove('hidden');
      if (holdEl) setHold(holdEl, dragOnly ? null : target);
    } else {
      label.classList.add('hidden');
      if (nameEl) nameEl.classList.add('hidden');
      if (block) block.classList.add('hidden');
      divider.classList.add('hidden');
      if (holdEl) holdEl.classList.add('hidden');
    }
  }

  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    lastPayload = p;
    render();
  });

  // Key-chip source: the behavior bar's already-resolved Interact entry. Only
  // re-render when the resolved icons actually change (entries rebroadcast at
  // up to 10 Hz on cooldown churn).
  tsic.on('tsic.msg.UI.BehaviorBar.Entries', function (p) {
    var next = null;
    var entries = (p && p.Entries) || [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].BehaviorTagName === INTERACT_TAG) { next = entries[i]; break; }
    }
    var a = interactEntry || {}, b = next || {};
    var changed = a.KeyboardIconUrl !== b.KeyboardIconUrl || a.GamepadIconUrl !== b.GamepadIconUrl
      || a.KeyboardKeyText !== b.KeyboardKeyText || a.GamepadKeyText !== b.GamepadKeyText;
    interactEntry = next;
    if (changed && lastPayload) render();
  });

  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    var next = (p && p.Mode) || 'MouseAndKeyboard';
    if (next === inputMode) return;
    inputMode = next;
    if (lastPayload) render();
  });
})();
