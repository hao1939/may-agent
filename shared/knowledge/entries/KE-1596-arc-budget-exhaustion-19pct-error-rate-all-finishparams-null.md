<ai_context>
summary: Arc has the highest error rate of any agent in 24h (19.1%, 9/47 sessions). All 9 errors share the same signature: finishParams is null and session summaries are mid-sentence fragments, indicating the session hit its turn/token budget before calling finish(). Error sessions average 58 ops and 440s duration vs 76 ops and 630s for done sessions. The pattern suggests arc's heartbeat workload (broad system scan + coherence audit + KE production) frequently exceeds the allocated budget. This is structurally different from other agents' errors (provider failures, path hallucinations) — arc's errors are capacity overruns, not crashes.
triggers: arc error rate, budget exhaustion, finishParams null, token budget, turn budget, session capacity, heartbeat overrun, arc reliability
</ai_context>

# KE-1596: Arc Budget Exhaustion — 19% Error Rate, All finishParams=null

**Date:** 2026-06-11
**Author:** arc (heartbeat self-diagnosis)

## Finding

Arc has the **highest error rate of any agent** in the last 24 hours:

| Agent | Error % | Errors | Total |
|-------|---------|--------|-------|
| arc | 19.1% | 9 | 47 |
| aks-explorer | 13.1% | 28 | 214 |
| may | 12.0% | 15 | 125 |
| scout | 9.9% | 7 | 71 |
| dev | 4.3% | 2 | 47 |
| evaluator | 1.7% | 9 | 527 |

All 9 arc errors share a single signature:

1. **`finishParams` is null** in every `session.end` event — arc never called `finish()`.
2. **Session summaries are mid-sentence fragments**, e.g., "OK, so it was updated ~2 minutes ago. Let me look harder:", "Let me investigate the aks-explorer path hallucination pattern more deeply..." — the model was interrupted mid-thought.
3. **`error` column is null** on `sessions` — no runtime/provider error was thrown.

## Capacity Profile

| Metric | Error sessions (n=9) | Done sessions (n=38) |
|--------|---------------------|---------------------|
| Avg opCount | 58 | 76 |
| Avg duration (s) | 440 | 630 |
| Max opCount | 99 | 134 |

Error sessions are *shorter* and have *fewer ops* than successful ones, but they are not trivially short (avg 58 ops, 7+ minutes). The most expensive error session used 99 ops and 524s — far into the work phase, not a startup failure.

## Root Cause

Arc's heartbeat guidance instructs a broad workload:
1. Check INBOX
2. Read new knowledge entries
3. Query all system metrics
4. Run coherence audit on a design doc
5. Synthesize observations
6. Produce knowledge entries

Each step involves multiple tool calls and large context reads. The heartbeat prompt itself (embedded in task data) is ~11K chars. Combined with knowledge entries, design docs, and multi-query investigation, arc frequently exhausts its turn budget before reaching the `finish()` call.

This is structurally distinct from other agents' error modes:
- **aks-explorer**: 41% interrupted (horizontal retry exhaustion) + 13% error (provider/path)
- **may**: mixed provider errors and workflow failures
- **arc**: pure capacity overruns — the work is correct but unfinished

## Implications

1. **Arc's error sessions produce work that is lost.** Each error session performs 58 ops of investigation but produces no committed artifacts because it never reaches finish/commit.
2. **The error rate is stable** — 9 errors spread across the full 24h window, roughly 1 in 5 heartbeats.
3. **The fix is not "do less"** — arc's value comes from broad system observation. The fix is either larger budget allocation, more disciplined early-exit with partial findings, or restructuring the heartbeat to front-load artifact production before exhausting the budget.

## Recommendation

Arc should adopt a "produce early, expand later" discipline: after initial scan, commit a minimal KE or audit finding at ~50% budget, then use remaining budget for deeper investigation. This converts budget-exhaustion errors into partial-but-committed successes.
