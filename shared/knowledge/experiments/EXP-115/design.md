# EXP-115: FM-2.2 Completeness Checklist Guard for Optimizer — Design

**Status**: PHASE 1 COMPLETE — gym scenarios built and validated
**Date**: 2026-04-10
**Author**: Coach
**Type**: Analysis + intervention design + gym scenario
**Prerequisite**: EXP-113 (FM-Heavy Workers analysis)
**Related**: EXP-114 (FM-2.1 approach guard), EXP-110 (commit guard), KE-007 (structural enforcement), KE-010 (ceiling effects)

---

## Motivation

EXP-113 identified FM-2.2 (incomplete deliverables) as optimizer's **dominant failure mode**:
- 51% of optimizer FM-Heavy Worker sessions have FM-2.2
- FM-2.2 is the **#2 cascade trigger** in the system (80 first-appearances, 2.19 subsequent FMs)
- Optimizer is the **#2 improvement opportunity** after coach (25.1% of FM-Heavy Workers)
- EXP-113 Priority #2 intervention: "Completeness checklist for optimizer"

**Can we build a structural guard that forces optimizer to verify all task deliverables before finishing?**

---

## Pre-Design Analysis: What IS FM-2.2 for Optimizer?

### Data Source

Queried may.db for all non-heuristic optimizer evaluations with FM-2.2 (N=35 unique sessions, 39 issue instances across 189 total optimizer evals = **27.0% FM-2.2 rate**).

### Critical Discovery: FM-2.2 Is Dominated by Pipeline Failures

| Category | N (issue instances) | % | Description |
|----------|:---:|:---:|-------------|
| **Missing required deliverable** | 16 | **41%** | INSTRUCTION_NONCOMPLIANCE, WORKFLOW_BREAK, SCOPE_DRIFT — agent didn't produce the file/change the task asked for |
| **Wrong deliverable target** | 8 | **21%** | WRONG_FILE_TARGET, PROCESS_SCOPE_LEAK, CONSTRAINT_COLLISION/MISMATCH — produced output to wrong file or didn't adapt when blocked |
| **Incomplete implementation** | 7 | **18%** | INSUFFICIENT_EVIDENCE, INSUFFICIENT_VERIFICATION, SLIPPERY_EDIT, INCORRECT_DELTA — did the right thing but didn't complete it |
| **Phase/pipeline failure** | 4 | **10%** | PHASE_CONTAMINATION — Phase 1 failed, Phases 2-4 inherit the failure |
| **Execution slip** | 4 | **10%** | ENV_ASSUMPTION, FAILED_RETRIEVAL, tool misuse, skipped tests |

### Key Insight: 66% of FM-2.2 Sessions Come From Skill Pipeline Tasks

| Task Type | N (sessions) | % |
|-----------|:---:|:---:|
| Skill pipeline (Phase 1-4) | 23 | **66%** |
| Brief-based (optimizer-brief.md) | 8 | **23%** |
| Heartbeat | 1 | **3%** |
| Other | 3 | **9%** |

The skill pipeline is a **4-phase workflow** where one failure in Phase 1 cascades to Phases 2-4, appearing as 4× FM-2.2 in the data. After deduplication:
- **7 pipeline failures** generate **28 of 39 issue instances** (72%)
- **11 standalone FM-2.2 issues** account for the rest (28%)

**The true unique FM-2.2 failure rate is ~18 distinct events across 35 sessions**, not 39.

### Co-occurring FM Codes

FM-2.2 rarely appears alone in optimizer sessions:

| Co-occurring FM | Rate | Relationship |
|:---:|:---:|-------------|
| **FM-3.3** | **67%** | Verification skipping co-occurs — incomplete work + no verification |
| **FM-2.1** | **61%** | Wrong approach leads to incomplete deliverables |
| FM-1.1 | 33% | Task misunderstanding causes wrong deliverables |
| FM-1.4 | 22% | Context loss leads to drift |

The FM-3.3 co-occurrence (67%) is the most actionable: **two-thirds of FM-2.2 sessions also skip verification**. The existing finish guard (FM-3.3) should already catch some of these, suggesting the FM-2.2 component is the *earlier* failure (incomplete work) that the FM-3.3 guard doesn't address.

