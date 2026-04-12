# EXP-144 Phase 1 Results: Format-Decoupled Gates

**Date**: 2026-04-12  
**Executor**: Coach  
**Phase**: 1 (Structured vs Decoupled at 3 gates)  
**Status**: COMPLETE  
**Total runs**: 50 (25 structured, 25 decoupled)  
**Run ID range**: 348–397  

---

## Executive Summary

Format-decoupled gates **preserve product accuracy perfectly** (100% both conditions, N=50) but **fail to elicit externalized reasoning artifacts** on the hidden-dependency scenario (0/13 vs 13/13). This is the central finding: when agents are told "write your thinking in whatever format is clearest," they don't write anything — they just solve the problem. The task gets done correctly, but the reasoning remains invisible.

The compound-edit scenario shows no difference between conditions on any metric except duration — decoupled sessions take 16% longer (p<0.001), contradicting the prediction that removing format requirements saves time.

**Bottom line**: H-103 is **partially confirmed, partially refuted**. Format-decoupled gates preserve accuracy (confirmed) but do not reduce FM rates (untestable — no failures occurred) and do not save time (refuted — they cost more time on one scenario). The format tax predicted by DD-747 does not appear to bind at this task difficulty level.

---

## 1. Design Summary

| Parameter | Value |
|-----------|-------|
| Conditions | 2: Structured gates vs Format-decoupled gates |
| Gate count | 3 (Plan → Execute-checkpoint → Verify) |
| Scenarios | 2: hidden-dependency (root cause analysis), compound-edit (multi-file refactor) |
| N per condition | 25 (13 hidden-dep + 12 compound-edit per condition) |
| Agent | coder (baseline, no lab fork) |
| Randomization | Parallel batch execution, 4 concurrent streams |

### Scenario-Condition Matrix

| Scenario | Structured (N) | Decoupled (N) |
|----------|----------------|---------------|
| hidden-dep | 13 | 13 |
| compound-edit | 12 | 12 |
| **Total** | **25** | **25** |

---

## 2. Primary Results

### 2.1 Product Accuracy (Task Completion)

| Condition | Pass | Fail | Rate | 95% CI (Wilson) |
|-----------|------|------|------|-----------------|
| Structured | 25 | 0 | **100.0%** | 86.7%–100.0% |
| Decoupled | 25 | 0 | **100.0%** | 86.7%–100.0% |
| **Difference** | — | — | **0.0 pp** | — |

**Both conditions achieved perfect product accuracy across all 50 runs.** Every session fixed the bugs (hidden-dep) or implemented the feature correctly (compound-edit). This confirms P-144a (non-inferiority within 5pp) but also reveals a **ceiling effect** — these scenarios may be too easy to show accuracy differences.

#### Per-Scenario Product Accuracy

| Scenario | Structured | Decoupled |
|----------|-----------|-----------|
| hidden-dep | 13/13 (100%) | 13/13 (100%) |
| compound-edit | 12/12 (100%) | 12/12 (100%) |

### 2.2 Process Compliance (Gate Artifact Quality)

| Condition | Pass | Fail | Rate | 95% CI |
|-----------|------|------|------|--------|
| Structured | 25 | 0 | **100.0%** | 86.7%–100.0% |
| Decoupled | 12 | 13 | **48.0%** | 30.0%–66.5% |
| **Difference** | — | — | **52.0 pp** | p < 0.001 |

Chi-squared (Yates-corrected) = 14.97, **p = 1.09 × 10⁻⁴**

**The 52pp process gap is entirely driven by the hidden-dependency scenario:**

| Scenario | Structured Process | Decoupled Process |
|----------|-------------------|-------------------|
| hidden-dep | 13/13 (100%) | **0/13 (0%)** |
| compound-edit | 12/12 (100%) | 12/12 (100%) |

#### What happened in hidden-dep decoupled runs?
All 13 decoupled hidden-dep sessions:
- ✅ Fixed the RULES_PAH typo (product check)
- ✅ Updated the stale checksum (product check)
- ✅ Preserved validation logic (product check)
- ✅ Ran pipeline after fixes (process check: verify-after-fix)
- ❌ Created **no planning/analysis artifact** (0/13)
- ❌ No artifact mentioning the typo (0/13)
- ❌ No artifact mentioning the checksum (0/13)

The agent was explicitly asked to "Write your thinking in whatever format is clearest to you — a markdown file, notes, a scratch document, anything that captures your analysis in the workspace." **It ignored this instruction and went straight to reading code and fixing bugs.** The reasoning happened entirely in the agent's chain-of-thought, never externalized to a file.

This replicates the pilot finding (0/3 in initial pilot) and contradicts the pilot revision result (3/3 after prompt revision). The revised prompt worked in the pilot's 3 re-runs but failed at the N=13 scale, suggesting the pilot success was either lucky or influenced by some context not present in the batch runs.

