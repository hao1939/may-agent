# EXP-155 Results: Ch2 Hard Externalization Gate vs Selective Compliance

**Date**: 2026-04-14
**Status**: COMPLETE
**Result**: H-155 STRONGLY CONFIRMED

## Summary

The Ch2 forced externalization gate achieved **100% pass rate (10/10)** on the `exp155-hidden-dep-hard-gate` scenario, vs 15% baseline (3/20) and 10% Ch1 skill treatment (1/10). Every single check — product and process — passed in all 10 trials. This is the strongest Ch2 result to date, confirming that forced externalization gates overcome the selective compliance failure discovered in EXP-154.

## Data

### 3-Way Comparison: Overall Pass Rates

| Condition | Channel | N | Passed | Rate | 95% CI |
|-----------|---------|---|--------|------|--------|
| Baseline (soft 3-phase) | None | 20 | 3 | 15.0% | 3–38% |
| Ch1 Skill (investigation-before-fix) | Ch1 | 10 | 1 | 10.0% | 0–45% |
| **Ch2 Hard Gate (FINDINGS.md required)** | **Ch2** | **10** | **10** | **100.0%** | **69–100%** |

**Effect size**: +85pp over baseline, +90pp over Ch1 skill.

### Per-Check Breakdown (All 10 Treatment Runs)

| Check | Baseline (20) | Ch1 Skill (10) | Ch2 Hard Gate (10) |
|-------|--------------|----------------|---------------------|
| P1: planning-artifact-exists | ~100% | 10% (1/10) | **100% (10/10)** |
| P2: planning-identifies-typo | ~15% | ~0% | **100% (10/10)** |
| P3: planning-identifies-checksum | ~15% | ~0% | **100% (10/10)** |
| P4: verify-after-fix | ~15% | 100% (10/10) | **100% (10/10)** |
| Product: typo-fixed | 100% | 100% | **100% (10/10)** |
| Product: checksum-correct | 100% | 100% | **100% (10/10)** |
| Product: pipeline-output-correct | 100% | 100% | **100% (10/10)** |
| Product: pricing-rules-intact | 100% | 100% | **100% (10/10)** |
| Product: validation-intact | 100% | 100% | **100% (10/10)** |

### The Critical Shift: P1 (Artifact Exists)

The selective compliance failure in EXP-154 was that agents ignored the interruptive step of writing FINDINGS.md (P1: 10% compliance). The Ch2 gate completely eliminated this failure:

| P1 (artifact exists) | Rate |
|---------------------|------|
| Baseline | ~100% (free-format "any document") |
| Ch1 Skill | **10%** (1/10) — selective compliance failure |
| Ch2 Hard Gate | **100%** (10/10) — gate forces creation |

Note: Baseline P1 passes because the baseline scenario accepts "any format" of thinking, and agents typically write something. The Ch1 skill *added* a specific requirement (FINDINGS.md) which agents selectively ignored. The Ch2 gate made the same requirement mandatory with an existence check.

### P2 and P3: Bug Identification Quality

The most remarkable result is P2 and P3 (bug identification). Even when baseline agents created planning artifacts, they rarely identified both bugs. With the Ch2 gate:

- **P2 (identifies typo)**: 100% — all agents documented the RULES_PAH → RULES_PATH typo
- **P3 (identifies checksum)**: 100% — all agents documented the checksum mismatch

This suggests the gate doesn't just force artifact creation — it forces *quality thinking*. The explicit instruction "list EVERY bug" plus "there are MULTIPLE bugs" combined with the forced deliverable ensures agents actually trace the full dependency chain.

## Hypothesis Evaluation

**H-155**: A Ch2 forced externalization gate that requires FINDINGS.md with bug analysis before implementation improves the process check pass rate on `exp144-hidden-dep-decoupled` by ≥30pp over baseline (15%), reaching ≥45% overall.

**Verdict: STRONGLY CONFIRMED**

| Prediction | Threshold | Result | Verdict |
|-----------|-----------|--------|---------|
| P1: Overall pass rate ≥45% | ≥30pp over 15% baseline | **100%** (+85pp) | ✅ EXCEEDED |
| P2: Artifact exists ≥80% | vs 10% in Ch1 | **100%** | ✅ EXCEEDED |
| P3: Bug identification ≥50% | P2+P3 | **100%** (both) | ✅ EXCEEDED |
| P4: Verify after fix ≥80% | vs ~15% baseline | **100%** | ✅ EXCEEDED |

Every prediction was exceeded. The effect is not just statistically significant — it's qualitatively transformative.

### Statistical Significance

- Ch2 (10/10) vs Baseline (3/20): Fisher's exact test p < 0.0001
- Ch2 (10/10) vs Ch1 (1/10): Fisher's exact test p < 0.0001
- Ch1 (1/10) vs Baseline (3/20): Fisher's exact test p = 1.0 (no difference)

## Analysis

### Why Did the Ch2 Gate Work So Dramatically?

The design doc predicted the gate might yield ~45-80% improvement. Instead it achieved 100%. Three factors explain the ceiling effect:

1. **Structural forcing eliminates the selective compliance failure**: When FINDINGS.md is a REQUIRED DELIVERABLE with an explicit existence check in Phase 2, agents can't skip it. This removed the #1 failure mode (P1 failure → cascading P2/P3 failure).

2. **"MULTIPLE bugs" hint + structured output = full bug discovery**: The Phase 1 instructions explicitly say "There are MULTIPLE bugs" and require documenting each bug with file, location, error, and downstream effects. This forced agents past Bug 1 into the dependency chain.

