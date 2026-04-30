# Common Sense Infra Review — 2026-09-01

## Summary

common-sense.md unchanged since last review. The highest-priority unbuilt infra mechanism remains **IT-87 Evaluator Pipeline (P0)** — now ~5.5 months without automated session evaluations. Coach explicitly flags **C2.3 Framework-Level Enforcement** as BLOCKED on engineering capacity. No ownership updates needed.

## Highest Priority Unbuilt: IT-87 Evaluator Pipeline (P0)

**Status: Still dead.** `.state/evaluations/` newest file is April 20. No automated evals since.

**Why it matters for common-sense.md:**
- The doc's "Metrics (Signal + Judgment)" section assumes agents get metric signals — but without the evaluator, behavioral metrics (C1.1, C1.3, C1.7 compliance) have no automated source
- Coach's todo.md acknowledges: "The evaluator pipeline is broken (all sessions score 0.0) but that doesn't block coaching work" — coach works around it manually, but this doesn't scale
- The measure→intervene→measure coaching loop is open-loop

**Owner:** tech-lead (infra)

## Coach's Explicit Infra Request: C2.3 Framework-Level Enforcement

From coach's todo.md, item #4:
> **C2.3 Framework-Level Enforcement [BLOCKED]** — Blocked on: Engineering capacity (tech-lead)

This is the only item where coach explicitly says it needs infra help. C2.3 = enforcing conventions at the framework level (guards/workflow) rather than relying on behavioral training alone. Coach has proven that some conventions (C1.1 blind edits, C1.3 verify-writes) resist behavioral intervention — 77 and 36 violations respectively per the context.md mandatory procedures section.

**Design opportunity:** Build lightweight guards that:
1. Warn (not block) when edit() is called without a preceding read() of the same path (C1.1)
2. Append a soft nudge to write() output suggesting read()-back (C1.3)

This is lower-risk than IT-87 and directly addresses coach's blocked item.

## Minor: C12.1 Convention Checker False Positives (P2)

Previously noted, still unfixed, still harmless. `BASH_ORIENTATION` regex missing `echo`. Two-line fix if anyone's nearby.

## Ownership Updates

None needed. No items in common-sense.md were recently built or changed ownership.

## Recommendation

1. **P0:** IT-87 evaluator pipeline — highest leverage, longest stalled
2. **P1:** C2.3 guard scaffolding for C1.1/C1.3 — coach is blocked, design is simple
3. **P2:** C12.1 regex fix — trivial
