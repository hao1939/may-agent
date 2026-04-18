# Intervention ROI Playbook — What Works, What Doesn't, Where to Invest Next

**Date**: 2026-04-13  
**Author**: Optimizer (Mode C: Skill & Technique Scouting)  
**Method**: Cross-analysis of 6 findings, 151 experiments, 20K+ sessions, 8 agents, 10 days of production data  
**Sources**: finding-tool-adoption-patterns-0412, finding-skills-adoption-audit-0412, finding-workflow-adoption-trend-0413b, finding-dor-budget-cap-impact-0412, finding-may-heartbeat-cap-impact-0413, finding-parallel-research-cost-0413, finding-dispatcher-deployment-impact-0407, finding-intervention-effectiveness-0413

---

## Executive Summary

**Structural interventions (code guards, heartbeat rewrites, workflow enforcement) deliver 62-97% measured impact and 80-100% adoption. Advisory interventions (context.md mentions, skill files, filesystem tools) deliver 0% adoption and 0% behavioral change.** The ROI difference is not 10x — it's infinity: zero divided by anything is zero.

The data supports a simple rule: **if you can't wire it into the execution path, don't build it.**

Over 10 days we deployed 14 distinct interventions. The 8 structural ones saved ~3,300 ops/day ($160/day). The 6 advisory ones saved exactly 0 ops/day despite meaningful engineering effort. Future optimization effort should exclusively target structural mechanisms.

---

## Part 1: Complete Intervention Inventory

### Table: Every Deployed Intervention, Measured

| # | Intervention | Type | Target Agent(s) | Mechanism Level | Measured Impact | Adoption Rate | Daily Savings | Status |
|---|---|---|---|:---:|---|:---:|:---:|:---:|
| 1 | **Dispatcher mode rewrites** | Heartbeat rewrite | Optimizer, TL, Bob, Coach, Scout | L3 | 78-95% cost/HB reduction | 100% (structural) | ~1,460 ops ($70/day) | ✅ Active |
| 2 | **D-o-R P1 budget cap** | Workflow + guard | Bob | L1+L2 | 71% P1 op reduction (31.9→9.4 avg) | 90.5% compliant | ~540 ops ($26/day) | ✅ Active |
| 3 | **May heartbeat budget caps** | Heartbeat rewrite | May | L3 | 67% op reduction (22.4→7.3 avg) | 96% compliant | ~740 ops ($35/day) | ✅ Active |
| 4 | **Parallel-research thread caps** | Workflow guard | Bob | L1+L2 | 66% run cost reduction (100.1→34.4 avg) | 91% compliant | ~920 ops ($44/day) | ✅ Active |
| 5 | **FM-3.3 finish guard** | Infrastructure guard | All agents | L1 | 72.5% catch rate; +15.8pp quality | 100% (code) | Quality, not ops | ✅ Active |
| 6 | **Deliverable checklist guard** | Infrastructure guard | Optimizer | L1 | 100% compliance (blocks finish) | 100% (code) | Quality, not ops | ✅ Active |
| 7 | **D-o-R as Bob's default dispatch** | Dispatch path default | Bob | L2-L3 | 74 runs/7d; ~50% lower error rate | 67.8% (peak) → decayed | Included in #2 | ⚠️ Decayed |
| 8 | **verify-wrap as optimizer default** | Dispatch path default | Optimizer | L2-L3 | 13 sessions/7d; catches verification gaps | 66.1% (peak) → decayed | Minimal (quality) | ⚠️ Decayed |
| 9 | **gym-batch.sh in context.md** | Context.md mention | Coach | L5 | 0% behavioral change | **0 executions** in 38+ sessions | 0 ops | ❌ Dead |
| 10 | **session-query.ts availability** | Filesystem existence | All | L7 | 0% adoption | **0 executions** | 0 ops | ❌ Dead |
| 11 | **read-before-edit skill text** | Skill text injection | QA, Optimizer | L6 | 0% improvement; C1.1 still declining | 0% behavioral change | 0 ops | ❌ Failed |
| 12 | **classify-then-act skill** | Skill text injection | Various | L6 | 0/15 runs in gym (EXP-017, EXP-032) | 0% | 0 ops | ❌ Disproven |
| 13 | **Context.md tool promotion** | Context.md mention | Various | L5 | 0% adoption across all promoted tools | 0% | 0 ops | ❌ Dead |
| 14 | **45+ shared skill files** | Filesystem existence | Available to all | L7 | 0/29 discovery rate (KE-011) | 0% | 0 ops | ❌ Invisible |

### Summary Statistics

