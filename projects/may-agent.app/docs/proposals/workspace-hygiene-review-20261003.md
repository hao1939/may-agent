# Workspace hygiene and unmerged design review

**Supports:** [App root layout](../2a-design/app-root-layout.md). Keep useful work discoverable and recoverable without carrying obsolete checkouts as competing sources of truth.

**Choice basis:** [Project value and cost](../1-principles/design-philosophy.md#value-and-cost); [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource); [resolve conflicting designs](../1-principles/core-principles.md#resolve-conflicting-designs); [evidence-first review](../1-principles/evidence-first.md).

**Design status:** Completed documentation disposition and local cleanup record.
**Implementation status:** Documentation only. No App/runtime candidate was merged,
no live Task was changed, and nothing was deployed by this work.

## Scope and baseline

Reviewed the shared Apps repository and May Host, using Apps `ac048bfcf5`, local
Host `0317016b` and fetched Host `797c7ee35` (#285). GitHub merge metadata matters:
many Host branches were squash-merged and therefore are not ancestors of main.
The source checkout was not advanced or used as proof of installed behavior.
Adjacent AKS and Herdr repositories were inventoried and left intact.

The inventory found 247 local branches and 269 registered worktrees in the two
May repositories. It identified 126 differing documentation versions across 79
paths, plus three uncommitted proposals and one modified direct-tool policy draft. This includes old contract variants,
trial plans and operational review notes, not 126 independent pending designs.
The [per-version disposition](evidence/workspace-design-dispositions-20261003.json)
retains each original path, blob, source branch/commit and decision.

## Review decisions

| Material | Decision | Value and choice rationale |
| --- | --- | --- |
| Recovery and independent oversight | Merge the [refined proposal](reliable-recovery-and-independent-oversight-20261002.md); mark #284 source repairs merged and connected recovery/oversight unproved | Keep the original requirement accountable; infra executes retry and delivery, the agent selects intervention |
| Token efficiency | Merge the [updated audit/proposal](../../../may.app/design/token-efficiency-proposal-20261002.md) | #281 completion and the App review clock are already integrated; avoid implementing them twice or adding a second clock field. Remaining policy/context/monitoring work needs evidence |
| App environment and Task resources | Merge shorter [adoption](app-environment-review-20260928.md) and [resource entry](task-resource-layout-20260929.md) proposals; preserve full originals in the archive | One durable Task and existing reads suffice; compare usability before adding context or improvement machinery |
| #285 companion contract text | Merge selected current design/manual updates, checked against the merged SDK | Requests belong to the receiver; Conditions express the caller's interest; live actions and final declarations use shared admission. Agent judgment is trusted by default, without a correctness guarantee |
| Proposed `decision`/`reply` fields | Keep explicitly unimplemented in the existing proposals | Changing spelling or convenience needs a paired contract change; merged #285 still uses `state`/`continue` and caller Conditions |
| #265/#266 executor trials | Merge a [dated evidence synthesis](task-executor-surface-20260928.md) | Keep successful recovery, failed trials and simpler rejected alternatives; do not mistake supplied context for native live access or general efficiency |
| Older context, annotations and executor-interface variants | Retain source; use current integration/comparison records and SDK/Task owners | Avoid a second contract and old live-input acknowledgment behavior. Complete history and generic annotation effects remain proposals |
| Uncommitted direct-tool policy | Preserve the draft; retain the current #223 owner | The broader concrete-tool denial semantics were not adopted; an old candidate must not redefine installed capability restrictions |
| September 25 runtime reliability draft | Archive as superseded, do not adopt its mechanisms | Fixed retry-count quarantine and automatic human-lane escalation bypass agent judgment. Marking consumed inputs done confuses consideration with fulfillment |
| Scout mining/Laya and Gym Task-resource practice | Retain unadopted experiments and their evidence | Mining trials did not establish value over direct source review; context practice remains a bounded method/transfer question, not a Host protocol |
| Release, event/approval, Conversation, metric and consumer-read variants | Keep current owners and retain exact historical or paired source evidence | Do not overwrite newer contracts with dated candidate status or claim an App change from a Host merge alone |
| AKS retirement and open #290 companion work | Retain existing Task/PR workspaces and exact candidate scope | This cleanup does not authorize retirement or finish unrelated runtime work |

Every merged proposal links to its parent need and the principles used to choose
its mechanism. Merging a proposal preserves reviewable direction; it does not
mean its implementation exists. Historical test counts and rollout claims remain
attached to their recorded revisions; they were not rerun as live trials here.

## Cleanup and retained work

Removed **221 inactive worktrees** after verifying committed-history bundles and
archives of modified, untracked and non-cache ignored files. Two additional
candidates were retained when the final check found current runtime references.
Removed **202 local branches**: 69 already integrated by ancestry, 49 with Host
squash-merge evidence, and 84 inactive unmerged branches archived for recovery.
The latter are not represented as merged or accepted work.

Kept 48 original registered worktrees: canonical roots, exact Task references,
open PR work, unfinished Scout publication transactions and required parent
checkouts. The final checks compared HEAD, full status, evidence hashes and
current runtime/process references; changed or newly referenced work was retained.
Temporary validation/edit worktrees created for this review are removed after
integration and are excluded from those original-workspace counts.

Three already broken external workspaces remain preserved. Two correspond to
open health/file-grant PR work, and the evaluation-capacity copy has no valid Git
administration to establish its disposition safely. They are recorded in
`broken-workspaces.json`; they are not silently pruned. The small root
`codex-resume` scratch note was moved to the recovery archive. Existing Evaluation
generated reports/observations remain in place as operational evidence.

No runtime state, installed release, evidence database, Docker image or unrelated
AKS/Herdr checkout was pruned. Retained workspaces may still use old paths because
moving a path named in a live Task would break its context. Future workspaces
follow the existing convention of creation outside `/app`.

## Recovery and provenance

The private local recovery directory is:

```text
/home/hao/workspace-archive/workspace-hygiene-20261003/
  apps-before.bundle
  may-agent-before.bundle
  branches.json / worktrees.json / host-prs.json
  branch-dispositions.json / cleanup-results.json
  protected-worktrees.json / broken-workspaces.json
  doc-source/<original-blob>
  main-uncommitted/<original-path>
  worktree-content/<workspace-id>/
    worktree.json / files.json / excluded.json
    working.patch / index.patch / files.tar.gz
```

The bundles include all original local refs and detached worktree heads and were
verified before removal. `doc-source` keeps each reviewed committed document as
its original Git blob; the disposition JSON gives full IDs, including source
commits after branch deletion. Uncommitted proposals have SHA-256 identities.
Each content archive was read back and its file hashes checked before cleanup.
Reproducible `node_modules`/Python cache directories are excluded; dependency
symlinks are preserved as symlinks and never followed into canonical repositories.

For a retired branch, restore it into a fresh directory outside `/app` from the
appropriate bundle, rather than changing a live checkout:

```sh
git clone /home/hao/workspace-archive/workspace-hygiene-20261003/apps-before.bundle /home/hao/workspace-worktrees/recovered-apps
git -C /home/hao/workspace-worktrees/recovered-apps switch --track origin/<original-branch>
```

Use the manifest's exact HEAD for a detached checkout. Its content archive holds
the uncommitted files relative to that worktree root; inspect `files.json` and
`excluded.json` before restoring into the disposable copy. Apply staged and
working patches deliberately if the old index matters. The bundles preserve
source, not live databases, external providers or every historical `/tmp` log.

## Validation

The review checks design integrity, executable SDK/control examples and canonical
App boundaries against fetched Host #285, plus purpose/choice links and index
coverage. Existing archive document bodies and shared retry principles must remain
unchanged. These checks establish documentation/source agreement, not deployed
behavior or agent judgment quality. The checks passed: SDK/control examples and canonical App integrity; 183 Markdown
documents, 182 purpose paths and 445 rationale/choice links; 75 existing archive
bodies unchanged. The existing root `reports` layout warning remains. Logs and
validation JSON are in the local archive.
