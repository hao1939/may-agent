# Finding: Heartbeat Inline-Creep (Coach) — NO_ACTION

**When:** 2026-04-17 15:00 UTC · **Author:** optimizer (Mode C) · **Scope:** Last 24h evaluated sessions, grouped by agent, matched on `task_kind`.
**Method:** `bun:sqlite` readonly; for agents with ≥6 evals sorted by `quality`, re-read `issues` for LO. Filtered heartbeats (`task LIKE '[heartbeat]%'`) for clean matched class.

## Matched pairs (coach heartbeats, same task template)

| Session                       | q    | ops | Behavior difference (from evaluator issues)                                                    |
|-------------------------------|------|-----|-----------------------------------------------------------------------------------------------|
| **HI** s_1776426786312_199    | 1.00 | 5   | Triaged, dispatched, exited. No inline workspace reads.                                       |
| **HI** s_1776432499606_299    | 1.00 | 5   | Ran persistent-task workflow (forked). No inline investigation.                               |
| **LO** s_1776356530517_305    | 0.45 | 10  | Inline investigation; skipped mandatory running-session guard.                                |
| **LO** s_1776372731961_93     | 0.55 | 5   | "No evidence of running-session guard before fork."                                           |
| **LO** s_1776397931830_305    | 0.55 | 8   | "Multiple DB/schema exploration calls; did not read todo.md."                                 |
| **LO** s_1776363731818_1      | 0.63 | 5   | "Ran substantive investigation actions inline (reading multiple EXP files + tailing results)."|
| **LO** s_1776406738302_382    | 0.72 | 17  | Extra scanning (EXP-168/173, long tails) instead of forking pending EXP-172/C3.2 work.        |
| **LO** s_1776381732324_172    | 0.68 | 5   | Complied with an injected op-budget (ORDER-004 violation) rather than flagging it.            |

**Prevalence:** 8 of 18 coach heartbeats (≥5 ops) in last 24h show the pattern. Other agents' LO heartbeats had *different* failure modes (qa=journal append; scout=gitignored commit; may=ghost verification) — the inline-creep pattern is **coach-specific**.

## Technique (observable behavioral difference)

**Fork-Boundary Discipline:** HI coach heartbeats touch only triage files (`todo.md`, running-session guard query, one `cat pending/*.md`) then either `agents.fork` with a workflow or `finish`. They never `read` an `EXP-*/results.md` or tail experiment output inline. LO sessions do 2+ inline workspace/EXP reads before (or instead of) forking.

Distinguishing signal: **count of `read`/`bash cat` calls against `workspace/experiments/**` in the first 10 ops.** HI: 0. LO: 2–6.

## Proposed fix — **NO_ACTION**

Reason: The coach heartbeat already contains explicit text:
- `agents/coach/heartbeat.md:4` — "Keep heartbeats lean. Fork substantive work."
- `agents/coach/heartbeat.md:8` — "⚠️ Keep heartbeats lean — fork substantive work"
- `agents/coach/heartbeat.md:46` — "Quick response (< 5 ops)? → Do it inline, then exit."

Coach is *violating instructions it already has*. Per **KE-002** (text rules have 0/20 success for judgment failures) and **KE-123** (don't stack interventions), adding a 4th restatement will not help. The addressable fix is **structural**, not textual — e.g., a `beforeToolCall` guard that blocks a 3rd `read`/`cat` of `workspace/experiments/**` in a coach heartbeat session. That is a non-trivial build with risk of false positives; given the measurable cost is already decreasing (coach ops/day 1,909 → 1,288 per Apr 15 finding), this does not clear the bar for a new guard right now.

Re-evaluate if next Mode-C scan shows the pattern rising or coach ops/day regresses >10%.

## Dispatch status

**None.** NO_ACTION — explicit per KE-002 + KE-123. Marker updated in `todo.md`.

[SIG: scout-mode-c-20260417-1500]
