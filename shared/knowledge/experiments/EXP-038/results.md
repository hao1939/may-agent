# EXP-038: Adversarial QA Framing — Full Results

**Date**: 2026-04-06
**Author**: Tech-Lead
**Status**: COMPLETE — H-001 WEAKLY DISCONFIRMED
**Hypothesis**: H-001 (Adversarial QA framing → higher detection)

## Executive Summary

**H-001 is WEAKLY DISCONFIRMED.** Across two scenario difficulty levels and 12 total runs, adversarial framing provides no detection benefit and actually **hurts evidence discipline** on the harder scenario. The adversarial framing's instruction to distrust tests made the agent skip test execution in 33% of hard-scenario runs.

## Phase A: Easy Scenario (`qa-evidence-discipline`)

Both conditions achieve identical 100% pass rates. Ceiling effect — scenario too easy.

### Standard QA (control)

| Run | Result | Duration | Checks |
|-----|--------|----------|--------|
| 1 | PASS | 80.2s | 7/7 |
| 2 | PASS | 72.3s | 7/7 |
| 3 | PASS | 78.6s | 7/7 |

**Pass rate: 3/3 (100%)** | **Mean: 77.0s**

### Adversarial QA (treatment)

| Run | Result | Duration | Checks |
|-----|--------|----------|--------|
| 1 | PASS | 132.3s | 7/7 |
| 2 | PASS | 123.3s | 7/7 |
| 3 | PASS | 112.4s | 7/7 |

**Pass rate: 3/3 (100%)** | **Mean: 122.7s (+58% overhead)**

## Phase B: Hard Scenario (`qa-review-hard`)

4 subtle bugs where all 13 unit tests pass. Bugs require spec-comparison and architectural reasoning.

### Standard QA (control)

| Run | Result | Duration | Checks | Failed |
|-----|--------|----------|--------|--------|
| 1 | PASS | 97.2s | 7/7 | — |
| 2 | PASS | 120.8s | 7/7 | — |
| 3 | PASS | 149.5s | 7/7 | — |

**Pass rate: 3/3 (100%)** | **Mean: 122.5s**

### Adversarial QA (treatment)

| Run | Result | Duration | Checks | Failed |
|-----|--------|----------|--------|--------|
| 1 | FAIL | 159.0s | 6/7 | ran-test-suite |
| 2 | FAIL | 133.5s | 6/7 | ran-test-suite |
| 3 | PASS | 146.5s | 7/7 | — |

**Pass rate: 1/3 (33%)** | **Mean: 146.3s (+19% overhead)**

### Key Finding: Adversarial Framing Hurts Evidence Discipline

The adversarial task.md tells the agent:
> "All tests pass. **Don't trust that.**"
> "Passing tests doesn't mean bug-free"

This caused the agent to **skip running tests entirely** in 2/3 runs. It went straight to code reading and found all the code-level bugs, but failed the "ran-test-suite" evidence discipline check.

**The adversarial framing created a worse review process** — it found the same bugs but produced less evidence. The standard framing (which said "Run the test suite and report results") produced more thorough, evidence-backed reviews.

## Combined Analysis

| Metric | Standard QA | Adversarial QA | Δ |
|--------|------------|---------------|---|
| Easy scenario pass rate | 3/3 (100%) | 3/3 (100%) | 0 |
| Hard scenario pass rate | 3/3 (100%) | 1/3 (33%) | **-67%** |
| Mean duration (easy) | 77.0s | 122.7s | +58% |
| Mean duration (hard) | 122.5s | 146.3s | +19% |
| Evidence discipline | 6/6 (100%) | 4/6 (67%) | **-33%** |
| Bug detection (code) | 6/6 (100%) | 6/6 (100%) | 0 |

### Why Adversarial Framing Backfired

1. **The "don't trust tests" instruction is too strong** — it made the agent dismiss test execution entirely, not just treat it as insufficient
2. **Evidence discipline is already high** — the agent's trained skills include "run tests, cite output" which the adversarial framing overrode
3. **Adversarial mindset ≠ thoroughness** — it redirected attention from "be thorough" to "be suspicious", which paradoxically reduced overall review quality
4. **Bug detection was identical** — adversarial thinking didn't help find MORE bugs, it just changed the approach (code reading vs test + code reading)

## Implications for H-001

**H-001: WEAKLY DISCONFIRMED** — P(H) drops from 0.52 to 0.30

The adversarial framing does not improve detection and actively degrades evidence discipline. The original hypothesis was based on the observation that production QA had a 14% issue detection rate and adversarial framing might increase it. But the evidence shows:

1. On easy scenarios: identical outcomes, 58% more expensive
2. On hard scenarios: identical bug detection, but WORSE evidence discipline
3. The duration overhead is consistent (19-58% more time)

**Recommendation**: Do NOT deploy adversarial QA framing to production workflows. Instead, focus on H-085 (forced externalization) which has strong evidence of improving judgment.

## Scenario Design Notes

### qa-review-hard (new scenario created this session)
- Session token manager with 4 subtle bugs
- Bug 1: validateSession doesn't delete expired tokens (spec violation)
- Bug 2: hasPermission uses cache, bypasses session validation (SECURITY)
- Bug 3: cleanupExpired doesn't clear permissionCache (incomplete cleanup)
- Bug 4: getActiveSessions returns mutable references (defense-in-depth)
- All 13 unit tests pass
- Requires spec-to-code comparison and security reasoning

## Files

- `agents/gym/scenarios/qa-evidence-adversarial/` — adversarial variant (easy)
- `agents/gym/scenarios/qa-evidence-discipline/` — standard QA (easy)
- `agents/gym/scenarios/qa-review-hard/` — standard QA (hard, new)
- `agents/gym/scenarios/qa-review-hard-adversarial/` — adversarial QA (hard, new)
