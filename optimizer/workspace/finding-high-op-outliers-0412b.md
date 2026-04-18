# Finding: High-Op Session Outliers — Bob 77-op & Coach 66/63-op (Apr 12, 2026)

**Date**: 2026-04-12 ~12:54 UTC  
**Author**: Optimizer  
**Scope**: 3 sessions from last 6 hours flagged as high-op outliers  
**Method**: Database analysis of sessions, digests, workflow trees, and comparison to known patterns

---

## Executive Summary

All 3 sessions match **known patterns** with existing fixes already deployed. No new failure modes discovered.

| Session | Agent | Ops | Pattern | New? | Actionable? |
|---------|-------|-----|---------|------|-------------|
| s_1775991281063_2064 | Bob | 77 | Research thread budget cap violation | **No** — known prompt-cap unreliability | Only infra `maxOps` would fix |
| s_1775982291491_1980 | Coach | 66 | Serial gym execution → timeout | **No** — known serial-gym pattern | gym-batch.sh exists but 0% adoption |
| s_1775987678357_2031 | Coach | 63 | Convention investigation exploration spiral | **No** — known investigation archetype | session-query.ts + investigation template exist |

**Verdict**: These are the long tail of known cost drivers. No emergency fixes needed. The structural fixes (infra `maxOps`, gym-batch adoption via dispatch path) are already identified but require infra or behavioral changes beyond prompt-level fixes.

---

## Session 1: Bob 77-op Research Thread (s_1775991281063_2064)

### What Happened

- **Task**: "EXP-148 results processing" — process experiment results, update H-102 P(H), update PRIORITY-TRACKER
- **Started**: 2026-04-12 10:54 UTC (6 hours after budget cap deployed at 04:55 UTC)
- **Duration**: 13m 23s, 99 turns, 77 ops
- **Workflow**: `parallel-research` (wr_1775991281063_h5w3)
- **Tree**: Thread 1 (77 ops) + Thread 2 (20 ops) + Synthesis (9 ops) = **106 total ops**
- **Parent**: Bob heartbeat (s_1775991223129_2054, 16 ops)
- **Outcome**: success — EXP-148 processed, H-102 updated, PRIORITY-TRACKER updated, todo.md marked complete

### What Consumed the Ops

The 77-op thread was an EXP-148 results processing task — reading experiment results, updating hypothesis files, updating PRIORITY-TRACKER, and writing a knowledge entry. This is inherently a multi-file-read/write task (5-10 files). The budget cap text (`≤25 tool calls`) was injected by the workflow but the LLM ignored it and did full delivery work inline.

### Known Pattern: Prompt Budget Cap Unreliability

This is a **known issue** documented in:
- `finding-bob-93op-cap-violation-0412.md` — identical pattern (93-op P1 cap violation on KB INDEX batch integration)
- `finding-bob-research-postfix-measurement-0412b.md` — cap works 89% of the time but fails on complex multi-file tasks

**Post-cap statistics (all research threads since 04:55 UTC):**

| Metric | Value |
|--------|-------|
| Total research threads | 17 |
| Compliant (≤25 ops) | 16 (94.1%) |
| Violations | 1 — this session (5.9%) |
| Compliant avg ops | 12.5 |
| Violation ops | 77 |
| Overall avg | 16.3 |

The cap is broadly effective (94% compliance) but text-based budget instructions are fundamentally unreliable for complex multi-file tasks. The sibling thread (20 ops, EXP-147 Track B analysis) respected the cap perfectly.

### Infrastructure Retry Note

One of the 99 turns was an infrastructure retry (empty_response) — negligible impact (1 of 77 ops).

### Fix Status

- **Prompt cap**: ✅ Already deployed (04:55 UTC), working for 94% of threads
- **Infra `maxOps`**: ❌ Not implemented — would hard-terminate at 25 ops, the only reliable fix
- **Anti-nesting**: ✅ Working — thread did NOT trigger D-o-R internally (anti-nesting instruction effective)

---

## Session 2: Coach 66-op EXP-147 Track B (s_1775982291491_1980)

### What Happened

