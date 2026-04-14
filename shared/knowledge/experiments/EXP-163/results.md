# EXP-163 Results: H-161 Independence Test — Dual IT Function of Artifacts

**Date**: 2026-04-14
**Status**: COMPLETE (INCONCLUSIVE — ceiling effect invalidates primary metric)
**Runs**: 63 total (26 baseline, 15 F1-only, 7 F2-only, 15 full-gate)
**Cost**: ~$4.40 (63 runs × ~$0.07)

---

## Executive Summary

**EXP-163 cannot adjudicate H-161 because the hidden-dependency scenario has a ceiling effect on product checks.** All arms — including the unassisted baseline — achieve 100% product pass rate. The agent solves both bugs (typo fix + checksum recomputation) every time regardless of whether artifacts, gates, or information are provided. The only differentiation is on process checks (whether a planning artifact exists), which is a design property of the arm, not a behavioral outcome.

**Critical retroactive finding**: This ceiling existed in ALL prior experiments using this scenario. EXP-154's baseline (11.8% overall = 4/34) and EXP-155's treatment (85.7% overall = 12/14) both had **100% product pass rates**. The entire "forced externalization effect" reported in those experiments was measuring process compliance (does the agent create FINDINGS.md?), not task quality improvement.

---

## Raw Results

### Overall Pass Rate (Product + Process)

| Arm | Label | Runs | Overall Pass | Rate | 95% CI |
|-----|-------|------|-------------|------|--------|
| A | Full Gate (F1+F2) | 15 | 15 | **100%** | [78%, 100%] |
| B | F2-Only | 7 | 7 | **100%** | [59%, 100%] |
| C | F1-Only | 15 | 15 | **100%** | [78%, 100%] |
| D | Baseline | 26 | 0 | **0%** | [0%, 13%] |

### Product Pass Rate (Primary Planned Metric)

| Arm | Label | Runs | Product Pass | Rate |
|-----|-------|------|-------------|------|
| A | Full Gate (F1+F2) | 15 | 15 | **100%** |
| B | F2-Only | 7 | 7 | **100%** |
| C | F1-Only | 15 | 15 | **100%** |
| D | Baseline | 26 | 26 | **100%** |

**All arms achieve 100% on all 5 product checks.** There is zero variance to analyze.

### Individual Check Pass Rates

| Check | Category | Arm A (n=15) | Arm B (n=7) | Arm C (n=15) | Arm D (n=26) |
|-------|----------|-------------|-------------|-------------|-------------|
| typo-fixed | product | 100% | 100% | 100% | 100% |
| validation-intact | product | 100% | 100% | 100% | 100% |
| pricing-rules-intact | product | 100% | 100% | 100% | 100% |
| checksum-correct | product | 100% | 100% | 100% | 100% |
| pipeline-output-correct | product | 100% | 100% | 100% | 100% |
| planning-artifact-exists | process | 100% | 100% | 100% | **0%** |
| planning-identifies-typo | process | 100% | 100% | 100% | **0%** |
| planning-identifies-checksum | process | 100% | 100% | 100% | **0%** |
| verify-after-fix | process | 100% | 100% | 100% | 100% |

The baseline fails ONLY on process checks P1-P3 (artifact existence and content), which require a .md file to exist. The baseline task doesn't ask the agent to create one, so these checks always fail. This is a design artifact, not a behavioral finding.

---

## Why This Happened: Ceiling Effect Analysis

### The Hidden-Dependency Scenario Is Too Easy

The scenario has two bugs:
1. **Bug 1** (RULES_PAH typo): Produces an immediate runtime error. Trivially discoverable.
2. **Bug 2** (stale checksum): Manifests AFTER Bug 1 is fixed. The agent runs `node process.js`, sees a new error, and fixes it.

The original hypothesis (from EXP-154/EXP-155 design) assumed Bug 2 would be "hidden" — that agents would fix Bug 1 and declare victory without discovering Bug 2. **This does not happen.** The agent's natural workflow is:

1. Read code, find the typo → fix it
2. Run `node process.js` → new error about checksum
3. Investigate checksum → fix it
4. Run `node process.js` → success

The `verify-after-fix` check passes 100% across all arms, confirming agents ALWAYS run the pipeline after fixing. This natural verification loop surfaces Bug 2 deterministically. The "hidden" dependency is not actually hidden from the agent's perspective — it's just a second error that appears in sequence.

### Retroactive Reinterpretation of EXP-154 and EXP-155

| Experiment | Reported Effect | Actual Mechanism |
|------------|----------------|-----------------|
| EXP-154 baseline | 15% overall (3/20) | 100% product, 15% process. Agents solve bugs but don't create planning artifacts. |
| EXP-155 treatment | 100% overall (10/10) | 100% product, 100% process. Hard gate forces FINDINGS.md creation. Product was already at ceiling. |
| Reported "85pp improvement" | "Forced externalization helps agents find hidden bugs" | Actually: forced externalization makes agents create .md files (which is definitionally required by the gate). No product quality improvement because product was already maxed. |

**KE-129's "100% vs 0% on forced externalization" was actually measuring artifact compliance, not task performance.** This is a significant reinterpretation.

---

## What We CAN Conclude

