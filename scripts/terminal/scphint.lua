-- SCP-HINT: the tier-3 demo program. On a tier-1/2 terminal it never runs (ERR_TIER_TOO_LOW).
local term = tsic.terminal

term.print('SCP RESTRICTED ACCESS \u{2014} SITE CONTROLS')
local r = term.world.mutate('setTimeOfDay', { t = 0.5 })
term.print('setTimeOfDay -> ' .. ((r and r.error) or 'ok'))
term.exit()