### FM-2.2 Sub-type Detailed Breakdown

| Sub-type Tag | N | Example |
|-------------|:---:|---------|
| INSTRUCTION_NONCOMPLIANCE | 8 | Phase 1 said "do NOT create SKILL.md" but optimizer created it anyway |
| WORKFLOW_BREAK | 4 | Phase 1 required workspace/skill-discovery.md but it was never written |
| SCOPE_DRIFT | 4 | Wrote wrong deliverable filename (finding-analysis-review.md instead of skill-discovery.md) |
| PHASE_CONTAMINATION | 4 | Phase 2 found stale Phase 1 output — pipeline broke |
| PROCESS_SCOPE_LEAK | 4 | Phase 4 required editing each agent's SOUL.md but only edited optimizer's |
| SLIPPERY_EDIT_ACCEPTANCE | 3 | `sed` appended to wrong line, agent accepted the error as "fine" |
| INSUFFICIENT_EVIDENCE | 2 | Read file partially, concluded target text absent without grep/search |
| WRONG_FILE_TARGET | 1 | ENOENT on target file, implemented in different file without noting |
| CONSTRAINT_COLLISION | 1 | P98 blocked the edit, didn't adapt plan |
| CONSTRAINT_MISMATCH | 1 | Hit P53 boundary trying to edit cross-agent SOUL.md |
| CONSTRAINT_FRICTION | 1 | Grep for "SOUL.md" triggered P53 guard, wasted cycles |
| INSUFFICIENT_VERIFICATION | 1 | "Already present" claim without structural evidence |
| INCORRECT_DELTA | 1 | Misread what needed changing, overstated the delta |
| FAILED_RETRIEVAL | 1 | Out-of-range read offset, didn't recover |
| ENV_ASSUMPTION | 1 | Used `/home/user` path and `npx` (wrong env) |
| Tool misuse | 1 | 7 empty-arg tool calls at end of session |
| Other | 1 | Skipped test run after commit |

### Quality Distribution of FM-2.2 Sessions

| Quality Bucket | N | Avg Q |
|:---:|:---:|:---:|
| < 0.4 | 16 | 0.328 |
| 0.4 - 0.6 | 4 | 0.450 |
| 0.6 - 0.8 | 12 | 0.677 |
| 0.8+ | 3 | 0.833 |

FM-2.2 has a **bimodal quality distribution**: sessions either fail badly (Q<0.4, N=16) or succeed mostly (Q>0.6, N=15). The severe cases are mostly pipeline failures where Phase 1 goes wrong. The mild cases are brief-based tasks where one deliverable is slightly off.

---

## What Could Work?

### The Hook Point: `finish()`

Unlike FM-2.1 (which has no clear hook point — EXP-114 finding), **FM-2.2 has a perfect hook point: `finish()`**. This is the moment where the agent declares work complete. The existing finish guard already intercepts `finish(status: "success")` and checks for write evidence and verification evidence.

**A completeness guard would add a third gate**: check that the agent's deliverables list matches the task's required outputs.

### Three Candidate Mechanisms

| Mechanism | Description | Hook Point | Feasibility |
|-----------|-------------|:---:|:---:|
| **A: Task-Deliverable Cross-Check** | Extract required deliverables from task text, compare to `finish()` deliverables | `finish()` | 🟡 Requires NLP/LLM |
| **B: Forced Deliverable Checklist** | Agent must write CHECKLIST.md enumerating all deliverables before finish() | `finish()` | ✅ Structural |
| **C: File-Existence Verification** | Before finish(), verify each claimed deliverable actually exists on disk | `finish()` | ✅ Pure structural |

**Analysis**:

- **Mechanism A** requires understanding the task to know what deliverables are expected. This is an LLM judgment task — exactly the kind that text rules fail at (KE-002, KE-007). **Not recommended.**

- **Mechanism B** follows the proven forced-externalization pattern (KE-007, KE-034). By requiring the agent to *enumerate* what it should produce before finishing, it activates the analysis pathway. This caught 100% of sycophancy failures in EXP-043. However, EXP-114 Phase B showed forced externalization has ceiling effects — coach already passed 100% baseline on approach-validation-trap. **Risk: may also ceiling for optimizer.**

