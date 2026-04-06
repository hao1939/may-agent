# EXP-038: Adversarial QA Framing — H-001 Test

**Date**: 2026-04-05
**Author**: Tech-Lead
**Status**: DESIGNED — workflow built, awaiting run
**Hypothesis**: H-001

## Question

Does adversarial QA framing ("try to BREAK it, find bugs") detect more issues than standard QA framing ("review this implementation")?

## Background

- H-001 proposes that adversarial framing increases issue detection from 14% to >30%
- KE-005 found QA detects issues in only 14% of reviews (evaluator catches 27%)
- An archived `verify-parallel.ts` workflow existed but was never tested
- The `qa-evidence-discipline` gym scenario has 4 planted bugs — a controlled testbed

## Design

### Workflow
Built `agents/shared/workflows/implement-and-adversarial-review.ts`:
- Same coder step as `implement-and-review`
- Runs standard QA + adversarial auditor **in parallel** (no shared context)
- Auditor uses contrastive framing: "Assume this code contains a subtle bug. Find it."
- Merges findings; auditor issues that QA missed trigger a fix cycle
- Tracks issue counts for both approaches (H-001 measurement data)

### Adversarial Framing Key Differences
| Aspect | Standard QA | Adversarial Auditor |
|--------|------------|---------------------|
| Goal | "Verify the coder's claims" | "Try to BREAK this code" |
| Coder summary | "Claims to verify — do NOT trust" | "UNTRUSTED — poke holes in it" |
| Approach | Read files, run checks, form judgment | Explicit adversarial checklist per function |
| Edge cases | Implicit (reviewer's initiative) | Explicit: null, empty, concurrent, throw, type |
| Output | Standard PASS/FAIL/CONDITIONAL | Issue-focused: severity + reproduction + evidence |

### Experiment Protocol

**Phase A — Controlled (gym):**
Run `qa-evidence-discipline` scenario with both framings on same planted bugs:
1. Standard QA task on rate-limiter.ts.after (10 runs)
2. Adversarial task on rate-limiter.ts.after (10 runs)
3. Measure: which bugs each finds, false positive rate

**Phase B — Production (workflow):**
Use `implement-and-adversarial-review` workflow for 5 real code changes:
1. Track auditor issues that QA missed
2. Track false positives from auditor
3. Compare with historical 14% detection rate

### Metrics
- **Primary**: Issue detection rate (% of reviews finding ≥1 real issue)
- **Secondary**: Unique issues found per review (auditor-only vs QA-only)
- **Safety**: False positive rate (hallucinated bugs per review)

### Success Criteria
- Treatment detection rate > 2x control rate (from H-001)
- False positive rate < 20% of total auditor findings

## Results

[Awaiting execution]

## Files
- Workflow: `agents/shared/workflows/implement-and-adversarial-review.ts`
- Testbed: `agents/gym/scenarios/qa-evidence-discipline/`
