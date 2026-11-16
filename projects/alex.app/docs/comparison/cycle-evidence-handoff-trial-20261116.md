# Durable cycle evidence handoff — November 16, 2026

Alex produced a cycle record outside its disposable Task worktree. Independent
review rejected the first version's field locator and timestamps. Alex corrected
them in a separate retained revision; after Task closure, the revised record and
all linked artifacts passed independent validation. This verifies one manual
evidence-handoff practice on an already completed activation/replay segment.

The user clarified that the target is the Gym/Alex improvement cycle. Scout
remains retained example evidence. The earlier actionable Scout guidance proposal
is deferred; no Scout experiment or recurring user problem is established by it.
The [previous trial](alex-owned-activation-replay-20261116.md) retains the original
diagnosis, and the [plan](standalone-improvement-plan.md#current-next-milestone)
now reflects the agreed priority.

## The change and its verification

The observed problem was ignored evidence disappearing with a clean hosted Task
worktree, followed by manual reconstruction from exact public transcript lines.
The smallest method change was to choose an output location outside that worktree
before admission and have Alex return a compact record with artifact hashes,
direct field locators, decisions, cost scope and next ownership.

| Revision | Task | Accepted attempt | Independent disposition |
| --- | --- | --- | --- |
| Initial | `input/app_c097b0cf-2caa-4393-a308-750282728c82` | `r_1_9add546e-9fee-4961-b28e-2217b565bcb6` | Storage survived closure; reject locator/timestamp validation. |
| Correction | `input/app_77a75830-b0f5-4f6b-bc1c-4d23bf9f2e37` | `r_1_51c14b39-3603-49d1-9dba-e87293acf169` | Revised record passed after closure. |

Admission events `6726068` and `6726081` each correlate to one request, now `done`.
Each accepted attempt used one Alex session and no workflow or specialist session.
No Scout change, fresh diagnosis, research, publication, development cycle or
runtime activation occurred. The operator supplied one independent rejection
and admitted the finite correction; neither Task received an in-attempt update.

The initial record's 13 artifact hashes matched, but a direct pointer named
`/environment/paths/workspaceDir` instead of `/paths/workspaceDir`. Its author
also hardcoded record/validation time to `09:36:00Z`, later than its accepted
attempt's finish at `09:33:53.905Z`. Its own successful validation missed both.
The independent review and original bytes are preserved. Host acceptance of the
Task result and independent acceptance of its evidence remain distinct facts.

Revision 2 uses the actual clock, resolves each declared JSON pointer and records
the operator rejection/correction in separate provenance. Independent read-back
after closure matched both files to their accepted result hashes, all 13 linked
artifact hashes, all 54 pointer declarations (35 unique locators), the historical
Task/workflow identities and cost scopes, and all 30 frozen input hashes. The
initial Task's worktree is absent, while both revisions' retained files survive.
Recovering represented cycle facts required the record and its direct evidence
links, with no new raw-log recovery. The Task transcript prefix was used only to
identify the removed worktree for this lifetime check.

The revised record SHA-256 is
`6a68762a3d93719b6663c9dfd174bde617628627d29fb73d1bc02b0f861a8dd9`;
its validation receipt is
`5c2363806647ffd5877c98d2a74eb188d4f206871317963b59f085d89852cd81`.
The [record](</root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-10/alex-output-v2/cycle-record.json>)
contains the represented historical outcomes; the
[independent check](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-10/independent-v2-verification.json)
records post-closure acceptance. The external evidence location must be preserved
or archived before any later operator-worktree cleanup.

## Cost, limits and next use

The initial attempt took 128.305 seconds and reports a $1.001256 model estimate;
the correction took 125.559 seconds and reports $0.7015168. Combined attempt
elapsed time is 253.864 seconds and the reported model estimate is **$1.7027728**.
Task-filtered public usage has no group/run truncation. Actual billing is unknown;
operator effort, review gaps and other external costs are excluded. The
$3.0511248 inside the cycle record represents the earlier activation/replay
Tasks, not this recording experiment.

Retain the practice in the existing
[manual stage guide](standalone-stage.md#hand-off-evidence-from-a-hosted-trial):
choose the evidence destination early, return a hash-bound record, verify field
locators and actual timestamps, then independently check after closure. Apply it
to the next authorized bounded cycle. The operator remains responsible for
post-closure inspection and preserving its retained output location.

This trial needed correction, so it does not demonstrate less human effort or
lower total cost. The previous structured workflow-output persistence gap remains
unrepaired. Full unattended development/recovery, universal adoption of this
recording practice and improved target behavior remain unverified. No new
scheduler, dashboard or generic receipt framework is warranted by this case.

The [session-10 index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-10/README.md)
links both admissions, accepted results, sessions, usage, rejected/revised records
and independent checks. Operations use the
[control-plane operation skill](/app/shared/skills/control-plane-operation/SKILL.md).
