from pathlib import Path
from pathlib import PurePosixPath
import re
from pathlib import Path
path = Path('app/workinstructions/[id]/page.js')
text = path.read_text(encoding='utf-8')
stack = []
line = 1
state = 'code'
string_char = None
escape = False
for ch in text:
    if ch == '\n':
        line += 1
        escape = False
        continue
    if state == 'string':
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif ch == string_char:
            state = 'code'
        continue
    if ch in ('"', "'", '`'):
        state = 'string'
        string_char = ch
        escape = False
        continue
    if ch == '{':
        stack.append((line, ch))
    elif ch == '}':
        if not stack:
            print('UNMATCHED_CLOSE', line)
            break
        stack.pop()
else:
    print('STACK_LEN', len(stack))
    if stack:
        print('UNMATCHED_OPEN', stack[-1][0])
