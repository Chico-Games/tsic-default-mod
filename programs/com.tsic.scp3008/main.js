// com.tsic.scp3008/main.js — SECRET. A short, choice-driven text game.
//
// Hidden program (not listed in HELP; runnable only if you know the name).
// Turns the terminal red, then walks a small story graph: print a passage +
// numbered options, read a choice, advance. The STORY content here is a
// PLACEHOLDER skeleton — the real writing comes later; this exists to prove
// the option-picking + screen-writing loop.
(async function () {
  const term = await TSICProgram.connect();
  term.theme('red');

  // Story graph. Each node: { text:[lines], options:[{label, goto}] }.
  // A node with no options is an ending (the program exits).
  const STORY = {
    start: {
      text: [
        'The fluorescent lights stutter, then settle into the colour',
        'of an emergency.',
        '',
        'You are inside the store. It is closed. The aisles run on',
        'further than the building should allow. There is no exit sign.',
        '',
        'Far off, something heavy shifts across the shelves.',
      ],
      options: [
        { label: 'Walk toward the sound.', goto: 'sound' },
        { label: 'Hide in the bedding section.', goto: 'hide' },
        { label: 'Call out: "Is anyone there?"', goto: 'call' },
      ],
    },
    sound: {
      text: ['[ placeholder ] You move toward the sound. The shelving seems to breathe.'],
      options: [
        { label: 'Keep going.', goto: 'end' },
        { label: 'Think better of it and turn back.', goto: 'start' },
      ],
    },
    hide: {
      text: ['[ placeholder ] You bury yourself in the duvets. Footsteps pass. They are too tall, and too slow.'],
      options: [
        { label: 'Stay perfectly still.', goto: 'end' },
        { label: 'Peek out.', goto: 'sound' },
      ],
    },
    call: {
      text: ['[ placeholder ] Your voice does not echo. Somehow, everything goes quiet to listen to it.'],
      options: [
        { label: 'Run.', goto: 'end' },
      ],
    },
    end: {
      text: [
        '[ placeholder ending ] The store is closed.',
        'It does not intend to open.',
        '',
        'SCP-3008 — TO BE CONTINUED.',
      ],
      options: [],
    },
  };

  let node = 'start';
  for (;;) {
    const n = STORY[node] || STORY.start;
    term.print('');
    n.text.forEach(function (line) { term.print(line); });
    if (!n.options.length) break; // ending
    term.print('');
    n.options.forEach(function (opt, i) { term.print('  ' + (i + 1) + ') ' + opt.label); });
    const ans = (await term.readLine('> ')).trim();
    const idx = parseInt(ans, 10) - 1;
    if (idx >= 0 && idx < n.options.length) { node = n.options[idx].goto; }
    else { term.print('  (choose a number)'); }
  }

  term.exit();
})();
