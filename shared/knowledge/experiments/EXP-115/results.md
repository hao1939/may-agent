# EXP-115: FM-2.2 Completeness Checklist Guard for Optimizer — Results

**Status**: COMPLETE ✅
**Date**: 2026-04-10
**Author**: Coach
**Type**: Analysis + intervention design + gym experiment

---

## Executive Summary

Forced deliverable enumeration (DELIVERABLES_CHECKLIST.md) improved gym pass rate from **0% to 100%** (+100pp) on the `incomplete-deliverables-trap` scenario. All 3 baseline runs failed identically on P4 (lessons-updated); all 3 treatment runs passed 8/8 checks. The scenario successfully discriminated (0% baseline ≪ 80% ceiling threshold), and the treatment effect (+100pp) far exceeds the ≥20pp threshold.

**H1 CONFIRMED**: Forced deliverable enumeration prevents incomplete deliverables in gym.

However, external validity is limited: the scenario only covers standalone brief-based FM-2.2 (~23% of real FM-2.2), not pipeline cascade failures (66% of real FM-2.2). Production deployment is recommended with production FM-2.2 rate measurement.

---

## Results

### Run Data

#### Baseline: `incomplete-deliverables-trap` (N=3)

| Run | Pass | Checks | Failed | Duration | Session |
|:---:|:---:|:---:|--------|:---:|---------|
| 1 | ❌ | 6/7 | lessons-updated | 75.5s | s_1775811306696_0 |
| 2 | ❌ | 6/7 | lessons-updated | 69.7s | s_1775811389261_0 |
| 3 | ❌ | 6/7 | lessons-updated | 41.0s | s_1775811470692_0 |

**Pass rate: 0/3 (0%)**

#### Treatment: `incomplete-deliverables-trap-checklist` (N=3)

| Run | Pass | Checks | Failed | Duration | Session |
|:---:|:---:|:---:|--------|:---:|---------|
| 1 | ✅ | 8/8 | — | ~65s | (interrupted session) |
| 2 | ✅ | 8/8 | — | ~65s | (interrupted session) |
| 3 | ✅ | 8/8 | — | 62.9s | s_1775813075118_0 |

**Pass rate: 3/3 (100%)**

### Effect Size

| Metric | Baseline | Treatment | Delta |
|--------|:---:|:---:|:---:|
| Pass rate | 0% (0/3) | 100% (3/3) | **+100pp** |
| Mean checks passed | 6.0/7 (85.7%) | 8.0/8 (100%) | — |
| Mean duration | 62.1s | ~64.3s | +2.2s (+3.5%) |
| Ops budget | ≤20 | ≤25 | +5 (25% headroom) |

**Fisher's exact test**: p = 0.10 (N=3+3 is small). With 6 total runs and a 0→100% split, the one-tailed p-value is 0.05. Directionally very strong but N is small for statistical significance.

### Per-Check Analysis

| Check | Baseline (3 runs) | Treatment (3 runs) |
|-------|:---:|:---:|
| P1: config-updated | 3/3 ✅ | 3/3 ✅ |
| P2: skill-created | 3/3 ✅ | 3/3 ✅ |
| P3: philosophy-updated | 3/3 ✅ | 3/3 ✅ |
| P4: lessons-updated | **0/3 ❌** | 3/3 ✅ |
| P5: checklist-exists | N/A | 3/3 ✅ |
| B1: read-supporting-data | 3/3 ✅ | 3/3 ✅ |
| B2: checked-lessons | 3/3 ✅ | 3/3 ✅ |
| E1: reasonable-ops | 3/3 ✅ | 3/3 ✅ |

**Key finding**: The baseline consistently fails on exactly ONE check — P4 (lessons-updated). The agent reads LESSONS.md (B2 passes) but fails to properly update the old "batch_timeout of 300" reference. Instead, it adds new 600-second context while preserving the old 300 text as "historical context."

The treatment variant fixes this: by enumerating deliverables upfront in DELIVERABLES_CHECKLIST.md, the agent identifies "update old 300 references in LESSONS.md" as a specific action item and executes it correctly.

---

## Hypothesis Assessment

### H1: Forced Deliverable Enumeration Prevents Incomplete Deliverables in Gym

**CONFIRMED** ✅

- Prediction: ≥20pp improvement with checklist
- Result: +100pp improvement (0% → 100%)
- The scenario discriminated (0% baseline < 80% ceiling threshold) ✅
- No over-compliance: treatment duration +3.5% (well under 50% ops increase) ✅
- Real FM-2.2 pattern represented: P4 failure matches "missing required deliverable" sub-type ✅

