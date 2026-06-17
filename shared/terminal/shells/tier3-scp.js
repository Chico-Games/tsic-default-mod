// shared/terminal/shells/tier3-scp.js — STUB. Foundation secure-terminal chrome
// with a disabled SITE CONTROLS section mapping to future world.mutate.* powers.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};
  function create(container) {
    container.innerHTML =
      '<div class="tsic-term tsic-term--t3">' +
      '  <div class="tsic-term-clearance">SCP RESTRICTED ACCESS — STATUS: HACKED</div>' +
      '  <div class="tsic-term-desktop" id="term-out"></div>' +
      '  <div class="tsic-term-sitecontrols">SITE CONTROLS (locked)</div>' +
      '</div>';
    return {
      onPrograms: function () {},
      printToProgram: function () {},
      beginProgramInput: function () { return Promise.resolve(''); },
      endProgram: function () {},
      destroy: function () { container.innerHTML = ''; },
    };
  }
  NS.shells.tier3 = { create: create };
})(window);
