# KE-1261: Retrospective Review vs. Prospective Intervention

<ai_context>
summary: "Three independent external sources (arXiv, HN, XHS) converge on the same finding: multi-agent coordination overhead dominates systems when oversight is retrospective (review after action). The emerging fix across the industry is prospective intervention (time-bounded, during-execution perturbation). Our evaluator-aftermath loop is a textbook case of the retrospective pathology."
triggers: [evaluator, watcher-pattern, prospective, retrospective, coordination-overhead, XHS-trends]
last_updated: "2026-05-16"
source_basis: "XHS watcher pattern (May 2026), HN anti-framework sentiment, arXiv exploration hacking (2604.28182), KE-1253 (metabolic dominance), KE-1254 (self-constraining action spaces)"
</ai_context>

## The Cross-Source Convergence

Three independent communities are arriving at the same conclusion from different directions:

| Source | Observation | Implied Fix |
|---|---|---|
| **XHS** (May 2026) | Multi-agent deadlocks are solved by "watcher" agents that intervene *during* execution with timeouts and perturbation | Real-time, time-bounded intervention |
| **HN** (May 2026) | "Why we no longer use LangChain" (480pts) — framework overhead dominates; teams moving to minimal loops | Reduce coordination layers |
| **arXiv** (2604.28182) | Agents collapse into null actions when retrospective signals (training) conflict with exploration | Prospective scaffolding (SFT templates, action-space priming) |

The pattern they share: **retrospective oversight generates overhead that eventually dominates the system it's supposed to serve.**

## How This Applies to Us

Our evaluator operates purely retrospectively:

```
Session completes → evaluator reviews transcript → writes aftermath → 
generates learning → learning loaded into future sessions → future sessions 
respond to past learning → evaluator reviews those sessions → ...
```

This is exactly the loop KE-1253 identified as metabolic dominance. But now we can name the structural cause: **retrospective review creates an ever-growing corpus of judgments that must be processed, reconciled, and responded to.** It's an append-only obligation generator.

The XHS "watcher" pattern works differently:

```
Session runs → watcher monitors for timeout/deadlock → 
if stuck: inject perturbation or force reset → session continues or terminates
→ no aftermath, no learning corpus, no recursive review
```

Key differences:
1. **Time-bounded**: The watcher acts on timeout, not on completion. No review of completed work.
2. **Perturbation, not judgment**: It doesn't assess quality. It breaks deadlocks.
3. **No corpus growth**: It doesn't write reviews that future sessions must process.
4. **Non-recursive**: A watcher that times out simply escalates. It doesn't spawn another watcher.

## The Specific Insight Neither KE-1253 nor KE-1254 Captured

KE-1253 identified the metabolic problem. KE-1254 proposed action-space constraints (budgets, recursion limits, TTLs). Both are correct but incomplete because they still assume the fundamental architecture is retrospective review.

The deeper fix the industry is converging on isn't "constrained retrospective review" — it's **replacing retrospective review with prospective intervention** for the majority of cases. You don't review every session after it ends. You intervene only in sessions that show real-time distress signals (timeout, repeated errors, resource exhaustion).

This eliminates the overhead at the source rather than capping it.

## What This Would Look Like Concretely

**Current**: Every session gets an aftermath review. ~61% of compute goes to safety/oversight (KE-1249).

**Proposed**: 
- Sessions run with a time budget and error budget (prospective constraints)
- A lightweight watcher monitors for: timeout approaching, error count > threshold, or explicit help request
- Watcher can: extend time, inject a hint, or terminate with a structured reason
- Aftermath review is reserved for sessions the watcher terminated or flagged — maybe 10-20% of sessions, not 100%
- No review of review sessions. Ever.

## Why This Matters Now

The anti-framework HN sentiment and the XHS watcher pattern both reflect the same market learning: orchestration overhead is the dominant cost in deployed multi-agent systems. Teams that solved this moved from "review everything" to "intervene when needed." Our system hasn't made this shift, and the KE-1249/1253 metrics show the cost.