- **Task**: "Execute EXP-147 Track B Phase 0: Setup and Pilot" — run context isolation A/B gym experiment
- **Started**: 2026-04-12 08:24 UTC
- **Duration**: 34.8 min, 74 turns, 66 ops
- **Status**: `interrupted` (Request was aborted — timeout after ~35 min)
- **Kind**: `job` via `agents.fork` from heartbeat
- **No workflow** — direct fork, no D-o-R or parallel-research

### What Consumed the Ops

This was a **gym execution session** running serial gym-run.sh calls for a controlled experiment:

1. **Setup (~10 ops)**: Verified 8 candidate scenarios exist, checked gym_runs DB (empty), identified context-swap mechanism
2. **Execution (~50 ops)**: Ran 40 individual gym runs across 2 conditions (full-context vs scoped-context), all passing
3. **Interrupted**: Session aborted at 35 min (likely request timeout) while planning to run more batches

The session then **resumed 6 more times** over the next 4 hours:
- s_1775985864624 (10 ops, interrupted at 61 min)
- s_1775987665644 (17 ops, interrupted at 31 min)
- s_1775991262341 (21 ops, interrupted at 60 min)
- s_1775993056925 (24 ops, interrupted at 60 min)
- s_1775994849931 (still running)
- s_1775996639659 (still running)

**Total experiment cost so far: ~138+ ops** across 7 sessions (all repeatedly interrupted).

### Known Pattern: Serial Gym Execution

This is the **serial gym-run pattern** documented in:
- `finding-coach-session-efficiency-0410.md` — "gym run proliferation" identified as 11.2% of waste
- `finding-coach-experiment-cost-scouting-0412.md` — gym run count × serial overhead (2-4 ops/run)
- `finding-gym-batch-adoption-0411.md` — gym-batch.sh exists but has ZERO adoption

Each gym run costs 1-2 ops (bash call + sometimes a checkpoint/read). Running 40 runs serially = ~50-60 ops minimum. `gym-batch.sh` was built to replace this pattern with a single command, but adoption remains at 0%.

### Why 66 Ops Is Expected for This Task

Running 40 gym runs at ~1.3 ops/run + 10 ops setup ≈ 62 ops. The 66 ops are essentially **the minimum** for this task with serial execution. This is not a case of waste or spiral — it's a structural cost of the serial gym execution pattern.

### Fix Status

- **gym-batch.sh**: ✅ Built and merged, but ❌ ZERO adoption (4th consecutive check)
- **Adoption strategy**: Context.md mentions don't work (Level 4 = 0% adoption). Needs dispatch path integration (Level 1-3)
- **Finding**: `finding-tool-adoption-patterns-0412.md` — adoption only works via workflow/handler integration, not context.md references

---

## Session 3: Coach 63-op C1.3 Regression Investigation (s_1775987678357_2031)

### What Happened

- **Task**: "Investigate optimizer C1.3 regression and design intervention" — why did verify-after-edit drop from 91.9% to 86.7%?
- **Started**: 2026-04-12 09:54 UTC
- **Duration**: 7.4 min, 54 turns, 63 ops
- **Status**: `done` (completed successfully)
- **Kind**: `job` via `agents.fork` from coach heartbeat at 09:53 UTC
- **No workflow** — direct fork

### What Consumed the Ops

Based on the investigation report (`investigation-optimizer-c13-regression.md`):

1. **DB exploration (~20 ops est.)**: Queried convention_checks for C1.3 trend data across 7 days, violation breakdown, session-level failure details
2. **Code investigation (~15 ops est.)**: Grep/read of convention-check.ts (1,141 lines) to understand C1.3 check logic, exemption patterns
3. **Root cause analysis + fix (~15 ops est.)**: Classified 39 violations into categories, identified 77% as false positives, added 2 exemptions to convention-check.ts
4. **Writing + infrastructure (~13 ops est.)**: Wrote investigation report, committed changes, finish()

### What It Produced

Solid output — correctly identified that 77% of violations were tracking files (DELIVERABLES_CHECKLIST.md, finding-*.md) that should be exempt. Added 2 pattern exemptions to `convention-check.ts`. Projected rate improvement from 88.6% to ~97.4%.

### Known Pattern: Convention Investigation Archetype