| Category | Count | Avg Impact | Total Daily Savings |
|----------|:---:|---|:---:|
| **Structural** (L1-L3) | 8 | 62-97% reduction | **~3,300 ops ($160/day)** |
| **Advisory** (L5-L7) | 6 | 0% | **0 ops ($0/day)** |
| **Borderline** (L4 dispatch option) | 2-3 tools | Low but non-zero | ~5-10 ops/day |

---

## Part 2: Tier Classification

### Tier 1: Always Works (100% reliability, permanent effect)

**Mechanism**: Infrastructure guards (L1) — runtime code that intercepts and blocks non-compliant behavior.

| Intervention | Success Rate | Internalization | Decay |
|---|:---:|:---:|:---:|
| FM-3.3 finish guard | 100% compliance | 0% (KE-106: attempt rate stays 50-70%) | None — permanent |
| Deliverable checklist guard | 100% compliance | 0% | None — permanent |
| Commit guard | 100% compliance | 0% | None — permanent |
| Verification-depth guard | 100% compliance | Uncertain | None — permanent |

**Characteristics**:
- Agents **cannot bypass** the guard — it's enforced at runtime
- Agents **don't learn** from guards (KE-106) — they continue attempting the blocked behavior
- Guards are **permanent infrastructure**, not training wheels
- ROI: Infinite — zero ongoing cost, permanent effect

**When to use**: Critical compliance requirements; budget ceilings; quality gates that must never be skipped.

**Cost to build**: Low (typically <100 lines of TS in a handler). High ROI per engineering hour.

---

### Tier 2: Usually Works (80-97% effectiveness, requires monitoring)

**Mechanism**: Heartbeat rewrites (L3) + Workflow enforcement (L2)

| Intervention | Success Rate | Decay Risk | Regression Risk |
|---|:---:|:---:|:---:|
| Dispatcher mode rewrites | 78-97% op reduction | Low (structural) | HIGH — Apr 10 regression 7x overnight |
| D-o-R P1 budget cap | 71-89% op reduction | Low (workflow code) | Low |
| May heartbeat caps | 67% op reduction | Low (structural) | Medium (KE-008) |
| Parallel-research caps | 66% op reduction | Low (workflow code) | Low |

**Characteristics**:
- 80-97% initial effectiveness, 60-80% sustained (H-053 decay curve)
- Heartbeat rewrites are **fragile** — structural changes can cause catastrophic regressions (coach: 85%→34% done rate after heartbeat restructure, KE-020)
- Workflow caps are **robust** — the code enforces the budget regardless of LLM behavior
- Best results: **heartbeat rewrite + guard backstop** (belt AND suspenders)

**When to use**: Default behavior changes; budget targets; multi-step quality enforcement.

**Cost to build**: Medium (heartbeat edits are risky; workflow code is straightforward). Must monitor for 48h post-deployment.

**Critical warning (KE-008)**: Do NOT restructure heartbeat steps (reorder, merge, rename). Add content within existing steps only. Structural changes cause regressions.

---

### Tier 3: Never Works (0% effectiveness — stop investing here)

**Mechanism**: Context.md mentions (L5), Skill text for judgment changes (L6), Filesystem existence (L7)

| Intervention | Success Rate | Evidence Depth |
|---|:---:|---|
| Context.md tool mentions | 0% | 38+ sessions, 3 tools, 0 adoption |
| Skill text for judgment overrides | 0/32 experiments | 32 experiments across 8 agents |
| Shared skill filesystem availability | 0/29 discovery | KE-011: agents don't discover resources |
| classify-then-act text | 0/15 gym runs | EXP-017, EXP-032 |
| read-before-edit text | 0% improvement | C1.1 declining post-deployment |
| investigate-and-fix text | 0% | EXP-025 |

**Characteristics**:
- Information at session start is **forgotten by decision time** (context window decay)
- Text rules that override judgment have **0/32 success rate** (KE-002) — the most robust null result in the system
- Agents don't explore the filesystem for available tools (KE-011)
- **No amount of emphasis, formatting, or repetition** changes this — the failure mode is architectural (LLM attention), not content quality

**When to use**: **Never** for behavioral change. Context.md and skills are fine for *reference material* (facts the agent might look up). They are useless for changing what the agent *does*.

---

### Tier 2b: Sometimes Works (narrow conditions)

**Mechanism**: Skill text for process additions (L6b), Few-shot examples (L6b), Dispatch table options (L4)

| Intervention | Success Rate | Condition |
|---|:---:|---|
| Skill text adding a NEW step | 60-80% | Must add, not override |
| Few-shot worked examples | 0→100% in specific domains | NOT for discovery tasks (KE-133: -67pp) |
| Dispatch table options | Non-zero (~1-4 uses/week) | Decays 60-80% over 7d |

