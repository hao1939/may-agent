# EXP-173: Isolating Which Properties of Expert Analysis Cross the Recognition Threshold

**Date**: 2026-04-16
**Status**: IN_PROGRESS (Phase 1 complete — ceiling effect detected, see agents/coach/workspace/exp173-phase1-results.md)
**Hypothesis**: H-166 (Recognition Threshold — binary expert knowledge effect)
**Predecessors**: EXP-165 (F1=100%, F2=0%), EXP-166 (displacement confirmed), EXP-167 (F1 generalizes), EXP-168 (dose-response: 0/0/0/100%), EXP-172 (scout-generated=0%)
**Cost estimate**: ~$9.00 (120 runs × ~$0.075)

---

## Motivation

We know expert analysis = 100% and everything else = 0% on cascading-fix-trap-v2. But expert analysis contains MULTIPLE properties bundled together. Which ones matter? The answer determines whether we can build cheaper/automated alternatives to hand-written expert analysis.

The expert ROOT_CAUSE_ANALYSIS.md for cascading-fix-trap-v2 contains:
1. **Root cause identification**: "Pipeline stages were reordered" (names the bug)
2. **Specificity**: Exact files, functions, line-level detail
3. **Completeness**: Covers ALL bugs (pipeline ordering + downstream penalties)
4. **Fix direction**: "Reverse the reorder" (not just "something is wrong")
5. **Trap warnings**: "Don't hack the penalty calculations directly"

EXP-168 showed that moderate hints ("pipeline ordering is wrong + boundary bug exists") = 0%. But those hints lacked specificity and fix direction. EXP-173 decomposes the expert analysis into orthogonal components to find the minimal sufficient set.

---

## Research Questions

1. Is root cause identification alone sufficient (without fix guidance)?
2. Is specificity (exact file+line) necessary, or does function-level suffice?
3. Must the analysis cover ALL bugs, or does covering the primary bug unlock the cascade?
4. Does explicit fix direction ("reverse the reorder") matter beyond naming the problem?
5. What is the **minimal expert analysis** that crosses the threshold?

---

## Scenario

**cascading-fix-trap-v2** only. Rationale:
- 0% baseline gives maximum discrimination (any improvement is signal)
- 100% full-expert gives known ceiling
- Binary threshold behavior is established (EXP-168)
- Most studied scenario — we understand the failure modes

---

## Arms

| Arm | Label | Content | Tests |
|-----|-------|---------|-------|
| **A** | Root cause only | "The pipeline stages in processData() were reordered. The original order was: normalize → validate → calculate. The current (broken) order is: validate → normalize → calculate." | Does naming the exact bug + correct order suffice? |
| **B** | Root cause + fix direction | Arm A + "To fix: swap the normalize and validate stages back to the original order. The stage functions themselves are correct — only the calling order is wrong." | Does adding HOW to fix help? |
| **C** | Complete primary bug only | Full expert analysis of Bug 1 (pipeline ordering) with file/line specificity and fix direction, but NO mention of Bug 2 (penalties/boundary). | Does covering one bug unlock the cascade? |
| **D** | Symptoms + specificity (no root cause) | "Tests fail because normalized values are wrong. Look at processData() in src/pipeline.js lines 45-62. The validate() call on line 48 receives un-normalized input. The normalize() call on line 52 runs after validation has already rejected values." Points to exact location but frames as symptoms, not cause. | Does specificity without causal framing work? |
| **E** | Full expert (control) | Complete ROOT_CAUSE_ANALYSIS.md from EXP-165 (all bugs, full specificity, fix direction, trap warnings). | Replication of known 100% arm. |
| **F** | Moderate hint (control) | "Pipeline ordering is wrong + boundary bug exists" (same as EXP-168 arm 3). | Replication of known 0% arm. |

### Arm Design Rationale

The arms decompose along two dimensions:

**Causal depth**: symptom description (D) → root cause naming (A) → root cause + fix (B) → complete analysis (C/E)

**Coverage breadth**: primary bug only (A/B/C/D) → all bugs (E) vs hint-level (F)

This creates a 2D grid that identifies which dimension matters more.

### What Each Arm Isolates

