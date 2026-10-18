-- LOGS: a paginated system-log viewer (tier 1, pure text I/O).
-- A paginated list of logs; pick a number to read one (its body paginates too);
-- B returns to the list, Q quits. The log text is baked in.
local term = tsic.terminal

local LOGS = {
  {
    title = "DURHAM OS v1.0.0 - SYSTEM INITIALIZATION LOG 001",
    body = {
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
    },
  },
  {
    title = "DURHAM OS // UNTITLED LOG ENTRY 002",
    body = {
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
    },
  },
  {
    title = "DURHAM OS // SYSADMIN DIARY // LOG 01",
    body = {
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
    },
  },
  {
    title = "DURHAM OS // SYSADMIN DIARY // LOG 02",
    body = {
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
    },
  },
  {
    title = "DURHAM OS // SYSADMIN DIARY // LOG 03",
    body = {
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
    },
  },
}

local LIST_PER_PAGE = 5
local BODY_PER_PAGE = 30
local RULE = "========================================"

local function clamp(n, lo, hi)
  if n < lo then return lo end
  if n > hi then return hi end
  return n
end

local function ask(prompt)
  return string.lower((term.readLine(prompt) or ''):match('^%s*(.-)%s*$'))
end

-- Single-log reader. Returns true when the operator chose to quit the program.
local function viewLog(log)
  local page = 0
  local pages = math.max(1, math.ceil(#log.body / BODY_PER_PAGE))
  while true do
    page = clamp(page, 0, pages - 1)
    local bar = string.rep("=", #log.title + 4)
    term.print("")
    term.print(bar)
    term.print("* " .. log.title .. " *")
    term.print(bar)
    local start = page * BODY_PER_PAGE
    for i = start + 1, math.min(#log.body, start + BODY_PER_PAGE) do
      term.print("  " .. log.body[i])
    end
    term.print("")
    term.print("  PAGE " .. (page + 1) .. "/" .. pages .. "   N) NEXT   P) PREV   B) BACK   Q) QUIT")
    local ans = ask("READ> ")
    if ans == "q" or ans == "quit" then return true end
    if ans == "b" or ans == "back" then return false end
    if ans == "n" then
      page = page + 1
    elseif ans == "p" then
      page = page - 1
    else
      term.print("  ?? UNKNOWN COMMAND. TYPE N, P, B OR Q.")
    end
  end
end

-- List view. Returns when the operator quits.
local function viewList()
  if #LOGS == 0 then
    term.print("")
    term.print(RULE)
    term.print("  DURHAM SYSTEM LOGS")
    term.print(RULE)
    term.print("  NO LOGS ON FILE.")
    term.readLine("LOGS>  (any key to quit)")
    return
  end
  local page = 0
  local pages = math.max(1, math.ceil(#LOGS / LIST_PER_PAGE))
  while true do
    page = clamp(page, 0, pages - 1)
    term.print("")
    term.print(RULE)
    term.print("  DURHAM SYSTEM LOGS   (" .. #LOGS .. " ENTRIES)")
    term.print(RULE)
    local start = page * LIST_PER_PAGE
    for i = start + 1, math.min(#LOGS, start + LIST_PER_PAGE) do
      term.print("  [" .. i .. "]  " .. LOGS[i].title)
    end
    term.print("")
    term.print("  PAGE " .. (page + 1) .. "/" .. pages .. "   #) READ   N) NEXT   P) PREV   Q) QUIT")
    local ans = ask("LOGS> ")
    if ans == "q" or ans == "quit" or ans == "exit" then return end
    if ans == "n" then
      page = page + 1
    elseif ans == "p" then
      page = page - 1
    else
      local num = tonumber(ans)
      if num and num >= 1 and num <= #LOGS and num == math.floor(num) then
        if viewLog(LOGS[num]) then return end
      else
        term.print("  ?? UNKNOWN COMMAND. TYPE A NUMBER, N, P OR Q.")
      end
    end
  end
end

term.print("LOGS v1.0 \u{2014} DURHAM SYSTEM LOG VIEWER")
viewList()
term.print("LOGS TERMINATED.")
term.exit()
