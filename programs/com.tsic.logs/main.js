// com.tsic.logs/main.js — LOGS: a paginated system-log viewer.
//
// Tier-1 program. Pure text I/O via the terminal shim (term.print / readLine).
// Shows a paginated list of logs; pick a number to read one (its body paginates
// too); B returns to the list, Q quits. Log content is baked in here — a later
// tier-3 build could swap this for live store logs via term.world.read.
(async function () {
  const term = await TSICProgram.connect();

  // Each log: a title + body as an array of lines (paginated by line).
  const LOGS = [
    {
      title: "DURHAM OS v1.0.0 - SYSTEM INITIALIZATION LOG 001",
      body: [
        "DATE: 14/12/1983    TIME: 08:30 AM",
        "SYSADMIN: KATIE",
        "",
        "Welcome everyone! This is the very first log of the very",
        "first version of DURHAM OS. I just finished wiring the",
        "back office, and we are officially online!",
        "",
        "I'm so excited to get everything running smoothly for the",
        "store. If you see any bugs, glitches, or a blinking cursor",
        "that won't go away, please remember to come speak to me!",
        "(I'm usually at the desk surrounded by cables).",
        "",
        "Happy typing!",
        "- Katie (Head of IT)",
      ],
    },
    {
      title: "DURHAM OS // UNTITLED LOG ENTRY 002",
      body: [
        "USER: GARY",
        "TIMESTAMP: 18/12/1983 - 10:14 AM",
        "",
        "SEARCH INVENTORY",
        "WHERE ARE THE PINE DROP LEAF TABLES",
        "LOCATE PINE TABLE SHOWROOM C",
        "HELLO COMPUTER PLEASE FIND PINE TABLE",
        "ENTER",
        "SEARCH",
        "PINE TALEB",
        "DELETE",
        "KATIE IF YOU SEE THIS I AM TRYING TO FIND THE PINE DROP LEAF TABLES FROM SHOWROOM C",
      ],
    },
    {
      title: "DURHAM OS // SYSADMIN DIARY // LOG 01",
      body: [
        "USER: KATIE_IT",
        "DATE: 08/01/1984    TIME: 05:30 PM",
        "",
        "I am officially set up in my own tech room and settled in!",
        "",
        "Still trying to get everyone up to speed on the new systems",
        "(Gary did find the table in the end, don't worry). It's",
        "been hard to keep accurate stock counts, and I suspect some",
        "of the stock just isn't being inputted correctly.",
        "",
        "Turned out we had a whole floor section which didn't get",
        "logged in stocks! Everyone says they weren't the one who got",
        "the supply delivery in, so go figure.",
        "",
        "Computers only know what we tell them, guys!",
        "",
        "- Katie",
      ],
    },
    {
      title: "DURHAM OS // SYSADMIN DIARY // LOG 02",
      body: [
        "USER: KATIE_IT",
        "DATE: 16/01/1984    TIME: 09:48 PM",
        "",
        "I've decided to start keeping backup floppy disks for all",
        "programs and logs. For some reason, the main server data",
        "keeps getting corrupted overnight.",
        "",
        "It's like we're getting massive power surges? Half of my",
        "plugged in testing devices are totally fried in the mornings.",
        "What could be causing such a huge surge at night of all times?",
        "",
        "I'm going to ask management if I can be put on the night",
        "shift this week to investigate.",
        "",
        "- Katie",
      ],
    },
    {
      title: "DURHAM OS // SYSADMIN DIARY // LOG 03",
      body: [
        "USER: KATIE_IT",
        "DATE: 19/01/1984    TIME: 03:14 AM",
        "",
        "Who knew the store could be such a maze in the dark? I went",
        "to get a snack from the vending machines and got completely",
        "turned around. It felt like I was wandering around forever",
        "before I found my way back.",
        "",
        "It's like, do you ever get that feeling that someone is",
        "watching you? Spooooooky.",
        "",
        "Oh and guess what? I must have missed whatever corrupted the",
        "data. The night wasn't all a waste though. I had a look",
        "through some of the raw data of the corrupted files, and",
        "here's the weird thing:",
        "",
        "The total stock data grew from roughly 48kb to over 300kb.",
        "It's like some of the data was repeating and duplicated. It",
        "was a mess and completely unrecoverable. I've never seen",
        "anything like that.",
        "",
        "- Katie",
      ],
    },
  ];

  const LIST_PER_PAGE = 5;
  const BODY_PER_PAGE = 30;
  const RULE = "========================================";

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  // List view. Returns when the user quits.
  async function viewList() {
    if (!LOGS.length) {
      term.print("");
      term.print(RULE);
      term.print("  DURHAM SYSTEM LOGS");
      term.print(RULE);
      term.print("  NO LOGS ON FILE.");
      await term.readLine("LOGS>  (any key to quit)");
      return;
    }
    let page = 0;
    const pages = Math.max(1, Math.ceil(LOGS.length / LIST_PER_PAGE));
    for (;;) {
      page = clamp(page, 0, pages - 1);
      term.print("");
      term.print(RULE);
      term.print("  DURHAM SYSTEM LOGS   (" + LOGS.length + " ENTRIES)");
      term.print(RULE);
      const start = page * LIST_PER_PAGE;
      LOGS.slice(start, start + LIST_PER_PAGE).forEach(function (log, i) {
        term.print("  [" + (start + i + 1) + "]  " + log.title);
      });
      term.print("");
      term.print(
        "  PAGE " +
          (page + 1) +
          "/" +
          pages +
          "   #) READ   N) NEXT   P) PREV   Q) QUIT",
      );
      const ans = (await term.readLine("LOGS> ")).trim().toLowerCase();
      if (ans === "q" || ans === "quit" || ans === "exit") return;
      if (ans === "n") {
        page += 1;
        continue;
      }
      if (ans === "p") {
        page -= 1;
        continue;
      }
      const num = parseInt(ans, 10);
      if (num >= 1 && num <= LOGS.length) {
        const quit = await viewLog(LOGS[num - 1]);
        if (quit) return;
        continue;
      }
      term.print("  ?? UNKNOWN COMMAND. TYPE A NUMBER, N, P OR Q.");
    }
  }

  // Single-log reader. Returns true if the user chose to quit the program.
  async function viewLog(log) {
    let page = 0;
    const pages = Math.max(1, Math.ceil(log.body.length / BODY_PER_PAGE));
    for (;;) {
      page = clamp(page, 0, pages - 1);
      // Standard log header: title framed by '=' rules, sized to the title.
      const bar = "=".repeat(log.title.length + 4);
      term.print("");
      term.print(bar);
      term.print("* " + log.title + " *");
      term.print(bar);
      const start = page * BODY_PER_PAGE;
      log.body.slice(start, start + BODY_PER_PAGE).forEach(function (line) {
        term.print("  " + line);
      });
      term.print("");
      term.print(
        "  PAGE " +
          (page + 1) +
          "/" +
          pages +
          "   N) NEXT   P) PREV   B) BACK   Q) QUIT",
      );
      const ans = (await term.readLine("READ> ")).trim().toLowerCase();
      if (ans === "q" || ans === "quit") return true;
      if (ans === "b" || ans === "back") return false;
      if (ans === "n") {
        page += 1;
        continue;
      }
      if (ans === "p") {
        page -= 1;
        continue;
      }
      term.print("  ?? UNKNOWN COMMAND. TYPE N, P, B OR Q.");
    }
  }

  term.print("LOGS v1.0 — DURHAM SYSTEM LOG VIEWER");
  await viewList();
  term.print("LOGS TERMINATED.");
  term.exit();
})();
