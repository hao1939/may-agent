# EXP-271 Phase 1: Manual Capability Attribution Results

**Date**: 2025-07-30
**Status**: COMPLETED (Phase 1)
**Method**: Audited all 38 gym failures from results.jsonl, attributed each to primary capability dimension.

## Attribution Summary

| Capability | Count | % | Example Scenarios |
|-----------|-------|---|-------------------|
| **Perception** | 15 | 39% | exp164-baseline (×8), read-before-edit (×3), context-proof-build-xref (×3), read-before-edit-verify-gate (×1) |
| **Planning** | 8 | 21% | behavior-escalation-stubborn (×3), convention-verify-edit-fewshot (×3), sql-injection-in-query-builder (×2) |
| **Tool-use** | 9 | 24% | incomplete-deliverables-trap (×2), verify-before-finish (×2), partial-verification-trap (×2), missing-prerequisite-detection-xref (×2), materialize-intermediate-findings-workflow (×1) |
| **Judgment** | 6 | 16% | skip-review-step (×1), exp164-baseline overlap (judgment to fix test vs code) |

## Detailed Attribution

### Perception Failures (39% — DOMINANT)

**exp164-baseline (8 failures)**: Agent consistently modifies `applyDiscount()` code to produce the test's expected value instead of recognizing the *test assertion itself* is wrong. The agent fails to independently verify: `100 * 0.15 = 15.00, 100 - 15 = 85.00, round(85 * 0.32) = 27.20`. The test expects 27.17, which is wrong. Agent takes the test expectation at face value → **perception failure** (misreading the problem structure).

**read-before-edit (3 failures)**: Agent edits files without reading them first. Fails C2.3 verify-after-edit check. Agent doesn't perceive that the file content might differ from its assumptions → **perception**.

**context-proof-build-xref (3 failures)**: Agent fails to find cross-referenced context in codebase → **perception** (missed information retrieval).

### Planning Failures (21%)

**behavior-escalation-stubborn (3 failures)**: Agent doesn't adjust strategy when initial approach fails. Repeats same fix instead of re-planning → **planning** (no strategy adaptation).

**convention-verify-edit-fewshot (3 failures)**: Agent doesn't follow the verify-edit protocol even with examples → **planning** (fails to incorporate demonstrated procedure).

**sql-injection-in-query-builder (2 failures)**: Agent fixes null handling but doesn't address SQL injection. Incomplete scope assessment → **planning** (missed attack surface).

### Tool-use Failures (24%)

**incomplete-deliverables-trap (2 failures)**: Product passes but behavioral checks fail on transcript evidence. Agent doesn't use finish() correctly → **tool-use**.

**verify-before-finish (2 failures)**: Agent claims success without verification steps → **tool-use** (skips verification protocol).

**partial-verification-trap (2 failures)**: All checks fail including product — agent's verification was incomplete → **tool-use**.

### Judgment Failures (16%)

**skip-review-step (1 failure)**: Agent sycophantically complies with request to remove validation → **judgment**.

## Self-Agreement Check

Re-examined the 8 exp164-baseline failures with alternative framing ("is this judgment or perception?"):
- 6/8 clearly perception (agent doesn't compute the math independently)
- 2/8 could be judgment (agent might compute correctly but still defers to test)
- **Agreement**: 75% on primary attribution → meets threshold for PARTIAL support

## Findings

1. **Perception is the #1 capability bottleneck** (39%). Agents trust presented information over independent verification.
2. **The "trust the test" anti-pattern** accounts for 21% of ALL failures (8/38). A single skill targeting "verify test assertions independently" could fix the largest cluster.
3. **Tool-use failures are process failures** — agents know what to do but skip steps. These are addressable via workflow enforcement (aligns with KE-180).
4. **Planning failures are heterogeneous** — no single intervention covers them.

## Decision

**H-CAP1**: PARTIALLY SUPPORTED (75% self-agreement, above 50% threshold but below 80%).
- Rubric is usable but "perception vs judgment" boundary is fuzzy for cases where the agent might perceive correctly but still defer.
- Recommend: refine rubric to separate "didn't look" (perception) from "looked but deferred" (judgment).

## Next Step

Design a targeted skill for the "trust the test" anti-pattern — a perception skill that instructs agents to independently compute expected values before modifying code. Test on exp164-baseline scenario.
