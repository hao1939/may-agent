# Comparing the independent review with May's review

Date: 2026-09-16. Review only; this document authorizes no implementation.

May's main conclusion holds: preserve the single-Task reconciliation model and
repair its boundaries. Its proposed creator-authorized revision capability is
well grounded and more precise about the required input than my independent
report. My additional inspection and local experiments found concrete execution
coupling and observation-recovery defects that May's final report did not
identify. Those change the repair priorities: documentation cleanup is useful,
but saving corrections and recovering completed work deserve earlier attention.

## Compared artifacts

- [Independent report](aks-rp-e2e-independent-review-20260916.md), frozen in local
  commit `52e4615f0b` before reopening May's final report. Its derivation was
  independent, not blind; May's headline findings were already in the conversation.
- [May's final report](/app/worktrees/may/goal-app_90820209-a35c-4c3e-bcbf-4c49d112d6df-caefca5ecf/projects/may.app/docs/proposals/aks-rp-e2e-task-workflow-improvements-20260916.md),
  commit `6fda11b421d40feff8bb9483ac27a408e51049f4`, SHA-256
  `3eddc93a4ae5672030f7f22d28590b1a0bd0e22e301bdf6b379ac9fa43eb286a`.
  This is the accepted generation-2 report for Task `75dca9a4`, not its earlier draft.
- Both examine AKS source `033780f64b4a6964c92a031ac55765d4d1082eb7` and the
  resolved SDK `a76c27dd385d87273f5271c25ece48b07d77f291`.

May's report accurately says its AKS tests were inspected, not executed. My
review ran selected safe tests and diagnostic probes, but neither review proves
live AKS behavior. Finding more issues with different coverage is not evidence
that the first review was dishonest or that one model is universally better.

## Where the findings agree and differ

| Topic                                  | May's final report                                                                    | Independent evidence                                                                                                          | Combined conclusion                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Retired returned `update-task`         | F1: demonstrated SDK incompatibility; workflows lack the replacement capability       | R1: 26 typecheck diagnostics; actual helper output rejected by SDK; Test Health admission test fails twice                    | Same finding, stronger executable evidence. Implement the narrow existing-authority binding, then migrate callers.                         |
| Correction while running/waiting       | Describes the correct independence principle and requests future integration coverage | R2: identifies `approvedRepairScope`'s explicit state/pipeline gate and reproduces withholding an approved edit               | Shared principle, additional concrete defect. Remove this gate as part of migration; an API rename alone is insufficient.                  |
| Lost pipeline registration             | Not identified                                                                        | R3: recovery adapter exists and is tested, but a different adapter is registered by the App                                   | Test the actual registered entry and consolidate it. Preserve required discovery as well as exact recovery.                                |
| Lost completion publication            | Not identified                                                                        | R4: collector acknowledges before Host publication; dropping the first returned events makes the next poll silent             | Use the existing observer publication/snapshot contract and repeat relevant outstanding levels. Fix separately from registration recovery. |
| Write-capable execution                | Retain deterministic source/routing protections                                       | R5: prose classifier misses a clear source repair; investigation prompt permits edits without declaring an isolated workspace | Keep explicit workspace/proof guards. Prose classification is not an authority boundary; align prompt, tools, and workflow responsibility. |
| Offline repository observation         | Not identified                                                                        | R6: failed fetch still produces a successful-looking cached ref observation                                                   | Report unavailability through the ordinary observer path; do not claim a fresh remote read.                                                |
| Lifecycle documentation and provenance | F2/F3: obsolete ownership/JSON/removal guidance; correct actual SDK resolution        | Agrees; also notes limited mtime-based bundle checking                                                                        | Refresh current guidance and verify actual source/SDK identity during validation. Do not build a new dependency framework.                 |
| Investigation versus domain success    | F4: consumer-contract risk, explicitly not a demonstrated false closure               | Agrees with this distinction; consumer closure was not fully exercised                                                        | Retain a focused consumer test in the plan, below reproduced blocking/recovery defects.                                                    |
| Foundations and broad rewrite          | F5/F6: retain typed ingress, exact links, waits, bounded work; test key boundaries    | Selected tests support these strengths; no evidence justifies a replacement engine                                            | Consolidate around the existing process. Keep whole-call checkpoints unless measurements justify finer ones.                               |

These are not twelve separate defects. The retired API, stale guidance, and
SDK provenance problems overlap across reports. R2 is a concrete implementation
conflict under a principle May already understood. R3–R6 add distinct mechanisms
or evidence that were absent from the accepted report.

## What I would adopt from May's proposal

May correctly distinguishes `TaskAttempt` from `WorkflowContext`. Merely telling
a workflow to call `TaskAttempt.reviseTask` would not work. Its proposed addition
is a narrow binding to existing Host authority, not a second mutation subsystem.
That is a worthwhile small shared capability for deterministic workflow edits.

Its input guidance should carry into implementation: `TaskRevision.input` is a
complete typed `AppInput`, not the old action's partial patch. For these AKS
children, reconstruct `{ kind: "work-request", data: <complete TaskIntent> }`
from current exact Task detail plus the approved change. Preserve unchanged
requirements and map back to the same ID. A fake workflow context can verify
construction; only a Host-backed fixture can prove creator authority,
persistence, generation changes, and stale-result rejection.

Also retain May's restraint around investigation completion. The App explicitly
allows an investigation to finish with an escalation or inconclusive report.
The correct question is whether the responsible creator keeps the unresolved
outcome visible. Replacing every such result with another retry would add model
cost without necessarily improving progress.

The accepted report also avoids the earlier draft's unproven implication that
putting a generation in `workResult` requires a generation-pinned receipt.
Exact current-Task observation is a reasonable contract. Agree on the intended
semantics before introducing historical-generation machinery.

## What I would change in the proposed priorities

May labels compatibility, current documentation, and SDK provenance as P0.
Compatibility blocks relevant branches, but the reviewed App is disabled and
neither review demonstrated a live emergency. Use plain relative priorities:
repair what blocks correct work first, and update affected documentation with it.

More importantly, “run tests after the fixes” misses a cheap source of design
feedback. The safe selected tests could be run before implementation without
cloud operations. Here they exposed a reproducible result-admission failure and
confirmed that some passing tests intentionally preserve the old coupling.
May disclosed its narrower verification correctly; this is a recommendation for
future review assignments, not a claim that it falsely reported passing tests.

Suggested combined order:

1. **Requirements:** expose the creator-bound workflow capability, migrate
   returned edits, and remove the running/pipeline gate. Verify same identity,
   complete input, creator authority, independent spec/status, and stale settlement.
2. **Observation recovery:** consolidate the installed pipeline adapter and move
   suppression state behind successful publication. Verify lost registration,
   dropped/partially published completion, restart, and continued observation
   while the agent is also executing.
3. **Execution clarity:** make diagnosis read-only or explicitly allocate its
   write workspace; surface failed fetches; update current docs and provenance
   checks. Retain exact-source verification and caller disposition tests.
4. **Bounded trial:** after implementation is authorized and locally verified,
   run one relevant AKS goal with a requirement correction and an interruption.
   Measure completed useful outcomes and recovery latency before broad cleanup.

This plan uses existing Task revisions, observer snapshots, exact Conditions,
workspace declarations, and ordinary creator feedback. It introduces no new
queue, event router, supervisor, nested lifecycle, or App-owned watchdog.

## What the May trial tells us about the development workflow

The recorded trial completed the requested report and returned it through May.
The final audit reports the original Request fulfilled at revision 5 and Task
`75dca9a4` accepted at generation 2. Its eight worker receipts include three
tech-lead sessions and five Bob sessions. The trial took roughly 19 minutes,
with obsolete-generation work and a review retry included. These numbers are
process observations, not a token-efficiency comparison.

There was meaningful review value: Bob caught the unavailable workflow revision
API in a draft and required a substantive correction. Code then verified the
committed report and enforced a review result with no unresolved findings.
The design/implementation/review process did more than pass text between roles.

There were also concrete costs:

- May's first delegation dropped exact current guidance paths and some criteria.
  One human/operator clarification updated the same Task during execution.
  Future assignments should carry the source revision, authoritative guidance,
  scope, and deliverable checks in their structured specification.
- The new generation used another worktree, preserving the old draft but
  repeating authoring. This is acceptable safe redo under the agreed philosophy;
  inspect retained work before adding a resumption framework.
- Bob once put supporting observations in the unresolved `findings` field while
  returning `pass`. The guard rejected it; ordinary recovery reused the artifact
  and verification and repeated review. Clarify that small result contract in
  guidance. There is no demonstrated need for another queue or finding taxonomy.

The report itself still says Bob's later review is pending. That statement was
true when the candidate was authored; the separate final audit confirms Bob
subsequently accepted the exact verified commit. A report should not need to
change its own content merely to certify its later review.

The trial supports using May to organize design work, with code enforcing the
process and another reviewer checking substance. It does not show that one
review pass finds all important defects or that multiple agents save tokens.
We have no comparable token/cost measurements here. For the next trial, ask for
a few targeted failure probes at the most important boundaries, not simply more
review rounds or a longer report.

Evidence for this section: `/app/.state/aks-workflow-review-20260916/README.md`
and `final-audit.json` (`finalAssertionsPassed: true`). No live Task was modified
or restarted during this comparison. May's report remains unchanged.
