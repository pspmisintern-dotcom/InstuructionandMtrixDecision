from pathlib import Path
import re
path = Path('app/workinstructions/[id]/page.js')
text = path.read_text(encoding='utf-8')
stack = []
line = 1
in_str = None
esc = False
for ch in text:
    if ch == '\n':
        line += 1
        esc = False
        continue
    if in_str:
        if esc:
            esc = False
        elif ch == '\\':
            esc = True
        elif ch == in_str:
            in_str = None
        continue
    if ch in ('"', "'", '`'):
        in_str = ch
        esc = False
        continue
    if ch == '{':
        stack.append((ch, line))
    elif ch == '}':
        if not stack:
            print('UNMATCHED_CLOSE', line)
            break
        stack.pop()
else:
    print('STACK_LEN', len(stack))
    if stack:
        print('UNMATCHED_OPEN', stack[-1][1])
