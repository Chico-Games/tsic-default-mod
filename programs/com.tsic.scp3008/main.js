// com.tsic.scp3008/main.js — SECRET. A short, scripted encounter.
//
// Hidden program (not in HELP; runnable only if you know the name). Clears the
// screen, then types a few lines slowly and unevenly, waiting for the player
// between each, and finally reboots the terminal.
(async function () {
  const term = await TSICProgram.connect();
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Slow, inconsistent typing — each character lands after charDelay plus up to
  // `jitter` extra ms, one character at a time, for an unsettling cadence.
  const creepy = { charDelay: 170, jitter: 170, charsPerTick: 1 };

  term.clear();
  await sleep(900);

  term.print('HELLO', creepy);
  await term.readLine('');            // wait for any response

  term.print('DO YOU FEEL SAFE?', creepy);
  await term.readLine('');            // wait for any other input

  term.print('GOODBYE', creepy);
  await Promise.race([sleep(5000), term.readLine('')]); // 5s, or any input

  term.clear();
  term.reboot();
})();
