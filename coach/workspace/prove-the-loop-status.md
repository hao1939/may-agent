# Prove-the-Loop Status — 2026-04-24 heartbeat

## M1-M4: COMPLETE
- Skill gap: relational bug blindness (v2: 0/74 = 0% over 14 days)
- Intervention: Data Flow Audit skill (3 arms: skill, inline, direct)
- Measurement protocol ready: 10 trials × 3 arms

## M5-M6: BLOCKED — gym runs cannot execute in this environment

### Critical finding: v3 overcorrected
- **v3 is 5/5 (100%)** — scenario too easy. Removing `adjusted_pct` and simplifying to `pct` made the ordering bug too obvious (5 clear test failures pointing directly at it).
- **v2 is 0/74 (0%)** — too hard. The `adjusted_pct` indirection completely hides the ordering bug.
- **We need a difficulty sweet spot** (20-40% baseline) for the skill to make a measurable difference.

### EXP-195 runs still at 0
- Scenarios `cascading-fix-trap-v2-exp195-{skill,inline,direct}` exist
- `GYM_AGENT_BIN` not available — gym runner returns "skipped"
- These runs must happen on k3s

### Options to unblock
1. **Run EXP-195 on k3s** — the v2 exp195 scenarios are ready. Even if baseline is 0%, the skill/inline/direct arms might lift it. Direct hint already showed 10%→40% in earlier testing.
2. **Create v3.5** — add back some indirection to v3 so it's not trivially obvious, targeting ~30% baseline. Then run skill experiment on that.
3. **Reframe success** — if direct hint lifts v2 from 0% to 40% and skill lifts it to 20%, that's still proof the loop works (even if skill < direct, skill is transferable).

## Recommended next action
Option 1: dispatch EXP-195 runs on k3s. We already have the scenarios. Even with v2's 0% baseline, the 3-arm comparison will be informative. If all arms score 0%, we know the task is beyond any prompt-level intervention and need v3.5.

## Data summary
| Scenario | Runs | Pass Rate | Period |
|----------|------|-----------|--------|
| cascading-fix-trap-v2 | 74 | 0% | 14d |
| cascading-fix-trap-v2-exp177-placebo | 10 | 0% | 14d |
| cascading-fix-trap-v2-exp177-lexical | 10 | 30% | 14d |
| cascading-fix-trap-v2-exp177-paraphrase | 10 | 20% | 14d |
| cascading-fix-trap-v3 | 5 | 100% | 12d ago |
| cascading-fix-trap-v2-exp195-skill | 0 | - | never |
| cascading-fix-trap-v2-exp195-inline | 0 | - | never |
| cascading-fix-trap-v2-exp195-direct | 0 | - | never |
