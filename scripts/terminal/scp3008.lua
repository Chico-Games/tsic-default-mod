local term = tsic.terminal

local creepy = { charDelay = 170, jitter = 170, charsPerTick = 1 }

term.clear()
term.sleep(900)

term.print('HELLO', creepy)
term.readLine('')

term.print('DO YOU FEEL SAFE?', creepy)
term.readLine('')

term.print('GOODBYE', creepy)
term.readLine('', 5000)

term.clear()
term.reboot()
