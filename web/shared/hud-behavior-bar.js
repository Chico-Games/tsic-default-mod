// shared/hud-behavior-bar.js — Gameplay HUD behavior bar (System A).
//
// This is the ONE and ONLY renderer of the in-game gameplay behavior bar. hud.js
// loads it on the InGame screen; tests host it via /screens/test-behavior-bar.html.
// Do NOT re-implement this rendering inline in an HTML page.
//
// Entries are projected from the input manager's active behaviours by
// UScpBehaviorBarPublisher (C++), with per-entry ability status overlaid, and
// arrive on UI.BehaviorBar.Entries.
//
// (The menu behavior bar — System B, #bb-menu — is not yet wired into the live
//  shell; the menu context is published but nothing renders it. Separate TODO.)
//
// Renders into #bb-shell-gameplay > #bb-gameplay (DOM created by hud.js).
// Each row: [behaviour name]  [key icon]
// Depends on: window.TSIC.keyIconUrl (from icons.js)
(function () {
  var STATUS = ['available', 'blocked', 'cooldown', 'single-use-used'];
  var inputMode = 'MouseAndKeyboard';
  var entries = [];
  // True while the look-target block (#bb-target, hud-interaction.js) is showing.
  // The block renders the Interact verb + key chip at the TOP of the panel, so
  // the generic "Interact" row is suppressed from this list to avoid a duplicate.
  var hasLookTarget = false;
  // True while the "Upgradable" badge (#bb-upgradable, hud-upgrade.js) is showing —
  // like the look-target block, it counts as panel content for shell visibility.
  var hasUpgradeTarget = false;

  // Key icon <img> nodes cached by `BehaviorTagName|url`. The behavior bar re-broadcasts
  // on every status/cooldown change (e.g. spamming crouch toggles StatusInt each poll),
  // and a full rebuild recreates the <img> — CEF then shows a blank frame while it
  // re-decodes, which reads as a flash. Reusing the already-decoded node across
  // re-renders removes that gap. Keyed by BehaviorTagName too so duplicate URLs on
  // different entries don't steal each other's node. Pruned to live keys after each render.
  var imgCache = {};

  function preferGamepad() { return inputMode === 'Gamepad'; }

  function removeKeyFor(img) {
    var key = img.closest ? img.closest('.bb-key') : img.parentNode;
    if (key && key.remove) key.remove();
  }

  // Return a cached <img> for (cacheKey, url), creating it on first use. A changed url
  // (e.g. input-mode swap) replaces the node so the new glyph loads.
  function keyImg(cacheKey, url, keyText, isGP, resolve) {
    var img = imgCache[cacheKey];
    if (img && img.getAttribute('src') === url) return img;

    img = document.createElement('img');
    img.src = url;
    img.alt = keyText || '';
    img.onerror = function () {
      var svgUrl = resolve(keyText, isGP);
      if (svgUrl && svgUrl !== url) {
        img.onerror = function () { delete imgCache[cacheKey]; removeKeyFor(img); };
        img.src = svgUrl;
      } else {
        delete imgCache[cacheKey];
        removeKeyFor(img);
      }
    };
    imgCache[cacheKey] = img;
    return img;
  }

  function renderRow(entry) {
    var row = document.createElement('span');
    row.className = 'bb-row';
    row.dataset.status = STATUS[entry.StatusInt | 0] || 'available';
    // Lets other components find a specific row's key chip — the progress ring
    // (hud-circular-progress.js) circles the chip of the action that is running.
    if (entry.BehaviorTagName) row.dataset.behavior = entry.BehaviorTagName;

    var txt = document.createElement('span');
    txt.className = 'bb-text';
    var nm = document.createElement('span');
    nm.className = 'bb-name';
    nm.textContent = entry.DisplayName || '';
    txt.appendChild(nm);
    if (entry.SubText) {
      var sub = document.createElement('span');
      sub.className = 'bb-sub';
      sub.textContent = entry.SubText.length > 30 ? entry.SubText.slice(0, 29) + '…' : entry.SubText;
      txt.appendChild(sub);
    }
    row.appendChild(txt);

    var isGP = preferGamepad();
    var iconUrl = isGP ? entry.GamepadIconUrl : entry.KeyboardIconUrl;
    var keyText = isGP ? entry.GamepadKeyText : entry.KeyboardKeyText;
    var resolve = (window.TSIC && window.TSIC.keyIconUrl) || function () { return ''; };
    var resolvedUrl = iconUrl || resolve(keyText, isGP);

    // Icon-only: render no key chip when no thumbnail resolves (no text fallback).
    if (resolvedUrl) {
      var key = document.createElement('span');
      key.className = 'bb-key';
      var cacheKey = (entry.BehaviorTagName || '') + '|' + resolvedUrl;
      liveKeys[cacheKey] = true;
      var img = keyImg(cacheKey, resolvedUrl, keyText, isGP, resolve);
      key.appendChild(img);
      if (entry.CooldownPercent > 0 && entry.CooldownPercent < 1) {
        var sweep = document.createElement('div');
        sweep.className = 'bb-cd-sweep';
        key.style.setProperty('--tsic-cd-percent',
          String(Math.max(0, Math.min(100, Math.round(entry.CooldownPercent * 100)))));
        key.appendChild(sweep);
      }
      row.appendChild(key);
    }
    return row;
  }

  // Set of `BehaviorTagName|url` keys touched in the current render; used to prune imgCache.
  var liveKeys = {};

  function render() {
    var host = document.getElementById('bb-gameplay');
    var shell = document.getElementById('bb-shell-gameplay');
    if (!host || !shell) return;
    liveKeys = {};
    host.innerHTML = '';
    var hasVisible = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].bVisible === false) continue;
      // Blocked actions (can't be used right now) are hidden from the bar entirely.
      if ((STATUS[entries[i].StatusInt | 0] || 'available') === 'blocked') continue;
      // The look-target block above the divider already shows the interact verb
      // with its key chip — drop the redundant generic row while it's visible.
      if (hasLookTarget && entries[i].BehaviorTagName === 'Input.Behavior.Interact') continue;
      hasVisible = true;
      host.appendChild(renderRow(entries[i]));
    }
    for (var k in imgCache) {
      if (!liveKeys[k]) delete imgCache[k];
    }
    // The look-target block and upgradable badge count as content — never hide the
    // shell out from under them just because every generic row filtered out.
    shell.classList.toggle('hidden', !hasVisible && !hasLookTarget && !hasUpgradeTarget);
  }

  tsic.on('tsic.msg.UI.BehaviorBar.Entries', function (p) {
    entries = (p && p.Entries) || [];
    render();
  });
  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    inputMode = (p && p.Mode) || 'MouseAndKeyboard';
    render();
  });
  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var next = !!(p && p.Targets && p.Targets[0]);
    if (next === hasLookTarget) return;
    hasLookTarget = next;
    render();
  });
  tsic.on('tsic.msg.UI.Upgrade.Target', function (p) {
    // Mirrors hud-upgrade.js's gate: bare-handed the badge never mounts, so an
    // upgradeable target alone must not keep an otherwise-empty shell on screen.
    var next = !!(p && p.EntityId && p.bHasUpgradeTool);
    if (next === hasUpgradeTarget) return;
    hasUpgradeTarget = next;
    render();
  });
})();
