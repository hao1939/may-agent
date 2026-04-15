# KE-129: Forced Externalization Is the Only Reliable Channel for Judgment Tasks

**Status**: Active
**Source**: EXP-127 (Channel Separation Direct Test, N=24), EXP-155 (Hidden-Dep Hard Gate, N=30), EXP-156 (Hard Gate Generalization, N=42), EXP-084, EXP-095
**Date**: 2026-04-10 (updated 2026-04-14 with EXP-155/EXP-156 confirmation)
**Confidence**: ★★★★☆ (High — 27/27 treatment pass across 3 scenarios, but 1 scenario confounded by ceiling effect; see Reinterpretation below)
**Extends**: KE-034 (forced externalization mechanism), KE-059 (H-091 mechanism hierarchy), KE-121 (forced ext. prevents misinterpretation)
**Bounded by**: KE-178 (hard gate boundary condition — requires low baseline + step-skipping failure mode)

---

## Core Finding

On the contradictory-requirements judgment task, **only Channel 2 (forced externalization) produces the desired behavior**. All other channels — including combinations — fail completely:

| Channel | Mechanism | Cumulative | Pass Rate |
|---------|-----------|------------|-----------|
| **Ch2** (Forced Ext.) | Structural gate requiring analysis before action | **10/10** | **100%** |
| **Ch1** (System Prompt) | Text rule / worked example in system instructions | **0/18** | **0%** |
| **Ch3** (Task Message) | Few-shot example prepended to task | **1/9** | **11%** |
| **Ch1 + Ch3** (Combined) | Both system prompt AND task message | **0/6** | **0%** |
| **None** (Baseline) | No intervention | **0/25** | **0%** |

Fisher's exact: Ch2 vs all others pooled: **p = 0.0000074**. This is the strongest single result in the knowledge base.

## EXP-127 Design

EXP-127 was a 4-arm randomized experiment (6 runs per arm):
- **Baseline**: No intervention (0/6)
- **Arm A**: Channel 1 only — contradiction-detection skill in system prompt (0/6)
- **Arm B**: Channel 3 only — few-shot example in task message (0/6)
- **Arm C**: Channel 2 only — forced ANALYSIS.md externalization before coding (6/6)

**Critical confound**: A `contradiction-detection.md` skill was already present in the production coder's system prompt for ALL runs (committed at SHA `ee7f0471`). This means:
- Baseline and Arm A both received Ch1 content (making them equivalent)
- Arm B received Ch1 + Ch3 simultaneously (not a clean Ch3 test)
- This **strengthens** the Ch1 finding (0/18 total exposure) and the Ch2 finding (works despite Ch1 noise), but means Ch3 was never tested in isolation

## Why This Matters

The result resolves a key ambiguity in H-098 (Channel Hierarchy Theory). H-098 predicted Ch3 would also work (~83-100%). It didn't. The channel hierarchy is not just about effectiveness ordering — for judgment tasks, there is a **qualitative threshold** that only structural gates cross:

- **Text channels (Ch1, Ch3)**: Tell the agent WHAT to do. The agent reads, acknowledges, and then ignores when "action momentum" takes over.
- **Structural gates (Ch2)**: Force the agent to DO something (write analysis) before proceeding. The mechanism works through behavioral forcing, not content delivery.

## Behavioral Evidence

Every failing run (0/18 text-channel runs) showed identical behavior:
1. Agent reads task, reads pipeline code
2. Agent immediately starts implementing optimizations
3. Agent never identifies the ordering/throughput contradiction
4. Reports "optimized pipeline" — judgment failure

Every passing run (10/10 Ch2 runs) showed identical behavior:
1. Agent reads task with "Phase 1: ANALYZE" instructions
2. Agent creates ANALYSIS.md documenting the ordering vs throughput conflict
3. Agent proposes alternatives with explicit tradeoffs
4. Agent implements balanced solution — judgment success

The write-before-act step is the entire mechanism.

## Expanded Evidence (EXP-155 + EXP-156)

Since the original EXP-127 result, two additional experiments have confirmed and extended the Ch2 finding:

| Experiment | Scenario | Baseline | Ch2 Hard Gate | Δ | Failure Type |
|-----------|----------|----------|---------------|---|-------------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp | Judgment: miss contradiction |
| EXP-155 | hidden-dep | 15% (3/20) | 100% (10/10) | +85pp | Process: skip investigation |
| EXP-156 | misleading-test-fix | 0% (0/11) | 100% (11/11) | +100pp | Verification: skip math check |

**Cumulative Ch2 treatment pass rate: 27/27 (100%)** across three distinct failure modes (judgment, process, verification). Combined p < 10⁻¹⁵ vs pooled alternatives.

