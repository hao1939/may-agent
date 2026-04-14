# KE-129: Forced Externalization Is the Only Reliable Channel for Judgment Tasks

**Status**: Active (REVISED 2026-04-14 — EXP-163 reinterpretation)
**Source**: EXP-127 (Channel Separation Direct Test, N=24), EXP-156 (Hard Gate Generalization, N=42), EXP-084, EXP-095
**Removed**: ~~EXP-155 (Hidden-Dep Hard Gate)~~ — invalidated by EXP-163 ceiling effect analysis
**Date**: 2026-04-10 (revised 2026-04-14)
**Confidence**: ★★★★☆ (High — 17/17 treatment pass across 2 scenarios with genuine product-quality metrics. Downgraded from 5-star after EXP-155 removal.)
**Extends**: KE-034 (forced externalization mechanism), KE-059 (H-091 mechanism hierarchy), KE-121 (forced ext. prevents misinterpretation)
**Bounded by**: KE-178 (hard gate boundary condition — requires low baseline + step-skipping failure mode)

---

## Core Finding

On judgment tasks requiring analytical detection, **only Channel 2 (forced externalization) produces the desired behavior**. All other channels — including combinations — fail completely:

| Channel | Mechanism | Cumulative | Pass Rate |
|---------|-----------|------------|-----------|
| **Ch2** (Forced Ext.) | Structural gate requiring analysis before action | **17/17** | **100%** |
| **Ch1** (System Prompt) | Text rule / worked example in system instructions | **0/18** | **0%** |
| **Ch3** (Task Message) | Few-shot example prepended to task | **1/9** | **11%** |
| **Ch1 + Ch3** (Combined) | Both system prompt AND task message | **0/6** | **0%** |
| **None** (Baseline) | No intervention | **0/36** | **0%** |

Fisher's exact: Ch2 vs all others pooled: **p < 10⁻⁸**. This remains one of the strongest results in the knowledge base.

---

## ⚠️ EVIDENCE REVISION NOTICE (2026-04-14)

### What Changed

EXP-163 revealed that EXP-155's "+85pp improvement" on the hidden-dependency scenario was measuring **process compliance** (did the agent create FINDINGS.md?) not **product quality** (did the agent fix both bugs?). 

**Key data point**: In EXP-155, product pass rate was **100% in ALL arms** — baseline, Ch1 skill, and Ch2 hard gate. The agent ALWAYS fixed both bugs. The only differentiation was whether a planning artifact existed. The hard gate forced artifact creation, which inflated overall pass rate, but the agent's actual task performance was already perfect.

### What Was Removed

The "Expanded Evidence" table previously read:

| Experiment | Scenario | Baseline | Ch2 Hard Gate | Δ | Failure Type |
|-----------|----------|----------|---------------|---|-------------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp | Judgment: miss contradiction |
| ~~EXP-155~~ | ~~hidden-dep~~ | ~~15% (3/20)~~ | ~~100% (10/10)~~ | ~~+85pp~~ | ~~Process: skip investigation~~ |
| EXP-156 | misleading-test-fix | 0% (0/11) | 100% (11/11) | +100pp | Verification: skip math check |

**EXP-155 has been removed.** The "+85pp" was a process compliance artifact. The cumulative Ch2 count drops from 27/27 (3 scenarios) to **17/17 (2 scenarios)**.

### What Survives and Why

**EXP-127 (contradictory-requirements)**: ✅ GENUINE. The checks measure real product quality:
- `ordering-preserved`: Does the pipeline still enforce record ordering? (behavioral correctness)
- `contradiction-identified`: Did the agent detect the throughput/ordering impossibility? (analytical judgment)
- `alternatives-proposed`: Did the agent suggest tradeoff solutions? (constructive response)
- `tests-pass`: Do existing tests still pass? (no regression)

These checks cannot be satisfied by mere compliance. The agent must actually recognize a physical impossibility in the requirements.

**EXP-156 (misleading-test-fix)**: ✅ GENUINE. The checks measure real product quality:
- `discount-mathematically-correct`: Does `applyDiscount(33.97, 20)` return 27.18? (math correctness)
- `test-assertion-fixed`: Does the test expect 27.18 not 27.17? (correct fix target)
- `applyDiscount-not-modified`: Was the function left unchanged? (code integrity)
- `all-tests-pass`: Does the full test suite pass? (regression check)

Baseline 0%: agents consistently modify the code to match the wrong test assertion. Treatment 100%: the forced DIAGNOSIS.md makes agents do the math first, revealing the test is wrong.

---

## What the Remaining Evidence Actually Supports

### Strong Claim (supported by 2 scenarios, N=46):
**Ch2 forced externalization gates produce dramatic improvements (+100pp) on analytical judgment tasks where the failure mode is "skipping an analysis step."** When the agent rushes to act without thinking, forcing a write-first step works perfectly.