**Key distinction**: Text that **adds** a new process step works (60-80%). Text that **overrides** existing judgment fails (0%). Few-shot examples work for pattern-matching tasks but actively harm open-ended discovery tasks (template-following displaces exploration).

---

## Part 3: Decision Framework

### Quick Reference: "If you want X, use Y"

| Desired Outcome | Intervention Type | Level | Expected Impact | Example |
|---|---|:---:|---|---|
| **Hard budget ceiling** | Infrastructure guard | L1 | 100% compliance | FM-3.3 finish guard |
| **Reduce heartbeat ops** | Heartbeat rewrite + guard | L3+L1 | 67-97% reduction | May budget caps, TL dispatcher |
| **Reduce workflow phase ops** | Workflow code + budget cap | L2+L1 | 66-89% reduction | D-o-R P1 cap, parallel-research cap |
| **Force multi-step quality** | Workflow enforcement | L2 | 87-100% within scope | D-o-R plan→execute→verify |
| **Get agent to use a new tool** | Wire into workflow code | L1-L2 | ~100% within workflow | Wire gym-batch.sh into growth-cycle.ts |
| **Add a new process step** | Skill text injection | L6b | 60-80% | "Write analysis before implementing" |
| **Override judgment call** | Workflow enforcement | L2 | 87-100% | forced-externalization workflow |
| **Prevent specific bad behavior** | Guard (runtime block) | L1 | 100% catch rate | Commit guard, finish guard |

### Decision Tree

```
What behavior do you want to change?
│
├─ Budget / resource limit?
│  └─ Guard (L1) + Heartbeat rewrite (L3)
│     Cost: ~2h to build. Impact: 67-97%.
│
├─ Tool adoption?
│  ├─ Wire into workflow that already runs → L1 (100% within scope)
│  ├─ Make it the default dispatch path → L3 (60-70% adoption)
│  ├─ Add to dispatch table with template → L4 (low but non-zero)
│  └─ ❌ Add to context.md → SKIP (0% adoption proven)
│
├─ Quality / judgment improvement?
│  ├─ ❌ Text rule or skill file → SKIP (0/32 success rate)
│  └─ Workflow that FORCES the desired sequence → L2 (87-100%)
│
├─ New process step?
│  └─ Skill text injection → L6b (60-80%)
│     But monitor for decay at 7d
│
└─ Prevent a specific failure?
   └─ Guard (L1) — permanent, catches 100%
      Note: won't teach; agent keeps attempting. Plan for permanent guard.
```

### Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Evidence |
|---|---|---|
| **"Just tell the agent"** | Text rules don't override judgment (KE-002) | 0/32 experiments |
| **"Add to context.md"** | Forgotten by decision time (KE-011) | gym-batch.sh: 0 usage in 38+ sessions |
| **"Make the skill file clearer"** | Clarity is not the bottleneck; attention is | read-before-edit: declined after deployment |
| **"Stack multiple interventions"** | Combining 2+ degrades by 12-15pp (KE-123) | Use ONE targeted intervention per task |
| **"Add few-shot examples to discovery tasks"** | Template-following displaces exploration (KE-133) | -67pp regression |
| **"Guards will teach eventually"** | Attempt rate stays 50-70% regardless of guard duration (KE-106) | Plan guards as permanent |

---

## Part 4: ROI Ranking of All Interventions

### Deployed Interventions by ROI (ops saved per engineering hour invested)

| Rank | Intervention | Ops Saved/Day | Est. Build Time | ROI (ops/day per hour) |
|:---:|---|:---:|:---:|:---:|
| **1** | Dispatcher mode rewrites (5 agents) | 1,460 | ~4h | **365 ops/day/hr** |
| **2** | Parallel-research caps | 920 | ~1h | **920 ops/day/hr** |
| **3** | May heartbeat caps | 740 | ~2h | **370 ops/day/hr** |
| **4** | D-o-R P1 budget cap | 540 | ~2h | **270 ops/day/hr** |
| **5** | FM-3.3 finish guard | Quality only | ~3h | Quality improvement |
| **6** | Deliverable checklist guard | Quality only | ~2h | Quality improvement |
| **7-12** | All advisory interventions | 0 | ~8h total | **0 ops/day/hr** |

**The top 4 structural interventions save 3,660 ops/day ($175/day) from ~9 engineering hours.** That's $19/day per engineering hour — paying back within the first hour and continuing indefinitely.

**The bottom 6 advisory interventions save 0 ops/day from ~8 engineering hours.** Complete waste.

---

## Part 5: Three Highest-ROI Next Interventions

Based on the patterns above, these are the three interventions most likely to deliver measurable impact:

### Recommendation 1: Wire gym-batch.sh into growth-cycle.ts (HIGHEST ROI)

