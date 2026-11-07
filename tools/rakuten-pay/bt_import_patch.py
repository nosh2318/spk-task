#!/usr/bin/env python3
# 2026-11-07 bt-import: 楽天の payment を一律「事前カード決済(支払済)」でなく、GAS が渡す reservation.pay_method で決める。
import sys
p = sys.argv[1]; s = open(p, encoding='utf8').read()
old = 'payment:_isJalan?"じゃらん事前決済(Square)":"事前カード決済(支払済)"'
new = 'payment:_isJalan?"じゃらん事前決済(Square)":(r.pay_method==="onsite"?"現地決済":"事前カード決済(支払済)")'
if new in s: print('already'); sys.exit(0)
assert s.count(old) == 1, 'anchor not found'
open(p, 'w', encoding='utf8').write(s.replace(old, new)); print('patched')