### 1. The Agent Is Already Competent at This Task
The agent solves a two-bug pipeline task 100% of the time without assistance. This means:
- Bug 2 is NOT actually "hidden" for this agent/model — sequential error discovery surfaces it reliably
- F1 (memory compression) provides no product benefit because the agent doesn't need the information
- F2 (behavioral forcing) provides no product benefit because the agent already investigates thoroughly

### 2. Process Compliance Follows Instructions, Not Gates
- Arms A, B, C all achieve 100% process compliance because the task explicitly involves FINDINGS.md (either producing or reading it)
- Baseline achieves 0% process compliance because the task doesn't mention any artifact
- This is instruction-following, not behavioral change

### 3. The F2-Only Arm Shows Interesting Compliance
In 7/7 F2-only runs, the agent produced FINDINGS.md (Phase 1) AND the process checks pass (meaning the artifact identifies both bugs). The transcripts were not stored, so we cannot verify whether Phase 2 read FINDINGS.md despite instructions not to. However, the product result is the same as baseline (100%), so it doesn't matter.

---

## Statistical Tests (As Planned, For Completeness)

### Product Pass Rate Comparisons (Fisher's Exact)

All comparisons are 100% vs 100% — no test is meaningful.

| Comparison | Rate A | Rate B | p-value | Verdict |
|-----------|--------|--------|---------|---------|
| A vs D | 100% vs 100% | — | NS | No difference |
| C vs D | 100% vs 100% | — | NS | No difference |
| B vs D | 100% vs 100% | — | NS | No difference |
| A vs B | 100% vs 100% | — | NS | No difference |
| A vs C | 100% vs 100% | — | NS | No difference |

### Overall Pass Rate Comparisons (Fisher's Exact)

| Comparison | Rates | p-value | Note |
|-----------|-------|---------|------|
| A vs D | 15/15 vs 0/26 | p < 0.0001 | Significant, but confounded (gate creates artifact definitionally) |
| C vs D | 15/15 vs 0/26 | p < 0.0001 | Significant, but confounded (pre-written artifact provided) |
| B vs D | 7/7 vs 0/26 | p < 0.0001 | Significant, but confounded (gate creates artifact in Phase 1) |

These p-values are meaningless — they measure whether "a task that requires FINDINGS.md results in FINDINGS.md existing" vs "a task that doesn't mention FINDINGS.md results in FINDINGS.md not existing." This is tautological.

### Additivity Analysis

Cannot be computed — all arms are at ceiling (100% product), so:
- F1_effect = pC - pD = 100% - 100% = 0%
- F2_effect = pB - pD = 100% - 100% = 0%
- Combined_effect = pA - pD = 100% - 100% = 0%

---

## Hypothesis Verdict: INCONCLUSIVE

EXP-163 **cannot adjudicate H-161** because the primary metric (product pass rate) shows no variance. The experiment fails due to scenario selection, not hypothesis invalidity.

### Decision per Pre-Registered Criteria

| Criterion | Design Target | Actual | Met? |
|-----------|--------------|--------|------|
| C > D by ≥25pp (product) | Primary F1 test | 0pp difference | ❌ Not met (ceiling) |
| B > D by ≥15pp (product) | Primary F2 test | 0pp difference | ❌ Not met (ceiling) |
| Additivity analysis | Core independence test | Cannot compute | ❌ N/A |

**Verdict**: H-161 remains at prior probability (P = 0.72). No Bayesian update.

---

## Implications and Recommendations

### 1. KE-129 Needs Reinterpretation
KE-129 ("100% vs 0% on forced externalization") should be updated to note that the effect was on process compliance, not product quality. The agent already solves the hidden-dep scenario at 100% product rate without any intervention.

**New interpretation**: Forced externalization gates reliably produce planning artifacts (compliance effect), but we have no evidence they improve task outcomes on this scenario. The product quality effect is **untested** — we need a harder scenario to measure it.

### 2. Need a Harder Scenario to Test H-161
Requirements for a valid H-161 test scenario:
- **Baseline product pass rate of 30-70%** (room to improve AND fail)
- **Failure mode that artifacts could help with** (not just sequential error discovery)
- **Bug 2 must be genuinely hidden** — not surfaced by running the program after fixing Bug 1
- Candidates:
  - Multi-file bugs where fixing one reveals a DIFFERENT file has issues (not a clear error message)
  - Logic bugs that produce subtly wrong output (not crashes)
  - Race conditions or state-dependent bugs
  - Tasks requiring integration across 3+ files where the dependency graph is non-obvious

### 3. Process Checks Are Not Outcome Metrics
The success_criteria.js conflates process compliance (did the agent create a .md?) with task outcomes (did the agent fix the bugs?). Future experiments should:
- Use **product checks only** as the primary outcome metric
- Use process checks as **descriptive/diagnostic** metrics, not in the overall pass/fail

### 4. Incomplete Runs
The F2-only arm has only 7/10 planned runs (session was interrupted). Given the ceiling effect, completing the remaining 3 runs would not change any conclusions.

---

## Data Inventory

- **62 gym runs** in .state/may.db (table: gym_runs, scenarios: exp163-*)
- **4 scenario directories** in agents/gym/scenarios/exp163-*
- **No transcripts** stored (transcript column is empty)
- **Design document**: agents/shared/knowledge/experiments/EXP-163/design.md

---

## Tags
`EXP-163` `H-161` `INCONCLUSIVE` `ceiling-effect` `hidden-dependency` `process-vs-product` `KE-129-reinterpretation`
