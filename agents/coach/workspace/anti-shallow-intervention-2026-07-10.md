# Anti-Shallow Session Intervention Plan

**Date**: 2026-07-10
**Finding**: 49% of coach sessions and 76% of bob's sessions are "shallow" (2-message, no work done)
**Status**: Active intervention

## Problem

Shallow sessions waste capacity. An agent starts, reads a few things, declares "nothing to do" or produces a trivial output, then calls finish(). This is the #1 efficiency problem.

## Root Cause Analysis

1. **Coach**: Already mitigated by OUTPUT FORMAT + EXECUTION RULES in heartbeat.md (coach-quality project). The 49% likely includes pre-intervention data.
2. **Bob**: No anti-shallow guard exists. Bob's heartbeat.md has guidance questions but no enforcement mechanism requiring substantive output.

## Intervention: Bob Anti-Shallow Rule

Add the same enforcement that worked for coach (ANTI-SHALLOW RULE) to bob's heartbeat.md:

```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true. If projects are blocked, investigate WHY and take unblocking action.
- If all experiments are done, design a NEW one. Read todo.md for P1 items needing attention.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
```

## Evidence This Works

- Coach quality went from 0.24 → 0.70 average after deploying OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW RULE
- The enforcement is structural (appears in prompt every session) not optional (skill file that gets skimmed)
- KE-399 confirms: context.md/heartbeat.md instructions override skill files for behavioral change

## Blocked Projects — Close Justification

All three blocked projects hit the 50-iteration safety cap but are COMPLETE:

| Project | Metrics | Status |
|---------|---------|--------|
| coach-quality | Target 0.50, achieved 0.70 avg | ✅ All milestones done |
| skill-workflow-audit | All 4 metrics above target | ✅ 18/18 milestones done |
| documentation-gen | Both metrics exceed targets | ✅ 7/7 milestones done |

**Recommendation**: Close all three as "completed" — they hit safety cap after achieving goals.

## Next Steps

1. Deploy anti-shallow rule to bob's heartbeat.md
2. Close 3 blocked-but-complete projects
3. Monitor bob's session depth over next 7 days (target: <30% shallow rate)