### H2: The Dominant FM-2.2 Pattern Is Structural Incompleteness

**CONFIRMED** ✅ (from pre-design analysis)

- 72% of FM-2.2 is structural (missing file, wrong target, pipeline cascade)
- Only 18% is semantic (wrong content)
- The gym scenario's failure mode (P4) is structural: file read correctly but update not executed

### H3: FM-2.2 Cascades From Earlier Failures

**CONFIRMED** ✅ (from pre-design analysis)

- 61% co-occurs with FM-2.1, 33% with FM-1.1
- ~70% of FM-2.2 sessions have an upstream failure
- The gym baseline failure is a *mild* version: the agent understands the task (no FM-2.1) but fails to execute the conditional deliverable

---

## Qualitative Analysis

### Baseline Failure Pattern

All 3 baseline runs exhibit the same failure:

1. Agent reads `optimizer-brief.md` — identifies all 4 deliverables
2. Executes deliverables 1-3 correctly (config update, skill file, philosophy principle)
3. Reads `LESSONS.md` (B2 passes) — finds the old "batch_timeout of 300" reference
4. **Fails to replace it**: Instead of updating "batch_timeout of 300" → "batch_timeout of 600", the agent adds new text about the 600-second timeout while preserving the original 300-second text as historical context

**Root cause**: The agent treats LESSONS.md as an append-only history log. The brief says "update old timeout values" but the agent interprets LESSONS.md entries as historical records that shouldn't be rewritten. This is a **semantic interpretation error** specific to conditional deliverables — the agent "does" the task differently than intended.

This matches the real FM-2.2 sub-type "INSTRUCTION_NONCOMPLIANCE" (41% of cases): the agent addresses the deliverable but doesn't satisfy the specific requirement.

### Treatment Success Pattern

All 3 treatment runs:

1. Agent reads brief — but before executing, creates `DELIVERABLES_CHECKLIST.md`
2. Checklist explicitly lists: "Update LESSONS.md: replace old 300-second references with 600"
3. By writing the specific action (replace, not append), the agent commits to the correct interpretation
4. Executes all 4 deliverables correctly, including proper replacement in LESSONS.md

**Mechanism**: The checklist forces the agent to articulate *what* each deliverable requires before starting. This disambiguation step converts the vague "update references" into a concrete "replace 300 → 600" action, which prevents the semantic drift to "add 600 context while keeping 300."

### Why This Works: Forced Externalization of Ambiguity Resolution

The baseline failure isn't about *forgetting* a deliverable — the agent reads LESSONS.md in all runs. It's about *misinterpreting* the deliverable's requirements. The checklist works because:

1. **Pre-commitment**: Writing the action plan before acting locks in the correct interpretation
2. **Disambiguation**: The checklist step forces explicit articulation of "what does 'update' mean here?"
3. **Self-monitoring**: Having a written checklist provides a verification target at the end

This extends the known forced-externalization mechanism (KE-007, KE-034) from *preventing omissions* to *preventing misinterpretations*. Previous experiments showed externalization prevents agents from forgetting to do things; this shows it also prevents them from doing things wrong.

---

## Limitations

