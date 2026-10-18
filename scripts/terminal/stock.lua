-- STOCK: Durham's "live" inventory database (tier 1, text). Each item has a static,
-- semi-random rate (0.5-5.5 units/sec, seeded from its SKU); QTY = rate * seconds since
-- 01/01/1984, absurdly large and growing every render. N/P paginate, F <text> searches,
-- ALL clears the search, R refreshes, H help, Q quits.
local term = tsic.terminal

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

local PER_PAGE = 8
local SKU_W, DESC_W, QTY_W, LOC_W = 7, 27, 13, 15
local HEADER = padEnd('SKU', SKU_W) .. ' | ' .. padEnd('ITEM DESCRIPTION', DESC_W) .. ' | ' .. padEnd('QTY', QTY_W) .. ' | ' .. padEnd('LOCATION', LOC_W)
local RULE = string.rep('=', #HEADER)
local DASH = string.rep('-', #HEADER)

local function rowOf(it, secs)
  return padEnd(it.sku, SKU_W) .. ' | ' .. padEnd(it.desc, DESC_W) .. ' | ' .. padStart(commas(qtyFor(it, secs)), QTY_W) .. ' | ' .. it.loc
end

local function showHelp()
  term.clear()
  term.print('')
  term.print(DASH)
  term.print('  INVENTORY DATABASE \u{2014} COMMANDS')
  term.print(DASH)
  term.print('  N            NEXT PAGE')
  term.print('  P            PREV PAGE')
  term.print('  F <SKU>      FIND BY SKU OR DESCRIPTION')
  term.print('  ALL          CLEAR SEARCH / SHOW ALL ITEMS')
  term.print('  R            REFRESH QUANTITIES')
  term.print('  H            THIS HELP')
  term.print('  Q            QUIT')
  term.print(DASH)
  term.readLine('> PRESS ENTER TO RETURN ')
end

local filter = nil
local page = 0

while true do
  local secs = math.floor(term.clock() - EPOCH)
  local visible = {}
  for _, it in ipairs(ITEMS) do
    if filter == nil or matches(it, filter) then visible[#visible + 1] = it end
  end
  local pages = math.max(1, math.ceil(#visible / PER_PAGE))
  if page < 0 then page = 0 elseif page > pages - 1 then page = pages - 1 end

  term.clear()
  term.print(RULE)
  term.print(' DURHAM OS // INVENTORY DATABASE // MAIN TERMINAL')
  term.print(RULE)
  term.print('FILE: INVENTORY_DB.DAT')
  term.print('STATUS: ONLINE')
  term.print('LAST UPDATED: 11/04/1986')
  if filter then
    term.print('SEARCH: "' .. filter .. '"   (' .. #visible .. (#visible == 1 and ' MATCH)' or ' MATCHES)'))
  end
  term.print(DASH)
  term.print(HEADER)
  term.print(DASH)
  if #visible == 0 then
    term.print('  NO RECORDS MATCH.')
  else
    local start = page * PER_PAGE
    for i = start + 1, math.min(#visible, start + PER_PAGE) do
      term.print(rowOf(visible[i], secs))
    end
  end
  term.print(DASH)
  term.print('PAGE ' .. (page + 1) .. '/' .. pages .. '   N)EXT  P)REV  F)IND <SKU>  H)ELP  Q)UIT')

  local ans = (term.readLine('') or ''):match('^%s*(.-)%s*$')
  local lc = string.lower(ans)
  if lc == '' then
    -- refresh
  elseif lc == 'q' or lc == 'quit' or lc == 'exit' then
    break
  elseif lc == 'h' or lc == 'help' or lc == '?' then
    showHelp()
  elseif lc == 'n' or lc == 'next' then
    page = page + 1
  elseif lc == 'p' or lc == 'prev' then
    page = page - 1
  elseif lc == 'r' or lc == 'refresh' then
    -- quantities re-read on the next render
  elseif lc == 'all' or lc == 'clear' or lc == 'b' or lc == 'back' then
    filter = nil
    page = 0
  else
    local query = ans:match('^[Ff]%s+(.+)$') or ans:match('^[Ff][Ii][Nn][Dd]%s+(.+)$') or ans:match('^[Ss][Ee][Aa][Rr][Cc][Hh]%s+(.+)$') or ans
    filter = query:match('^%s*(.-)%s*$')
    page = 0
  end
end

term.exit()
