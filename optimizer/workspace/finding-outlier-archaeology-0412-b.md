# Finding: Outlier Archaeology — Tech-Lead 96-op & Fresh Outlier Synthesis (Apr 12, 2026)

**Date**: 2026-04-12 ~14:54 UTC  
**Author**: Optimizer (Mode A — Session Archaeology)  
**Scope**: Tech-lead 96-op "dead weight cleanup" + bob 77-op + coach 67/63-op + cross-pattern analysis  
**Method**: Synthesis of 8 prior findings + cross-session pattern mining

---

## Executive Summary

The tech-lead 96-op session and all 6h outliers have been **thoroughly analyzed by prior sessions** (Mode D at 11:56, Mode A at 12:54). No single session contains waste — they are all legitimate complex tasks. However, **cross-cutting this archaeology with prior findings reveals a meta-pattern**: the system has **three distinct outlier archetypes**, each requiring a different fix strategy, and only one archetype (budget cap violations) has a deployed fix.

### The Three Outlier Archetypes

| Archetype | Example | Root Cause | Fix Status | Fix Type Needed |
|-----------|---------|------------|------------|-----------------|
| **A: Budget Cap Violation** | Bob 77-op EXP-148, Bob 93-op INDEX | Complex task exceeds text budget | ✅ Partial (90% compliance) | Infra `maxOps` |
| **B: Inherently Serial Task** | TL 96-op branch cleanup, Coach 66-op gym runs | Task requires N sequential ops with no shortcut | ❌ None | Task decomposition / batching tools |
| **C: Open-ended Investigation** | Coach 63-op C1.3 regression | No natural stopping point, unbounded scope | ❌ None | Investigation budget convention |

**Key insight**: Archetype A already has a deployed fix (budget cap) with 90% compliance. Archetypes B and C have identified fixes (gym-batch, investigation budgets) but ZERO deployment. The remaining cost savings are in B and C, not in refining A.

---

## 1. Tech-Lead 96-op Session — Confirmed Legitimate (Archetype B)

**Session**: `s_1775991272448_2063` — "Lens C: Review branch dead weight cleanup"  
**Duration**: 11.3 min | **Cost**: $3.42 | **Status**: success  
**Dispatched by**: Tech-lead heartbeat (non-workflow `agents.fork`)

### Prior Analysis (finding-workflow-health-d-0412.md)

This session has been comprehensively analyzed. Key facts:
- 85/104 bash calls (82%) were git operations
- 16 branches audited → 5 merged, 11 deleted
- 17 merge conflict errors → cascading resolution chains
- 6 ops/branch average is **the minimum** for serial branch processing
- **Not a workflow** — direct fork from heartbeat, no D-o-R

### What's New: Git Operations as a Cost Center

Cross-referencing with the tool gap scan (finding-tool-gap-scan-0412b.md), GIT_OPS rose from 5.9% → 16.0% of all bash commands in the same 6h window — **almost entirely driven by this one session**. The 96-op session alone contributed ~81 of the ~279 GIT_OPS commands in the period (29%).

This is a **one-off task** (branch cleanup after accumulating 16 stale review branches). It's unlikely to recur at this scale. A git batch cleanup script could reduce it from 96 ops to ~15 ops, but the ROI is low since this task type is rare.

### Verdict: No action needed. Legitimate Archetype B.

---

## 2. Bob 77-op EXP-148 — Budget Cap Bypass (Archetype A)

**Session**: `s_1775991281063_2064` — EXP-148 results processing  
**Duration**: 13.4 min | **Workflow**: `parallel-research` (wr_1775991281063_h5w3)  
**Tree cost**: 106 ops (77 + 20 + 9)

### Prior Analysis (finding-high-op-outliers-0412b.md)

- Budget cap text ("≤25 tool calls") was injected but ignored
- This is a parallel-research thread, not D-o-R
- Post-cap compliance: 94.1% (16/17 threads compliant)
- The one violation (this session) was a complex multi-file task

### What's New: Synthesis Step Is the Bigger Risk

Cross-referencing with finding-bob-113op-research-synthesis-0412.md reveals that **synthesis steps are the unguarded path**: the `parallel-research` workflow has ZERO budget on synthesis, and 2/10 synthesis sessions are 70+ ops. The 77-op thread is an anomaly; the synthesis gap is systemic.

