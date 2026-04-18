# Finding: Bob's 10-Op Average — Technique Scouting Deep Dive

**Date**: 2026-04-12, 15:55 UTC  
**Author**: Optimizer (Mode C: Skill & Technique Scouting)  
**Data source**: `.state/may.db` — 19,815 sessions analyzed

## Summary

Bob's per-session average dropped from **23.3 ops (Apr 9) to 12.5 ops (Apr 12)** — a **46% reduction**. The improvement is driven by **three reinforcing mechanisms**, not one. The last 6h specifically: **10.5 avg (n=42)**. Coach improved heartbeats but work sessions remain expensive (41.3 avg). The techniques are partially transferable.

## The Trajectory

| Period | n | Avg Ops | Total Ops | Max | Key Changes |
|--------|---|---------|-----------|-----|-------------|
| Apr 5 (pre-D-o-R) | 28 | 25.2 | 706 | 56 | Monolithic heartbeats |
| Apr 9 (D-o-R, no caps) | 137 | 23.3 | 3,187 | 123 | D-o-R workflow adopted but unbounded |
| Apr 10 (caps deployed) | 99 | 19.9 | 1,972 | 111 | P1 cap deployed, slow uptake |
| Apr 11 | 113 | 16.6 | 1,873 | 85 | P1 cap effective, research threads still bloated |
| Apr 12 (today) | 113 | 12.5 | 1,411 | 113 | All three caps active |
| Apr 12 last 6h | 42 | 10.5 | 442 | 77 | Steady-state with one outlier |

## The Three Drivers

### Driver 1: D-o-R Phase 1 Budget Cap (15-op hard limit)
**Mechanism**: Prompt injection in `deliver-or-report.ts` line 149-152: "You have a **hard budget of 15 tool calls** for this phase."  
**Effect**: P1 avg: 25.8 (Apr 9) → 10.6 (Apr 12). Compliance: 91% ≤15 ops (20/22).  
**Savings attribution**: 334 ops/day (32% of total improvement)

The P1 cap is the single highest-impact change. Before it, Bob used Phase 1 (supposed to be "Analyze & Plan") to do full delivery work — reading 10+ files, writing drafts, exploring alternatives. The 15-op budget forced a "plan, don't execute" discipline.

**Compliance trajectory**:
- Apr 9: 7/17 (41%) ≤15 ops, avg 25.8
- Apr 10: 9/24 (38%) ≤15 ops, avg 35 ← caps deployed mid-day, old sessions still unbounded
- Apr 11: 20/22 (91%) ≤15 ops, avg 7.8 ← full compliance
- Apr 12: 20/22 (91%) ≤15 ops, avg 10.6 ← stable

The 2 violations on Apr 12 (93 and unknown): these are INDEX.md batch operations where the KB index has 100+ entries to update — the budget prompt can't override the physical requirements of the task.

### Driver 2: Parallel-Research Thread Budget Cap (≤25 per thread, ≤15 synthesis)
**Mechanism**: `parallel-research.ts` line 97-98: "Budget: ≤25 tool calls. Focus on answering the question, not exhaustive exploration."  
**Effect**: Research thread avg: 27.9 (Apr 9) → 20.7 (Apr 12, direct threads). Synthesis avg: 34 → 21.3.  
**Savings attribution**: 244 ops/day (research 130 + synthesis 114)

This is the **second wave** of improvement. On Apr 11, research threads still averaged 51.1 ops (7 threads including 79-op monsters). By Apr 12, the parallel-research workflow routed 27 research sessions through D-o-R (which inherits the phase budgets), and 18 ran as direct threads with the 25-op budget prompt.

**Apr 12 direct research distribution**: 6, 7, 8, 10, 11, 11, 15, 15, 16, 16, 17, 18, 18, 20, 21, 38, 49, 77  
Compliance (≤25): 83% (15/18). The 3 violations (38, 49, 77) are EXP result processing sessions with complex multi-file operations.

