<ai_context>
summary: "Cycle 434 makes the isolated Mnemosyne admission claim classify whether the kernel boundary has started and whether a decision resolved it. A synthetic kernel exception leaves a durable, replay-blocking in-doubt state; this is observability, not crash recovery or end-to-end idempotency."
triggers: ["RV-034", "Mnemosyne", "admission claim", "in-doubt state", "kernel exception", "replay prevention"]
last_updated: "2026-09-09"
source_basis: "No-request XHS reconciliation at 2026-09-09T13:01:24Z; exact accepted canonical source 62d38199ffcd2047e60300a628f48ac84bc43e9e; goal-owned Mnemosyne fixture at retained upstream base ba43036035bb33dfb955d53da54635aac2ab83a0; exact Cycle 433 candidate digest f8dcd0c9676a5f4bfbb6073a32c82dba541be9d6f37b5ea98485d320e5552445; cumulative Cycle 434 candidate digest f34072d932080c6605bb595dd419b4369b20aee9fc1048754cd35f39d8fcc2af."
</ai_context>

# Mnemosyne admission-claim state candidate — Cycle 434

## What was wrong and what changes

Cycle 433 durably excludes a second local SQLite caller before the kernel, but
its retained claim does not distinguish three materially different moments:
claimed before the external call, crossed into the kernel, or resolved by a
recorded decision. After an exception, an operator can see a claim and no
decision but cannot tell from the row whether the external boundary started.

This isolated candidate gives the claim a small state machine. It records
`claimed` on reservation, commits `kernel_started` before calling the external
kernel, and moves the matching claim to `resolved` in the same SQLite
transaction that records the terminal decision. A synthetic kernel exception
therefore leaves an explicit `kernel_started` row; reopening the database sees
the same row, and replay remains blocked before a second kernel call.

This is a local design experiment, not an upstream or production repair.

## Bounded seed and queue reconciliation

The accepted source is exact clean canonical
`62d38199ffcd2047e60300a628f48ac84bc43e9e`. At
`2026-09-09T13:01:24Z`, Cycle 433's direct XHS observation through
`12:20:54.892Z` was about 40 minutes old and remained inside the six-hour
cadence. No XHS browser, feed, search, detail, saved-surface, GitHub, arXiv, or
Reddit request ran. Additions and changes remain unknown, observed removals
remain `[]`, and all 132 durable seeds remain unavailable rather than removed.

RV-004 remains highest by consequence but inaccessible without the protected
query → rank → selection → later-outcome join. Repeating unjoined counts cannot
resolve it. RV-034's claim-before-kernel uncertainty was the highest-value
accessible gap.

## Exact candidate and matched evidence

- Retained upstream base:
  `ba43036035bb33dfb955d53da54635aac2ab83a0`.
- Exact Cycle 433 four-file baseline diff SHA-256:
  `f8dcd0c9676a5f4bfbb6073a32c82dba541be9d6f37b5ea98485d320e5552445`.
- Exact cumulative Cycle 434 four-file candidate diff SHA-256:
  `f34072d932080c6605bb595dd419b4369b20aee9fc1048754cd35f39d8fcc2af`.
- Cumulative diff: 195 implementation/schema plus 512 test lines. The
  Cycle 433→434 increment is 47 implementation/schema plus 81 test lines.
- No network ref refresh or upstream write ran, so no newer-upstream claim is
  made.

Three state-focused assertions first failed against the Cycle 433 candidate:
the retained claim had no `state`, `kernel_started_at`, or `resolved_at`
fields. After the change:

1. the concurrent winner's claim becomes `resolved` after its accepted
   decision;
2. a pre-kernel rejection becomes `resolved` without a kernel-start timestamp;
3. a synthetic `RuntimeError` from the kernel stub leaves `kernel_started`, no
   decision, and the proposal still `submitted`; and
4. a reopened repository rejects replay of that claim without invoking a new
   committer.

The focused admission file passes 24 tests. The runnable runtime suite passes
94 tests with the known generated-artifact R3 assertion deselected, and the
repository persistence file passes 7 tests. The runtime suite generated four
R4 output artifacts; they were removed immediately, leaving only the intended
four modified candidate files. `git diff --check` passes.

## What this does not prove

The `kernel_started` state means only that the local adapter durably recorded
intent immediately before invoking the external interface. It does not reveal
whether an exception occurred before or after an external commit. No hard
process-kill test, kernel outcome lookup, idempotency token, lease, retry owner,
reclaim rule, compensation, cross-host/database coordination, schema upgrade,
operator API, or service recovery procedure was tested. A retained
`kernel_started` claim therefore remains deliberately fail closed and requires
human or future protocol reconciliation.

The cumulative candidate also remains uncommitted and external. It does not
settle delegation, service identity, `agent_binding_id`, durable denial audit,
typed public errors, transformed payload semantics, maintainer review,
upstream integration, deployment, benchmark effect, or user outcome. Current
product behavior is not replay proof. RV-034 and RV-004 remain high/open.

## Validation, rollback, and next work

Canonical validation and protected-checkout evidence belong to the committed
Cycle 434 checkpoint, not this external experiment. Roll back the experiment
by discarding the exact four-file diff in the goal-owned fixture. Roll back the
canonical documentation with one ordinary revert of the Cycle 434 material
commit. Neither action authorizes writing `/app`, moving local main, cleaning,
compacting, deploying, or changing upstream.

Ranked next work:

1. seek an upstream contract for kernel outcome lookup and explicit ownership
   of `kernel_started` reconciliation;
2. if that exists, test a fail-closed state transition without assuming that a
   retry is safe;
3. otherwise bind `agent_binding_id` and define delegated/service authority;
4. preserve RV-004 until protected joined outcome evidence exists.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