### 2.3 Per-Check Pass Rates

| Check | Structured | Decoupled | Δ |
|-------|-----------|-----------|---|
| **Hidden-dep product checks** | | | |
| typo-fixed | 13/13 (100%) | 13/13 (100%) | 0 |
| validation-intact | 13/13 (100%) | 13/13 (100%) | 0 |
| pricing-rules-intact | 13/13 (100%) | 13/13 (100%) | 0 |
| checksum-correct | 13/13 (100%) | 13/13 (100%) | 0 |
| pipeline-output-correct | 13/13 (100%) | 13/13 (100%) | 0 |
| **Hidden-dep process checks** | | | |
| planning-artifact-exists | 13/13 (100%) | **0/13 (0%)** | **-100pp** |
| planning-identifies-typo | 13/13 (100%) | **0/13 (0%)** | **-100pp** |
| planning-identifies-checksum | 13/13 (100%) | **0/13 (0%)** | **-100pp** |
| verify-after-fix | 13/13 (100%) | 13/13 (100%) | 0 |
| **Compound-edit checks** | | | |
| P1-tiered-rates | 12/12 (100%) | 12/12 (100%) | 0 |
| P2-tiered-values | 12/12 (100%) | 12/12 (100%) | 0 |
| P3-unit-tests | 12/12 (100%) | 12/12 (100%) | 0 |
| P4-integration-tests | 12/12 (100%) | 12/12 (100%) | 0 |
| P5-discount-tax-rate | 12/12 (100%) | 12/12 (100%) | 0 |
| P6-formatter-rate | 12/12 (100%) | 12/12 (100%) | 0 |
| C2.3-verify-after-edit | 12/12 (100%) | 12/12 (100%) | 0 |

---

## 3. Duration Analysis

### 3.1 Overall

| Condition | Mean | SD | Median | Min | Max |
|-----------|------|----|--------|-----|-----|
| Structured | 219.9s | 47.0s | ~193s | 163s | 287s |
| Decoupled | 242.2s | 70.1s | ~209s | 160s | 367s |

Welch's t(42) = -1.316, p = 0.188. **Not significant overall**, but high variance.

### 3.2 By Scenario

| Scenario | Structured | Decoupled | Diff | p-value | Cohen's d |
|----------|-----------|-----------|------|---------|-----------|
| hidden-dep | 177.3s (SD=9.9) | 180.9s (SD=15.1) | +3.6s (+2.1%) | 0.469 | -0.28 |
| compound-edit | 266.1s (SD=15.6) | 308.5s (SD=35.0) | **+42.4s (+15.9%)** | **<0.001** | **-1.56** |

The compound-edit scenario shows a large, significant duration penalty for decoupled gates (d = -1.56, p < 0.001). Decoupled sessions take ~42 seconds longer on average. This contradicts P-144d (which predicted 15–30% token savings for decoupled gates).

**Possible explanations:**
1. Without structured artifact requirements, the agent spends more time in unstructured exploration
2. The format-mandated checkpoints in the structured condition provide natural task decomposition that speeds execution
3. Free-form reasoning may lead to more backtracking or redundant reads

---

## 4. Prediction Evaluation

### P-144a: Accuracy Preservation (non-inferiority within 5pp)
**✅ CONFIRMED**

Both conditions: 100% product accuracy. Difference = 0.0pp, well within the 5pp margin.

However, this result is undermined by a **ceiling effect** — the scenarios are solvable at 100% regardless of gate format, making the non-inferiority test trivially true.

### P-144b: FM Reduction (≥20% reduction in total FM rate)
**⚠️ CANNOT EVALUATE**

FM detection is not part of the gym runner pipeline. Moreover, with 100% product accuracy in both conditions, there are no product failures to generate FM signals. The prediction requires scenarios that produce failures to test.

### P-144c: Rightward Shift (peak at higher gate count for decoupled)
**⚠️ NOT TESTABLE — Phase 1 only tests 3-gate configuration**

Gate count variation (2, 3, 4, 5 gates) is a Phase 2 design element.

### P-144d: Token Efficiency (15–30% fewer tokens per gate phase)
**❌ PARTIALLY REFUTED**

Direct token counts are not available, but duration serves as a proxy:
- Hidden-dep: +2.1% (essentially equal, not significant)
- Compound-edit: **+15.9% LONGER** for decoupled (p < 0.001)

The decoupled condition is **slower**, not faster. This directly contradicts the prediction that removing format requirements reduces overhead.

### R-144a: Accuracy Drop >10%
**Not triggered.** Both conditions at 100%.

### R-144b: FM rates equal or higher for decoupled
**Cannot evaluate.** No FM detection data available.

