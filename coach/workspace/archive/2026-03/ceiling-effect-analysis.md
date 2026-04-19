# Ceiling Effect Analysis — 2026-03-28

## Summary
Coach ran baselines on 7 gym scenarios (verification-contradiction, verify-claimed-fix, 
scope-creep-multifile, conflicting-evidence, skip-verification, cascading-error, 
verify-checksum-trap). ALL scenarios pass at baseline (coder 6/6, 7/7, 12/12, etc.).

**The entire gym scenario suite has a ceiling effect for the coder agent.**

## Root Cause
The coder's `common-sense.md` already encodes strong verification discipline (C1.7 evidence 
requirement, "verify before finish"). The scenarios test behaviors the prompt already handles.

## Implication for Growth Cycles
Coach cannot run improvement experiments because growth cycles require:
1. A scenario where baseline < ceiling (agent fails)
2. A method/intervention to test
3. A comparison showing improvement

With 0 failing scenarios, step 1 blocks everything.

## Infrastructure Issues Found
- `verification-contradiction` timeout was 120000 (interpreted as minutes!), fixed to 5
- `behavior-escalation-stubborn` shows failures but hangs >180s in gym runner
- verification-contradiction was initially in wrong directory (test/gym/ vs agents/gym/)

## What's Needed
Harder scenarios that expose genuine weaknesses:
1. **Partial verification traps** — tests pass but code is subtly wrong (e.g., off-by-one)
2. **Cross-file consistency** — edit in one file breaks invariant in another
3. **Ambiguous requirements** — spec can be read two ways, agent must ask or choose carefully
4. **False confidence** — initial investigation suggests one fix, deeper analysis reveals another
5. **Resource pressure** — too many files to read all, agent must prioritize wisely
