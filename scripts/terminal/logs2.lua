-- LOGS_V2: the tier-2 GUI log browser. A clickable entry list beside a reader, in the
-- program's own window; a log stays flagged NEW until it has been read (the read set
-- persists through program-private storage for the sitting). Same Durham logs as LOGS.
local term = tsic.terminal
local gui = term.gui

local LOGS = {
  { id = 'init-001', title = 'SYSTEM INITIALIZATION \u{2014} LOG 001', meta = 'KATIE (HEAD OF IT) \u{00b7} 14/12/1983 08:30', body = {
    'Welcome everyone! This is the very first log of the very',
    'first version of DURHAM OS. I just finished wiring the back',
    'office, and we are officially online!',
    '',
    'If you see any bugs, glitches, or a blinking cursor that',
    "won't go away, please come speak to me (I'm usually at the",
    'desk surrounded by cables).',
    '',
    'Happy typing!   - Katie',
  } },
  { id = 'gary-002', title = 'UNTITLED LOG ENTRY 002', meta = 'GARY \u{00b7} 18/12/1983 10:14', body = {
    'SEARCH INVENTORY',
    'WHERE ARE THE PINE DROP LEAF TABLES',
    'LOCATE PINE TABLE SHOWROOM C',
    'HELLO COMPUTER PLEASE FIND PINE TABLE',
    'ENTER',
    'SEARCH',
    'PINE TALEB',
    'DELETE',
    'KATIE IF YOU SEE THIS I AM TRYING TO FIND THE PINE DROP',
    'LEAF TABLES FROM SHOWROOM C',
  } },
  { id = 'diary-01', title = 'SYSADMIN DIARY \u{2014} LOG 01', meta = 'KATIE \u{00b7} 08/01/1984 17:30', body = {
    'I am officially set up in my own tech room and settled in!',
    '',
    'Still trying to get everyone up to speed on the new systems',
    "(Gary did find the table in the end). It's been hard to keep",
    'accurate stock counts, and I suspect some of the stock just',
    "isn't being inputted correctly.",
    '',
    "Turned out we had a whole floor section which didn't get",
    "logged in stocks! Everyone says they weren't the one who got",
    'the supply delivery in, so go figure.',
    '',
    'Computers only know what we tell them, guys!   - Katie',
  } },
  { id = 'diary-02', title = 'SYSADMIN DIARY \u{2014} LOG 02', meta = 'KATIE \u{00b7} 16/01/1984 21:48', body = {
    "I've decided to start keeping backup floppy disks for all",
    'programs and logs. For some reason, the main server data',
    'keeps getting corrupted overnight.',
    '',
    "It's like we're getting massive power surges? Half of my",
    'plugged-in testing devices are totally fried in the mornings.',
    'What could cause such a huge surge at night of all times?',
    '',
    "I'm going to ask management if I can be put on the night shift",
    'this week to investigate.   - Katie',
  } },
  { id = 'diary-03', title = 'SYSADMIN DIARY \u{2014} LOG 03', meta = 'KATIE \u{00b7} 19/01/1984 03:14', body = {
    'Who knew the store could be such a maze in the dark? I went',
    'to get a snack from the vending machines and got completely',
    'turned around. It felt like I was wandering around forever',
    'before I found my way back.',
    '',
    'Do you ever get that feeling that someone is watching you?',
    'Spooooooky.',
    '',
    'I must have missed whatever corrupted the data. The night',
    "wasn't a total waste though \u{2014} I looked through some of the raw",
    "corrupted files, and here's the weird thing:",
    '',
    'The total stock data grew from roughly 48kb to over 300kb.',
    'Some of the data was repeating and duplicated. It was a mess',
    "and completely unrecoverable. I've never seen anything like",
    'that.   - Katie',
  } },
}

-- Per-log NEW tracking: the read set survives re-opening the program within this sitting.
local readSet = {}
local stored = term.storage.get('readLogs')
if type(stored) == 'table' then
  for _, id in ipairs(stored) do readSet[id] = true end
end

local function persist()
  local list = {}
  for id in pairs(readSet) do list[#list + 1] = id end
  table.sort(list)
  term.storage.set('readLogs', list)
end

local function markRead(log)
  if readSet[log.id] then return end
  readSet[log.id] = true
  persist()
end

local selected = 1

local function render()
  local items = {}
  for i, log in ipairs(LOGS) do
    items[#items + 1] = { key = log.id, label = i .. '. ' .. log.title, badge = readSet[log.id] and '' or 'NEW', active = (i == selected) }
  end
  local log = LOGS[selected]
  gui.set({ gui = 'logs', items = items, reader_title = log.title, reader_meta = log.meta, reader_lines = log.body })
end

local function select(key)
  for i, log in ipairs(LOGS) do
    if log.id == key then
      selected = i
      markRead(log)
      break
    end
  end
  render()
end

gui.on('select', select)
select(LOGS[1].id)
