<ai_context>
summary: "Recovery needs an explicit operation-state contract and an edit ledger. AgentRecovery makes ambiguous side effects first-class but currently validates only plan shape; CONTINUUM implements claim-before-effect reconciliation and guarded rewind, while also exposing that recovery verdicts are advisory and explicit carry-forward records uncertainty rather than resolving it."
triggers: ["AgentRecovery", "CONTINUUM", "RECOVERY.md", "ambiguous side effect", "unknown operation state", "recovery plan", "resume gate", "Action Ledger", "blind retry", "recovery conformance", "rewind", "carry forward"]
last_updated: "2026-09-19"
source_basis: "HadjievK/AgentRecovery revision 0dd34594b78624698fccc64b1956906f2aa5ff6f plus Cyrax321/CONTINUUM revision 8ef24740b77aff03ac4b196ae12b2b0d83057de0. For CONTINUUM, inspected the complete non-truncated 572-entry tree, README/status, recovery walkthrough and API docs, action ledger, rewind and edit-precondition implementations, selected rewind/recovery tests, and workflow definition; static inspection only."
</ai_context>

# Recovery plans should start from operation state, not retry folklore

**Date:** 2026-09-15

**Repo:** https://github.com/HadjievK/AgentRecovery

**Pinned revision:** [`0dd34594b78624698fccc64b1956906f2aa5ff6f`](https://github.com/HadjievK/AgentRecovery/commit/0dd34594b78624698fccc64b1956906f2aa5ff6f)

**Status at inspection:** Draft 0.1 RFC; one GitHub star in the discovery result. This is design evidence from a very new repository, not evidence of production adoption.

## Signal

AgentRecovery proposes a portable `RECOVERY.md` package for a trusted controller to verify, contain, compensate for, and resume side-effecting agent work. Its most useful design choice is to begin from **observable operation state** rather than an agent's interpretation of an exception. A timeout after a mutation may mean `verified-applied`, `verified-not-applied`, or `unknown`; the schema explicitly forbids `unknown` in `retry.allowed_only_when`.

The format requires operation and correlation identifiers, a verification capability with outcome-to-state mappings, bounded retry policy, containment actions, escalation, a resume gate, and audit fields. The procurement example makes the intended sequence concrete: query by the original idempotency key; return the existing business reference if found; retry once with the same key only after authoritative `not-found`; otherwise contain and escalate.

That is a stronger recovery contract than generic "retry with backoff" guidance because it keeps three decisions separate:

1. **What happened?** Authoritative verification maps evidence to operation state.
2. **What may happen next?** Existing identity, destination, policy, and approval checks still govern every recovery capability.
3. **When may work resume?** Stopping a task, revoking delegated authority, compensating an effect, and restoring authority are distinct transitions.

The specification also correctly treats compensation as another failure-prone, authorized effect rather than a magical inverse. For multi-agent incidents, its highest proposed conformance level adds cascade lineage, descendant cancellation, delegated-credential revocation, reconstruction of completed effects, and a prohibition on silent child or peer resumption.

## The plan/controller boundary is the key security property

`RECOVERY.md` is declarative by default. Capability fields are opaque identifiers, not shell commands or credentials, and loading a plan does not grant authority. A controller is expected to resolve identifiers through an administrator-controlled registry and reapply identity, resource, destination, policy, and approval checks.

This prevents a recovery artifact from laundering new authority through an incident path. It also suggests a reusable architecture rule: **plans describe admissible recovery transitions; trusted controllers decide whether the named transition is authorized now.** The Action Ledger supplies durable facts, but evidence that an effect is absent or present does not itself authorize retry, compensation, or resumption.

## Current assurance boundary

The repository is a specification prototype, not yet a demonstrated recovery controller:

- the complete pinned tree has three example plans and no behavioral test suite;
- `scripts/validate.py` loads YAML frontmatter and applies the Draft 2020-12 JSON Schema to `examples/*/RECOVERY.md`;
- CI installs PyYAML and jsonschema and runs that validator;
- the conformance document calls timeout placement, duplicate detection, unavailable verification, partial completion, failed compensation, descendant cancellation, and resume rejection cases for a **future** reference suite; and
- signing, distribution, tool-version pinning, cross-protocol lineage, and registry stewardship remain open questions.

Schema validity therefore establishes that bundled declarations have the expected shape. It does **not** establish that a controller deterministically enforces the state machine, binds evidence to the right operation and plan revision, survives crashes around recovery effects, or fences stale descendants from resuming.

There is also an important modeling distinction inside the current schema. Core verification outcomes map to a closed recovery-state enum, while several compensation, escalation, resume, and audit conditions are unconstrained strings. That is appropriate for extensible domain policy, but interoperable controllers will need registries or profiles for those terms; otherwise two schema-valid plans can assign different operational meaning to similarly named gates.

## Implementation signal: rewind is an accountable state edit

A live GitHub search on 2026-09-19 surfaced
[`Cyrax321/CONTINUUM`](https://github.com/Cyrax321/CONTINUUM), a Python
recovery library at version `0.1.2`. At pinned revision
[`8ef24740b77aff03ac4b196ae12b2b0d83057de0`](https://github.com/Cyrax321/CONTINUUM/commit/8ef24740b77aff03ac4b196ae12b2b0d83057de0),
its implementation turns several of the draft contract's ideas into inspectable
mechanisms.

The [`ActionLedger`](https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/actions/ledger.py)
records intent before an external effect and its outcome afterward. If a crash
lands on either side of the effect but before outcome recording, the durable
state is `STARTED` or `UNKNOWN`, not “failed.” A repeated claim raises
`UnknownSideEffect` unless a reconciler checks the external system. The source
correctly describes this as at-least-once execution with mandatory
reconciliation, not exactly-once delivery.

The more distinctive signal is how the project handles time travel. Its
[`rewind_to_checkpoint`](https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/checkpoint/rewind.py)
does not merely reset semantic state. It derives the event span after the
checkpoint, restores or deletes hook-observed files, compares current digests
against the last observed versions, and refuses conflicting or unavailable
snapshots by default. Before discarding the span, a shared edit-precondition
[gate](https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/recovery/gate.py)
checks for unsettled approvals, results on which later work depends, and
uncertain action slots. Successful rewinds append restoration lineage rather
than making the discarded interval disappear.

This yields a broader recovery rule: **rollback of model state and rollback of
world state are different operations.** Files can sometimes be restored from
snapshots; a sent message, charge, deployment, or still-valid approval cannot
be undone by projecting an older event prefix. A rewind therefore needs a
manifest of what was restored, deleted, conflicted, unrecoverable, reconciled,
or deliberately carried across the edit.

CONTINUUM also exposes two important assurance boundaries:

- `--carry-forward` is an explicit accounting mechanism, not proof that an
  approval remains authorized or that an uncertain effect was resolved. The
  selected [tests](https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/tests/test_rewind_carry_forward.py)
  show a caller can name an approval or uncertain action ID to preserve it in
  rewind lineage. A supervising controller must separately decide who may make
  that override and whether fresh authorization or reconciliation is required.
- The project's own
  [recovery walkthrough](https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/docs/recovery_walkthrough.md)
  says a `RecoveryDecision` is advisory. The CLI's nonzero exit code can gate a
  shell pipeline, and optional host/gateway/replay guards can enforce verdicts,
  but direct library callers can ignore `permits()`. Installed analysis is not
  complete mediation.

The repository contains a large test suite and CI definitions, including
selected tests for digest conflicts, hard-kill rewind, carry-forward lineage,
and unknown-effect policy. Scout inspected those source files but did not
install the package, execute tests, reproduce benchmark numbers, or validate a
live framework adapter. Repository-authored status and benchmark claims should
therefore remain self-reported; the reusable evidence here is the concrete
state-transition and enforcement design.

## Practical implication

Agent runtimes should represent ambiguous external effects with a durable state contract before adding automatic retry or recovery UX. A credible receipt for recovery should bind at least:

- operation, correlation, task, agent, and idempotency identities;
- the exact reviewed plan version and resolved capability versions;
- dispatch, verification, containment, compensation, approval, and resume transitions;
- authoritative evidence references and the controller policy revision used;
- origin/cascade lineage and fencing state for descendants; and
- explicit conformance evidence by crash window, not merely schema-valid configuration.

The project usefully supplies a vocabulary and package shape for that contract. Its next assurance step is executable failure injection against a real controller, with negative tests proving that `unknown` cannot retry, plan capabilities cannot expand authority, stale descendants cannot resume, and recovery effects have their own indeterminate-state handling.

## Primary sources

- Repository: https://github.com/HadjievK/AgentRecovery
- Pinned tree: https://api.github.com/repos/HadjievK/AgentRecovery/git/trees/0dd34594b78624698fccc64b1956906f2aa5ff6f?recursive=1
- README: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/README.md
- Draft specification: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/SPEC.md
- Conformance levels: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/CONFORMANCE.md
- Normative schema: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/schema/recovery-plan.schema.json
- Validator: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/scripts/validate.py
- Procurement example: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/examples/procurement-request/RECOVERY.md
- CI workflow: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/.github/workflows/validate.yml
- CONTINUUM repository: https://github.com/Cyrax321/CONTINUUM
- CONTINUUM pinned tree: https://api.github.com/repos/Cyrax321/CONTINUUM/git/trees/8ef24740b77aff03ac4b196ae12b2b0d83057de0?recursive=1
- CONTINUUM README and enforcement limits: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/README.md
- Claim-before-effect ledger: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/actions/ledger.py
- Rewind implementation: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/checkpoint/rewind.py
- Edit-precondition gate: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/src/continuum/recovery/gate.py
- Carry-forward tests: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/tests/test_rewind_carry_forward.py
- Dual-state rewind tests: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/tests/test_rewind_dual_state.py
- Recovery walkthrough: https://github.com/Cyrax321/CONTINUUM/blob/8ef24740b77aff03ac4b196ae12b2b0d83057de0/docs/recovery_walkthrough.md
