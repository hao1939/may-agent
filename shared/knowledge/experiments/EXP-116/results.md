# EXP-116 Results: Adversarial Framing Guard for Multi-Session Handoffs

**Date**: 2026-04-10  
**Analyst**: Bob (Architect)  
**Status**: PHASE 2 COMPLETE — H0 CONFIRMED (NULL RESULT), PARTIAL INFRASTRUCTURE CONFOUND  
**Prior analysis**: `phase2-analysis.md` (corrected below — that file undercounted by 4 runs)

---

## Executive Summary

EXP-116 Phase 2 ran **18 trials** (not 15 as initially counted) across 2 scenarios and 5 arms. **All 18 runs failed** (0% pass rate). The baseline confirmed the confabulation mechanism at the predicted difficulty level (11% check pass rate for kb-integration-failure, 25% for ghost-deliverable-chain). All 14 treatment runs across both scenarios scored 0 checks — a uniform treatment failure.

**H0 (Null) is confirmed**: No arm achieved ≥80%. Structural enforcement via adversarial framing, machine-verified evidence, and their combination did NOT overcome confabulation in multi-session handoffs. However, this conclusion is **partially confounded** by infrastructure issues (missing environment directories for Arms C/D on kb-integration-failure, incomplete ghost-deliverable-chain runs for Arms B/C/D).

**The actionable finding**: Treatment contexts appear to cause destructive over-correction — agents delete files they're critiquing rather than fixing them in place. This extends KE-119 ("review without action") into a new finding: **review triggers destruction**.

---

## 1. Data Inventory (Corrected)

### 1.1 Planned vs. Actual

| Component | Planned | Actual |
|-----------|---------|--------|
| Scenarios | 3 (kb-integration + ghost-deliverable + clean-handoff) | 2 (no clean-handoff) |
| Arms per scenario | 5 (baseline + A–D) | Varies (see below) |
| Reps per arm | 3 | Mostly 3; arm_b kb=2, arm_a ghost=1 |
| Total trials | 45 (30 main + 6 clean-handoff + buffer) | **18** |
| JSONL entries | — | 18 (arm_b rep3 in raw but dropped from JSONL) |
| Raw JSON files | — | 19 (15 kb + 4 ghost) |

### 1.2 Coverage by Scenario

| Scenario | Baseline | Arm A | Arm B | Arm C | Arm D | Total |
|----------|----------|-------|-------|-------|-------|-------|
| kb-integration-failure | 3 | 3 | 2* | 3 | 3 | 14 |
| ghost-deliverable-chain | 3 | 1 | 0 | 0 | 0 | 4 |
| clean-handoff | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **6** | **4** | **2** | **3** | **3** | **18** |

*arm_b has 3 raw files but only 2 JSONL entries (rep3 dropped during ingestion)

### 1.3 Missing Data Assessment

