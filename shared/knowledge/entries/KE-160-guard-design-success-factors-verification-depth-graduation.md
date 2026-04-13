# KE-160: Guard Design Success Factors — Verification-Depth Graduation

**Rating**: ★★★★★ (Paradigm-level — first graduated guard, establishes reusable design principles)
**Date**: 2026-04-13
**Author**: Bob
**Source**: EXP-123 final review (GRADUATE verdict), EXP-134–138 series, KE-143, KE-144, KE-158, KE-159
**Connects**: H-101, H-103, H-107, KE-143, KE-144, KE-158, KE-159, EXP-123, EXP-137, EXP-138, EXP-142

---

## The Core Insight

The verification-depth guard (EXP-123) is our first guard to graduate from experiment to permanent infrastructure. Its success — **74% → 93.8% C1.3, 0.66 → 0.84 quality, 100% recovery rate, zero compensatory failures** — wasn't accidental. It succeeded because it satisfied a specific set of design properties that other interventions (few-shot examples, prompt additions, skill documents) consistently lack.

This entry distills what those properties are, establishing a **guard design checklist** for future interventions.

---

## Why This Guard Succeeded

### Property 1: Binary, Objective Detection

The guard checks a factual condition: "Does the transcript contain a post-write verification call?" This is a yes/no question with no subjective judgment, no threshold tuning, and no ambiguity. Compare this to guards that would need to assess "quality" or "completeness" — those require the same judgment the agent already failed to apply.

**Principle**: Guards succeed when detection is mechanical, not judgmental.

### Property 2: Cheap Recovery Path

When the guard blocks `finish(status: "success")`, the agent can recover by simply reading back what it wrote. This costs 1-2 tool calls (~$0.01, ~5 seconds). The recovery doesn't require rethinking, replanning, or redoing work — just performing the missing verification step.

**Principle**: Guards succeed when the cost of compliance is trivially low relative to the benefit.

### Property 3: Channel 2 (Structural) Not Channel 1 (Persuasion)

The guard operates structurally — it literally blocks the finish() call. It doesn't suggest, remind, or encourage. KE-144 established that "guards don't teach" and that's correct, but the deeper insight is: **guards don't need to teach**. The verification-depth guard doesn't change agent beliefs or habits; it mechanically forces the behavior. This is why fire rates rose rather than fell over 60 hours — and why that's fine.

**Principle**: Design guards as permanent infrastructure (linters), not temporary training (scaffolding).

### Property 4: Narrow Scope, No Side Effects

The guard targets exactly one behavior (post-write verification) and doesn't interfere with anything else. It doesn't restructure prompts, add cognitive overhead during task execution, or change the agent's planning approach. It only activates at the boundary moment (finish call), not during productive work.

**Evidence**: Zero compensatory failures across all conventions. C1.1, C1.4, C1.5, C2.1, C3.2, C6.1, C12.1 all improved or held steady. Quality improved 0.66 → 0.84.

**Principle**: Guards succeed when they intervene at the narrowest possible point — the boundary between work and completion, not during the work itself.

### Property 5: Fail-Open Safety

The guard fails open — if the detection logic errors, the agent can still finish. This prevents the guard from becoming a source of stuck sessions or cascading failures. Combined with kill-switch support (`DISABLE_VERIFICATION_DEPTH_GUARD=1`), operators maintain override capability.

**Principle**: Guards must fail open. A guard that can block valid work is worse than no guard.

---

## The Guard Design Checklist

For any proposed guard to be worth deploying:

| # | Criterion | Test Question | EXP-123 Result |
|---|---|---|---|
| 1 | **Binary detection** | Can a regex/pattern check detect the violation? | ✅ Transcript scan for read/grep after write |
| 2 | **Cheap recovery** | Can the agent fix the violation in ≤3 tool calls? | ✅ 1-2 read-back calls |
| 3 | **Structural enforcement** | Does it block the action rather than suggest? | ✅ Blocks finish() |
| 4 | **Narrow scope** | Does it touch only the target behavior? | ✅ Only activates at finish boundary |
| 5 | **No judgment required** | Does detection avoid LLM-level reasoning? | ✅ Pure pattern matching |
| 6 | **Fail-open** | If guard errors, does work proceed? | ✅ Explicit fail-open policy |
| 7 | **Measurable target** | Is there a convention metric to track? | ✅ C1.3 with clear baseline |