This matches the **convention investigation archetype** documented in:
- `finding-coach-investigation-tool-gaps-0412.md` — avg 104 ops for convention investigations, 73% on investigation steps
- `finding-coach-work-session-cost-analysis-0412.md` — interactive DB exploration is the primary cost driver

However, at 63 ops this is **significantly more efficient** than the archetype average of 104 ops. The session was focused:
- It didn't repeat schema discovery excessively
- It went from data → root cause → fix in 7.4 min
- It produced a concrete code change, not just a report

### Assessment

This is actually a **success story** compared to the investigation archetype. 63 ops for a complete investigation + code fix + report is at the low end of what's possible with the serial DB query pattern. The session was reasonably efficient.

### Fix Status

- **session-query.ts**: ✅ Built but ❌ ZERO adoption — would save ~10-15 ops on DB querying
- **Convention investigation template**: Not built — would pre-specify the query sequence and code sections to read
- **Pre-computed schema context**: Not implemented — would eliminate schema discovery ops

---

## Cross-Session Analysis

### Are These New Patterns?

**No.** All 3 match previously documented patterns:

| Pattern | First Documented | Sessions Affected | Fix Status |
|---------|-----------------|-------------------|------------|
| Prompt budget cap unreliability | Apr 12 05:54 UTC | Bob research threads (5.9% violation rate) | Partial — prompt cap deployed, infra `maxOps` needed |
| Serial gym execution | Apr 10 | Coach experiment sessions | Built (gym-batch.sh), 0% adoption |
| Convention investigation spiral | Apr 12 10:55 UTC | Coach investigation sessions | Built (session-query.ts), 0% adoption |

### Cost Impact

| Session | Excess Ops (vs optimal) | $ Cost | Avoidable? |
|---------|------------------------|--------|-----------|
| Bob 77-op | ~52 ops (vs 25 cap) | ~$2.44 | Only with infra `maxOps` |
| Coach 66-op | ~46 ops (vs 20 with gym-batch) | ~$2.16 | Yes, with gym-batch adoption |
| Coach 63-op | ~10-15 ops (vs 48-53 with session-query) | ~$0.60 | Partially, with session-query |

**Total excess: ~$5.20** across 3 sessions. Not an emergency.

---

## Recommendations

### No New Fixes Needed

All actionable fixes are already identified. The priority order:

1. **Infra `maxOps` on `ctx.runAgent()`** (HIGH — covers bob research threads + D-o-R P1 violations)
   - File: `src/lib/workflow.ts` and session manager
   - Would hard-cap research threads at 25 ops, eliminating the 5.9% violation rate
   - This is the only reliable fix for prompt budget cap failures

2. **gym-batch.sh dispatch path integration** (MEDIUM — covers coach gym sessions)
   - Wire into growth-cycle.ts prompt or experiment template workflow
   - Context.md mentions have proven ineffective (0% adoption over 4+ checks)
   - Would save ~46 ops per gym-heavy experiment session

3. **session-query.ts adoption** (LOW — marginal savings per investigation)
   - Saves ~10-15 ops per investigation session
   - Requires fixing may.db backend first (currently 0 rows in production DB)
   - Lower priority since investigations happen less frequently than gym runs

### What NOT to Do

- ❌ Don't add more prompt text about budgets — text caps are 89-94% effective and adding more won't fix the remaining failures
- ❌ Don't restructure heartbeat or workflow steps — structural changes cause regressions (KE-008)
- ❌ Don't skip heartbeats for coach — the gym sessions are dispatched from heartbeats, and heartbeats need to keep firing

---

## Related Findings

- `finding-bob-93op-cap-violation-0412.md` — D-o-R P1 budget cap violation analysis
- `finding-bob-research-thread-structure-0412.md` — research thread cost center analysis
- `finding-bob-research-postfix-measurement-0412b.md` — post-cap measurement (n=1)
- `finding-coach-investigation-tool-gaps-0412.md` — convention investigation archetype
- `finding-coach-work-session-cost-analysis-0412.md` — coach work session cost drivers
- `finding-coach-experiment-cost-scouting-0412.md` — experiment cost analysis
- `finding-gym-batch-adoption-0411.md` — gym-batch.sh zero adoption
- `finding-tool-adoption-patterns-0412.md` — adoption only works via dispatch path, not context.md