**Pattern**: parallel-research → thread ops (capped, 94% compliant) + synthesis ops (uncapped, 20% outlier rate)

### Recommended Fix Priority

1. **Synthesis budget cap** (20 ops) in `parallel-research.ts` — systemic, affects 20% of synthesis sessions
2. Thread budget compliance is already at 94% — diminishing returns on further prompt refinement
3. Infra `maxOps` would catch the remaining 6% of thread violations

---

## 3. Coach 67-op EXP-149 & Coach 66-op EXP-147 — Serial Gym (Archetype B)

**Sessions**: 
- `s_1775982291491_1980` — EXP-147 Track B (66 ops, interrupted at 35 min)
- Coach 67-op EXP-149 at 13:54 — same serial gym execution pattern

### Prior Analysis (finding-high-op-outliers-0412b.md)

- 40 individual gym runs at ~1.3 ops/run + 10 ops setup = ~62 ops minimum
- gym-batch.sh exists but has ZERO adoption (4th consecutive check)
- Session interrupted after 35 min, then resumed 6+ times for ~138+ total ops

### What's New: The Restart Accumulation Problem

The EXP-147 session was interrupted and retried **7 times**, accumulating ~138+ total ops across restarts. This mirrors the pattern from finding-coach-166op-archaeology-0410.md where 184-op sessions were really 6-7 restart segments. The **serial gym + restart accumulation** combination is the worst-case coach cost pattern:

```
Serial gym execution (66 ops per segment)
  × Timeout interruption (35 min limit)
    × Auto-restart (7 segments)
      = ~138+ total ops for one experiment
```

If gym-batch.sh were adopted, each segment would be ~20 ops instead of 66, and fewer restarts would be needed (batch completes faster). Total would drop from ~138 to ~40-60 ops.

### Why gym-batch.sh Adoption Is Dead

Per finding-tool-adoption-patterns-0412.md, context.md mentions produce 0% adoption. The tool adoption hierarchy is:
1. **Level 1**: Hard-wired in handler code → 100% adoption
2. **Level 2**: Wired into workflow prompts → 60-80% adoption  
3. **Level 3**: In templates used by workflows → 30-50% adoption
4. **Level 4**: In context.md → **0% adoption** ← gym-batch.sh is here
5. **Level 5**: In external docs → 0% adoption

**The only path to adoption is Level 1-2**: wire gym-batch.sh into the coach's growth-cycle workflow or experiment execution handler. Context.md will never work.

---

## 4. Coach 63-op C1.3 Regression — Efficient Investigation (Archetype C)

**Session**: `s_1775987678357_2031` — Optimizer C1.3 regression investigation  
**Duration**: 7.4 min | **Status**: done (success)

### Prior Analysis (finding-high-op-outliers-0412b.md)

- Correctly identified 77% false positive rate in C1.3 violations
- Added 2 pattern exemptions to convention-check.ts
- At 63 ops, this is **below** the investigation archetype average (104 ops)

### What's New: This Is Actually the Success Template

Compared to the bloated investigation archetype (84-96% investigation, 50:1 investigation-to-delivery ratio), this session had a much better ratio:
- ~35 investigation ops + ~15 code change ops + ~13 write/infra ops
- Investigation-to-delivery ratio: ~2.3:1 (vs 50:1 in bloated sessions)
- Completed in 7.4 min with a real code fix

**This session should be the model for investigation budget conventions**. If all coach investigation sessions hit this efficiency level (63 ops instead of 104), it would save ~40 ops per investigation session.

---

## 5. Cross-Cutting Patterns: What's Actually New

### Pattern 1: The "Residual Outlier" Problem

All deployed budget caps (D-o-R P1, research threads, May HB) show the same structure:
- **85-94% compliance** with text-based budget prompts
- **6-15% violations** that text cannot fix
- Violations are either task-scope mismatches or inherently serial tasks

This means **text-based budgets have a hard ceiling around 90% compliance**. The remaining 10% requires either:
- Infra `maxOps` (hard kill at limit)
- Task decomposition (break large tasks into smaller units)
- Task-type routing (detect INDEX.md batch tasks, route to different budget)