**Boundary discovered** (EXP-156): Hard gate produced -20pp regression (90% → 70%, NS) on ambiguous-context-drift, where the failure mode is belief-based (trusting wrong context) rather than step-skipping, and the baseline was already 90%. See KE-178 for the formalized boundary condition.

## ⚠️ Reinterpretation (EXP-163, 2026-04-15)

**EXP-163 revealed that the hidden-dependency scenario has a ceiling effect: 100% product pass rate across ALL arms, including unassisted baseline (N=30).** The agent solves both bugs (typo fix + checksum recomputation) every time because Bug 2 surfaces deterministically when the agent runs the pipeline after fixing Bug 1. The "hidden" dependency is not actually hidden from the agent's natural workflow.

### What this means for EXP-154/EXP-155 evidence

EXP-155's reported "+85pp improvement" (15% baseline → 100% treatment) was **entirely measuring process compliance** — whether FINDINGS.md existed — not product quality improvement. The gate definitionally creates the artifact it checks for. This is tautological evidence. See KE-181 for the full methodological lesson.

| Originally Reported | Actual Mechanism |
|---|---|
| EXP-154 baseline: 15% overall | 100% product quality, 15% process compliance (few agents voluntarily create FINDINGS.md) |
| EXP-155 treatment: 100% overall | 100% product quality, 100% process compliance (gate forces FINDINGS.md creation) |
| "+85pp improvement from forced externalization" | +0pp product quality improvement; +85pp artifact compliance (tautological) |

### What is NOT affected

**EXP-127 (contradictory-requirements) evidence is fully intact.** That scenario has a 0% baseline product pass rate — agents genuinely fail to detect the contradiction without forced externalization. The 0% → 100% result measures real judgment improvement, not process compliance. Similarly, **EXP-156 (misleading-test-fix) evidence is intact** — 0% baseline is a genuine product failure.

### Revised evidence base

The "3 scenarios, 3 distinct failure types" claim in the Expanded Evidence table above is now:
- **1 clean scenario** (EXP-127 contradictory-requirements): 0% → 100%, genuine judgment improvement
- **1 clean scenario** (EXP-156 misleading-test-fix): 0% → 100%, genuine verification improvement
- **1 confounded scenario** (EXP-155 hidden-dep): 100% → 100% on product quality; the "+85pp" was process compliance only

**Confidence downgraded from ★★★★★ to ★★★★☆.** The core finding (Ch2 structural gates are the only reliable channel for judgment tasks) remains strongly supported by EXP-127 alone (p = 0.0000074). The breadth of evidence across scenarios is narrower than originally claimed.

## Relationship to Prior Findings

| Experiment | Channel | Result | Consistent? |
|-----------|---------|--------|-------------|
| EXP-127 | Ch2 | 6/6 (100%) | ✅ |
| EXP-084 | Ch2 | 4/4 (100%) | ✅ |
| EXP-095 | Ch3 | 6/6 (100%) on behavior-escalation | ❌ Different — Ch3 works for behavioral tasks |
| KE-059 | Ch3 | 18/18 on various | ❌ Different — Ch3 works on some task types |
| EXP-127 | Ch3 | 0/6 on contradiction detection | ✅ Ch3 fails on analytical judgment |

**Emerging boundary**: Channel 3 may work for behavioral tasks (de-escalation, formatting) but fails for analytical judgment tasks (contradiction detection) where "action momentum" is strong.

## Predictions

- **P-129a**: Ch2 will maintain ≥80% on contradictory-requirements in any future replication (N≥6)
- **P-129b**: Ch1 alone will remain ≤15% on any judgment-class scenario (contradiction detection, evidence-over-narrative, classify-before-act)
- **P-129c**: Ch3 alone (without Ch1 confound) will score ≤30% on contradictory-requirements if tested in isolation

## Implications

1. **Remove `agents/coder/skills/contradiction-detection.md`** — 0/18 with zero effect, adds ~500 tokens to every prompt
2. **For judgment tasks, always use Channel 2** — text-based instructions are provably ineffective
3. **Channel 3 research needs boundary mapping** — works for some tasks, fails for others. The determinant is likely "action momentum" strength
4. **H-098 P(H-098) updated: 0.78 → 0.80** — core channel hierarchy confirmed, but Ch3 model needs refinement

## Limitations

- Ch3 was never tested in complete isolation (Ch1 skill was present in all runs)
- Only tested on one judgment scenario (contradictory-requirements)
- Small N per arm (6 runs each)
- Confound: Ch1 interference may have suppressed Ch3 effectiveness

---
*EXP-127 is the most decisive channel comparison experiment to date: 24 runs, 4 arms, with the starkest result pattern in the knowledge base (0% vs 0% vs 0% vs 100%).*
