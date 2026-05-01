# EXP-340: Verify-After-Edit Structural Enforcement via Context Gate

## Problem
verify-after-edit compliance is 9% system-wide (502 failures/7d). EXP-280 (text coaching) was NEGATIVE — no improvement. KE-338 confirms text skills are dead for behavioral enforcement. This is the #1 system-wide failure pattern.

## Hypothesis
If we add a **structural gate rule** to agent context.md files that says:
> "After EVERY edit() or write() call, you MUST immediately read() the file to verify. If you call edit/write without a following read, your session quality is 0."

...combined with the ANTI-SHALLOW enforcement pattern (which proved +32pp for shallow sessions), we can achieve ≥30% verify-after-edit compliance (from 9%).

## Why This Might Work When EXP-280 Didn't
- EXP-280 used a skill file (loaded conditionally). Context.md rules load EVERY session.
- EXP-280 was a soft recommendation. This is framed as a hard gate with consequences.
- The ANTI-SHALLOW pattern (same framing: "do X or quality=0") achieved 69%→0% shallow rate.

## Treatment
Add to target agent's context.md:
```
## VERIFY-AFTER-EDIT GATE (mandatory)
After EVERY edit() or write() call, immediately read() the file back to confirm your change applied correctly. 
Skipping verification = session failure. No exceptions.
```

## Target Agent
bob (highest violation count: 120 failures/7d in baseline). Already has ANTI-SHALLOW in context.md so we know the loading path works.

## Control
- Baseline: bob's verify-after-edit rate from recent sessions (estimate ~10-20%)
- Measurement: count edit/write calls followed by read() of same file within 3 tool calls

## Success Criteria
- verify-after-edit compliance ≥30% (from ~10% baseline) = POSITIVE
- ≥50% = STRONG POSITIVE, recommend rollout to all agents

## Measurement Plan
1. Pre-treatment: audit 5 recent bob sessions, count edit→read pairs
2. Deploy gate to bob/context.md
3. Post-treatment: audit 5 bob sessions after deployment, count edit→read pairs

## Risk
- Agent may game by doing meaningless read() calls → mitigate by checking read targets match edit targets
- May slow agents down → acceptable tradeoff for correctness

## Status: DESIGNED
- Next: Run pre-treatment baseline audit, then request deployment
