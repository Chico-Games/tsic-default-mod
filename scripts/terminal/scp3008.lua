-- SCP3008: SECRET. A short, scripted encounter. Hidden from HELP; runnable by name.
-- Clears the screen, types a few lines slowly and unevenly, waiting for the operator
-- between each, and finally reboots the terminal.
local term = tsic.terminal

-- Slow, inconsistent typing: each character lands after charDelay plus up to jitter extra ms.
local creepy = { charDelay = 170, jitter = 170, charsPerTick = 1 }

term.clear()
term.sleep(900)

term.print('HELLO', creepy)
term.readLine('')                 -- wait for any response

term.print('DO YOU FEEL SAFE?', creepy)
term.readLine('')                 -- wait for any other input

term.print('GOODBYE', creepy)
term.readLine('', 5000)           -- 5 s, or any input

term.clear()
term.reboot()
