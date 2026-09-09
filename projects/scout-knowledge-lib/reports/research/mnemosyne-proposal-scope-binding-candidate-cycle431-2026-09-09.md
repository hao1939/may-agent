<ai_context>
summary: "Cycle 431 extends the isolated Mnemosyne repair candidate from tenant/agent ownership to six stable proposal-scope fields. Matched controls show that the owner-only candidate permits four substitutions and reaches the kernel before two foreign-key failures; the revised candidate rejects all eight tested accept/reject substitutions before side effects."
triggers: ["RV-034", "Mnemosyne", "kernel admission", "proposal scope", "workflow binding", "envelope substitution", "principal binding"]
last_updated: "2026-09-09"
source_basis: "No-request seed reconciliation at 2026-09-09T05:20:02.158Z; retained Cycle 430 XHS observation through 2026-09-09T04:30:11.936Z; goal-owned Mnemosyne clone at exact retained base ba43036035bb33dfb955d53da54635aac2ab83a0; matched owner-only and scope-bound candidate runs; exact two-file candidate diff SHA-256 4b295990f0efbfab5613c40cd06673ccff52120286969dab951def3eb9185cf0."
</ai_context>

# Mnemosyne proposal-scope binding candidate — Cycle 431

## What was wrong and what changes

Cycle 430 made tenant and agent ownership a precondition for Mnemosyne kernel
admission. The adapter still accepted six caller-supplied scope fields after
that owner check: workflow, workflow binding, entity, FSM, app, and schema.

Matched controls show two different failure modes. Substituting entity, FSM,
app, or schema reached the controlled kernel and was recorded as accepted.
Substituting workflow or binding also reached the kernel, then surfaced an
incidental SQLite foreign-key error while the decision insert ran. The reject
path reached the same foreign-key error without a decision row. Database
integrity therefore prevented some inconsistent records but did not provide a
pre-kernel authorization boundary.

The isolated candidate now compares all six stable scope fields with the
stored proposal after checking tenant and agent. Any mismatch raises before a
kernel call, admission decision, proposal-status change, or new trace event.
This remains a local experiment, not an upstream or production repair.

## Bounded seed and queue reconciliation

Cycle 431 began from clean reviewed integration tip
`b5fd946eb7709a3ac92d5119723256d648cea803`. The exact Cycle 430 XHS
observation was about 50 minutes old, within the established six-hour cadence,
so this pass made zero browser or public-source requests. The last observed
state remains 30 public Explore notes and a profile-class saved-surface login
wall with zero attributable items. Added and changed identities remain
unknown, observed removals remain `[]`, and all 132 durable seeds remain
unavailable rather than removed.

RV-004 remains first by consequence, but its required protected
query → ranked result → selected artifact → later outcome join is not present
in the accessible evidence. Cycle 430's retained-event query was not repeated:
another unjoined count cannot resolve that finding. RV-034 was therefore the
highest-value accessible gap.

## Exact provenance and matched replay

- Goal-owned isolated clone, retained outside canonical Scout content.
- Detached retained base: `ba43036035bb33dfb955d53da54635aac2ab83a0`.
- Audited v2 tag retained from Cycle 430:
  `7aab09c43c1672c01b415b4987cd2d1d9a6fd0a4`.
- No network ref refresh ran in Cycle 431, so this report makes no newer-upstream
  claim.
- Candidate paths: `mnemosyne/runtime/kernel_admission.py` and
  `tests/runtime/test_kernel_admission.py`.
- Complete two-file candidate relative to the retained base: 252 added lines;
  binary diff SHA-256
  `4b295990f0efbfab5613c40cd06673ccff52120286969dab951def3eb9185cf0`.
- Increment beyond Cycle 430's owner-only candidate: 31 implementation lines
  and 89 test lines.

With production code held at the owner-only candidate, all eight new controls
failed their fail-closed expectation: six accept-path substitutions and two
reject-path workflow/binding substitutions. After the scope comparison, all
eight pass. The complete runnable runtime directory passes 87 tests with one
artifact-only R3 test deselected.

The deselected test still expects absent generated files under `results/r3`;
the unconstrained repository suite still has the previously disclosed absent
`experiments.aaai_lcrp` module. Pytest also warns that the configured
`asyncio_mode` plugin is unavailable. These are retained environment/artifact
boundaries, not silently counted as candidate failures or repaired here.

## Why payload is not bound

The first test design also proposed strict payload equality. Source review
rejected that invariant: upstream `r4_kernel_admission_demo.py` deliberately
submits a proposal containing `case_id` plus `route`, then passes only
`case_id` to the kernel commit request. The runnable runtime suite preserves
that behavior. Payload transformation therefore remains an explicit kernel or
domain-validation concern, not something this adapter patch can forbid without
an upstream contract decision.

## Remaining limits and rollback

The candidate does not define delegation, service identities, ownership
transfer, durable denial auditing, or exception compatibility. It does not
bind `agent_binding_id`, because the admission methods do not receive that
field, and it does not validate caller metadata or transformed payload
semantics. It still raises `ValueError`; maintainers must decide whether a
typed public error is required. No deployment, benchmark improvement, or user
outcome is claimed.

RV-034 remains high/open until an authorized upstream change or exact
equivalent receives maintainer review and release-grade validation. Rollback
of this experiment is discarding the uncommitted two-file diff. Canonical
Scout retains documentation only. RV-004 remains high/open pending prospective
joined outcome evidence.

## Next ranked work

1. Preserve RV-004 for a protected prospective outcome join or matched-budget
   user-result study; do not substitute more unjoined telemetry.
2. Seek maintainer review for the exact owner-and-scope candidate, including a
   decision on delegation, typed errors, and payload transformation.
3. If upstream action remains unavailable, test proposal status/replay and
   agent-binding semantics as a separate matched invariant rather than calling
   the six-field patch complete authorization.

No account mutation, upstream write, local-main movement, compaction, cleanup,
or protected-checkout write occurred.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
