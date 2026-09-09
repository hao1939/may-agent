<ai_context>
summary: "Cycle 432 extends the isolated Mnemosyne owner-and-scope candidate with a sequential admission preflight. Matched controls show duplicate proposal or decision state reaches the external kernel before SQLite rejects it; the revised candidate rejects those three cases before the kernel while explicitly leaving concurrent idempotency unresolved."
triggers: ["RV-034", "Mnemosyne", "kernel admission", "sequential replay", "idempotency", "proposal status", "decision ID", "TOCTOU"]
last_updated: "2026-09-09"
source_basis: "No-request seed reconciliation at 2026-09-09T05:50:42.853Z; retained Cycle 430 XHS observation through 2026-09-09T04:30:11.936Z; goal-owned Mnemosyne clone at exact retained base ba43036035bb33dfb955d53da54635aac2ab83a0; accepted Cycle 431 candidate baseline and sequential-replay candidate runs; exact two-file candidate diff SHA-256 b31c32d0dda299a6da3a69f17f8acb0ca00c917cddde59d7e653ea9d07d21817."
</ai_context>

# Mnemosyne sequential-admission replay candidate — Cycle 432

## What was wrong and what changes

The accepted Cycle 431 candidate checks proposal ownership and six stable scope
fields before kernel admission, but it still lets already-decided state reach
the external kernel. Database uniqueness then rejects the duplicate decision
only after that external side effect has occurred.

Three matched controls reproduce the boundary. Re-accepting an accepted
proposal invokes the kernel a second time before the unique `proposal_id`
constraint fails. Accepting a rejected proposal invokes the kernel before the
same constraint fails. Reusing a decision ID for a different submitted
proposal invokes the kernel before the unique `decision_id` constraint fails.

The isolated candidate now requires proposal status `submitted` and an unused
decision ID before either admission path proceeds. The three controls reject
before a new kernel call or decision write. This is a local experiment, not an
upstream or production repair.

## Bounded seed and queue reconciliation

Cycle 432 began from independently accepted clean canonical tip
`dc4ed03ef68ff469e7ab7ec5f18eae93e48d2a02`. Cycle 430's exact XHS
observation was about 80 minutes old and still inside the six-hour cadence, so
this pass made zero browser or public-source requests. The last observed state
remains 30 public Explore notes and a profile-class saved-surface login wall
with zero attributable items. Added and changed identities remain unknown,
observed removals remain `[]`, and all 132 durable seeds remain unavailable
rather than removed.

RV-004 remains first by consequence, but its required protected query → ranked
result → selected artifact → later outcome join is absent from accessible
evidence. Repeating unjoined telemetry cannot resolve it. RV-034 was therefore
the highest-value accessible gap.

## Exact provenance and matched replay

- Goal-owned isolated clone, retained outside canonical Scout content.
- Detached retained base:
  `ba43036035bb33dfb955d53da54635aac2ab83a0`.
- No network ref refresh ran in Cycle 432, so no newer-upstream claim is made.
- Candidate paths: `mnemosyne/runtime/kernel_admission.py` and
  `tests/runtime/test_kernel_admission.py`.
- Complete candidate relative to retained base: 382 added lines; binary diff
  SHA-256
  `b31c32d0dda299a6da3a69f17f8acb0ca00c917cddde59d7e653ea9d07d21817`.
- Direct comparison with exact Cycle 431 candidate digest `4b295990f0efbfab5613c40cd06673ccff52120286969dab951def3eb9185cf0`
  adds 15 implementation lines and 115 test lines.

With the production file held at the Cycle 431 candidate, the three new tests
fail and 17 unrelated focused tests are deselected. Every failure is a
post-kernel `sqlite3.IntegrityError`. With `_require_open_admission` enabled,
the complete focused file passes 20 tests. The runnable runtime directory
passes 90 tests with one artifact-only R3 test deselected.

Pytest warns that the configured `asyncio_mode` plugin is unavailable. The
fixture virtual environment's `.venv/bin/python` works; a missing bare
`python` command on `PATH` was convenience wiring, not missing execution
capability. Generated `reports/r4` and `results/r4` outputs were removed after
the run, leaving only the two intentional candidate files modified.

## What the evidence does not prove

The preflight is sequential. Two concurrent callers can both observe a
submitted proposal and unused decision ID before either commits. Correct
concurrent behavior requires an atomic state transition, transaction boundary,
or explicit idempotency design; this candidate does not provide one.

The broader Cycle 430-432 candidate also does not receive or bind
`agent_binding_id`, define delegated or service authority, emit a durable
denial audit event, settle transformed payload or metadata semantics, or use a
maintainer-approved typed public error. It has no upstream review, merge,
release, deployment, benchmark, or user-outcome evidence. Current product
behavior is not replay proof.

RV-034 therefore remains high/open. RV-004 remains high/open pending
prospective joined outcome evidence.

## Next ranked work and rollback

1. Preserve RV-004 for a protected prospective outcome join or matched-budget
   user-result study; do not substitute another unjoined count.
2. Seek maintainer review of the exact accumulated candidate, explicitly
   including atomic/idempotent admission, delegation, `agent_binding_id`, typed
   errors, and denial-audit semantics.
3. If upstream action remains unavailable, build a goal-owned concurrent
   admission control that distinguishes a real atomic transition from this
   sequential preflight; do not call the current guard concurrency-safe.

Rollback of the external experiment is discarding the retained uncommitted
two-file diff. Rollback of this documentation is one ordinary revert of the
Cycle 432 canonical commit. No account mutation, upstream write, local-main
movement, compaction, cleanup, or protected-checkout write occurred.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