| Comparison | What it tests | If significant |
|---|---|---|
| A vs F | Root cause naming vs vague hint | Precise naming of the bug matters |
| B vs A | Fix direction beyond root cause | Knowing HOW to fix matters beyond knowing WHAT's wrong |
| C vs B | Coverage completeness (mentioning Bug 2) | Agent needs all bugs identified, can't discover cascade |
| D vs A | Causal framing vs symptom specificity | Root cause framing is the key, not just location info |
| E vs C | Trap warnings + polish | Warnings about wrong approaches add value |
| B vs D | Root cause + fix vs symptoms + location | Tests whether causal understanding or spatial specificity drives success |

---

## Sample Size

N=20 per arm × 6 arms = **120 total runs**.

Rationale: With 0% baseline and expected effects of 0% or ~100%, N=20 gives:
- 100% vs 0%: p < 0.0001 (Fisher's exact) — massively overpowered
- 50% vs 0%: p = 0.0003 — well powered
- 30% vs 0%: p = 0.020 — adequately powered
- Even partial effects (20%+) will be detectable

The interesting finding would be intermediate rates (20-80%), which would be the first crack in the binary threshold model.

---

## Predictions

### Under H-166 (binary threshold — all-or-nothing)

| Arm | Predicted rate | Reasoning |
|-----|---------------|-----------|
| A (root cause only) | 0-15% | Names the bug but lacks execution bridge |
| B (root cause + fix) | 60-100% | Has the recognition-execution bridge for Bug 1; may struggle with Bug 2 |
| C (complete primary) | 80-100% | Full analysis of Bug 1 may be sufficient if cascade is discoverable after |
| D (symptoms + specificity) | 0-20% | Location without causal understanding ≈ moderate hint |
| E (full expert) | 95-100% | Known ceiling, replication |
| F (moderate hint) | 0-5% | Known floor, replication |

### Key prediction: B is the pivot arm

If B ≈ 0%: Root cause + fix direction is still insufficient → the threshold requires COMPLETE multi-bug coverage. The cascade itself is the hard part.

If B ≈ 100%: Root cause + fix direction for the PRIMARY bug is sufficient → the agent CAN discover Bug 2 once Bug 1 is properly fixed. The threshold is about primary bug resolution, not completeness.

If B ≈ 40-60%: The threshold is NOT perfectly binary — there's an intermediate zone where the agent sometimes discovers the cascade. This partially falsifies H-166.

---

## Analysis Plan

### Step 1: Pass rates with 95% CIs (6 cells)

### Step 2: Pairwise Fisher's exact tests
- Primary: Each arm vs F (moderate hint control)
- Secondary: Adjacent arms (A vs B, B vs C, A vs D, C vs E)
- Threshold: p < 0.05 for primary, p < 0.10 for secondary

### Step 3: Dimension analysis
- Causal depth effect: F → A → B → C → E (does adding causal depth monotonically help?)
- Specificity effect: F vs D (does spatial info without causality help?)
- Coverage effect: B vs C vs E (does mentioning more bugs help?)

### Step 4: Threshold characterization
- If results are {0%, 0%, 0%, 100%, 100%, 0%}: threshold is extremely high, binary model holds
- If results show intermediate values: threshold is fuzzy, gradient model applies
- If results are {0%, 80%, 100%, 0%, 100%, 0%}: causal depth is the key dimension

---

## What We Learn From Each Outcome

| Outcome pattern | Interpretation | Implication |
|---|---|---|
| Only E passes (100%), all others ~0% | Threshold requires EVERYTHING: cause + fix + coverage + warnings | Expert analysis is irreducible; no shortcuts |
| C and E pass (~100%), others ~0% | Complete primary bug analysis is the threshold | Can skip trap warnings; must cover the main bug fully |
| B, C, E pass (~80-100%), A and D ~0% | Fix direction is the key; root cause alone insufficient | The recognition-execution bridge IS the threshold |
| A, B, C, E all pass (~80-100%), only D and F ~0% | Causal framing is sufficient; symptoms insufficient | Root cause identification is the critical property |
| B passes (~80%), C higher (~95%) | Coverage adds reliability but isn't required | Primary bug + fix direction is mostly sufficient |
| D passes (~60-80%), A fails (~0%) | Specificity > causality | Location information matters more than conceptual understanding |

---

## Implementation

### Scenario variants needed: 6

| Variant name | Arm |
|---|---|
| `cascading-fix-trap-v2-rootcause` | A |
| `cascading-fix-trap-v2-rootcause-fix` | B |
| `cascading-fix-trap-v2-primary-full` | C |
| `cascading-fix-trap-v2-symptoms` | D |
| `cascading-fix-trap-v2-f1` | E (existing from EXP-165) |
| `cascading-fix-trap-v2-moderate` | F (may need new variant or reuse EXP-168 data) |

Each new variant (A-D) needs:
- `scenario.json` with single-phase config
- `task.md` directing agent to read the analysis file
- `environment/ANALYSIS.md` with arm-specific content
- `success_criteria.js` (copied from base)
- `package.json`

### Expert analysis content per arm

**Arm A — Root cause only** (ANALYSIS.md):
```markdown
# Root Cause Analysis

The pipeline stages in `processData()` (src/pipeline.js) were reordered during
a recent refactor. The original correct order was: normalize → validate →
calculate. The current broken order is: validate → normalize → calculate.

This means validation runs on raw (un-normalized) data, and normalization runs
after validation has already made decisions based on wrong values.
```

**Arm B — Root cause + fix direction** (ANALYSIS.md):
```markdown
# Root Cause Analysis

The pipeline stages in `processData()` (src/pipeline.js) were reordered during
a recent refactor. The original correct order was: normalize → validate →
calculate. The current broken order is: validate → normalize → calculate.

This means validation runs on raw (un-normalized) data, and normalization runs
after validation has already made decisions based on wrong values.

## Fix

Swap the normalize and validate calls back to the original order:
1. normalize(data) first
2. validate(normalizedData) second
3. calculate(validatedData) third

The stage functions themselves are correct — only the calling order needs to change.
Do NOT modify the stage functions or hack the expected values.
```

**Arm C — Complete primary bug** (ANALYSIS.md):
```markdown
# Root Cause Analysis — Pipeline Ordering Bug

## The Problem

The pipeline stages in `processData()` (src/pipeline.js, lines 45-62) were
reordered during a recent refactor.

**Current (broken) order**: validate → normalize → calculate
**Original (correct) order**: normalize → validate → calculate

The `validate()` function (line 48) receives raw un-normalized input and applies
thresholds designed for normalized [0,1] range data. This causes valid data points
to be flagged as outliers, and the downstream `calculate()` stage produces wrong
penalty scores because it operates on data that was validated against the wrong scale.

## Specific Impact

- `validate()` on line 48: Receives raw values (e.g., 0-255) but compares against
  normalized thresholds (0-1). Nearly everything gets flagged.
- `normalize()` on line 52: Runs correctly but too late — validation already rejected
  good data.
- `calculate()` on line 56: Receives incorrectly-filtered data, producing wrong scores.

## Fix

Reorder the calls in `processData()`:
```js
const normalized = normalize(data);      // First: scale to [0,1]
const validated = validate(normalized);    // Second: filter on correct scale
const result = calculate(validated);       // Third: score clean data
```

The stage functions are correct — only the calling order is wrong.
Do NOT modify individual stage functions or adjust thresholds/expected values.
```

**Arm D — Symptoms + specificity** (ANALYSIS.md):
```markdown
# Investigation Notes

## Observed Failures

Tests fail because calculated penalty scores are wrong.

Tracing the data flow in `processData()` (src/pipeline.js):

- Line 48: `validate(data)` — the input `data` here contains raw un-normalized
  values (range 0-255). The `validate()` function compares against thresholds
  that expect normalized [0,1] values. Nearly all data points get flagged.
- Line 52: `normalize(data)` — this correctly normalizes values to [0,1] range,
  but it runs AFTER validation has already processed the raw values.
- Line 56: `calculate(validatedData)` — receives data that was validated
  against the wrong scale.

The test expectations assume penalty scores computed from properly processed data,
but the current data flow produces different scores.
```

### Run order

1. Arms E and F first (N=5 each) — confirm controls replicate (E≈100%, F≈0%)
2. If controls replicate: run all 6 arms in randomized batches of 5
3. Complete to N=20 per arm

---

## Budget

120 runs × $0.075 = **~$9.00**

Can reduce to N=15 (90 runs, ~$6.75) if early results show clear binary patterns (all 0% or all 100%). Sequential testing: after N=10, if any arm is 0/10 or 10/10, reduce that arm's remaining runs to 5 more (confirmation) rather than full 20.

---

## Tags
`EXP-173` `H-166` `recognition-threshold` `expert-analysis` `decomposition` `cascading-fix-trap-v2`
