# Delegation Quality Gap Analysis

**Date**: 2026-06-19 | **Metric**: 0.79 vs 0.85 target | **Gap**: -0.06 | **Severity**: Medium

## Executive Summary

The 0.79 delegation quality score is driven by three well-documented root causes that together account for the full 0.06 gap. Two prior investigations (`agents/tech-lead/workspace/finding-delegation-quality-gap.md` and `agents/tech-lead/workspace/delegation-quality-diagnostic.md`) have already diagnosed these. This analysis confirms the findings remain current and no new failure patterns have emerged.

## Root Causes (Ranked by Impact)

### 1. Evaluator Zero-Score Bug on Self-Delegations (~0.03 drag)

Same-agent delegations (coach→coach, bob→bob) receive `quality=0` because the evaluator skips them with "duplicate agent name" (`finding-delegation-quality-gap.md:27`). These zeros drag the aggregate without reflecting actual delegation quality. This is a **measurement bug**, not a quality bug.

**Fix**: Exclude same-agent delegations from the metric or evaluate them normally. Estimated impact: 0.79 → ~0.82.

### 2. Unbounded Investigation Tasks — FM-2.6/FM-3.3 (~0.02 drag)

Tech-lead self-delegated lens sessions average 0.63 quality (n=26) (`finding-delegation-quality-gap.md:33-38`). Failures cluster on:
- **FM-2.6 (DRIFT)**: Investigation wanders from stated question
- **FM-3.3 (DELIVERABLE_MISSING)**: Output file not written before session ends
- **PHASE_VIOLATION**: Op budget exceeded

Per `agents/tech-lead/workspace/common-sense-feedback.md:19` (KE-013), boundedness is the primary driver of quality. The phase-boundary system in this session's own prompt is the correct mitigation pattern.

### 3. Coder Retry Sessions Lack Context (~0.01 drag)

Verified-coder retry sessions ("attempt 2/2") average ~0.40 quality (n≈6) (`finding-delegation-quality-gap.md:40-42`). Issues: `SCOPE_VIOLATION`, `FM-3.3/VERIFICATION_FAILURE`. Retry tasks say "fix the failing verification" without including specific error output or the first attempt's diff (`agents/tech-lead/workspace/system-gaps.md:37`).

## What's NOT the Problem

- **Agent selection**: Tech-lead delegates primarily to coder (appropriate) and self (for investigation). No wrong-agent-for-task patterns found.
- **Task descriptions for coder**: Tech-lead→coder averages 0.69 quality (`finding-delegation-quality-gap.md:33`), which is acceptable. The metric set in `agents/tech-lead/scripts/refine-metrics-2026-04-18.ts:9` is 0.85, but this includes self-delegations which skew it.
- **Infrastructure errors**: ~15 of 1,289 delegation entries in `.state/delegations.jsonl` are API-level failures (empty model responses, aborts), not delegation quality issues.

## Delegation Volume (from `.state/delegations.jsonl`)

Only 2 tech-lead→child delegations found in the JSONL (both to coder: 1 error/abort, 1 success). The bulk of "delegation quality" measurement comes from the evaluator's per-session scoring of forked/called sessions, not this file. The sparse JSONL data suggests tech-lead delegates infrequently as a parent, and most of the 0.79 metric is driven by cross-agent patterns where tech-lead is the delegatee.

## Recommendations (Do NOT Implement — Separate Sessions)

| # | Action | Est. Impact | Effort |
|---|--------|-------------|--------|
| R1 | Exclude self-delegations from delegation-quality metric | +0.03 | Low |
| R2 | Apply phase-boundary pattern to all lens/investigation tasks | +0.02 | Medium |
| R3 | Include error output + diff in verified-coder retry tasks | +0.01 | Low |
| R4 | Filter infrastructure errors from quality metric | +0.005 | Low |

**If R1-R3 implemented**: 0.79 → ~0.85 (target met).
**If R1 alone**: 0.79 → ~0.82.

## Prior Art

- `agents/tech-lead/workspace/finding-delegation-quality-gap.md` — April 2026, found metric at 0.73
- `agents/tech-lead/workspace/delegation-quality-diagnostic.md` — June 2026, found metric at 0.79, same root causes
- `agents/tech-lead/workspace/metric-design-feedback.md` — Tech-lead's own suggestion to track "coder first-pass rate"
