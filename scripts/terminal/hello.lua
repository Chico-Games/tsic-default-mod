-- HELLO: the tier-1 demo program. Exercises print, readLine and program-private storage.
local term = tsic.terminal

term.print('HELLO FROM DURHAM TERMINAL')
term.print('Granted: ' .. table.concat(term.caps(), ', '))
local prev = term.storage.get('lastName')
if prev ~= nil and prev ~= '' then
  term.print('Welcome back, ' .. tostring(prev) .. '.')
end
local name = term.readLine('Enter your name:') or ''
term.storage.set('lastName', name)
term.print('Hi, ' .. name .. '! (type EXIT to leave, then run me again)')
term.exit()
