// shared/terminal/program-icons.js
//
// Monochrome line-icons for terminal programs, shared by the tier-2 GUI desktop
// and the tier-3 topology. stroke=currentColor so they take the host theme
// colour (Durham red / SCiPnet amber) and dim when locked. Static literals only
// — no user data in the markup.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  const ICONS = {
    terminal:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<rect x="2" y="3" width="20" height="14"/>' +
      '<path d="M6 7.5 l3 2.5 -3 2.5"/>' +
      '<line x1="12" y1="12.5" x2="16" y2="12.5"/>' +
      '<line x1="12" y1="17" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>',
    logs:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<path d="M5 2 h9 l5 5 v15 H5 Z"/><path d="M14 2 v5 h5"/>' +
      '<line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="8" y1="18" x2="13" y2="18"/></svg>',
    stock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<rect x="3" y="4" width="18" height="16"/>' +
      '<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="14.5" x2="21" y2="14.5"/>' +
      '<line x1="11" y1="9" x2="11" y2="20"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<path d="M3 6 h6 l2 3 h10 v11 H3 Z"/></svg>',
  };

  // Pick an icon for a node/program. opts: { isConsole, type ('anchor'|'file'),
  // icon (manifest hint) }. ROOT/console -> terminal; folder anchors -> folder;
  // otherwise the manifest icon, falling back to terminal.
  function iconSvgFor(opts) {
    opts = opts || {};
    if (opts.isConsole) return ICONS.terminal;
    if (opts.type === 'anchor') return ICONS.folder;
    return ICONS[opts.icon] || ICONS.terminal;
  }

  NS.programIcons = ICONS;
  NS.iconSvgFor = iconSvgFor;
})(window);
