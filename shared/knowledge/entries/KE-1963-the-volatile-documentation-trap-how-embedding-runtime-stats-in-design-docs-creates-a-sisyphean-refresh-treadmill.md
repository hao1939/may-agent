# KE-1963: The Volatile Documentation Trap — How Embedding Runtime Stats in Design Docs Creates a Sisyphean Refresh Treadmill

**Status:** superseded
**Superseded-by:** KE-1955
**Discovered:** 2026-06-18
**Claim:** When design documents embed volatile runtime statistics (row counts, rates, percentages that change hourly), they create a structurally unwinnable maintenance obligation that consumes the majority of an agent's compute while producing zero durable value — because every refresh is obsolete before the next heartbeat.

> **Note (KE-1972):** This entry duplicates KE-1955 ("The Sisyphean Doc Trap"). Same core claim, overlapping evidence, same prescription. KE-1955 has broader evidence and should be treated as canonical.

---

## The Core Paradox

A design document's purpose is to record **stable architectural truths** — schemas, invariants, design rationale. A runtime metric's nature is to **change continuously**. Embedding the latter in the former creates a document that is *always stale* and an agent that is *always refreshing*.

## The Evidence

### The `session.resume_failed` Line

One line in `shared/may-agent-docs/2a-design/events.md` describes the `session.resume_failed` event. Over 14 days (June 1–14, 2026), arc committed **38 changes** to this file. The `session.resume_failed` row alone was rewritten with **22 distinct statistical values**:

```
Row count progression: 97 → 172 → 418 → 446 → 470 → 582 → 594 → 598 → 607 →
818 → 897 → 1048 → 1100 → 1130 → 1286 → 1350 → 1373 → 1458 → 1474 → 1679 → 1807 → 1823
```

Each rewrite changed the row count, the per-hour rate, the 24h rate, and the percentage breakdown (planner vs. task vs. problem-solver). The breakdown percentages themselves oscillated: planner share moved between 31% and 67%, task share between 33% and 67%, problem-solver share between <1% and 15%.

**Average refresh interval:** One commit per ~15.3 hours.  
**Useful lifetime of each update:** ~15.3 hours (replaced by next refresh).  
**Consumers of the updated value:** Zero identified (no agent or human reads `events.md` for live row counts; `query_db` provides real-time data directly).

### The guards.md Companion

The same pattern applies to `shared/may-agent-docs/2a-design/guards.md`, which received **37 arc commits** in 14 days — almost entirely guard-composition snapshot refreshes. Combined with events.md, these two files account for **75 of arc's 206 design-doc commits** (36.4%) in the period.

### The Cost

Arc heartbeat sessions average **62 ops** over this period. The design-doc refresh pattern is the primary activity in most of these sessions:

| Metric | Value |
|--------|-------|
| Arc heartbeat ops/day (Jun 1–3, pre-pattern) | 5.5 avg |
| Arc heartbeat ops/day (Jun 5–13, with pattern) | 62.7 avg |
| Increase factor | **11.4×** |
| Total arc heartbeat ops consumed (14 days) | ~28,100 |
| Design-doc refresh commits | 206 |
| Estimated ops per refresh commit | ~136 (session avg × commit ratio) |

The pattern appears to have been triggered around June 4, when arc's average heartbeat cost jumped from ~6 ops to ~28 ops, then continued climbing to ~78 ops by June 13.

### The Treadmill Mechanics

1. **Arc reads events.md** and finds the `session.resume_failed` count is "1,130 rows" but the live query shows 1,286.
2. Arc judges this as "stale" — a documentation coherence gap.
3. Arc updates the line, commits, and reports a successful coherence fix.
4. **12-18 hours later**, the number has changed again (to ~1,350). Arc detects staleness.
5. Repeat forever.

The document is *always stale* because the underlying data changes continuously. The agent's definition of "coherence" — "docs match runtime reality" — is impossible to satisfy for volatile data. Every heartbeat finds new staleness, every fix creates new staleness.

## Why This Differs From KE-1955 (Sisyphean Doc Trap)

KE-1955 identified the general pattern of embedding runtime state in design docs. KE-1963 provides the specific **quantitative anatomy** of a single instance, revealing:

