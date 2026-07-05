// shared/terminal/boot.js
//
// Tier-1 "Durham Internal Terminal" BIOS-style boot sequence. BOOT_LINES is the
// scripted output; runBoot types each line in order (awaiting the typewriter
// animation), then prints the ASCII logo. The terminal object passed in supplies
// the actual type()/print() — so this module is pure orchestration and unit-
// testable with a fake term.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  const BOOT_LINES = [
    { text: 'DURHAM SYSTEMS BIOS v1.0' },
    { text: '640K RAM SYSTEM GO' },
    { text: 'CHECKING MAGNETIC MEDIA...' },
    { text: 'DRIVE A: OK' },
    { text: 'LOADING DURHAM-OS SYS.COM' },
    { text: 'INITIALIZING DISPLAY...' },
    { text: 'ESTABLISHING STORE MAINFRAME LINK...' },
    { text: 'CONNECTION ESTABLISHED.', className: 'tsic-term-banner' },
  ];

  const DURHAM_LOGO = [
    '+----------------------------------+',
    '|    D U R H A M   S Y S T E M S   |',
    '|        INTERNAL TERMINAL         |',
    '+----------------------------------+',
  ].join('\n');

  // Plays the boot animation on a terminal, then prints the logo.
  // `term` must provide type(text, {className}) -> Promise and print(text, {className}).
  async function runBoot(term, opts) {
    opts = opts || {};
    const lines = opts.lines || BOOT_LINES;
    for (const line of lines) {
      await term.type(line.text, { className: line.className });
    }
    if (opts.logo) term.print(opts.logo, { className: 'tsic-term-logo' });
  }

  NS.boot = { BOOT_LINES: BOOT_LINES, DURHAM_LOGO: DURHAM_LOGO, runBoot: runBoot };
})(window);
