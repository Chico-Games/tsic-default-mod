local term = tsic.terminal

term.print('SCP RESTRICTED ACCESS \u{2014} SITE CONTROLS')
local r = term.world.mutate('setTimeOfDay', { t = 0.5 })
term.print('setTimeOfDay -> ' .. ((r and r.error) or 'ok'))
term.exit()