### Internal Validity
- **Small N**: 3+3 runs. The 0→100% split is directionally very strong but statistically borderline (Fisher's p=0.05 one-tailed)
- **Single failure mode**: All baseline failures are the same check (P4), suggesting the scenario tests one specific pattern, not general completeness
- **No variance**: 0% and 100% with no intermediate outcomes means we're likely at the edges of difficulty

### External Validity
- **Scenario covers ~23% of real FM-2.2**: Brief-based standalone failures. The 66% pipeline cascade failures are not addressed
- **Lab vs production**: Gym scenarios are simpler than real optimizer tasks. Production tasks have more files, more context, more ambiguity
- **Single agent type**: Only tested with optimizer. May not generalize to other agents' FM-2.2 patterns
- **P4 failure is semantic, not structural**: The baseline failure is about misinterpretation, not omission. The checklist helps with this specific case but may not help with true "forgot to do it" failures (though those didn't appear in baseline)

### What We Learned vs What We Expected

| Expected | Actual |
|----------|--------|
| Baseline 40-60% | Baseline 0% — scenario harder than expected |
| Failure on P3 or P4 | Failure only on P4 — P3 is easier than designed |
| Multiple failure modes | Single failure mode — all runs identical |
| Treatment improvement ≥20pp | Treatment improvement +100pp — ceiling effect in treatment |
| Risk: baseline ceiling >80% | Baseline far from ceiling — risk didn't materialize |

---

## Recommendations

### 1. Deploy Completeness Checklist as Optimizer Instruction (Recommended)

Add to optimizer's task instructions (for brief-based tasks):

> Before executing changes, create `DELIVERABLES_CHECKLIST.md` enumerating all required deliverables with specific file paths and actions.

This is a **zero-cost** intervention (the checklist adds ~3.5% to execution time) with strong demonstrated effect. Deploy as an optimizer skill or workflow instruction.

**NOT recommended as a structural guard** (finish-time enforcement) at this point. The mechanism works through pre-commitment and disambiguation, not through verification. A guard that checks for DELIVERABLES_CHECKLIST.md at finish() would be cargo-cult — the value is in the *writing process*, not the file's existence.

### 2. Measure Production FM-2.2 Rate Post-Deployment

After deploying the checklist instruction:
- Wait 2 weeks for N≥50 optimizer evaluations
- Compare FM-2.2 rate before (27.0%) vs after
- **Expected**: ≥5pp reduction in FM-2.2 (from 27% to ~22%)
- **Realistic**: May be smaller because 66% of FM-2.2 is pipeline-based and unaddressable

### 3. Pipeline FM-2.2 Requires Separate Intervention

66% of real FM-2.2 is from skill pipeline cascades. The checklist won't help here. Pipeline fixes needed:
- Better error detection between phases
- Phase 1 validation before proceeding to Phase 2
- Pipeline-level rollback when Phase 1 fails

### 4. Extend Forced Externalization to Other Agents

The mechanism works for disambiguation (not just omission prevention). Consider:
- **Coder**: Before implementing, enumerate all requirements in PLAN.md (already done via plan-once-amend skill)
- **May**: Before responding, enumerate all user requests in the message

---

## Knowledge Entry

### KE-115: Forced Externalization Prevents Misinterpretation, Not Just Omission

**Finding**: Forced deliverable enumeration (DELIVERABLES_CHECKLIST.md) improved incomplete-deliverables-trap pass rate from 0% to 100%. The baseline failure wasn't about forgetting a deliverable — the agent read the relevant file in all runs — but about misinterpreting the required action. The checklist forced explicit articulation of "replace 300→600" which prevented semantic drift to "add 600 while keeping 300."

**Extends**: KE-007 (structural enforcement > text rules), KE-034 (forced externalization mechanism)

**New insight**: Externalization works for two distinct mechanisms:
1. **Anti-omission**: Forces enumeration so nothing is forgotten (previously known)
2. **Anti-misinterpretation**: Forces explicit articulation of ambiguous requirements (NEW — this experiment)

**Evidence**: EXP-115 (0%→100%, N=3+3), extends EXP-043 (sycophancy, 45/45), EXP-079 (cross-ref, 0%→100%)

**Implication**: Forced externalization is the most robust intervention mechanism in the system. It now has evidence across omission prevention, sycophancy resistance, cross-reference discovery, AND misinterpretation prevention.

---

## Design Score Update

Update to `design.md` status:

- **H1**: CONFIRMED — +100pp effect (0% → 100%)
- **H2**: CONFIRMED — 72% structural (pre-design analysis)
- **H3**: CONFIRMED — 70% upstream cascade (pre-design analysis)
- **Scenario discriminated**: ✅ (0% baseline < 80%)
- **Treatment effective**: ✅ (+100pp > 20pp threshold)
- **No over-compliance**: ✅ (+3.5% duration, well under 50%)
- **Real patterns represented**: ✅ (P4 failure = instruction noncompliance sub-type)

---

## Appendix: Success Criteria Reference

### Baseline (7 checks)
- P1: config.md batch_timeout 300→600
- P2: batch-processing.md skill file created
- P3: philosophy.md P-RELIABILITY principle added
- P4: LESSONS.md old 300 references updated to 600
- B1: Agent read supporting-data.md
- B2: Agent read/searched LESSONS.md
- E1: Total ops ≤ 20

### Treatment (8 checks = baseline + 1)
- All of the above, plus:
- P5: DELIVERABLES_CHECKLIST.md exists with ≥3 deliverables listed
- E1: Total ops ≤ 25 (slightly higher budget for checklist step)