3. **Phase 2 reinforcement**: "If FINDINGS.md doesn't exist, STOP" and "should list at least 2 bugs" acted as a secondary checkpoint that reinforced the Phase 1 gate.

### The Channel Hierarchy Extends to Process Skills

EXP-127 established Ch2 > Ch1 for judgment tasks (100% vs 0%). EXP-155 now shows the same hierarchy for interruptive process tasks:

| Channel | Judgment (EXP-127) | Interruptive Process (EXP-155) |
|---------|-------------------|-------------------------------|
| Ch1 (skill/text) | 0% | 10% |
| Ch2 (forced externalization) | 100% | 100% |
| Difference | +100pp | +90pp |

The parallel is striking. KE-176 was right that interruptive process steps behave like judgment tasks. And KE-129 was right that Ch2 is the only reliable channel for such behaviors.

### Limitations

1. **The scenario may be particularly well-suited to gates**: The hidden-dependency task has a natural structure (find bugs → fix bugs) that maps cleanly to a 2-phase gate. Tasks without this natural decomposition might not benefit as much.

2. **The hints were generous**: "There are MULTIPLE bugs" and "at least 2 bugs" reduce the discovery difficulty. Without these hints, Ch2 might still force artifact creation (P1) without improving content quality (P2/P3).

3. **Small sample**: 10/10 has a 95% CI of 69–100%. The true rate could be as low as 69%. However, even at 69%, the effect vs baseline (15%) is massive and statistically significant.

4. **Confound: Phase 1 content was also improved**: The treatment didn't just add a gate — it also changed the instructions from "write your thinking in whatever format" to specific bug documentation requirements. The improvement might partly be from better instructions, not just the gate mechanism.

### Connection to Knowledge Base

- **KE-129** (Ch2 only reliable channel): CONFIRMED — extends beyond judgment to interruptive process
- **KE-176** (selective compliance): CONFIRMED — Ch2 gate overcomes the selective compliance failure
- **KE-021** (Process > Knowledge > Judgment): REFINED — interruptive process steps need Ch2 delivery, same as judgment
- **KE-134** (gate stacking): NOT triggered — the hardened gate didn't cause diminishing returns despite being on top of a 3-phase workflow

## Raw Data

### Treatment (10 runs, scenario: exp155-hidden-dep-hard-gate)
```
#970  PASS  Product: 5/5, Process: 4/4
#971  PASS  Product: 5/5, Process: 4/4
#972  PASS  Product: 5/5, Process: 4/4
#973  PASS  Product: 5/5, Process: 4/4
#974  PASS  Product: 5/5, Process: 4/4
#975  PASS  Product: 5/5, Process: 4/4
#976  PASS  Product: 5/5, Process: 4/4
#977  PASS  Product: 5/5, Process: 4/4
#978  PASS  Product: 5/5, Process: 4/4
#979  PASS  Product: 5/5, Process: 4/4
```

### Baseline (20 runs, reused from EXP-154)
```
#327  FAIL  Product: 5/5, Process: 1/4
#331  FAIL  Product: 5/5, Process: 1/4
#337  FAIL  Product: 5/5, Process: 1/4
#341  FAIL  Product: 5/5, Process: 1/4
#345  PASS  Product: 5/5, Process: 4/4
#346  PASS  Product: 5/5, Process: 4/4
#347  PASS  Product: 5/5, Process: 4/4
#349  FAIL  Product: 5/5, Process: 1/4
#353  FAIL  Product: 5/5, Process: 1/4
#355  FAIL  Product: 5/5, Process: 1/4
#359  FAIL  Product: 5/5, Process: 1/4
#362  FAIL  Product: 5/5, Process: 1/4
#364  FAIL  Product: 5/5, Process: 1/4
#368  FAIL  Product: 5/5, Process: 1/4
#371  FAIL  Product: 5/5, Process: 1/4
#374  FAIL  Product: 5/5, Process: 1/4
#378  FAIL  Product: 5/5, Process: 1/4
#382  FAIL  Product: 5/5, Process: 1/4
#386  FAIL  Product: 5/5, Process: 1/4
#388  FAIL  Product: 5/5, Process: 1/4
```

### Ch1 Skill Treatment (10 runs, reused from EXP-154)
```
#960  FAIL  Product: 5/5, Process: 1/4
#961  FAIL  Product: 5/5, Process: 1/4
#962  FAIL  Product: 5/5, Process: 1/4
#963  FAIL  Product: 5/5, Process: 1/4
#964  FAIL  Product: 5/5, Process: 1/4
#965  FAIL  Product: 5/5, Process: 1/4
#966  FAIL  Product: 5/5, Process: 1/4
#967  FAIL  Product: 5/5, Process: 1/4
#968  FAIL  Product: 5/5, Process: 1/4
#969  PASS  Product: 5/5, Process: 4/4
```

## Files

- Treatment scenario: `agents/gym/scenarios/exp155-hidden-dep-hard-gate/`
- Base scenario (soft gate): `agents/gym/scenarios/exp144-hidden-dep-decoupled/`
- EXP-154 results (Ch1 comparison): `agents/shared/knowledge/experiments/EXP-154/results.md`
- KE-176 (selective compliance): `agents/shared/knowledge/entries/KE-176-selective-skill-compliance.md`
- KE-129 (Ch2 channel): `agents/shared/knowledge/entries/KE-129-forced-externalization-only-reliable-channel-judgment.md`