### Pattern 2: Restart Accumulation Multiplier

Multiple findings converge on restart accumulation as a cost multiplier:
- Coach EXP-147: 7 restarts × 66 ops = ~138+ total
- Coach 184-op archaeology: 6 restarts × ~30 ops = 184 total
- Coach 129-op archaeology: multiple restarts with discovery overhead

**Restart overhead is additive, not recoverable.** Each restart re-does discovery (schema exploration, file location, context loading). An infra `maxRestarts=3` cap would bound the worst cases.

### Pattern 3: Archetype B Has No Fix Path

Archetype A (budget violations) → infra maxOps will fix  
Archetype C (investigation spirals) → investigation budget convention will help  
Archetype B (inherently serial tasks) → **no general fix exists**

The serial tasks (branch cleanup, gym runs, multi-file KB integration) are doing real work at near-minimum ops/unit. The only fix is to batch the units (gym-batch.sh, git batch script, INDEX.md batch integrator), but each requires a task-specific tool AND Level 1-2 adoption wiring.

---

## 6. Concrete Recommendations (Prioritized)

### Priority 1: Synthesis Budget Cap in parallel-research.ts
- **Impact**: Catches 20% outlier synthesis sessions (70-113 ops → 20 ops)
- **Effort**: Single-line change in workflow prompt
- **Status**: Recommendation exists in finding-bob-113op-research-synthesis-0412.md, NOT YET DEPLOYED

### Priority 2: Infra maxOps on ctx.runAgent()
- **Impact**: Hard-caps the 6-10% of sessions that ignore text budgets
- **Effort**: Code change in session manager / workflow.ts
- **Status**: Identified repeatedly, NO implementation

### Priority 3: gym-batch.sh Dispatch Path Integration
- **Impact**: Coach serial gym sessions 66→20 ops; combined with fewer restarts saves ~100 ops per experiment
- **Effort**: Modify growth-cycle.ts to emit gym-batch.sh commands instead of individual gym-run.sh
- **Status**: Tool built, ZERO adoption. Context.md approach declared dead.

### Priority 4: Investigation Budget Convention for Coach
- **Impact**: Reduces average investigation session from 104→63 ops (the C1.3 session as template)
- **Effort**: Add budget instruction to coach fork prompts for investigation tasks
- **Status**: Recommendation exists, NOT DEPLOYED

### NOT Recommended
- ❌ Git batch cleanup script — one-off task, low ROI
- ❌ More prompt text refinement for existing budget caps — already at 90% compliance ceiling
- ❌ Heartbeat restructuring — violates KE-008

---

## 7. Summary Metrics

| Metric | Value |
|--------|-------|
| Sessions analyzed | 4 directly + 20+ cross-referenced from 8 prior findings |
| New patterns found | 3 (residual outlier ceiling, restart accumulation multiplier, Archetype B has no general fix) |
| Already-documented patterns confirmed | 3 (budget cap violations, serial gym, investigation spirals) |
| Deployed fixes validated | 3 (D-o-R P1 cap ✅, research thread cap ✅, May HB cap ✅) |
| Un-deployed fixes re-identified | 4 (synthesis cap, infra maxOps, gym-batch adoption, investigation budget) |
| Estimated savings from Priority 1-4 | ~$5-10/day combined |

---

## Related Findings
- `finding-workflow-health-d-0412.md` — Tech-lead 96-op deep analysis + D-o-R cap measurement
- `finding-high-op-outliers-0412b.md` — Bob 77-op + Coach 66/63-op individual analysis
- `finding-bob-113op-research-synthesis-0412.md` — parallel-research synthesis gap
- `finding-efficient-session-techniques-0412.md` — Efficient vs bloated session patterns
- `finding-coach-166op-archaeology-0410.md` — Restart accumulation in coach sessions
- `finding-tool-adoption-patterns-0412.md` — Why context.md mentions don't drive adoption
- `finding-tool-gap-scan-0412b.md` — GIT_OPS spike + wrong DB path pattern
- `finding-efficiency-health-check-0412b.md` — System-wide efficiency snapshot