- **Mechanism C** is the most structural. The finish guard already checks for write evidence; this would extend it to verify each specific file in the deliverables array actually exists. It catches ghost deliverables (claiming files you didn't create) but NOT wrong-content deliverables. **Already partially addressed by Gate 0 of finish guard.** Limited new impact.

### Recommended: Mechanism B (Forced Deliverable Checklist) with Pre-Finish Enumeration

The strongest design combines forced externalization with the finish() hook:

1. **Before writing the final output**, agent must create `DELIVERABLES_CHECKLIST.md` that:
   - Lists every deliverable required by the task
   - States the current status of each (DONE / NOT DONE / BLOCKED)
   - For each DONE item, cites the file path and verification method

2. **This is NOT an LLM judgment check** — it's forced externalization. The act of writing the checklist is what prevents incompleteness, not the checklist being evaluated by software.

3. **The finish guard could optionally check** that DELIVERABLES_CHECKLIST.md exists as a deliverable, but the primary mechanism is behavioral: the enumeration itself surfaces gaps.

### Why This Might Work (and Why It Might Not)

**Reasons to expect success:**
- Forced externalization has the strongest track record (45/45, 100% across 9+ scenarios — KE-007)
- The `finish()` hook is proven (commit guard: 58% → 1%, finish guard: +51pp recovery)
- 41% of FM-2.2 is "missing required deliverable" — the exact failure that enumeration would catch
- 67% FM-3.3 co-occurrence suggests agents rush to finish without checking

**Reasons to expect failure:**
- EXP-114 Phase B: forced APPROACH.md showed ceiling (100% baseline, 100% treatment) — optimizer may already pass simple scenarios
- 66% of real FM-2.2 is from skill pipeline tasks which have complex multi-phase requirements — hard to replicate in a gym scenario
- KE-010: most scenarios hit ceiling for Claude Sonnet 4 on coding/implementation tasks
- The intervention addresses the *symptom* (missing deliverable) not the *cause* (context loss, instruction noncompliance, scope drift)

---

## Hypothesis

### H1: Forced Deliverable Enumeration Prevents Incomplete Deliverables in Gym

**Prediction**: Requiring optimizer to write DELIVERABLES_CHECKLIST.md before producing outputs will improve pass rate by ≥20pp on the `incomplete-deliverables-trap` scenario vs baseline.

**Test**: Gym scenario with baseline vs checklist variants, N=3 per variant.

**Risk**: Ceiling effect (KE-010). If baseline passes >80%, the scenario is too easy and the test is inconclusive.

### H2: The Dominant FM-2.2 Pattern Is "Missing Deliverable" Not "Wrong Content"

**Prediction**: >60% of optimizer FM-2.2 is structural incompleteness (files not created, requirements not addressed) rather than semantic incompleteness (files created but with wrong content).

**Already confirmed by analysis**: 41% missing deliverable + 21% wrong target + 10% phase contamination = **72% structural**. Only 18% is semantic incompleteness.

### H3: FM-2.2 Cascades From Earlier Failures

**Prediction**: In >50% of FM-2.2 sessions, FM-2.2 co-occurs with FM-2.1 or FM-1.1, suggesting incomplete deliverables are a downstream effect of wrong approach or task misunderstanding.

**Already confirmed by analysis**: FM-2.1 co-occurs in 61%, FM-1.1 in 33%. Combined: **~70% of FM-2.2 sessions have an upstream failure**.

---

## Gym Scenario Design: `incomplete-deliverables-trap`

### Concept

Optimizer receives a brief with **4 clearly stated required deliverables**. The task is structured so that:
1. The **first 2 deliverables are easy** and naturally flow from reading the brief
2. The **3rd deliverable requires a non-obvious intermediate step** (reading a different file to get data)
3. The **4th deliverable is conditional** ("if X, then also do Y") — easy to miss if not carefully reading

This mirrors the real FM-2.2 pattern: optimizer handles the straightforward parts but misses deliverables that require extra effort or careful reading.

The task is an **optimization brief** (optimizer's natural task type), not a coding task. This is critical because 23% of real FM-2.2 comes from brief-based tasks and these are the standalone failures (not pipeline cascades).

### Scenario Structure

**Task**: "Read `workspace/optimizer-brief.md` and execute all items."

**The brief asks for 4 things:**
1. ✅ Update `agents/optimizer/config.md` with new timeout value (easy — value is in the brief)
2. ✅ Add a new skill file `agents/optimizer/skills/batch-processing.md` with content from the brief (easy — content provided)
3. ⚠️ Update `agents/shared/philosophy.md` to add a new principle — but the principle text is in `workspace/supporting-data.md`, not in the brief itself (requires reading another file)
4. ⚠️ "If `agents/optimizer/LESSONS.md` contains any reference to the old timeout value, update it too" (conditional — requires checking, and the file DOES contain the reference)

**The trap**: Deliverables 1-2 are self-contained in the brief. Deliverable 3 requires following a reference ("see supporting-data.md for the principle text"). Deliverable 4 is conditional and requires checking a second file. An agent that reads the brief and immediately starts executing will likely miss 3 or 4.

**Red herring**: None needed. The difficulty is in the task structure itself — multiple deliverables with varying difficulty, not deception.

### Success Criteria

```
Product:
  P1: config.md updated with new timeout value (300 → 600)
  P2: batch-processing.md skill file created with correct content
  P3: philosophy.md updated with the new principle from supporting-data.md
  P4: LESSONS.md updated to reflect new timeout value (if old reference exists)

Behavioral:
  B1: Agent read supporting-data.md (required for deliverable 3)
  B2: Agent read or searched LESSONS.md (required for deliverable 4)
  B3: Agent listed ≥ 3 deliverables in finish() call

Efficiency:
  E1: Total operations ≤ 20
```

### Variant Design

| Variant | Scenario Name | Intervention | Expected Pass |
|---------|---------------|-------------|:---:|
| Baseline | `incomplete-deliverables-trap` | None — standard optimizer task | ~40-60% |
| Treatment | `incomplete-deliverables-trap-checklist` | Must write DELIVERABLES_CHECKLIST.md first | ~70-90% |

**Treatment variant modification**: The task.md adds at the top:
> **Before executing any changes**, create `DELIVERABLES_CHECKLIST.md` listing every deliverable required by the brief. For each item, note: the deliverable name, what file(s) to modify, and what information you need to find. Only begin implementation after the checklist is complete.

This is forced externalization (KE-007, KE-034): the agent must enumerate all deliverables *before* acting, which surfaces the less-obvious items (3 and 4) before the agent gets tunnel-visioned on the easy ones.

### Baseline Estimate and Ceiling Risk

**Ceiling risk assessment:**
- KE-010 says coding/implementation scenarios hit ceiling; behavioral scenarios don't
- This is an **implementation scenario** (edit files per brief), so ceiling risk is **HIGH**
- However, the task has 4 deliverables where 2 require indirect discovery, which adds behavioral complexity
- EXP-114 Phase B hit ceiling (100/100) — same structure (forced externalization test)
- **Mitigation**: If baseline > 80%, we'll know the scenario is too easy and the test is inconclusive — but the analysis will still be valuable

**Expected baseline**: 40-60% (optimistic). The "conditional deliverable" pattern (item 4) is the kind of detail agents often miss in production. But gym environments are simpler than production, which inflates pass rates.

**Fallback plan**: If ceiling is hit, we shift to a production-deployment approach:
1. Deploy the checklist as a structural addition to optimizer's workflow
2. Measure FM-2.2 rate before/after in production (like EXP-110 for commit guard)
3. This is lower-confidence than a gym test but may be the only viable measurement

---

## Implementation Plan

### Phase 1: Build Gym Scenario (this experiment)

Create two scenarios in `agents/gym/scenarios/`:

**`incomplete-deliverables-trap/`**:
- `scenario.json` — metadata, tags, agent_type: optimizer
- `task.md` — the brief execution task
- `environment/` — workspace with brief, supporting files, agent config files
- `success_criteria.js` — 7 checks (4 product, 2 behavioral, 1 efficiency)

**`incomplete-deliverables-trap-checklist/`**:
- Same as above but task.md includes forced enumeration instruction
- Success criteria adds: C1: DELIVERABLES_CHECKLIST.md exists

### Phase 2: Run Gym Trials

- 3 runs per variant (baseline + treatment) = 6 runs total
- Record pass rates, per-check results, and qualitative observations
- If baseline > 80%: INCONCLUSIVE (ceiling), shift to Phase 3
- If baseline < 80% and treatment ≥ baseline + 20pp: H1 CONFIRMED

### Phase 3: Production Guard (if gym confirms effect)

Build `createCompletenessGuard()` as a `beforeToolCall` hook:
- Intercepts `finish(status: "success")` for optimizer agent only
- Checks: does `DELIVERABLES_CHECKLIST.md` exist in the workspace?
- If not: block with message "Before finishing, enumerate your deliverables in DELIVERABLES_CHECKLIST.md"
- This is the lightest-weight structural intervention possible

**Alternative (if gym hits ceiling)**: Skip the guard, deploy as an optimizer skill/workflow instruction. Measure production FM-2.2 rate change. Less rigorous but avoids the ceiling problem.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|:---:|:---:|------------|
| Baseline ceiling (>80%) | **HIGH** | Test inconclusive | Fall back to production measurement (Phase 3 alt) |
| Forced checklist causes timeout | Low | Worse outcome | Keep checklist minimal (5 lines); EXP-114 showed no over-compliance risk |
| Scenario doesn't represent real FM-2.2 | Medium | Low external validity | Based on actual FM-2.2 sub-type analysis; brief-based tasks are 23% of real FM-2.2 |
| Pipeline FM-2.2 not addressed | **HIGH** | 66% of FM-2.2 untouched | Pipeline failures need pipeline-level fixes, not a gym scenario. Separate intervention track. |
| Checklist becomes cargo-cult compliance | Medium | No behavioral change | Monitor for agents that write checklist perfunctorily then still miss deliverables |

---

## What This Experiment Does NOT Address

1. **Pipeline FM-2.2 (66% of cases)**: The skill pipeline's 4-phase structure means one Phase 1 failure cascades to 3 more evaluations. This is a **workflow design problem**, not an agent behavior problem. Fix: improve the pipeline's error handling, not the agent's completeness checking.

2. **Constraint collision FM-2.2 (5% of cases)**: When optimizer hits P53/P98 permission boundaries and doesn't adapt. This is a **planning problem** — the agent needs to recognize when it can't do what's asked and pivot. The completeness checklist won't help here.

3. **Upstream cascade FM-2.2 (61% co-occur with FM-2.1)**: When FM-2.2 is caused by first taking the wrong approach. Fixing FM-2.1 would reduce FM-2.2 as a downstream effect. EXP-114's tool schema guard partially addresses this.

The completeness checklist targets the **18% of FM-2.2 that is standalone incomplete implementation** plus the **41% where the agent simply forgot a deliverable**. At best, this addresses ~59% of FM-2.2 instances (≈23 of 39 issue instances, or ~12 of 18 unique failure events).

---

## Success Criteria for This Experiment

| Criterion | Threshold | Measurement |
|-----------|-----------|-------------|
| Scenario discriminates | Baseline < 80% | Gym run pass rate |
| Treatment effect | ≥ 20pp improvement | Treatment - baseline pass rate |
| No over-compliance | Treatment doesn't increase ops by >50% | Op count comparison |
| Real FM-2.2 patterns represented | ≥ 2 of 4 sub-types present in failures | Qualitative analysis of baseline failures |

If baseline ≥ 80%: Experiment is **INCONCLUSIVE** (ceiling), not failed. We shift to production measurement.

---

## Next Steps

1. **Build gym scenarios**: `incomplete-deliverables-trap` and `incomplete-deliverables-trap-checklist`
2. **Run 3+3 gym trials**: Baseline then treatment
3. **Analyze results**: Per-check pass rates, qualitative failure patterns
4. **Decision gate**: If confirmed, build production guard. If ceiling, pivot to production A/B.

---

## Methodology Notes

- **Data source**: `.state/may.db`, 189 non-heuristic optimizer evaluations, 35 with FM-2.2
- **Sub-type classification**: Manual classification from evaluator issue text (39 FM-2.2 instances)
- **Deduplication**: 7 pipeline failure clusters generate 28/39 instances; 18 unique failure events
- **Architectural reference**: `src/lib/tools/compose-guards.ts`, `finish-guard.ts`, `commit-guard.ts`
- **Gym scenario template**: Based on `approach-validation-trap` (EXP-114) structure
