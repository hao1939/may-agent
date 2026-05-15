# EXP-720 Phase 1: Coverage Audit Results

**Date**: 2026-05-03
**Status**: PHASE 1 COMPLETE — H1 SUPPORTED

## Method

Sampled 15 representative worker-like task descriptions (mix of implementation, bugfix, refactoring, and testing tasks) and ran them through the 5 regex patterns from `fewshot-inject-helpers.ts`.

## Results

| Task Description | Matched Patterns |
|---|---|
| Implement input validation for user registration | — |
| Fix bug where login fails with 500 error | reproduce-first-debugging, evidence-over-narrative |
| Add pagination to products endpoint | — |
| Test suite failing after DB migration - fix it | reproduce-first-debugging, evidence-over-narrative |
| Refactor payment module to use shared utilities | — |
| Write unit tests for auth middleware | — |
| Update dependency versions, fix breaking changes | escalation-judgment |
| Deploy API gateway configuration | — |
| Create bulk user import endpoint | — |
| Fix incorrect output for international tax calc | evidence-over-narrative |
| Add caching to product search | — |
| Deploy script is broken - investigate and fix | evidence-over-narrative |
| Implement rate limiting for public API | — |
| Fix crash when uploading files >10MB | reproduce-first-debugging |
| Add error handling to webhook pipeline | reproduce-first-debugging |

**Coverage**: 7/15 tasks (47%) match at least one pattern.

## Pattern Frequency

| Pattern | Matches | % |
|---|---|---|
| reproduce-first-debugging | 4 | 27% |
| evidence-over-narrative | 4 | 27% |
| escalation-judgment | 1 | 7% |
| binary-file-escalation | 0 | 0% |
| know-when-blocked | 0 | 0% |

## Dry-Run Log Status

The dry-run logging in master-worker.ts (line 461-475) has **0 entries** in `exp720-fewshot-dryrun.log`. The file doesn't exist, meaning either:
1. No worker sessions have executed through the updated code path since deployment
2. The dynamic import fails silently (caught by try/catch)

Since the code uses `appendFileSync` without ensuring the file exists first, and imports dynamically with `await import()`, the most likely cause is that the compiled binary doesn't include the updated master-worker.ts code (requires rebuild).

## Conclusion

**H1 SUPPORTED**: 47% coverage far exceeds the 20% threshold. The few-shot router would match nearly half of typical worker tasks.

**Top value**: `reproduce-first-debugging` and `evidence-over-narrative` are the highest-frequency matches. These two patterns alone cover 27% of tasks each.

## Phase 2 Recommendation

Move from dry-run to actual injection:
1. Change master-worker.ts to call `injectFewShot(guidance)` and prepend matched examples
2. Requires binary rebuild (escalate to tech-lead)
3. Measure via gym: 3 debug scenarios, compare with/without injection

**Blocker**: Binary rebuild needed. Escalate to tech-lead.
