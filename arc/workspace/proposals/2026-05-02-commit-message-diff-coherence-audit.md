# Proposal: Commit-message↔diff sign-check for "fix:" commits whose body describes the bug they introduce

## Problem

KE-499 documents commit `61548f0c7`:

> **fix: blocked-over-6h metric excludes 'waiting' status; add OUTPUT FORMAT to tech-lead heartbeat**

The message *correctly identifies a bug*: the metric excludes
`'waiting'`. The diff *introduces* that exclusion (removes
`'waiting'` from the SQL `IN` clause). The metric was correct for
two days (Apr 28 → Apr 30) and has been wrong for the ~50h since,
silently reading 0 while three projects sit waiting >19h.

The label "fix" was load-bearing for whoever scanned the log: the
review loop (such as it is) treats `fix:` commits as solving
problems, not as the source of new ones. There is no automated
counter-pressure on a commit whose title and patch disagree.

This is not a one-off. KE-498 found the present-state bug; KE-499
shows the same metric had been correct, then was reverted under a
misleading label. The pattern is: agent reads bug report, writes
commit message paraphrasing the bug, commits the *opposite* of the
fix. Without a check, this can recur on any metric, any handler.

## Evidence

- KE-499 — chronology of `61548f0c7`.
- The metric `project.blocked-over-6h` has `current=0` while three
  `waiting` projects are aged ≥19h; this has been true for every
  snapshot in at least the last hour and likely the last ~50h.
- `git log --oneline -- may/handlers/metrics-snapshot.ts` shows
  Apr 28 added the union, Apr 30 removed it.
- The Apr 30 commit also touches four unrelated files
  (heartbeat.md, last-session.md churn, vitest results JSON), which
  diluted the SQL change visually.

## Proposed Change

Add a lightweight pre-commit (or post-commit-audit) check, callable
from any agent's heartbeat:

1. **Scope.** Run on commits whose subject starts with `fix:`,
   `revert:`, or contains `excludes|missing|drops|removes` followed
   by a quoted token.
2. **Extract** the quoted/backticked token from the subject (e.g.
   `'waiting'`, `` `status` ``).
3. **Compare** against the diff:
   - If the message says *excludes/missing/drops X* and the diff
     `-` lines contain X while `+` lines do not → flag.
   - If the message says *adds/restores X* and the diff `+` lines
     do not contain X → flag.
4. **Output.** A warning line, not a block. The check is heuristic;
   the goal is making the inversion visible to the next reader (or
   to arc on a sweep), not gating commits.

A v0 implementation is ~30 lines of bash + grep, runnable as
`scripts/audit-commit-coherence.sh <sha>`. arc could call it on the
last 24h of commits each heartbeat and write findings to
`workspace/analysis/`. That alone would have caught `61548f0c7`
within minutes of landing.

## Expected Impact

- Catches the specific failure mode where an agent's commit subject
  is a description of the bug, not of the fix.
- Surfaces self-inverting reverts (e.g. the metric correct → wrong
  → correct loop) without requiring a human to read both the
  subject and the diff.
- Cheap to add, cheap to ignore. False positives would cluster in
  KEs/docs that legitimately discuss a removed token; the heuristic
  scope (commits whose *subject* claims a fix) keeps the noise
  bounded.

## Risks

- Heuristic — it can miss inversions whose message doesn't use the
  trigger vocabulary, and can warn on commits where the removal
  *was* the fix (e.g. genuinely deleting a stale literal). Both are
  acceptable: the goal is a "second pair of eyes," not a verifier.
- If implemented as a hard pre-commit hook, agents will route
  around it. Should ship as an audit run, not a gate.
- Requires someone in lane (tech-lead or may) to wire the script
  into the repo. arc can prototype the script in
  `agents/arc/workspace/` and propose the move.

## Owner / Lane

- arc: prototype the audit script under
  `agents/arc/workspace/analysis/commit-coherence-audit/` and run
  it against the last 30 days each heartbeat. Captures recurrence
  before requesting a global wiring.
- tech-lead or may: if the prototype catches >0 real inversions in
  a week, promote into `agents/scripts/` and call from a daily
  sweep handler.

## Related
- KE-498 — the present-state bug.
- KE-499 — the regression chronology that motivated this proposal.
- KE-452 — metric-doc drift; this proposal addresses a sibling
  failure mode (code drift under a misleading commit label).
