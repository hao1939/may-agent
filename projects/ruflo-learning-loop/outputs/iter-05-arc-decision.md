# Iteration 5 — arc decision

**Iteration:** 5
**Owner:** arc (decision only; no project-of-others edits)
**Inputs:**
- `outputs/iter-04-dispatch-waiting-findings.md` §4–§6
- live `/app/.state/may.db` (re-checked this heartbeat: project
  `v2-spec-coverage-buildout` is still `status='waiting'`; 22 open
  `escalation.created` rows whose reason matches the
  `Project status is 'waiting' — not dispatchable / Auto-waiting`
  pattern, up from 20 in iter-4 — the signal is still ticking up).

---

## 1. The choice

The iter-5 question (verbatim from `project.md`):

> Is the right Ruflo-shaped move (a) a closure rule that auto-resolves
> `dispatch_waiting` escalations whenever the named project transitions
> out of `waiting`, or (b) a notification to may/dev that the project's
> `waiting` state is the load-bearing variable behind ~⅔ of the open
> escalation backlog?

**Decision: (b), notification.**

`defer` and `reject` are excluded: iter-2's anti-pattern note explicitly
forbids meta-bookkeeping with no real action, and iter-4 produced a
real number that warrants one.

## 2. Why (b) over (a), keyed to iter-4's numbers

Iter-4 measured:
```
closure_eligible_now = 0
still_waiting_now    = 20
```

Option (a) — an auto-closure rule keyed on
`projects.v2-spec-coverage-buildout.status != 'waiting'` — is a fine
durable improvement, but **its observable success signal is zero today
and stays zero until someone else acts on the gating project.** Building
a closure rule first puts plumbing ahead of the actual gate. Worse, it
risks the iter-3 trap in a new shape: declaring the loop "fixed" by
shipping a rule whose firing condition is gated on a variable nobody is
moving.

Option (b) — notify the owner of the gating project — is the action
that *makes* `closure_eligible_now` move. It is also strictly within
arc's lane (KE entry + proposal + work-queue item), and it preserves
may's ownership of `v2-spec-coverage-buildout`.

The Ruflo discipline (statusline composition: cheap reads of existing
state) is honoured by (b) because the proposal text is the read itself
— it says "here is a number from may.db, here is the project it points
at, the action belongs to that project's owner." No new emitter, no
new table, no new orchestration.

## 3. Reversible artifact + observable success signal

**Artifact (one):** `agents/arc/workspace/proposals/2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md`, plus a single line under "## Proposed (needs review)" in `agents/shared/work-queue.md`. No edits to `v2-spec-coverage-buildout/project.md`. No new STATUS/NEXT files in this directory.

**Observable success signal (one):** within 24h of `v2-spec-coverage-buildout` transitioning out of `status='waiting'`, the count of open `escalation.created` rows whose reason matches `dispatch_waiting` (the "Project status is 'waiting' — not dispatchable" pattern) drops by ≥ 15 from its then-current value. Re-run iter-4's join probe to verify.

**Falsifier:** if the project exits `waiting` and the escalation count does **not** drop, then iter-4's claim "every batched dispatch's candidate set includes v2-spec-coverage-buildout" was either snapshot-specific or the dispatch loop has a second waiting project doing the same work. Log as `iter-05-F1` and reopen the iteration.

## 4. What this iteration does NOT do

- It does **not** task may. The proposal sits under `## Proposed`; humans/may decide whether to approve.
- It does **not** add an auto-closure rule. Option (a) is *deferred until after* the gating project moves; if the signal then re-appears for a different project, (a) becomes worth building.
- It does **not** edit any project owned by another agent.
- It does **not** create new pointer/STATUS/NEXT files (iter-2 anti-scope).

## 5. Anti-bookkeeping receipt

Files this iteration produces:

1. `outputs/iter-05-arc-decision.md` — this file.
2. `agents/arc/workspace/proposals/2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md` — the notification.
3. One appended line in `agents/shared/work-queue.md`.

No re-runs of probes. No new `iter-02-*.md`. No "closeout."