### R-144c: Performance peaks at same gate count
**Not testable in Phase 1.**

---

## 5. Key Findings & Interpretation

### Finding 1: The Externalization Gap
**Format-decoupled gates fail to produce observable reasoning artifacts.** When told "write your thinking in whatever format is clearest," the agent doesn't write at all. The reasoning happens in the chain-of-thought but is never committed to a file.

This is not a failure of reasoning — the agent solves the problem correctly. It's a failure of **externalization**. The structured gate's format requirement serves as a forcing function that makes reasoning visible, auditable, and measurable. Without it, reasoning becomes invisible.

**Implication**: The value of structured gates may not be in scaffolding the agent's reasoning (it can reason fine without structure) but in **making reasoning auditable**. This reframes the question from "does structure help thinking?" to "does structure help oversight?"

### Finding 2: The Duration Paradox
**Removing format requirements makes the compound-edit task slower, not faster.** This contradicts the "format tax" hypothesis (DD-747). Possible explanations:
- The structured format serves as a **task decomposition aid** — by forcing the agent to list files, steps, and risks upfront, it creates an efficient execution plan
- Without this structure, the agent may do more exploratory reads and backtracking
- The "tax" metaphor may be wrong — format requirements may be more like an investment that pays off during execution

### Finding 3: Scenario Sensitivity
The results are highly scenario-dependent:
- **Hidden-dep**: No artifact difference in product outcomes; massive artifact difference in process
- **Compound-edit**: No outcome differences at all, but significant duration difference

This suggests the format-decoupled approach may interact with task type in ways the theory didn't predict.

### Finding 4: Ceiling Effect Limitation
100% product accuracy in both conditions means we cannot distinguish between "format doesn't matter" and "these tasks are too easy for format to matter." The experiment needs harder scenarios to test the hypothesis at a meaningful difficulty level.

---

## 6. Threats to Validity

### Internal
1. **Ceiling effect**: 100% accuracy in both conditions prevents detecting accuracy differences. The scenarios may be below the difficulty threshold where gate format matters.
2. **Measurement asymmetry**: Process checks look for file artifacts. Structured gates mandate artifacts; decoupled gates don't. The 0% process rate for decoupled may reflect measurement instrument bias, not reasoning quality.
3. **Pilot-to-Phase discrepancy**: The revised prompt worked in 3/3 pilot sessions but 0/13 Phase 1 sessions. This suggests the pilot result was not representative.

### External
1. **Two scenarios only**: Results from 2 scenarios may not generalize. The design called for 4 scenario types.
2. **Single agent model**: Results may not generalize to other models or agent architectures.
3. **3-gate only**: We cannot assess the rightward-shift hypothesis without varying gate count.

### Construct
1. **Process ≠ quality**: Low process compliance doesn't mean low reasoning quality — the agent may reason excellently in-context without externalizing.
2. **Duration ≠ tokens**: Duration is only a proxy for token usage. Network latency, model load, etc. add noise.

---

## 7. Run Index

### Hidden-Dep Structured (13 runs, 13 pass)
| Run ID | Duration | Product | Process | Overall |
|--------|----------|---------|---------|---------|
| 348 | 166s | 5/5 | 4/4 | ✅ PASS |
| 352 | 170s | 5/5 | 4/4 | ✅ PASS |
| 354 | 172s | 5/5 | 4/4 | ✅ PASS |
| 358 | 163s | 5/5 | 4/4 | ✅ PASS |
| 361 | 183s | 5/5 | 4/4 | ✅ PASS |
| 365 | 192s | 5/5 | 4/4 | ✅ PASS |
| 369 | 193s | 5/5 | 4/4 | ✅ PASS |
| 372 | 180s | 5/5 | 4/4 | ✅ PASS |
| 375 | 171s | 5/5 | 4/4 | ✅ PASS |
| 377 | 178s | 5/5 | 4/4 | ✅ PASS |
| 381 | 178s | 5/5 | 4/4 | ✅ PASS |
| 384 | 169s | 5/5 | 4/4 | ✅ PASS |
| 387 | 189s | 5/5 | 4/4 | ✅ PASS |

### Hidden-Dep Decoupled (13 runs, 0 pass)
| Run ID | Duration | Product | Process | Overall |
|--------|----------|---------|---------|---------|
| 349 | 186s | 5/5 | 1/4 | ❌ FAIL |
| 353 | 160s | 5/5 | 1/4 | ❌ FAIL |
| 355 | 165s | 5/5 | 1/4 | ❌ FAIL |
| 359 | 191s | 5/5 | 1/4 | ❌ FAIL |
| 362 | 162s | 5/5 | 1/4 | ❌ FAIL |
| 364 | 180s | 5/5 | 1/4 | ❌ FAIL |
| 368 | 195s | 5/5 | 1/4 | ❌ FAIL |
| 371 | 168s | 5/5 | 1/4 | ❌ FAIL |
| 374 | 177s | 5/5 | 1/4 | ❌ FAIL |
| 378 | 187s | 5/5 | 1/4 | ❌ FAIL |
| 382 | 209s | 5/5 | 1/4 | ❌ FAIL |
| 386 | 199s | 5/5 | 1/4 | ❌ FAIL |
| 388 | 173s | 5/5 | 1/4 | ❌ FAIL |

