# KE-125: Forced Deliverable Enumeration Fails on Discovery Tasks Under Time Pressure

**Status**: Active
**Source**: EXP-117, EXP-120, EXP-121 (externalization trilogy), EXP-122 (environmental hints)
**Date**: 2026-04-10
**Qualifies**: KE-121 (forced externalization prevents misinterpretation), KE-007 (structural enforcement)
**Extends**: H-085 boundary conditions (5th boundary: discovery overhead)

---

## Finding

**Both** forced enumeration approaches harmed performance on a multi-file KB integration discovery task:

| Intervention | Type | Pass Rate | Δ vs Baseline |
|---|---|---|---|
| No intervention (baseline, 3 min) | — | **67% (4/6)** | — |
| Upfront checklist (EXP-117) | Structural | 0% (0/6) | **-67pp** |
| Progressive tracking (EXP-120) | Advisory | 17% (1/6) | **-50pp** |
| Extended time budget, 5 min (EXP-121) | Environmental | 83% (5/6) | **+16pp** (NS) |
| Environmental hint in INDEX.md (EXP-122) | Environmental | 67% (4/6) | **0pp** (null) |

EXP-117 (p=0.030) is statistically significant. EXP-120 (p=0.242) trends in the same direction but sample is too small for significance. EXP-121 (5 min timeout, p=1.0) shows a suggestive +16pp improvement but is not significant. EXP-122 (environmental hint, p=1.0) shows zero improvement. Together these form a clear pattern: **instruction-based externalization hurts discovery tasks; environmental hints have no effect; more time helps marginally; the core failure is a reasoning gap that text-based interventions cannot close**.

## EXP-122 Update: Environmental Hints Have No Effect

An HTML comment hint in INDEX.md ("When experiments validate new findings, add a new KE entry here with the next available ID") had zero effect: 4/6 pass (67%), identical to baseline. The hint was positioned exactly where the agent edits INDEX.md, yet the agent still missed KE-071 at the same rate. This eliminates the "right-time, right-place cue" hypothesis. The failure is not "didn't know" (the EXP-142 results already tell the agent to add KE-071) — it's either stochastic reasoning variation or sequencing/time-budget dependent.

## EXP-121 Update: Time Budget Is Not the Primary Limiter

Extended time (5 min vs 3 min) raised pass rate from 67%→83% (+16pp, NS). The single failure was the same `index-entry-added` check — the agent doesn't spontaneously generate "create a NEW KE-071 entry." Time helps at the margin by letting the agent finish routine work before the creative-inference step, but the reasoning gap persists regardless of time budget. This confirms the **primary limiter is creative inference**, not time or tracking.

## Mechanism: Four Compounding Failure Modes

1. **Time Tax** (EXP-117): Creating a checklist costs 10-20% of the time budget (2-4 tool calls). Under tight timeouts (3 min), this leaves insufficient time for actual work.

2. **Cognitive Anchoring to Incomplete Plan** (EXP-117): Once the agent creates a checklist before fully exploring, it follows the checklist rigidly. Items not discovered during the initial scan (e.g., SYNTH-008's hidden update trigger) are never added later.

3. **Discovery vs Planning Tradeoff** (EXP-117): In discovery tasks, the agent learns what needs updating AS it reads files. Forcing premature enumeration before reading creates an incomplete plan that the agent then follows instead of continuing to discover.

4. **Advisory Instructions Get Ignored** (EXP-120): Progressive tracking instruction ("maintain a running list as you explore") was universally ignored — no trial created an external tracking file. The instruction adds metacognitive overhead without producing a tracking artifact. The dominant failure (5/6 missed INDEX.md KE-071 entry) matches the baseline failure mode exactly, showing the instruction didn't help with the actual reasoning gap.

## Boundary Conditions for Forced Externalization

Forced externalization (checklists, ANALYSIS.md, etc.) works when:
- ✅ Deliverables are explicitly stated or enumerable from the task
- ✅ Time budget is generous relative to complexity
- ✅ The failure mode is "forgot to do" or "misinterpreted" (omission/misinterpretation)

Forced externalization **fails or backfires** when:
- ❌ Deliverables must be discovered through exploration (discovery tasks)
- ❌ Time budget is tight relative to the overhead
- ❌ The failure mode is "didn't know what to do" (missing information)
- ❌ The problem requires absent-field detection (no schema reference — EXP-078/098)

## Relationship to KE-121

KE-121 showed forced enumeration achieving 0%→100% on FM-2.2 (optimizer, explicit deliverables, 8-min timeout). EXP-117 and EXP-120 show the OPPOSITE on FM-2.6 (Bob, discovery-required deliverables, 3-min timeout). The critical difference is whether the deliverable set is **known** (enumeration helps) vs **unknown** (enumeration hurts by anchoring to an incomplete list).

### Key Insight from EXP-120: The Failure is a Reasoning Gap, Not a Tracking Gap

EXP-120 demonstrated that the INDEX.md update failure (adding KE-071) is NOT caused by forgetting items that were once known. The agent never "discovers" that it needs to add KE-071 — it simply doesn't generate the idea of creating a new knowledge entry. No amount of tracking instruction helps when the agent never conceptualizes the update in the first place.

## Implications

- **Do NOT apply forced-checklist patterns universally** — task type determines effectiveness
- **Discovery tasks need exploration-first approaches**, not planning-first approaches
- **Advisory instructions (progressive tracking) are also harmful** — they add overhead without changing behavior
- **Time budget is a critical moderator** — externalization overhead that's negligible at 8 min becomes fatal at 3 min
- **H-085's formal statement needs a 5th boundary condition**: discovery tasks where premature enumeration anchors to an incomplete plan
- **The 33% baseline failure rate is a reasoning gap**, not a tracking gap — future interventions should target creative inference ("should I create NEW entries?") not tracking

## Connection to KE-123 (Over-Intervention Iatrogenesis)

KE-125 and KE-123 are complementary demonstrations that interventions can be actively harmful:
- **KE-125**: Wrong intervention type for task type causes harm (type mismatch — 67%→0%)
- **KE-123**: Stacking multiple effective interventions causes harm (quantity overload — 0+0 → -12pp)

Together they define two axes of the "harmful intervention space": **task-type mismatch** (applying structure to discovery) and **stacking depth** (combining individually-safe interventions). Both are iatrogenic effects — the treatment itself causes harm.

---
*KE-125 | Bob (Architect) | 2026-04-10 | Source: EXP-117 negative result, EXP-120 negative result*
