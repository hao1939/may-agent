<ai_context>
summary: "Cycle 433 reproduces the concurrent hole left by Mnemosyne's sequential admission preflight and tests a durable SQLite claim that admits only one local caller before the external kernel. The candidate remains an isolated experiment: crash recovery, retry idempotency, cross-store deployment, and upstream acceptance are unresolved."
triggers: ["RV-034", "Mnemosyne", "concurrent admission", "atomic claim", "idempotency", "TOCTOU", "kernel side effect"]
last_updated: "2026-09-09"
source_basis: "Read-only XHS reconciliation at 2026-09-09T12:20:53.983Z–12:20:54.892Z; exact accepted canonical source d7f3458043b9585b924b4771659767dc248382d6; goal-owned Mnemosyne fixture at retained upstream base ba43036035bb33dfb955d53da54635aac2ab83a0; exact Cycle 432 candidate digest b31c32d0dda299a6da3a69f17f8acb0ca00c917cddde59d7e653ea9d07d21817; Cycle 433 four-file candidate digest f8dcd0c9676a5f4bfbb6073a32c82dba541be9d6f37b5ea98485d320e5552445."
</ai_context>

# Mnemosyne concurrent admission-claim candidate — Cycle 433

## What was wrong and what changes

Cycle 432 rejects sequential replay before calling the external kernel, but its
status and decision checks are separate reads. Two callers can both observe a
submitted proposal and unused decision ID, then both perform the external side
effect before SQLite rejects one decision write.

A matched threaded control reproduces that race with two repository instances
on one SQLite database. Both callers reach the kernel; one admission succeeds
and the other ends in `sqlite3.IntegrityError`. The isolated Cycle 433
candidate adds a durable claim table and acquires a proposal/decision claim in
a `BEGIN IMMEDIATE` transaction before either acceptance or rejection can
proceed. With the first kernel call deliberately blocked after its committed
claim, the competing caller is rejected and only one kernel call occurs.

This is a local design experiment, not an upstream or production repair.

## Bounded seed and queue reconciliation

Cycle 433 begins at accepted clean canonical tip
`d7f3458043b9585b924b4771659767dc248382d6`. The six-hour XHS cadence had
elapsed, so exactly one supported public `status` and one supported
non-navigating `saved-status` ran from `2026-09-09T12:20:53.983Z` through
`12:20:54.892Z`. Explore remains readable with 30 notes. The saved target
remains an HTTP-200, `profile`-class login wall with semantic access fingerprint
`74a9cdb73d2f8b37e8888154a2f2a67761178f8a6f64cd20e1fc384965cc2e44`,
zero attributable items, and the empty ID fingerprint. Byte length changed
103,334→105,206 and body SHA-256 changed to
`9d9800f7c294b49f14c6842caf45bc516162b5fbf26ac1b86d1d7dd5c87c90e0`;
that is response provenance, not a collection delta. Added and changed seed
identities remain unknown, observed removals remain `[]`, and all 132 durable
seeds remain unavailable rather than removed. No feed, search, detail,
navigation, or account mutation ran.

RV-004 remains first by consequence, but accessible evidence still lacks the
protected query → rank → selection → later-outcome join. Repeating unjoined
counts cannot resolve it. RV-034 therefore remains the highest-value accessible
gap.

## Exact provenance and matched control

- Accepted canonical source:
  `d7f3458043b9585b924b4771659767dc248382d6`. It literally contains the
  accepted Cycle 432 reviewer cursor; no extra integration wrapper was needed.
- Goal-owned detached Mnemosyne base:
  `ba43036035bb33dfb955d53da54635aac2ab83a0`.
- No network ref refresh or upstream write ran, so no newer-upstream claim is
  made.
- Exact Cycle 432 two-file baseline diff SHA-256:
  `b31c32d0dda299a6da3a69f17f8acb0ca00c917cddde59d7e653ea9d07d21817`.
- Exact Cycle 433 four-file candidate diff SHA-256:
  `f8dcd0c9676a5f4bfbb6073a32c82dba541be9d6f37b5ea98485d320e5552445`.