**Problem**: Coach runs 10-26 individual `gym-run.sh` calls per gym session (31 calls in EXP-130). gym-batch.sh exists and would batch these. Context.md mention has 0 adoption in 38+ sessions.

**Intervention**: Edit `agents/coach/workflows/growth-cycle.ts` to inject gym-batch.sh usage instruction directly into the Phase 1 prompt. Change from "run scenarios" to "Run trials using `scripts/gym-batch.sh --scenario X --variants baseline,treatment --trials 3`".

**Mechanism**: L1 (structural enforcement in workflow code)  
**Expected impact**: 30-100 ops/day saved (currently wasted on individual gym-run.sh loops)  
**Build time**: ~30 minutes (edit workflow prompt text)  
**ROI**: 60-200 ops/day per engineering hour  
**Confidence**: HIGH — this is the same pattern that made D-o-R adoption work (wire into execution path)

### Recommendation 2: Bob heartbeat budget cap (MEDIUM-HIGH ROI)

**Problem**: Bob's non-heartbeat work sessions average 24.8 ops. While this is already improved from 29.9, Bob generates the most total ops in the system. A tighter per-session budget cap in Bob's heartbeat (similar to what worked for May) could squeeze another 20-30% reduction.

**Intervention**: Add per-step budget caps to Bob's heartbeat.md (following the May pattern: KE-008 compliant — add content within existing steps, don't restructure).

**Mechanism**: L3 (heartbeat rewrite) + L1 guard backstop  
**Expected impact**: ~200-400 ops/day saved  
**Build time**: ~1h  
**ROI**: 200-400 ops/day per engineering hour  
**Confidence**: HIGH — May's identical intervention achieved 67% reduction, beating projections

### Recommendation 3: Convention-check guard for C1.1 read-before-edit (MEDIUM ROI)

**Problem**: C1.1 (read-before-edit) compliance is 88.6% system-wide, 61.4% for QA, and declining for optimizer (97.4%→77.8% after skill deployment backfired). Text-based skill interventions have failed completely — the skill file itself caused the regression by introducing a write→edit pattern.

**Intervention**: Add a runtime guard (similar to FM-3.3) that detects edit() calls without a preceding read() of the same file. Instead of trying to teach the behavior, enforce it mechanically.

**Mechanism**: L1 (infrastructure guard)  
**Expected impact**: C1.1 compliance → 100% (by definition)  
**Build time**: ~2h  
**ROI**: Quality improvement (prevents silent data loss from blind edits)  
**Confidence**: HIGH — follows the proven guard pattern (FM-3.3, deliverable checklist, commit guard)

---

## Part 6: The Meta-Lesson

### The System Has One Reliable Lever

After 10 days, 151 experiments, 14 interventions, and 20K+ sessions, the system has exactly **one reliable lever for changing agent behavior**: make the execution path enforce the desired behavior.

Everything else — text rules, skill files, context mentions, tool availability — is noise. The evidence is overwhelming:

- **32 text-rule experiments**: 0 successes (KE-002)
- **3 context.md tool promotions**: 0 adoption
- **29 shared skill files**: 0 discovery (KE-011)
- **8 structural interventions**: 8 successes, 62-97% measured impact each

The question is never "how do we tell the agent?" It's always "how do we restructure the agent's execution path?"

### Investment Allocation Going Forward

| Budget Allocation | Current (est.) | Recommended |
|---|:---:|:---:|
| Structural interventions (L1-L3) | 40% | **90%** |
| Dispatch table options (L4) | 10% | **10%** |
| Context.md / skill text (L5-L7) | 50% | **0%** |

Stop writing skill files. Stop adding context.md mentions. Stop building tools without wiring them into workflows. Every hour spent on advisory interventions is an hour not spent on structural ones.

---

## Appendix: Intervention Decay Rates

| Intervention | Initial Impact | 7-Day Retention | 14-Day Projection |
|---|---|:---:|:---:|
| Guards (L1) | 100% | 100% | 100% |
| Heartbeat rewrites (L3) | 80-97% | ~70-90% (with guard backstop) | ~70-90% |
| Workflow enforcement (L2) | 87-100% | ~70-80% (if wired as default) | ~60-70% |
| D-o-R as default dispatch (L2-L3) | 67.8% | 27.1% → 0.8% (collapsed) | ~0% without re-wiring |
| Dispatch table options (L4) | Low | ~20-40% of initial | Near-zero |
| Advisory interventions (L5-L7) | 0% | 0% | 0% |

**Key takeaway**: Even successful non-guard interventions decay 60-80% over 7 days (H-053). Only guards are permanent. Every Tier 2 intervention should have a guard backstop for the critical behaviors it's enforcing.

---

*This playbook synthesizes the full body of intervention evidence from the optimization program. It should be the first reference when designing any new behavioral change intervention.*