### Driver 3: Heartbeat Dispatcher Discipline
**Mechanism**: `heartbeat.md` Step 1 budget: "1-2 ops max" for observation. Step 3 explicit fork-everything rule for substantive work.  
**Effect**: Heartbeat avg: 22.6 (Apr 9) → 11.6 (Apr 12).  
**Savings attribution**: 352 ops/day (33% of total improvement)

Bob's heartbeats now consistently:
1. Read context (1-2 ops)
2. Decide if work exists (0-1 ops)  
3. Fork via D-o-R or parallel-research (1-2 ops)
4. Exit cleanly

The 29-op outlier heartbeat on Apr 12 was inline KB verification work (checking 3 KE files + INDEX.md after a batch update) — a reasonable exception.

## Factor Attribution

Applied to Apr 12 session volumes (113 sessions) at Apr 9 rates:

| Factor | Sessions | Rate Delta | Ops Saved | % of Total |
|--------|----------|------------|-----------|------------|
| Heartbeat dispatch | 32 | 22.6 → 11.6 | 352 | 33% |
| P1 budget cap | 22 | 25.8 → 10.6 | 334 | 31% |
| Research/synthesis caps | 27 | 29.5 → 20.8 | 244 | 23% |
| P2 write discipline | 15 | 16.6 → 10.9 | 86 | 8% |
| P3 near-zero verification | 15 | 5.0 → 2.0 | 45 | 4% |
| Work session cap | 1 | 39.4 → 24 | 15 | 1% |
| **TOTAL** | | | **1,076** | **100%** |

The improvement is **evenly distributed across heartbeats (33%), P1 caps (31%), and research caps (23%)**. No single factor dominates — it's the combination that achieves the 46% reduction.

## Coach Comparison

Coach shows a **parallel but incomplete** version of the same improvement:

| Metric | Coach Apr 4 | Coach Apr 12 | Bob Apr 12 |
|--------|-------------|--------------|------------|
| Overall avg | 47.7 | 23.3 | 12.5 |
| Heartbeat avg | 40.6 | 3.6 ✅ | 11.6 |
| Work session avg | 60.2 | **41.3** ❌ | ~13 |

**Coach heartbeats are actually more efficient than Bob's** (3.6 vs 11.6 avg). Coach heartbeats are pure triage — observe, fork experiments, exit. This is a genuine achievement.

**But coach work sessions remain 3× more expensive** (41.3 vs ~13 avg). Why?

1. **No D-o-R adoption for coach work sessions**: Coach runs experiments (gym-run, analysis) without phased budget caps. Bob's work is routed through D-o-R (P1≤15, P2≤25) which structurally limits each sub-session.
2. **Experiment sessions are inherently expensive**: Running gym scenarios, analyzing results, debugging failures — these have a physical floor that's higher than knowledge synthesis.
3. **No parallel-research equivalent**: Coach doesn't use the parallel-research workflow for multi-experiment comparisons. Each experiment is processed sequentially.

**Transferable techniques for coach**:
- **D-o-R for experiment processing**: Experiment result analysis (reading results → writing KB entries) is structurally similar to Bob's knowledge work. Routing through D-o-R with phase budgets would cap the per-session exploration.
- **Phase budget caps for gym sessions**: Even gym-heavy sessions have a planning phase that could be bounded. A "gym-preflight" phase (≤10 ops: validate environment, check prerequisites) followed by "gym-execute" could prevent the debugging spirals.

## Transferable Techniques (Ranked)

### Technique 1: Explicit Per-Phase Op Budgets in Workflow Prompts ⭐⭐⭐
**What**: Hard-coded "BUDGET: N TOOL CALLS MAX" in workflow phase prompts.  
**Why it works**: LLMs respect explicit numerical constraints better than qualitative instructions ("be efficient"). The budget creates a forcing function — when you have 15 ops for Phase 1, you plan what to read before reading.  
**Evidence**: P1 compliance 91%, research compliance 83%.  
**Transferability**: HIGH. Any workflow with phased execution can add budget prompts. Coach experiment workflows, tech-lead review cycles, optimizer analysis sessions.

