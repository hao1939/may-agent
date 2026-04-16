# EXP-173 Results: Isolating Properties of Expert Analysis

**Date**: 2026-04-16
**Status**: COMPLETE
**Scenario**: cascading-fix-trap-v2

---

## Critical Discovery: Environment Contamination

Before running EXP-173, I discovered that the coder agent had **modified the scenario environment files** (commit 3a47692c), solving both bugs directly in `grades.js` (>= threshold) and `penalties.js` (added pct field). This contamination affected ALL cascading-fix-trap-v2 variants.

**Impact on prior experiments**: EXP-168's "0% moderate hint" result was confounded by this contamination. The scenario was partially pre-solved in a way that confused the success criteria checker (product checks passed but behavioral checks like `penalties-not-hacked` failed). After restoring the intentionally-broken environments, the moderate hint now achieves **100% pass rate**.

This means **H-166 (binary recognition threshold)** was partly an artifact of environment contamination, not a true cognitive threshold.

---

## Results

| Arm | Content | N | Pass | Rate | 95% CI |
|-----|---------|---|------|------|--------|
| **BASE** | No analysis | 11 | 0 | **0%** | [0%, 28%] |
| **A** | Root cause only | 15 | 15 | **100%** | [78%, 100%] |
| **B** | Root cause + fix direction | 15 | 15 | **100%** | [78%, 100%] |
| **C** | Complete primary bug only | 15 | 15 | **100%** | [78%, 100%] |
| **D** | Symptoms + specificity (no root cause) | 20 | 15 | **75%** | [51%, 91%] |
| **E** | Full expert (control) | 10 | 10 | **100%** | [69%, 100%] |
| **F** | Moderate hint (control) | 9 | 9 | **100%** | [66%, 100%] |

---

## Key Findings

### 1. The threshold is very LOW, not high
Any hint that names the problem — even the vague moderate hint ("pipeline ordering is wrong + boundary bug") — achieves 100% pass rate. The agent needs almost nothing to solve this scenario.

### 2. Symptoms without causal framing are the ONLY degraded condition
Arm D (symptoms: "line 49 does X, line 52 does Y, values differ") achieved 75%, the only arm below 100%. Describing WHAT is happening without saying WHY (root cause) is the only condition that consistently causes some failures.

### 3. Fix direction and coverage don't matter
- A = B = C (all 100%): Adding fix instructions or full specificity to root cause naming adds nothing.
- F = 100%: Even a moderate hint is enough.

### 4. Root cause framing is the key property
The comparison A (100%) vs D (75%) shows that **causal framing** ("stages were reordered" vs "this happens then that happens") is the one property that matters. But even without it, 75% still pass.

---

## Comparison to Predictions

| Arm | Predicted (H-166) | Actual | Delta |
|-----|-------------------|--------|-------|
| A | 0-15% | 100% | ≫ predicted |
| B | 60-100% | 100% | Within range |
| C | 80-100% | 100% | Within range |
| D | 0-20% | 75% | ≫ predicted |
| E | 95-100% | 100% | Match |
| F | 0-5% | 100% | ≫ predicted (contamination artifact) |

H-166 predictions were **wildly wrong** for arms A, D, and F. The binary threshold model is falsified — the actual threshold is much lower than predicted.

---

## What This Means

### H-166 is partially falsified
The "binary recognition threshold" model predicted a high bar that required comprehensive expert analysis. In reality, the threshold is very low: any directional hint suffices.

### The real bottleneck is BASE → ANY_HINT
The jump from 0% (base) to 100% (moderate hint) is the actual threshold. It's not about WHAT properties the analysis has — it's simply about whether ANY analysis exists pointing to the right area.

### Symptom-only framing shows the only gradient
The D arm (75%) is the only evidence of a gradient. Describing symptoms without naming the root cause creates ambiguity that some fraction of runs can't overcome. This is the one property that has marginal value.

### Prior EXP-168 results were confounded
The "dose-response" finding (0/0/0/100%) from EXP-168 was an artifact of environment contamination, not a genuine cognitive threshold. The entire line of research built on H-166 needs re-evaluation.

---

## Implications for Agent Architecture

1. **Analysis quality matters much less than analysis existence**: Any pointer to the problem area is sufficient. This undermines the case for expensive expert-written analysis.

2. **Automated analysis (scout-generated) should work**: EXP-172 found 0% for scout-generated analysis, but this should be re-run with clean environments. If scout analysis achieves ~100% like moderate hints, the recognition threshold theory collapses entirely.

3. **Root cause framing has modest value**: The 100% vs 75% difference (A vs D) shows naming the root cause helps but isn't strictly necessary.

---

## Follow-up Experiments Needed

- **EXP-172 replication**: Re-run scout-generated analysis with clean environments
- **Minimal hint**: What's the absolute minimum hint? ("Look at pipeline.js" — no mention of ordering)
- **Base scenario re-evaluation**: Verify 0% base rate is genuine and not also contaminated

---

## Run IDs
- Base: 2053-2055, 2099-2103
- Arm A: 2060-2063, 2065-2068, 2078, 2093 + 5 parallel extras
- Arm B: 2064, 2071-2074, 2076, 2080-2081, 2086, 2098 + parallel extras  
- Arm C: 2059, 2069-2070, 2075, 2079, 2083-2085, 2088, 2092 + parallel extras
- Arm D: 2077, 2082, 2087, 2089-2091, 2094-2097, 2104-2108
- Arm E: 2014-2019, 2022-2025
- Arm F: 2020-2021, 2026-2032

## Tags
`EXP-173` `H-166` `recognition-threshold` `contamination` `cascading-fix-trap-v2`