**Prediction**: Guards that satisfy all 7 criteria will achieve ≥15pp improvement on their target metric with ≤5pp quality regression. Guards that fail criterion 2 (cheap recovery) or criterion 4 (narrow scope) will show the overhead/harm patterns documented in KE-158.

---

## Contrast: When Guards Fail

KE-158 (difficulty threshold) and KE-159 (format toll) document the opposite case — interventions that add cognitive or structural overhead during the work itself:

| Property | Verification-Depth (succeeds) | Format Gates (complex picture) | Few-Shot Examples (fails) |
|---|---|---|---|
| When it activates | At completion boundary | During task execution | During task planning |
| Recovery cost | 1-2 tool calls | Restructure output | Unlearn fixation (impossible) |
| Cognitive load | Zero during work | Format tax during work | Template displacement |
| Scope | finish() only | Every output step | Entire reasoning approach |

The key differentiator is **timing**: interventions at the completion boundary have near-zero overhead because the work is already done. Interventions during execution add cumulative tax proportional to task difficulty (H-107's difficulty threshold model).

---

## Connection to Active Hypotheses

**H-101 (Architectural Readiness, P=0.72)**: The guard's success validates H-101's core claim — guards become permanent infrastructure when architectural readiness is absent. EXP-137 showed that only agents with workflow-level verification (bob, coach, tech-lead) internalized the behavior; others (scout, may, optimizer) rely on the guard structurally. The guard's graduation AS infrastructure is the correct outcome per H-101.

**H-103 (Format-Decoupled Gates, P=0.45)**: The verification-depth guard succeeds precisely because it ISN'T a format gate. It doesn't impose output structure — it verifies that verification happened. KE-159 showed format requirements provide task decomposition benefits but at an efficiency cost. The verification-depth guard avoids this entirely by operating post-hoc.

**H-107 (Difficulty Threshold, P=0.62)**: The guard's universal effectiveness (every agent improved) suggests it operates below any difficulty threshold. This makes sense: the recovery action (read back your files) is trivially easy regardless of task complexity. Prediction: guards with expensive recovery actions will show H-107's difficulty-modulated harm pattern.

---

## The Bigger Picture

EXP-123's graduation establishes that **structural enforcement at behavioral boundaries** is the highest-leverage intervention pattern for multi-agent systems. This is more effective than:
- Prompt engineering (KE-133: few-shot examples harmful for discovery)
- Skill documents (KE-144: text doesn't transfer to behavior)
- Training/practice (EXP-138: gym doesn't transfer to production)

The guard pattern works because it sidesteps the fundamental challenge of changing agent cognition. It doesn't try to make agents "understand" why verification matters — it makes non-verification impossible. This is the same insight that makes type systems more reliable than code review: mechanical enforcement at boundaries beats human (or AI) judgment during execution.

**First law of guard design**: The best guard is one the agent never has to think about.

---

## Metrics Summary

| Metric | Pre-Guard | Post-Guard (60h, n=882) | Change |
|---|---|---|---|
| Fleet C1.3 | 74.0% | 93.8% | +19.8pp |
| Fleet quality | 0.66 | 0.84 | +0.18 |
| Recovery rate | — | ~100% | — |
| Compensatory failures | — | 0 | — |
| True positive rate | — | ~100% | — |
| OpCount overhead | 6.2 | 15.6 | +9.4 (fleet-wide, multi-factor) |

---

## Predictions

- **P-160a**: Future guards satisfying all 7 checklist criteria will achieve ≥15pp on target metric (testable per-guard)
- **P-160b**: Guards violating criterion 2 (cheap recovery) will show ≤5pp improvement or net harm on complex tasks
- **P-160c**: Guards violating criterion 4 (narrow scope) will produce compensatory failures in adjacent conventions
- **P-160d**: The verification-depth guard will maintain ≥90% C1.3 for 30 days post-graduation without recalibration