### Weaker Claim (reduced evidence):
**Ch2 is the "only" reliable channel.** This claim still holds for the two tested scenarios (Ch1 and Ch3 both 0%), but with only 2 scenarios the generalization is less certain than previously stated.

### Dead Claim:
**"27/27 treatment pass across 3 distinct failure types."** Now 17/17 across 2 failure types. The "process: skip investigation" failure type was an artifact of ceiling-effect measurement.

---

## EXP-127 Design (Unchanged)

EXP-127 was a 4-arm randomized experiment (6 runs per arm):
- **Baseline**: No intervention (0/6)
- **Arm A**: Channel 1 only — contradiction-detection skill in system prompt (0/6)
- **Arm B**: Channel 3 only — few-shot example in task message (0/6)
- **Arm C**: Channel 2 only — forced ANALYSIS.md externalization before coding (6/6)

**Critical confound**: A `contradiction-detection.md` skill was already present in the production coder's system prompt for ALL runs (committed at SHA `ee7f0471`). This means:
- Baseline and Arm A both received Ch1 content (making them equivalent)
- Arm B received Ch1 + Ch3 simultaneously (not a clean Ch3 test)
- This **strengthens** the Ch1 finding (0/18 total exposure) and the Ch2 finding (works despite Ch1 noise), but means Ch3 was never tested in isolation

## Why Channel 2 Works

The mechanism is behavioral forcing, not content delivery:

- **Text channels (Ch1, Ch3)**: Tell the agent WHAT to do. The agent reads, acknowledges, and then ignores when "action momentum" takes over.
- **Structural gates (Ch2)**: Force the agent to DO something (write analysis) before proceeding. The mechanism works through behavioral forcing, not content delivery.

Every failing run shows identical behavior: read task → immediately start coding → miss the analytical insight. Every passing run shows: read task → write analysis artifact → insight becomes obvious → correct action.

## Boundary Condition (EXP-156)

Hard gate produced **-20pp regression** (90% → 70%, NS) on ambiguous-context-drift, where:
- Baseline was already 90% (near ceiling)
- Failure mode is belief-based (trusting wrong context), not step-skipping

This means Ch2 gates are NOT a universal fix. See **KE-178** for the formalized boundary.

## Predictions (Revised)

- **P-129a**: Ch2 will maintain ≥80% on contradictory-requirements in any future replication (N≥6) — UNCHANGED
- **P-129b**: Ch1 alone will remain ≤15% on any judgment-class scenario — UNCHANGED  
- **P-129c**: Ch3 alone (without Ch1 confound) will score ≤30% on contradictory-requirements — UNCHANGED
- **P-129d** (NEW): On a new scenario with ≤50% baseline and step-skipping failure mode, Ch2 hard gate will achieve ≥80% — tests the generalization claim

## Open Questions

1. **Would Ch2 help on the hidden-dep scenario if it were actually hard?** EXP-163 showed the scenario is too easy (100% product baseline). A harder variant with genuinely hidden bugs could test whether forced investigation planning helps.
2. **How many scenarios do we need for generalization confidence?** Two scenarios (contradictory-requirements, misleading-test-fix) is suggestive but not definitive. The "Channel Theory" name may be premature with n=2.
3. **Is process compliance entirely worthless?** EXP-155 showed the gate forces artifact creation. While this doesn't improve outcomes on easy tasks, it might matter for harder tasks where the artifact becomes genuinely useful. The artifact's value is untested, not disproven.

## Relationship to Prior Findings

| Experiment | Channel | Result | Consistent? | Product Quality? |
|-----------|---------|--------|-------------|-----------------|
| EXP-127 | Ch2 | 6/6 (100%) | ✅ | ✅ Genuine |
| EXP-084 | Ch2 | 4/4 (100%) | ✅ | ✅ Genuine |
| EXP-156 misleading-test-fix | Ch2 | 11/11 (100%) | ✅ | ✅ Genuine |
| ~~EXP-155~~ | ~~Ch2~~ | ~~10/10 (100%)~~ | ~~✅~~ | ❌ Process compliance only |
| EXP-095 | Ch3 | 6/6 (100%) on behavior-escalation | ❌ Different — Ch3 works for behavioral tasks | ✅ Genuine |

## Implications

1. **Remove `agents/coder/skills/contradiction-detection.md`** — 0/18 with zero effect, adds ~500 tokens to every prompt
2. **For analytical judgment tasks, use Channel 2** — text-based instructions are provably ineffective
3. **Always verify metrics measure product quality, not compliance** — EXP-155's lesson applies broadly
4. **More scenarios needed** — Two scenarios is sufficient to establish a pattern but insufficient for "theory" status

---
*KE-129 remains one of the strongest findings in the knowledge base, but its evidence base is narrower than previously claimed. The core insight — structural gates beat text instructions for judgment tasks — is supported by genuine product-quality metrics on 2 scenarios (N=46 total). The "3 failure types" claim was inflated by a ceiling-effect confound in EXP-155.*
