# Brief: Restore Evaluator Pipeline (IT-87)

**Priority:** P0  
**Owner:** tech-lead (implementation), bob (design)  
**Date:** 2026-07-28  
**Status:** Design ready for implementation

## Problem

The evaluator pipeline has been dead since March 24, 2026 (4+ months). The code exists at `agents/shared/evaluation/evaluator.ts` but nothing invokes it. Consequence: coach does all behavioral verification manually via session sampling. The measure→intervene→measure loop is open.

## Evidence

- Last evaluation file: `.state/evaluations/task_tree_s_1774348439374_46_optimizer.json` (Mar 24)
- Evaluator code exists and has tests (`agents/shared/tests/evaluator*.test.ts`)
- No cron job or hook triggers it — `src/` contains zero references to "evaluat"
- Coach's common-sense-status.md shows manual verification across 24 behavioral items

## Design

### Trigger Mechanism

Add a post-session hook (or cron) that evaluates completed sessions:

1. **When:** After any session completes with `finish(status: "success")` 
2. **What:** Run `evaluator.ts` against the session transcript
3. **Where:** Write result to `.state/evaluations/`
4. **Sampling:** Evaluate ~20% of sessions (random or round-robin by agent) to manage cost

### Integration Point

The evaluator needs to be called from the session lifecycle. Options (in preference order):

1. **Event-driven:** Emit a `session.completed` event; a handler runs the evaluator as a lightweight forked session
2. **Cron-batch:** A periodic job (every 30min) picks up unevaluated sessions and runs the evaluator on a batch of 5-10
3. **Inline:** Call evaluator synchronously at session end (rejected — adds latency)

Option 2 (cron-batch) is simplest to implement and least risky.

### Cron-Batch Design

```
every 30min:
  1. List sessions completed in last 30min from sessions table
  2. Filter out already-evaluated (check .state/evaluations/ for matching file)
  3. Sample up to 5 sessions
  4. For each: call evaluator.ts, write result to .state/evaluations/
  5. If any session scores below threshold, emit alert for coach
```

### Success Criteria

- [ ] New evaluations appear in `.state/evaluations/` after sessions complete
- [ ] Coach can query evaluation results to close the feedback loop
- [ ] Evaluator covers all active agents (not just one)

## Context

- Prior briefs: `agents/bob/workspace/brief-common-sense-infra-review-20260728.md`
- Evaluator code: `agents/shared/evaluation/evaluator.ts`
- Evaluator tests: `agents/shared/tests/evaluator*.test.ts`
- Coach's manual tracking: `agents/coach/workspace/common-sense-status.md`

## Secondary Items (lower priority, unchanged)

- **P1: C1.3 write-readback nudge** — advisory message after write() suggesting read-back. Coach item #22 has been ❌ for 6 consecutive checks (~15% compliance).
- **P2: IT-86/90 structural enforcement** — deferred, coach not re-escalating.
