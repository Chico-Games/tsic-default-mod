-- STOCK_V2: the tier-2 GUI inventory database. A sortable table in the program's own
-- window: a column header sorts, the search box filters, and quantities tick up live at
-- staggered moments, each bump flashing its own row (the same absurd growth as STOCK).
local term = tsic.terminal
local gui = term.gui

local EPOCH = 441763200          -- 01/01/1984 00:00 UTC, as seconds
local RATE = { big = { 0.5, 2.0 }, med = { 2.0, 3.5 }, small = { 3.8, 5.5 } }

local ITEMS = {
  { sku = '442-PT', desc = 'PINE DROP-LEAF TABLE',        loc = 'SHOWROOM C',      size = 'big' },
  { sku = '819-LS', desc = 'LEATHER SECTIONAL (BROWN)',   loc = 'WAREHOUSE SEC 1', size = 'big' },
  { sku = '290-LC', desc = 'LIVING ROOM CARPET (BEIGE)',  loc = 'MARKETPLACE',     size = 'med' },
  { sku = '883-MW', desc = 'MODULAR WARDROBE FRAME',      loc = 'WAREHOUSE SEC 4', size = 'big' },
  { sku = '112-FL', desc = 'FLOOR LAMP (BRUSHED STEEL)',  loc = 'SHOWROOM A',      size = 'med' },
  { sku = '550-OC', desc = 'OFFICE CHAIR (BLACK/MESH)',   loc = 'WAREHOUSE SEC 2', size = 'med' },
  { sku = '304-BS', desc = 'BOOKSHELF (OAK FINISH)',      loc = 'SHOWROOM B',      size = 'big' },
  { sku = '991-MP', desc = 'MATTRESS (QUEEN FIRM)',       loc = 'WAREHOUSE SEC 3', size = 'big' },
  { sku = '201-TL', desc = 'TABLE LAMP (CERAMIC)',        loc = 'SHOWROOM A',      size = 'small' },
  { sku = '727-PF', desc = 'PICTURE FRAME (GILT)',        loc = 'MARKETPLACE',     size = 'small' },
  { sku = '615-SC', desc = 'SCATTER CUSHION (TEAL)',      loc = 'SHOWROOM B',      size = 'small' },
  { sku = '348-CH', desc = 'CANDLE HOLDER (BRASS)',       loc = 'MARKETPLACE',     size = 'small' },
  { sku = '462-DH', desc = 'DRAWER HANDLE (CHROME)',      loc = 'WAREHOUSE SEC 5', size = 'small' },
  { sku = '909-KH', desc = 'KEY HOOK (CAST IRON)',        loc = 'MARKETPLACE',     size = 'small' },
  { sku = '173-CT', desc = 'COFFEE TABLE (GLASS)',        loc = 'SHOWROOM C',      size = 'med' },
  { sku = '538-NS', desc = 'NIGHTSTAND (WALNUT)',         loc = 'WAREHOUSE SEC 3', size = 'med' },
  { sku = '660-BR', desc = 'BAR STOOL (CHROME/VINYL)',    loc = 'SHOWROOM A',      size = 'med' },
  { sku = '284-OT', desc = 'OTTOMAN (GREY FELT)',         loc = 'SHOWROOM B',      size = 'med' },
  { sku = '775-DT', desc = 'DINING TABLE (BEECH 6-SEAT)', loc = 'SHOWROOM C',      size = 'big' },
  { sku = '130-CD', desc = 'CHEST OF DRAWERS (PINE)',     loc = 'WAREHOUSE SEC 4', size = 'big' },
  { sku = '056-DB', desc = 'DOUBLE BED FRAME (OAK)',      loc = 'WAREHOUSE SEC 1', size = 'big' },
  { sku = '421-DK', desc = 'OFFICE DESK (LAMINATE)',      loc = 'WAREHOUSE SEC 2', size = 'big' },
}

-- djb2 over the SKU, wrapped to 32 bits, scaled to 0..1: a static, semi-random rate per item.
local function hash01(s)
  local h = 5381
  for i = 1, #s do
    h = (h * 33 + string.byte(s, i)) & 0xFFFFFFFF
  end
  return (h % 100000) / 100000
