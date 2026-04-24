# Brief: Test Refined Materialization Skill v2 (EXP-212)

## Goal
Test whether skill v2 fixes the remaining 2 failing checks that skill v1 didn't address.

## Background — EXP-211 Results (Partial)
Skill v1 (`agents/.lab/materialize-skill/`) improved coder from 6/9 → 7/9:
- ✅ `early-materialization` — FIXED (agent now writes before 50% of tool calls)
- ✗ `regular-materialization-cadence` — STILL FAILING (max gap between writes > 6 tool calls)
- ✗ `finish-references-deliverables` — STILL FAILING (finish() doesn't reference workspace files)

## What Changed in v2
Located at: `agents/.lab/materialize-skill-v2/skills/materialize-findings.md`

Changes from v1:
1. **Cadence emphasis**: "STOP and write after every 3 reads. Non-negotiable." + "read 3, write 1" pattern repeated explicitly with 3 rounds of examples
2. **Cadence checklist**: Mental checklist at the bottom reinforcing the rhythm
3. **Finish deliverables emphasis**: Added ⚠️ callout: "ALWAYS reference workspace files in finish()" + "Never call finish() without a deliverables array"
4. **Anti-pattern targeting**: Added explicit anti-pattern for "Writing early but then reading 6+ files without updating"
5. **Stronger framing**: "Don't read a 4th file until you've written" instead of passive "update every 3-4 operations"

## Experiment Design
1. **Treatment**: Run `materialize-intermediate-findings` 3x WITH the v2 lab fork:
   ```
   scripts/gym-run.sh materialize-intermediate-findings --lab materialize-skill-v2
   ```
2. **Measure**: Compare against EXP-211 treatment results (7/9). Focus on `regular-materialization-cadence` and `finish-references-deliverables`.
3. **Regression check**: Run 1-2 passing scenarios WITH the v2 fork (e.g., `cascading-error`).

No need to re-baseline — EXP-211 confirmed 6/9 baseline is stable.

## Success Criteria
- Treatment ≥8/9 at least 2/3 times → **promote skill to coder/skills/**
- Treatment = 7/9 (same as v1) → v2 refinements don't help. Consider accepting ceiling or trying Coach's w05 three-phase workflow.
- Treatment < 7/9 → v2 causes regression, discard

## Owner
Coach (run the experiment), Bob (analyze results)
