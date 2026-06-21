// shared/terminal/constants.js
//
// Single source of truth for terminal tiers: in-fiction hardware names, the
// per-tier capability allow-list, the launch/runtime error codes, and the
// C++<->JS bridge channel strings. Pure data + pure helpers; no DOM, no deps.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  NS.TIER_NAMES = {
    1: 'Durham Internal Terminal',
    2: 'Durham GUI Terminal (Experimental)',
    3: 'SCP Restricted-Access Terminal',
  };

  NS.hardwareName = function (tier) {
    return NS.TIER_NAMES[tier] || 'Unknown Terminal';
  };

  // Each tier lists ONLY the capabilities it ADDS. allowedCaps() accumulates.
  NS.CAPS_BY_TIER = {
    1: ['term.print', 'term.input', 'storage.local', 'catalog.read'],
    2: ['gfx.canvas', 'input.mouse'],
    3: ['world.read', 'world.mutate'],
  };

  NS.allowedCaps = function (tier) {
    const out = [];
    for (let t = 1; t <= tier; t++) {
      const add = NS.CAPS_BY_TIER[t];
      if (add) out.push.apply(out, add);
    }
    return out;
  };

  NS.grantedCaps = function (tier, requested) {
    const allowed = NS.allowedCaps(tier);
    return (requested || []).filter(function (c) { return allowed.indexOf(c) !== -1; });
  };

  NS.ERR = {
    TIER_TOO_LOW:    'ERR_TIER_TOO_LOW',
    NOT_UNLOCKED:    'ERR_NOT_UNLOCKED',
    NOT_FOUND:       'ERR_NOT_FOUND',
    ENTRY_FAILED:    'ERR_ENTRY_FAILED',
    CAP_DENIED:      'ERR_CAP_DENIED',
    NOT_IMPLEMENTED: 'ERR_NOT_IMPLEMENTED',
  };

  NS.CHANNELS = {
    Open:        'UI.Terminal.Open',
    UnlockedList:'UI.Terminal.UnlockedList',
    Catalog:     'UI.Terminal.Catalog',
    Badges:      'UI.Terminal.Badges',          // { Badges: { <programId>: "NEW" } } — new-arrival flags
    InsertDisk:  'UI.Cmd.Terminal.InsertDisk',
    WorldMutate: 'UI.Cmd.Terminal.WorldMutate',
    MarkSeen:    'UI.Cmd.Terminal.MarkSeen',     // { ProgramId } — operator opened it; clear its badge
    Close:       'UI.Cmd.Terminal.Close',
  };
})(window);
