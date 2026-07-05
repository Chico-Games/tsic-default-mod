// Tier-1 demo program. Exercises print, readLine, and program-private storage.
(async function () {
  const term = await TSICProgram.connect();
  term.print('HELLO FROM DURHAM TERMINAL');
  term.print('Granted: ' + term.caps.join(', '));
  const prev = await term.storage.get('lastName');
  if (prev && prev.value) term.print('Welcome back, ' + prev.value + '.');
  const name = await term.readLine('Enter your name:');
  await term.storage.set('lastName', name);
  term.print('Hi, ' + name + '! (type EXIT to leave, then run me again)');
  term.exit();
})();
