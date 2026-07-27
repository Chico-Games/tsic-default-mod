// shared/hud-upgrade.js — hammer look-at upgrade readout.
//
// The hammer replaced the Upgrade screen: you aim at furniture with a hammer equipped and
// hold the upgrade input, so there is no menu for the cost to live in. Two pieces render
// from the same UI.Upgrade.Target payload:
//
//   1. #bb-upgradable — an "Upgradable" badge inside the action-bar panel
//      (#bb-shell-gameplay), shown for ANY upgradeable look-target so the player learns
//      the furniture can be upgraded even bare-handed. Hints "needs hammer" when none
//      is equipped.
//   2. #hud-upgrade — the full cost card (what it becomes, every material with
//      have/need, which gate blocks). Only shown while a hammer is equipped
//      (bHasUpgradeTool); without one the badge alone carries the affordance.
//
// Fed by UI.Upgrade.Target (UInteractionControllerComponent::BroadcastUIUpgradeTarget),
// which only publishes on change, so this never re-renders per frame.
(function () {
  if (!window.TSIC) window.TSIC = {};
  if (TSIC.__hudUpgradeInstalled) return;
  TSIC.__hudUpgradeInstalled = true;

  const STYLE = `
    #hud-upgrade {
      position: fixed;
      right: 24px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 210px;
      max-width: 300px;
      padding: 10px 12px;
      background: rgba(241, 229, 207, 0.94);
      border: 2px solid #14110c;
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.45);
      font-family: var(--font-display, sans-serif);
      color: #14110c;
      pointer-events: none;
      z-index: 40;
    }
    #hud-upgrade[hidden] { display: none; }
    #hud-upgrade .hu-eyebrow {
      font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
      color: rgba(20, 17, 12, 0.6); margin-bottom: 2px;
    }
    #hud-upgrade .hu-name { font-size: 15px; font-weight: 800; line-height: 1.15; }
    #hud-upgrade .hu-arrow { font-size: 12px; margin: 2px 0 6px; color: rgba(20,17,12,0.75); }
    #hud-upgrade .hu-costs { display: flex; flex-direction: column; gap: 3px; }
    #hud-upgrade .hu-cost {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-variant-numeric: tabular-nums;
    }
    #hud-upgrade .hu-cost .hu-icon {
      width: 20px; height: 20px; flex: 0 0 auto;
      border: 1px solid rgba(20,17,12,0.55); background: rgba(255,255,255,0.5);
    }
    #hud-upgrade .hu-cost .hu-icon img { width: 100%; height: 100%; object-fit: contain; }
    #hud-upgrade .hu-cost .hu-label { flex: 1 1 auto; min-width: 0; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    #hud-upgrade .hu-cost .hu-have { font-weight: 700; }
    /* Red only on the lines actually short — the player should see WHICH material to go find. */
    #hud-upgrade .hu-cost.is-short .hu-have { color: #a3121a; }
    #hud-upgrade .hu-cost.is-ok .hu-have { color: #1c6b2b; }
    #hud-upgrade .hu-block {
      margin-top: 7px; padding-top: 6px; border-top: 1px dashed rgba(20,17,12,0.35);
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: #a3121a;
    }
    #hud-upgrade .hu-ready {
      margin-top: 7px; padding-top: 6px; border-top: 1px dashed rgba(20,17,12,0.35);
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: #1c6b2b;
    }
    /* Action-bar badge — lives in the dark panel, so it matches the .bb-row look
       (right-aligned, uppercase, white with text-shadow inherited from the shell). */
    #bb-upgradable {
      display: flex; justify-content: flex-end; align-items: baseline; gap: 6px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: #fff;
    }
    #bb-upgradable.hidden { display: none; }
    #bb-upgradable .bu-glyph { font-size: 9px; color: #f5d34a; }
    #bb-upgradable .bu-sub {
      font-size: 9px; font-weight: 400; letter-spacing: 0.04em; text-transform: none;
      color: #cfc8bb;
    }
  `;

  function injectStyleOnce() {
    if (document.getElementById('hud-upgrade-style')) return;
    const s = document.createElement('style');
    s.id = 'hud-upgrade-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function ensureRoot() {
    let root = document.getElementById('hud-upgrade');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'hud-upgrade';
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  }

  // The badge slots into the action-bar panel between the look-target block and the
  // divider, so it reads as part of the furniture header. hud.js owns that shell; when
  // it is absent (test fixtures load only this component) the badge simply never mounts.
  function ensureBadge() {
    let badge = document.getElementById('bb-upgradable');
    if (badge) return badge;
    const shell = document.getElementById('bb-shell-gameplay');
    if (!shell) return null;
    badge = TSIC.el('div', { id: 'bb-upgradable', class: 'hidden' });
    shell.insertBefore(badge, document.getElementById('bb-divider'));
    return badge;
  }

  function renderBadge(badge, p) {
    badge.innerHTML = '';
    badge.appendChild(TSIC.el('span', { class: 'bu-glyph' }, '▲'));
    badge.appendChild(TSIC.el('span', {}, 'Upgradable'));
    if (!p.bHasUpgradeTool) {
      badge.appendChild(TSIC.el('span', { class: 'bu-sub' }, 'needs hammer'));
    }
    badge.classList.remove('hidden');
  }

  function hideBadge() {
    const badge = document.getElementById('bb-upgradable');
    if (!badge) return;
    badge.classList.add('hidden');
    badge.innerHTML = '';
  }

  function render(root, p) {
    const el = TSIC.el;
    root.innerHTML = '';

    root.appendChild(el('div', { class: 'hu-eyebrow' }, 'Upgrade'));
    root.appendChild(el('div', { class: 'hu-name' }, p.FurnitureName || 'Furniture'));
    if (p.UpgradedName) {
      root.appendChild(el('div', { class: 'hu-arrow' }, '→ ' + p.UpgradedName));
    }

    const costs = p.Costs || [];
    if (costs.length > 0) {
      const list = el('div', { class: 'hu-costs' });
      for (const c of costs) {
        const short = (c.Owned || 0) < (c.Required || 0);
        const row = el('div', { class: 'hu-cost ' + (short ? 'is-short' : 'is-ok') });
        const iconWrap = el('div', { class: 'hu-icon' });
        if (c.ItemId) iconWrap.appendChild(TSIC.iconImg(TSIC.itemIconUrl(c.ItemId)));
        row.appendChild(iconWrap);
        row.appendChild(el('div', { class: 'hu-label' }, c.Name || c.ItemId || '?'));
        row.appendChild(el('div', { class: 'hu-have' }, (c.Owned || 0) + ' / ' + (c.Required || 0)));
        list.appendChild(row);
      }
      root.appendChild(list);
    } else {
      root.appendChild(el('div', { class: 'hu-cost is-ok' }, 'No materials required.'));
    }

    // Name the blocking gate rather than just greying out — "hold to upgrade" with nothing
    // happening is the single most confusing state this feature can produce. (The no-hammer
    // state never reaches here: the card only renders while a hammer is equipped.)
    if (!p.bToolTierSufficient) {
      root.appendChild(el('div', { class: 'hu-block' },
        'Needs a tier ' + (p.RequiredTier || '?') + ' hammer (yours is tier ' + (p.ToolTier || 0) + ')'));
    } else if (!p.bCanAfford) {
      root.appendChild(el('div', { class: 'hu-block' }, 'Missing materials'));
    } else {
      root.appendChild(el('div', { class: 'hu-ready' }, 'Hold to upgrade'));
    }
  }

  function boot() {
    if (!window.tsic || typeof window.tsic.on !== 'function' || !document.body || !TSIC.el) {
      setTimeout(boot, 16);
      return;
    }
    injectStyleOnce();
    const root = ensureRoot();

    window.tsic.on('tsic.msg.UI.Upgrade.Target', (p) => {
      // EntityId 0 is the "nothing upgradeable in front of me" signal.
      if (!p || !p.EntityId) {
        root.hidden = true;
        root.innerHTML = '';
        hideBadge();
        return;
      }
      const badge = ensureBadge();
      if (badge) renderBadge(badge, p);
      // The cost card is a hammer readout — without one the badge is the whole story.
      if (!p.bHasUpgradeTool) {
        root.hidden = true;
        root.innerHTML = '';
        return;
      }
      render(root, p);
      root.hidden = false;
    });
  }

  boot();
})();