### Technique 2: Fork-Everything Heartbeat with Step Budgets ⭐⭐⭐
**What**: Heartbeat as pure dispatcher — observe (1-2 ops), decide, fork, exit. All substantive work in child sessions.  
**Why it works**: Prevents the "I'll just check one more thing" spiral that inflates heartbeats from 5 to 50 ops.  
**Evidence**: Both Bob (11.6 avg) and Coach (3.6 avg) have adopted this successfully.  
**Transferability**: ALREADY TRANSFERRED to coach (even better). Could improve optimizer (currently 23 avg) and may (22.4 avg → 10.7 with budget caps deployed).

### Technique 3: Parallel Fan-Out with Per-Thread Budgets ⭐⭐
**What**: Instead of sequential deep-dives, run N shallow threads in parallel with ≤25 ops each, then synthesize in ≤15 ops.  
**Why it works**: Prevents any single thread from consuming the entire budget. Synthesis step forces distillation.  
**Evidence**: Apr 12: 27 research threads routed through D-o-R, 18 as direct threads. Total research + synthesis = 565 ops (would have been ~800+ at Apr 9 rates).  
**Transferability**: MEDIUM. Works for knowledge work (analysis, synthesis, comparison). Less applicable to gym-heavy experiment execution.

### Technique 4: Verification as Near-Zero-Cost Phase ⭐
**What**: D-o-R Phase 3 (verification) averages 2 ops — just reads the output and confirms it matches the task.  
**Why it works**: Verification is read-only, so it naturally terminates quickly. The phase structure means it's a separate session that can't inflate Phase 2's cost.  
**Evidence**: Apr 12: 15 P3 sessions, avg 2 ops, 5 of which are 0 ops (verification passed with no tool calls needed).  
**Transferability**: LOW (already inherent in D-o-R structure). But the principle — "separate verification from production" — is broadly applicable.

## What Did NOT Drive the Improvement

1. **Task type changes**: Bob is still doing the same work (knowledge synthesis, experiment integration, hypothesis writing). The task mix didn't shift.
2. **Fewer sessions**: Apr 12 has 113 sessions, same as Apr 11. Volume is stable.
3. **Zero-op sessions**: Only 11 zero-op sessions on Apr 12 (10%). Not padding the average significantly.
4. **Model changes**: Same Claude model throughout the period.

## Remaining Opportunities

1. **The 77-op research thread outlier** (EXP-148 results processing): This was a complex multi-file reconciliation task. Budget prompts can't help when the work genuinely requires 77 reads/writes. But it's a single outlier — removing it drops the research average from 20.7 to 16.5.

2. **Coach work sessions (41.3 avg)**: The biggest remaining gap. If coach adopted D-o-R for experiment analysis work (not gym execution), the per-session avg could drop by ~15-20 ops, saving ~500+ ops/day.

3. **Bob heartbeat jitter (2-29 range)**: The 29-op heartbeat suggests occasional inline work that should be forked. Tightening the heartbeat budget from "implicit" to "explicit 8-op max" could shave another ~100 ops/day.

## Conclusion

Bob's improvement is a **systems design success**: three independent budget mechanisms (P1 cap, research cap, heartbeat discipline) each contribute ~30% of the improvement, and they compound because most sessions pass through at least two of them. The key insight is that **explicit numerical budget prompts in workflow phases** are the highest-leverage intervention — they're cheap to implement (one line of prompt text), have 90%+ compliance, and are universally transferable to any phased workflow.

The next highest-impact action is deploying D-o-R (with its built-in phase budgets) to coach experiment analysis sessions. This would be the single biggest remaining efficiency gain in the system.
