<ai_context>
summary: "Cycle 430 advances RV-034 with a matched isolated Mnemosyne repair candidate: admission now checks the stored proposal tenant and agent before acceptance or rejection. The candidate blocks the reproduced cross-principal path before kernel or decision writes, but is not an upstream integration and does not define delegation or a durable denial event."
triggers: ["RV-034", "Mnemosyne", "ATP", "principal binding", "proposal owner", "kernel admission", "tenant binding", "delegated authority"]
last_updated: "2026-09-09"
source_basis: "Read-only upstream ref check for eyuchang/Mnemosyne; goal-owned isolated clone at exact main ba43036035bb33dfb955d53da54635aac2ab83a0; test-only baseline and repaired-tree runs; exact uncommitted two-file candidate diff SHA-256 f7adf20826d82b290bba3c20133dab3846482769e9fabe8e24a3f32e42659578."
</ai_context>

# Mnemosyne principal-binding repair candidate — Cycle 430

## What was wrong and what changes

Mnemosyne's `KernelAdmissionAdapter` accepted caller-supplied `tenant_id` and
`agent_id` when recording either an accepted or rejected proposal. It did not
first compare them with the stored proposal. The earlier matched probe therefore
let one registered same-tenant agent admit another agent's proposal.

In a goal-owned disposable clone, the candidate adds one fail-closed lookup
before both admission paths. The stored proposal must exist and both its tenant
and agent must match the decision caller. A mismatch raises before the kernel is
called and before a decision or admission trace is written. The proposal stays
`submitted`.

This is a tested repair candidate, not an upstream change and not evidence that
the public runtime is fixed.

## Exact provenance

- Upstream repository: `https://github.com/eyuchang/Mnemosyne.git`.
- Audited v2 tag: `7aab09c43c1672c01b415b4987cd2d1d9a6fd0a4`.
- Current upstream `main` and isolated candidate base:
  `ba43036035bb33dfb955d53da54635aac2ab83a0`.
- The bounded ref check found both identities unchanged. Prior evidence shows
  the tag-to-main change adds the supplement PDF without changing Python.
- Candidate paths: `mnemosyne/runtime/kernel_admission.py` and
  `tests/runtime/test_kernel_admission.py`.
- Exact uncommitted candidate: 132 added lines across two files; binary diff
  SHA-256
  `f7adf20826d82b290bba3c20133dab3846482769e9fabe8e24a3f32e42659578`.
- The isolated clone remains detached at the exact upstream base. No peer or
  protected worktree was edited.

## Matched evidence

The test-only baseline left production code at exact upstream main. The two
wrong-principal tests failed because neither acceptance nor rejection raised.
After the owner check, the matched focused gate passed. A third test separately
binds the tenant dimension.

| Check | Result | Interpretation |
| --- | --- | --- |
| Test-only baseline, wrong agent on accept/reject | 2 failed: no exception | Reproduces the missing owner check rather than inferring it from source alone. |
| Repaired admission + repository files | 16 passed | Same-owner behavior remains covered; wrong agent and wrong tenant fail before writes. |
| Runnable runtime suite | 79 passed | 70 passed outside the R3 conformance file; 9 passed inside it with one absent-artifact test deselected. |
| Exact candidate diff | `git diff --check` passed | No whitespace error in the two-file candidate. |

The unconstrained full suite is not a clean release gate for this exact public
checkout. Collection stops because `tests/experiments/test_aaai_lcrp_containment.py`
imports absent module `experiments.aaai_lcrp`. The complete runtime directory
otherwise reaches 79 passes but one inherited test expects absent
`results/r3/local_runtime_demo_001.json` (and related R3 files). The minimal
environment also warns that the configured `asyncio_mode` plugin is unavailable.
These boundaries are disclosed rather than counted as candidate failures or
silently repaired.

## Safety invariants and remaining limits

The candidate establishes only these local invariants:

1. The proposal exists before either decision path continues.
2. Stored and caller tenant IDs are equal.
3. Stored and caller agent IDs are equal.
4. Failure occurs before kernel invocation, decision insertion, proposal status
   change, or a new trace event.

It does not model delegated authority, principals acting through a service
identity, or a policy for transferring proposal ownership. It emits no durable
record of the denied attempt. It also does not bind every caller-supplied
envelope field—workflow, binding, entity, FSM, app, schema, and payload remain a
separate audit surface. The exception type and public API contract still need
maintainer review. No production, benchmark, or independent deployment effect
is claimed.

## RV-004 boundary and disposition

RV-004 was checked first because retained Scout outcomes still outrank an
external repair. A query-only open of `/app/.state/may.db` found 1,654 retained
events, maximum ID `6316656`, and maximum timestamp `1788161030805`
(`2026-08-31T15:23:50.805+08:00`). There are zero exact
`project.knowledge.maintained` event types and the same two payload mentions,
ending at ID `6151587`. Nothing crosses the prior
`2026-08-31T15:24:13.597+08:00` evidence boundary, and the store still lacks a
query → ranked result → selected artifact → later user outcome join. Its smaller
current retention window cannot establish that no later outcome ever happened.
RV-004 therefore remains high/open.

RV-034 materially advances from reproduced defect to a small matched repair
candidate, but remains high/open until an authorized upstream integration (or
an exact equivalent) receives maintainer review and release-grade validation.
Rollback of this isolated experiment is simply discarding the two-file diff;
canonical Scout contains documentation only.

## Next ranked work

1. Preserve RV-004 first: resolve it only with a prospective protected
   query/selection/outcome join or matched-budget user-result study, not more
   unjoined telemetry.
2. Independently review the exact RV-034 candidate and, if authorized, prepare
   an upstream handoff that decides delegation, denial auditing, and exception
   semantics.
3. If upstream action remains unavailable, audit the remaining admission
   envelope bindings against the stored proposal with matched allow/deny tests;
   do not generalize this two-field repair to complete authorization.

No local-main move, compaction, cleanup, account mutation, or protected-checkout
write occurred.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