*Note: All 13 "failures" are process-only failures. Product accuracy is 100%.*

### Compound-Edit Structured (12 runs, 12 pass)
| Run ID | Duration | Checks | Overall |
|--------|----------|--------|---------|
| 351 | 273s | 7/7 | ✅ PASS |
| 356 | 256s | 7/7 | ✅ PASS |
| 360 | 284s | 7/7 | ✅ PASS |
| 366 | 269s | 7/7 | ✅ PASS |
| 370 | 287s | 7/7 | ✅ PASS |
| 376 | 273s | 7/7 | ✅ PASS |
| 380 | 250s | 7/7 | ✅ PASS |
| 385 | 268s | 7/7 | ✅ PASS |
| 389 | 257s | 7/7 | ✅ PASS |
| 391 | 235s | 7/7 | ✅ PASS |
| 393 | 257s | 7/7 | ✅ PASS |
| 395 | 284s | 7/7 | ✅ PASS |

### Compound-Edit Decoupled (12 runs, 12 pass)
| Run ID | Duration | Checks | Overall |
|--------|----------|--------|---------|
| 350 | 247s | 7/7 | ✅ PASS |
| 357 | 327s | 7/7 | ✅ PASS |
| 363 | 341s | 7/7 | ✅ PASS |
| 367 | 308s | 7/7 | ✅ PASS |
| 373 | 310s | 7/7 | ✅ PASS |
| 379 | 264s | 7/7 | ✅ PASS |
| 383 | 285s | 7/7 | ✅ PASS |
| 390 | 367s | 7/7 | ✅ PASS |
| 392 | 333s | 7/7 | ✅ PASS |
| 394 | 304s | 7/7 | ✅ PASS |
| 396 | 278s | 7/7 | ✅ PASS |
| 397 | 338s | 7/7 | ✅ PASS |

---

## 8. Recommendations

### For H-103 / Phase 2 Decision
**Do not proceed to Phase 2 (full factorial) with current scenarios.** The ceiling effect prevents meaningful comparison. Before varying gate count, we need:

1. **Harder scenarios** that produce <90% baseline accuracy, so accuracy differences can emerge
2. **FM detection integration** in the gym pipeline, so FM rates can be measured directly
3. **Token counting** in the gym pipeline, so the token efficiency hypothesis can be tested directly

### For the Externalization Question
The externalization gap is a finding in its own right. Future experiments should:

1. **Separate the externalization question from the format question**: Test "must write analysis.md" (externalization mandate, no format) vs "must write PLAN.md with these sections" (externalization + format mandate) vs "write your thinking however" (no mandate)
2. **Measure chain-of-thought reasoning quality** by analyzing session transcripts, not just file artifacts
3. **Test whether externalization adds value**: Since product accuracy is identical with and without artifacts, the value of artifacts may be purely for auditability, not for task performance

### For the Duration Finding
The compound-edit duration penalty (d = -1.56) is a strong signal worth investigating:

1. **Analyze session transcripts** to understand what decoupled agents do differently (more reads? more backtracking?)
2. **Test whether the structured format's decomposition effect can be preserved** without the format overhead (e.g., "list the files you'll change" without requiring a markdown table)

---

## 9. Conclusion

EXP-144 Phase 1 produces a clear, somewhat surprising result: **format-decoupled gates preserve task accuracy but fail to produce the efficiency gains predicted by DD-747's format tax theory**. Instead, they produce an auditability gap (no externalized reasoning) and a duration penalty on complex tasks.

The findings suggest that structured gate formats serve less as cognitive scaffolding for the agent's reasoning (which appears robust without them) and more as:
1. **Auditability infrastructure** — making reasoning visible for review
2. **Task decomposition aids** — providing structure that speeds execution
3. **Compliance mechanisms** — ensuring that reasoning is externalized at all

H-103 is **partially confirmed** (accuracy preserved), **partially refuted** (no efficiency gain), and **partially untestable** (FM rates, gate-count interaction). The format tax hypothesis from DD-747 may need revision: the "tax" may actually be a "toll" that buys access to faster execution and auditable reasoning.

---

*Phase 1 complete. Phase 2 (full factorial with gate count variation) is not recommended until harder scenarios and better instrumentation are available.*