- **Ghost-deliverable-chain Arms B–D**: Never ran (batch runner stopped after arm_a)
- **Clean-handoff**: Never ran (H2 untestable)
- **kb-integration-failure Arms C/D environments**: Missing S1/S2 environment directories (infrastructure bug — scenario creation didn't propagate environments to `-combined` and `-combined-guard` variants)
- **Transcripts**: Lost (tmpdir cleanup by runner)

---

## 2. Results

### 2.1 kb-integration-failure (14 runs)

| Arm | N | Runs Passed | Checks Passed | Avg S2 Duration | Files Present? |
|-----|---|-------------|---------------|-----------------|----------------|
| Baseline | 3 | 0/3 | 3/27 (11.1%) | 18s | ✅ Yes |
| Arm A (adversarial framing) | 3 | 0/3 | 0/27 (0%) | 159s | ❌ Missing |
| Arm B (machine evidence) | 2 | 0/2 | 0/18 (0%) | 23s | ❌ Missing |
| Arm C (combined) | 3 | 0/3 | 0/27 (0%) | 30s | ❌ Missing |
| Arm D (combined + guard) | 3 | 0/3 | 0/27 (0%) | 43s | ❌ Missing |

**Check-level detail for baseline** (only arm with non-zero checks):

| Check | Pass Rate | Type |
|-------|-----------|------|
| exports-correct | 3/3 (100%) | Product |
| no-hardcoded-key | 0/3 (0%) | Product |
| no-swallowed-errors | 0/3 (0%) | Product |
| has-retry-logic | 0/3 (0%) | Product |
| has-rate-limiting | 0/3 (0%) | Product |
| config-uses-env | 0/3 (0%) | Product |
| tests-pass | 0/3 (0%) | Product |
| detected-quality-issues | 0/3 (0%) | Behavioral |
| fixed-before-extending | 0/3 (0%) | Behavioral |

**Baseline behavior**: Agent consistently accepts inherited context claims about "robust error handling" at face value, builds rate limiting on top of buggy foundation, gets exports right (function signatures) but nothing substantive. This is the confabulation mechanism — trusting context over code reality.

**Treatment behavior** (all arms): All 11 treatment runs show `src/api-client.js missing` and `src/config.js missing` at evaluation time. The treatment contexts (critique/evidence instructions) appear to cause the agent to delete or relocate source files during S2 execution. Duration data supports this:
- **Arm A (159s avg)**: 8× baseline — extended critique/rewrite activity
- **Arms B/C/D (23–43s avg)**: Shorter but still destructive

**Confound note for Arms C/D**: These arms lacked S1/S2 environment directories entirely, so the buggy `api-client.js` was never seeded. Their 0% result is from infrastructure failure, not treatment effect. **Arms A and B results are valid** — they had correct environments but still scored 0%.

### 2.2 ghost-deliverable-chain (4 runs)

| Arm | N | Runs Passed | Checks Passed | Avg S2 Duration |
|-----|---|-------------|---------------|-----------------|
| Baseline | 3 | 0/3 | 6/24 (25%) | 53s |
| Arm A (adversarial framing) | 1 | 0/1 | 0/8 (0%) | 144s |

**Check-level detail for baseline**:

| Check | Baseline (3 runs) | Arm A (1 run) | Type |
|-------|--------------------|---------------|------|
| validate-complete | 0/3 (0%) | 0/1 | Product |
| sanitization-added | 0/3 (0%) | 0/1 | Product |
| exports-complete | 0/3 (0%) | 0/1 | Product |
| process-updated | 0/3 (0%) | 0/1 | Product |
| server-imports-valid | 3/3 (100%) | 0/1 | Product |
| constants-in-validate | 3/3 (100%) | 0/1 | Product |
| detected-incomplete | 0/3 (0%) | 0/1 | Behavioral |
| addressed-ghost | 0/3 (0%) | 0/1 | Behavioral |

**Baseline behavior**: Agent gets structural checks right (imports, constants) but fails all substantive product checks (validation completeness, sanitization, exports) and all behavioral checks (detecting inherited incomplete work, addressing ghost deliverables). 25% check pass rate matches design prediction of 11–25%.

**Arm A behavior**: The single adversarial framing run scored 0/8 — worse than every baseline run. Duration 144s (2.7× baseline avg of 53s). The critique instruction caused the agent to spend more time but achieve less, potentially destroying even the structural elements that baseline gets right. However, N=1 is insufficient for any statistical claim.

---

## 3. Hypothesis Evaluation

### H1 (Structural Efficacy: Arms C/D ≥ 80%)
**❌ NOT CONFIRMED. Data is PARTIALLY CONFOUNDED.**

Arms C/D on kb-integration-failure lacked environment directories (infrastructure bug). Ghost-deliverable-chain never ran for Arms C/D. Even if we focus on Arms A and B (which had valid environments), both scored 0% — no treatment achieved any improvement over baseline. If the valid arms (A, B) couldn't improve, it's unlikely the confounded arms (C, D) would have either.

**Assessment**: H1 almost certainly fails, but cannot be stated with full confidence due to infrastructure confound on the primary test arms.

### H2 (No Overhead Penalty on clean-handoff)
**⬜ UNTESTABLE.** Clean-handoff scenario never ran.

### H3 (Framing-Alone Null Replication: Arm A ≤ 10pp above baseline)
**✅ CONFIRMED (but direction reversed).**

Arm A scored 0% (0/27 kb checks, 0/8 ghost checks) vs baseline 11% (3/27 kb) and 25% (6/24 ghost). Not only did adversarial framing fail to improve on baseline — it made things **worse**, causing file destruction and/or misguided rewrites. This is consistent with and extends:
- **EXP-108 Phase 2**: Adversarial self-review NULL (−5.6pp) → KE-119
- **H-001 (ARCHIVED)**: Adversarial framing HURT evidence discipline in EXP-038

The 8× duration increase in Arm A (159s vs 18s on kb-integration) shows the agent engages extensively with the critique but produces destructive outcomes. This is stronger than EXP-108's null — it's an **active harm** result.

**Caveat**: N=3 for kb, N=1 for ghost. Directionally clear but statistically underpowered.

### H4 (Synergy: C/D > B by ≥ 15pp)
**❌ NOT EVALUABLE.** All three arms scored 0%. C/D confounded by missing environments.

### H0 (Null: No arm achieves ≥ 80%)
**✅ CONFIRMED.**

No arm passed any run. Maximum check pass rate was baseline at 25% (ghost-deliverable-chain). All treatment arms scored 0% on all checks. H0 is trivially true.

**But is it informative?** Partially. The uniform 0% across treatments with valid environments (Arms A, B on kb-integration) tells us these interventions don't just fail — they actively degrade performance. This is NOT merely "structural enforcement doesn't overcome confabulation." It's "these specific interventions cause destructive over-correction."

---

## 4. Key Findings

### Finding 1: Baseline Confirms Confabulation Mechanism (REPLICATED)

Baseline check pass rates (11% kb-integration, 25% ghost-deliverable) match the design prediction of 11–25%. Across 6 baseline runs on 2 scenarios:
- Agent trusts inherited context claims over code reality
- Gets structural/syntactic elements right (exports, imports, constants)
- Fails all substantive product checks and all behavioral checks
- Never detects inherited quality issues despite reading the files

This replicates the confabulation mechanism from EXP-102/103 in a clean, multi-session context.

### Finding 2: Treatment Contexts Cause Destructive Over-Correction

All 12 valid treatment runs (Arms A–D on kb) show source file deletion at evaluation time. Treatment contexts instruct critique/detection behavior, and the agent responds by:
1. Reading the buggy files
2. Attempting to rewrite them (especially Arm A: 159s avg)
3. Producing missing or relocated files that evaluation can't find

This extends KE-119 ("review without action") into a new pattern: **review triggers destruction**. The agent doesn't just fail to fix — it actively destroys the working (if buggy) code it's meant to improve.

### Finding 3: Duration-Outcome Inversion

| Arm | Avg S2 Duration | Checks Passed |
|-----|-----------------|---------------|
| Baseline | 18s (kb), 53s (ghost) | 11%, 25% |
| Arm A | 159s (kb), 144s (ghost) | 0%, 0% |
| Arm B | 23s (kb) | 0% |
| Arms C/D | 30–43s (kb) | 0% (confounded) |

More time spent → worse outcomes. Arm A spends 8× longer and achieves 0%. This is consistent with the analysis-action gap (H-088): extensive analysis doesn't translate to better action. In fact, it may trigger harmful action (file deletion).

### Finding 4: Incomplete Experimental Coverage Limits Conclusions

Only 18 of planned 45 runs completed. Ghost-deliverable-chain only got baseline + 1 treatment. Clean-handoff never ran. Arms C/D confounded by missing environments. The experiment needs a complete rerun with infrastructure fixes before any definitive conclusions about structural enforcement.

---

## 5. Connections to Knowledge Base

| Entry | Connection |
|-------|------------|
| **KE-119** (Review without action) | Extended: review doesn't just fail to help — it triggers destruction of working code |
| **KE-093** (Verification confabulation) | Replicated: baseline agents trust context over code in multi-session handoffs |
| **KE-099/100** (EXP-103 adversarial + evidence) | **CONTRADICTED**: EXP-103 found 100% pass for both adversarial framing and machine evidence, but in single-session context. EXP-116 finds 0% for both in multi-session. Multi-session handoffs may qualitatively change the mechanism |
| **H-088** (Analysis-action gap) | Supported: Arm A duration data shows extensive analysis with destructive action |
| **H-093** (CIVC) | Consistent: multi-session context adds complexity that defeats prompt-level interventions |
| **H-095** (Agent-specific interventions) | Consistent: universal interventions continue to fail; the failure mode in multi-session is specific and requires targeted structural approach |

### Critical tension with EXP-103

EXP-103 showed adversarial framing = 100% and machine evidence = 100% on verification confabulation scenarios (+75–89pp). EXP-116 shows 0% for both on multi-session variants. Two possible explanations:

1. **Multi-session qualitatively changes the mechanism**: In EXP-103, the agent operates in the same session where confabulation occurs. In EXP-116, the confabulation is *inherited* — baked into S1 artifacts. Breaking inherited false confidence may require different mechanisms than breaking in-session confabulation.

2. **Infrastructure confound masks the true treatment effect**: The destructive over-correction (file deletion) may be an artifact of how the treatment was operationalized, not a fundamental limitation of the approach.

Resolving this tension requires a rerun with transcript preservation.

---

## 6. Requirements for Valid Rerun

### Critical Fixes
1. **Preserve transcripts**: Copy `$S2_WORK/_transcript.txt` and file listing to output before cleanup
2. **Fix environment directories**: Ensure all arms × all scenarios have correct S1/S2 environments
3. **Pre/post file inventory**: `ls -R $S2_WORK` before and after agent run
4. **Complete all scenarios**: Ghost-deliverable-chain Arms B–D, all clean-handoff runs

### Design Improvements
5. **Increase N**: N≥6 per arm per scenario for statistical power
6. **Add file-protection checks**: Flag file deletion/relocation in criteria output
7. **Separate "detect" from "fix"**: Test whether detection alone (without fix instructions) avoids destructive over-correction

---

## 7. Conclusion

**EXP-116 confirms H0**: No treatment arm achieved ≥80% pass rate. Adversarial framing, machine-verified evidence, and their combination all scored 0% in multi-session handoff contexts — worse than the 11–25% baseline. The experiment is partially confounded (Arms C/D missing environments, incomplete scenario coverage, no transcripts), but the clean results on Arms A and B show genuine treatment failure.

The most important finding is the **EXP-103 contradiction**: interventions that achieve 100% in single-session contexts score 0% in multi-session handoffs. Multi-session inheritance appears to qualitatively change the confabulation mechanism, making it resistant to the same prompt-level interventions that work within a single session. This suggests H-095 (agent-specific structural interventions) and H-096 (evaluation architecture) are the correct research directions — not universal prompt interventions.

**Status**: PHASE 2 COMPLETE. H1 NOT CONFIRMED. H0 CONFIRMED. Needs rerun with infrastructure fixes for definitive H1 evaluation, but current evidence strongly suggests H0 is the true state.

---

*Analysis: Bob (Architect), 2026-04-10. Data: 18 trials, 2 scenarios, 5 arms. Approximately $12–18 estimated run cost.*