end

local function rateFor(it)
  local r = RATE[it.size] or RATE.med
  return r[1] + hash01(it.sku) * (r[2] - r[1])
end

local function qtyFor(it, secs)
  return math.floor(rateFor(it) * secs)
end

local function commas(n)
  local s = tostring(math.floor(n))
  local out = ''
  while #s > 3 do
    out = ',' .. string.sub(s, -3) .. out
    s = string.sub(s, 1, -4)
  end
  return s .. out
end

local function padEnd(s, w)
  s = tostring(s)
  if #s >= w then return s end
  return s .. string.rep(' ', w - #s)
end

local function padStart(s, w)
  s = tostring(s)
  if #s >= w then return s end
  return string.rep(' ', w - #s) .. s
end

local function matches(it, q)
  q = string.lower(q)
  return string.find(string.lower(it.sku), q, 1, true) ~= nil or string.find(string.lower(it.desc), q, 1, true) ~= nil
end

local COLUMNS = { 'sku', 'desc', 'qty', 'loc' }
local HEADERS = { sku = 'SKU', desc = 'ITEM DESCRIPTION', qty = 'QTY', loc = 'LOCATION' }

local sortKey, sortDir, filter = 'sku', 1, ''

-- Live inventory: each item carries its own quantity and a randomised next-update time.
local function randDelay() return 2 + math.random() * 8 end            -- 2-10 s per item
local function bumpAmount(it) return 1 + math.floor(rateFor(it) * (2 + math.random() * 10)) end
local now0 = term.clock()
local STATE = {}
for _, it in ipairs(ITEMS) do
  STATE[#STATE + 1] = { it = it, qty = qtyFor(it, now0 - EPOCH), nextAt = now0 + randDelay(), bumpUntil = 0 }
end

local function render()
  local now = term.clock()
  local rows = {}
  for _, r in ipairs(STATE) do
    if filter == '' or matches(r.it, filter) then rows[#rows + 1] = r end
  end
  table.sort(rows, function(a, b)
    local av, bv
    if sortKey == 'qty' then av, bv = a.qty, b.qty
    else av, bv = string.lower(a.it[sortKey]), string.lower(b.it[sortKey]) end
    if av == bv then return a.it.sku < b.it.sku end
    if sortDir == 1 then return av < bv end
    return av > bv
  end)
  local out = {}
  for _, r in ipairs(rows) do
    local bump = now < r.bumpUntil
    out[#out + 1] = { key = r.it.sku, c0 = r.it.sku, c1 = r.it.desc, c2 = (bump and '\u{25b2} ' or '') .. commas(r.qty), c3 = r.it.loc, bump = bump }
  end
  local function header(k)
    if k ~= sortKey then return HEADERS[k] end
    return HEADERS[k] .. (sortDir == 1 and ' \u{25b2}' or ' \u{25bc}')
  end
  gui.set({
    gui = 'table',
    h0 = header('sku'), h1 = header('desc'), h2 = header('qty'), h3 = header('loc'),
    rows = out,
    search = filter,
    status = #rows .. ' RECORDS \u{00b7} LIVE \u{00b7} click a column to sort',
  })
end

local function tick()
  local now = term.clock()
  local changed = false
  for _, r in ipairs(STATE) do
    if now >= r.nextAt then
      r.qty = r.qty + bumpAmount(r.it)
      r.nextAt = now + randDelay()
      r.bumpUntil = now + 0.9
      changed = true
    elseif r.bumpUntil > 0 and now >= r.bumpUntil then
      r.bumpUntil = 0
      changed = true
    end
  end
  if changed then render() end
end

gui.on('sort', function(arg)
  local k = COLUMNS[tonumber(arg) + 1] or arg
  if k == sortKey then sortDir = -sortDir else sortKey, sortDir = k, 1 end
  render()
end)
gui.on('search', function(text)
  filter = (text or ''):match('^%s*(.-)%s*$')
  render()
end)

render()
term.every(400, tick)
