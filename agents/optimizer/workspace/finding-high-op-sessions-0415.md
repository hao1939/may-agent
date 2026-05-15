# Finding: High-Op Session Investigation — Apr 15

**Date**: 2026-04-15  
**Sessions**: coach 48-op (`s_1776234795917_39`), tech-lead 45-op (`s_1776243683921_46`)

## Summary

Both sessions are significantly above-average for their task types. The coach session is 8× the coaching-feedback average (48 vs 6 ops). The tech-lead session's total tree cost was **159 ops** (45 parent + 114 across 8 children), mostly spent on an unrelated bug fix that consumed the majority of the session.

---

## Session 1: Coach 48-op Convention Violation Analysis

| Metric | Value | Baseline |
|--------|-------|----------|
| Op count | 48 | 6 avg (coaching-feedback) |
| Status | interrupted (aborted) | — |
| Duration | 436s (~7.3m) | — |
| Children | 0 | — |
| Prior coaching-feedback | 14 ops, 29 ops | — |

### Task
Convention violation analysis — reviewing violations detected by the automated scanner, deciding interventions (skill-update, gym-scenario, soul-edit, or skip) for each agent.

### Analysis
- **No workflow delegation**: All 48 ops were inline in the parent session — no children, no workflows called.
- **Interrupted**: The session was aborted mid-work (outcome: "Let me synthesize my analysis and write my recommendations, then finish"). This means 48 ops of analysis work was lost.
- **Justified complexity**: Convention violation analysis involves reading multiple agents' violation data, cross-referencing with existing skills, deciding interventions. Previous runs were 14 and 29 ops — so this one is high but within range of the 29-op session. The 48-op count suggests it was tackling more agents or more complex violations.
- **Waste pattern**: Being interrupted means all 48 ops produced zero durable output. The session should have been writing incrementally (partial results) rather than accumulating everything in memory for a final synthesis.

### Verdict: **Partially justified, partially wasteful**
- The task complexity is real (multi-agent analysis), but 48 ops without any durable writes is a "big-bang synthesis" anti-pattern.
- Fix: Coach should write per-agent recommendations incrementally rather than accumulating all analysis in context for a final write.

---

## Session 2: Tech-Lead 45-op Oracle Generator Build

| Metric | Value | Baseline |
|--------|-------|----------|
| Parent op count | 45 | 21 avg (tech-lead build tasks) |
| Total tree ops | **159** (45 + 114 children) | — |
| Status | done | — |
| Duration | 425s (~7.1m) | — |
| Children | 8 sessions | — |

### Task
Build a scenario oracle generator script to auto-generate gym scenario expected outputs.

### Analysis — **Major task drift detected**

The parent session was tasked with building `scripts/scenario-oracle.sh`. However, **all 8 child sessions were about a completely different task**: "Fix verify-wrap ctx.agent bug — add defensive check in workflow-tool.ts for agentName being the string 'undefined'".

Child session breakdown:
1. coder (19 ops) — iteration 2 of verify-wrap bug fix
2. coder (19 ops) — iteration 2 of verify-wrap bug fix (duplicate!)
3. tech-lead (4 ops) — review iteration 2
4. tech-lead (20 ops) — review iteration 2 (duplicate!)
5. coder (11 ops) — iteration 3 of verify-wrap bug fix
6. tech-lead (9 ops) — review iteration 3
7. coder (17 ops) — iteration 3 of verify-wrap bug fix (another duplicate!)
8. tech-lead (15 ops) — review iteration 3 (another duplicate!)

**Key issues**:
1. **Task drift**: 114 of 159 total ops (72%) were spent on an unrelated bug fix, not the oracle script
2. **Duplicate spawns**: Multiple children appear to be duplicate iterations (same iteration number, same goal). This suggests a retry loop or workflow bug where work was spawned redundantly.
3. **Script was built**: Despite the detour, `scripts/scenario-oracle.sh` (7294 bytes) does exist — the primary deliverable was produced, likely in the 45 parent ops + one separate coder session (27 ops for the oracle specifically).

### Verdict: **Significantly bloated due to task drift + duplicate spawns**
- The oracle script build itself was likely ~45-70 ops (reasonable for a build task).
- The verify-wrap bug fix added ~114 ops that should have been a separate task.
- Duplicate child sessions (same iteration, same goal) suggest a workflow/tooling bug.

---

## Recommendations

### R1: Incremental write pattern for coach analysis sessions
Coach should write per-agent recommendations as it analyzes each agent, not accumulate everything for a final synthesis. This prevents total loss on interruption.
- **Impact**: Would have saved 48 ops of wasted work in this session.

### R2: Investigate duplicate child session spawning
Tech-lead spawned 2 copies of iteration 2 (coder), 2 copies of iteration 2 (review), 2 copies of iteration 3 (coder), 2 copies of iteration 3 (review). This doubling pattern suggests a bug in the persistent-task workflow where both quoted and unquoted variants of the goal are spawning separate sessions.
- **Impact**: ~57 ops wasted on duplicates (half of the 114 child ops).

### R3: Task scope discipline for tech-lead
Tech-lead should not bundle unrelated bug fixes into a build task. The verify-wrap ctx.agent bug should have been tracked as a separate request.
- **Impact**: Would keep the oracle build session at ~70 ops instead of 159.

---

## Raw Data

| Session | Agent | Type | Ops | Status | Children | Total Tree |
|---------|-------|------|-----|--------|----------|------------|
| s_1776234795917_39 | coach | coaching-feedback | 48 | interrupted | 0 | 48 |
| s_1776243683921_46 | tech-lead | build script | 45 | done | 8 (114 ops) | 159 |
