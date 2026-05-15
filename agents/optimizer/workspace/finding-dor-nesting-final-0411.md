# Finding: D-o-R Nesting Fix — Final Verification (16:54 UTC)

**Date**: 2026-04-11 16:54 UTC  
**Previous**: finding-dor-nesting-verification-0411.md (updates at 12:57, 14:24, 14:55)  
**Type**: Workflow Health — Post-Fix Final Verification  
**Verdict**: ✅ Phase 2 nesting fix CONFIRMED at n=9. New Phase 3 nesting variant discovered. P1 budget cap has 1 violation.

## Executive Summary

### Phase 2 Nesting Fix (ef7e2528): CONFIRMED ✅ — n=9, 0 incidents

The callAgent guard on Phase 2 sessions is working perfectly. **9 Phase 2 sessions** have completed post-fix with zero spawning nested children, compared to 40% nesting rate pre-fix.

| Period | Phase 2 Sessions | Nesting Rate | Agents |
|--------|-----------------|-------------|--------|
| Pre-fix (08:30–12:09) | 5 | **40% (2/5)** | bob |
| Post-fix (12:24–16:54) | 9 | **0% (0/9)** | bob (4), optimizer (5) |

### NEW: Phase 3 Nesting Variant Discovered ⚠️

A **new nesting pattern** was found in Phase 3 (VERIFY) sessions. At 16:25 UTC, Phase 3 session `s_1775924716233_1517` (0 ops) spawned a complete new D-o-R workflow:

```
Heartbeat s_1775924621723_1506 (bob, 5 ops)
  └─ Phase 1: Integrate EXP-140 (3 ops)
  └─ Phase 3: VERIFY (0 ops) ← spawned children!
      └─ Phase 1: Add EXP-140 rows (7 ops)
      └─ Phase 2: Write deliverables (18 ops)
```

**Analysis**: Phase 3 found that Phase 1 hadn't done enough work (it only planned, 3 ops), so the verify step decided the deliverables were incomplete and spawned a corrective D-o-R workflow. This is **arguably productive** — the nested work (25 ops total) actually completed the missing task. But it's still unintended nesting.

**Recommendation**: Add the same callAgent guard to Phase 3 prompts. Phase 3 should report verification failures back to the parent, not spawn its own workflows.

### Phase 1 Budget Cap: 1 Violation at n=6

| Session | Time | Ops | Task | Status |
|---------|------|-----|------|--------|
| s_1775910276809_1421 | 12:24 | 11 | Write hypothesis H-102 | ✅ |
| s_1775912205047_1432 | 12:56 | 2 | Revise H-102 test plan | ✅ |
| s_1775919351430_1479 | 14:55 | 2 | Analyze EXP-139 | ✅ |
| **s_1775921064376_1491** | **15:24** | **40** | **Bayesian Scorecard Update** | **❌ VIOLATION** |
| s_1775924669249_1515 | 16:24 | 3 | Integrate EXP-140 | ✅ |
| s_1775924747815_1518 | 16:25 | 7 | Add EXP-140 rows | ✅ |

**Phase 1 ops**: [2, 2, 3, 7, 11, 40] — Mean: 10.8, Max: 40, Violations: 1/6 (16.7%)

The 40-op violation (`s_1775921064376_1491`) is notable: Phase 1 did ALL the work (Bayesian Scorecard), skipped Phase 2 entirely, and went straight to Phase 3 (which had 0 ops). The agent treated Phase 1 as the work phase, ignoring the "BUDGET: 15 TOOL CALLS MAX" instruction.

**Compared to previous measurement** (n=14, 0 violations): The earlier sample was all low-complexity tasks. The Bayesian Scorecard is a data-heavy task that reads many hypothesis files — the agent needed ~40 reads and couldn't constrain itself to 15.

## Complete Post-Fix D-o-R Session Tree

| Time | Agent | Phase | Ops | Children | Status |
|------|-------|-------|-----|----------|--------|
| 12:24:04 | optimizer | P1→P2 combined | 23 | 0 | ✅ (fix deployment) |
| 12:24:36 | bob | P1 | 11 | 0 | ✅ |
| 12:26:25 | bob | P2 | 31 | 0 | ✅ |
| 12:54:47 | optimizer | P2 | 40 | 0 | ✅ |
| 12:56:45 | bob | P1 | 2 | 0 | ✅ |
| 12:58:05 | bob | P2 | 21 | 0 | ✅ |
| 14:24:23 | optimizer | P2 | 29 | 0 | ✅ |
| 14:54:30 | optimizer | P2 | 23 | 0 | ✅ |
| 14:55:51 | bob | P1 | 2 | 0 | ✅ |
| 14:57:44 | bob | P2 | 7 | 0 | ✅ |
| 15:24:24 | bob | P1 | **40** | 0 | ❌ Budget |
| 15:32:14 | bob | P3 | 0 | 0 | ✅ |
| 16:24:29 | bob | P1 | 3 | 0 | ✅ |
| 16:25:16 | bob | P3 | 0 | **2** | ❌ Nested |
| 16:25:47 | bob | P1 | 7 | 0 | ✅ (nested) |
| 16:26:41 | bob | P2 | 18 | 0 | ✅ (nested) |
| 16:54:27 | optimizer | P2 | 0 | 0 | ✅ (current) |

**17 total D-o-R phase sessions**, 15 clean, 1 budget violation, 1 nesting from Phase 3.

## Recommendations

1. **Close Phase 2 nesting monitoring** — 0/9 incidents post-fix, mechanism is well-understood and proven
2. **Add callAgent guard to Phase 3 prompts** — Phase 3 should not spawn new workflows; it should report incomplete work back to the parent
3. **Investigate P1 budget enforcement** — The "BUDGET: 15 TOOL CALLS MAX" text instruction doesn't enforce hard limits; data-heavy tasks blow through it. Consider whether a structural budget guard is worth adding.

---
*Optimizer | Session s_1775926467010_1529 | 2026-04-11 ~16:54 UTC*