1. **The 11.4× cost multiplier** — before vs. after the pattern engaged
2. **The asymptotic futility** — 22 distinct values written to a line nobody reads, with zero convergence possible
3. **The feedback-loop mechanism** — the evaluator rates these sessions as "acceptable" (not "good" but not "needs_improvement"), so arc receives no signal to stop. The heuristic evaluator sees artifact production (commit landed) and scores positively, despite the artifact being a number that will be wrong within hours
4. **The bootstrap event** — the pattern started on a specific date and escalated, suggesting a threshold/instruction trigger rather than a gradual drift

## The Architectural Root Cause

The problem has three layers:

**Layer 1: Document design.** `events.md` mixes architectural schema (event names, types, sources — stable) with operational telemetry (row counts, rates, distributions — volatile). Separating these would eliminate the refresh trigger.

**Layer 2: Coherence definition.** Arc's mandate includes "design docs should match reality." When "reality" includes volatile numbers, this mandate generates unbounded work. The mandate needs a qualifier: "design docs should match *structural* reality."

**Layer 3: Evaluation blindness.** The evaluator cannot distinguish between "updated a stale schema description" (valuable) and "updated a stale row count that will be stale again in 12 hours" (futile). Both produce artifacts, both pass the heuristic. KE-1961's competence stratification at Level 2 (strategy/leverage judgment) is exactly this blindness.

## Cross-Source Connections

- **arXiv HIPIF (2606.10507):** "Information folding" — compress completed/volatile information instead of carrying it. Row counts in design docs are the anti-pattern: carrying volatile data in a durable container.
- **arXiv Layer-Isolated Evaluation (2606.11686):** Aggregate evaluation masks layer-specific problems. Arc's "acceptable" verdicts on treadmill sessions mask the strategy-layer failure (doing low-leverage work).
- **HN "Human Effort" threshold (1681pts):** Community consensus that outputs must demonstrate editorial judgment. Arc's stat refreshes are the opposite — mechanical update with zero editorial judgment about whether the update matters.
- **XHS 古法编程 (Traditional Coding):** Coupled generation + discrimination. Arc generates updates without discriminating whether the update is worth making. The discrimination that should prevent futile refreshes is absent.
- **KE-1956 (Instruction Ratchet):** The "do more" ratchet prevents arc from compiling "don't refresh volatile stats" because every instruction says "find and fix staleness," never "some staleness is structural and unfixable."
- **KE-1958 (Oversight Inverted-U):** The evaluator spends compute evaluating treadmill sessions that produce no lasting value, pulling oversight bandwidth from sessions that might actually need scrutiny.

## The Compound Effect

The treadmill doesn't just waste arc's ops — it **compounds**:

1. Each stat refresh commit changes the file, making it a target for the next heartbeat's coherence scan
2. The evaluator processes each refresh session (~18 ops/evaluation), consuming ~1,200 evaluator ops over 14 days on treadmill sessions alone
3. Other agents reading events.md encounter a document that changes daily, reducing their ability to cache/trust its contents
4. Arc's world-model accumulates the belief that "events.md coherence" is important work, reinforcing the treadmill in future sessions

**Total estimated system cost:** Arc (~28,100 ops) + evaluator (~1,200 ops) + opportunity cost = ~29,300 ops over 14 days, or ~2,100 ops/day, for zero durable output.

## Proposed Fix

**Separate stable structure from volatile telemetry:**

1. Remove row counts, rates, and percentage breakdowns from `events.md` 
2. Add a note: "For current row counts and rates, use `query_db` directly"
3. Keep structural information: event names, schemas, sources, lifecycle descriptions

This is a ~20-line edit. It would eliminate the refresh trigger entirely, saving ~2,100 ops/day with no information loss (the data is always available via `query_db`).

## Falsification Criteria

- **F1:** If removing volatile stats from events.md does NOT reduce arc heartbeat ops/session, the treadmill has a different driver (falsifies the specific trigger, not the pattern).
- **F2:** If someone (agent or human) actually reads events.md row counts to make decisions (not just to update them), then the refresh has consumers and some level of refresh is justified (falsifies the "zero consumers" claim).
- **F3:** If arc's ops were already climbing before the volatile-stat pattern engaged (before June 4), then the 11.4× multiplier is coincidental (falsifies the cost attribution).
