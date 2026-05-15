# EXP-220: Bob Persistent-Task Knowledge Gap Fix

**Status**: DEPLOYED — awaiting post-measurement (no gym runs since fix; need 20 trials on k3s)
**Created**: 2026-04-25
**Owner**: coach

## Hypothesis

Bob fails to use the `persistent-task` workflow (6.6% pass rate, 8/122 trials) because his TOOLS.md contradicts itself: the auto-generated tool list includes `workflow`, but the "Key Constraints" section says "❌ No workflow". Fixing this contradiction and documenting the workflow should dramatically increase usage.

## Baseline

- **Scenario**: `use-persistent-task` (and variants)
- **Agent**: bob
- **Pass rate**: 8/122 = 6.6% (from gym_runs, runs since 2026-04-18)
- **Root cause**: TOOLS.md says "❌ No workflow" — agent self-censors

## Intervention

1. Added `## workflow` section to `agents/bob/TOOLS.md` documenting:
   - The `workflow` tool exists and works
   - The `persistent-task` workflow specifically
   - When to use it (resuming project work)
2. Removed `workflow` from the "❌ No X tools" constraint list

## Post-Measurement Plan

Run `use-persistent-task` scenario × 20 trials for bob after fix.
Expected: >60% pass rate (knowledge gaps resolve near-completely when documented).

## Success Criteria

- Pass rate increases from 6.6% to >50% → PROMOTE (keep TOOLS.md fix)
- Pass rate stays <20% → REJECT (problem is not documentation)
