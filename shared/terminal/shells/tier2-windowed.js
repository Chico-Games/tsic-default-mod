// shared/terminal/shells/tier2-windowed.js — STUB. Proves shell-swap + a
// windowed display region for future gfx.canvas programs. No window manager yet.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};
  function create(container, host) {
    container.innerHTML =
      '<div class="tsic-term tsic-term--t2">' +
      '  <div class="tsic-term-titlebar">' + NS.hardwareName(host.tier) + '</div>' +
      '  <div class="tsic-term-desktop" id="term-out"><p>EXPERIMENTAL GUI — coming soon</p>' +
      '    <button class="tsic-term-launch" id="term-launch">Programs</button></div>' +
      '  <div class="tsic-term-cursor"></div>' +
      '</div>';
    return {
      onPrograms: function () {},
      printToProgram: function () {},
      beginProgramInput: function () { return Promise.resolve(''); },
      endProgram: function () {},
      destroy: function () { container.innerHTML = ''; },
    };
  }
  NS.shells.tier2 = { create: create };
})(window);
