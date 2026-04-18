# Finding: Coach High-Op Sessions

**Date**: 2026-04-18  
**Severity**: Low (working as designed)  
**Lens**: System Architecture

## Summary

Coach's high-op sessions (>30 ops) are **not a bug** — they are legitimate work sessions with appropriately large scope. 14.4% of coach's 3,277 total sessions exceed 30 ops (471 sessions, avg 50 ops). The two flagged sessions (57-op `s_1776515111675_166`, 49-op `s_1776518709125_231`) are gym scenario building and persistent-task iteration work.

## Evidence

### Session Breakdown

| Session | Ops | Kind | Type | Task |
|---------|-----|------|------|------|
| `s_1776515111675_166` | 57 | `job` / `agents.fork` | Direct | Build metric-reaction gym scenario + run baseline |
| `s_1776518709125_231` | 49 | `call` / `workflow` | Workflow child (`wr_1776518709125_2djb`) | Persistent-task iteration (env facts preamble) |

Source: `sessions` table, columns `kind`, `source`, `workflowRunId`, `opCount`.

### What's Causing High Op Counts

The top 15 high-op coach sessions fall into three categories:

1. **Gym/experiment work** (40-57 ops): Building scenarios, running variants, iterating on metric-autonomy project. Tasks like `[WORK SESSION] metric-autonomy Iter 1` (52 ops), `metric-autonomy Iter 4` (40 ops).
2. **Convention regression investigations** (32-73 ops): Querying DB, diagnosing drops, writing findings. E.g., `Investigate coach C1.7 convention regression` (73 ops), `Investigate bob C12.1 convention regression` (38 ops).
3. **Persistent-task workflow iterations** (49-54 ops): The workflow wraps tasks with environment facts preamble. The 49-op session is a `kind:call` child of workflow run `wr_1776518709125_2djb`.

### Are These Excessive?

The average high-op session is ~50 ops across both direct (50.5 avg, n=411) and workflow (49.7 avg, n=60) types. The workflow overhead is negligible — workflow sessions average essentially the same ops as direct sessions. The high op count comes from **task scope**, not workflow overhead or unnecessary work.

## Assessment

**No structural fix needed.** These are legitimately complex tasks (build gym scenarios, investigate regressions across multiple DB queries, iterate on experiments). The 14.4% rate of >30-op sessions is reasonable for an agent doing investigation and experiment work.

## Follow-up (if desired)

- If convention-regression investigations (the biggest category) feel too expensive, the fix is to **narrow the task spec** given to coach, not to change coach's behavior. But at 37-73 ops for a full investigation with DB queries + finding write-up, this seems appropriate.