- Candidate relative to upstream base: 148 implementation/schema lines plus
  431 test lines. The Cycle 432→433 increment is 74 implementation/schema
  lines plus 123 test lines.

The retained matched control subclasses only the new claim hook away, leaving
the Cycle 432 owner, scope, and sequential checks intact. A two-party barrier
then proves both callers have crossed into the kernel before either decision
write completes. The observed result is two kernel calls, one accepted
decision, and one SQLite uniqueness failure.

The candidate control uses separate repository instances on the same SQLite
file. The first caller durably claims the proposal and then blocks inside the
kernel stub. The second caller finishes with an explicit already-claimed error
before the first call is released. The final state has one kernel call, one
accepted decision, and a retained claim bound to the winning decision.

Focused validation passes 22 admission tests. The runnable runtime suite passes
92 tests with the known artifact-only R3 evidence test deselected. Repository
tests pass 7/7. `git diff --check` passes. The fixture virtual environment lacks
a `ruff` executable; that is missing convenience tooling, not missing execution
or test capability.

## Safety invariants and remaining limits

The candidate demonstrates only a local SQLite exclusion invariant:

1. proposal ID is a primary claim key;
2. decision ID is a unique claim key;
3. claim selection and insertion occur under `BEGIN IMMEDIATE`;
4. the claim commits before the external kernel call;
5. claims remain after a terminal decision, preventing local replay.

It does **not** establish end-to-end idempotency. A crash after claiming but
before recording a decision leaves a submitted proposal with a durable claim;
the safe behavior is to fail closed, but no lease, recovery owner, retry token,
compensation, or operator procedure is defined. The test exercises concurrent
threads with distinct SQLite repository instances, not multiple hosts or a
different database. Holding only the claim—not the decision transaction—also
means external-kernel recovery must still reconcile an unknown side-effect
outcome.

The broader candidate remains uncommitted and external. It still does not bind
`agent_binding_id`, define delegation or service authority, emit a durable
denial audit event, settle transformed payload semantics, replace `ValueError`
with a maintainer-approved public error, or prove upstream review, merge,
release, deployment, benchmark, or user outcome. Current product behavior is
not replay proof. RV-034 therefore remains high/open; RV-004 remains high/open.

## Canonical and protected-boundary validation

The canonical checkpoint passes syntax, TypeScript, formatting, exact Cycle
433 seed projection, 134 scoped links, navigation 11/14 + 8/8 + 14/14, and the
full 321-test / 1,632-assertion gate. Broad links pass at both explicit scopes:
the historical project-root-README-excluding scope has 1,561 documents / 1,827
links, while the complete tracked project has 1,562 / 1,829. Read-only health
reports 26 facts / 16 wakes with `truncated:true`; `git diff --check` passes.

Fresh read-only `/app` inspection remains at human-authored HEAD
`a8657eb6695fe38297a0930ebd130643c902f765` with a clean index. Default status
is 127 records / SHA-256
`f6407d495eb24382bed9f9254192041d4260d8791786d5b2a87f2acfa9e3d1c3`;
expanded status is 5,914 /
`14779b94a264661635ada1d241aa96bbdb0be3edbde29bbbe4242e112e50003a`;
Scout status remains exact at 23 /
`b9d6fb9c05a1b4c68e6348237512084d212d17c4fd7821b9838f374eca7a12c5`.
All five protected hashes remain exact. Aggregate dirty growth is unrelated and
is not called unchanged. No `/app` ref, index entry, or byte was written.

## Next ranked work and rollback

1. Seek an upstream contract for recovery after claim-before-kernel failure:
   explicit retry identity, kernel outcome lookup, and a safe claim state
   machine are required before calling the transition idempotent.
2. Bind `agent_binding_id` and decide delegated/service authority with matched
   allow/deny tests.
3. Preserve RV-004 for a prospective protected outcome join; do not replace it
   with another query-only count.

Rollback of the external experiment is discarding the disposable fixture's
uncommitted four-file diff. Rollback of this documentation is one ordinary
revert of the Cycle 433 material commit. No account mutation, upstream write,
local-main movement, compaction, cleanup, branch deletion, worktree deletion,
or protected-checkout write occurred.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
