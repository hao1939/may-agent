# Protected Scout knowledge edit pilot

## Current convention

A knowledge or report path returned by a Scout Task or workflow is a published
interface. Maintenance may improve its title and add index navigation, but must
not rename or move the delivered file. This keeps retained Task and workflow
results useful without a global reference registry or duplicate full findings.
Unpublished files may be moved only after checking and repairing editable links.

`scout-assess-source` already follows this convention mechanically: a source's
normalized identity selects one stable, source-identity-derived assessment path,
and later questions update that path while retaining earlier evidence. The workflow
returns the exact path only after write/read-back succeeds. If saving fails, it
returns the substantive draft and failure evidence without claiming a path.

## Bounded protected-edit pilot proposal

Pilot only `knowledge-planner`, because it is the observed workflow that edits
versioned knowledge and reports. Keep `library-health` JSONL and daily-digest
accumulator/snapshots in their existing App runtime workspace; they are runtime
scratch/artifacts, not source-branch changes.

1. The Host allocates and retains one Task worktree and exposes its root as
   `ctx.workspace.root`. The App must also receive an explicit mapping for the
   Scout project and App roots inside that candidate.
2. The planner prompt names only those candidate roots as writable. Canonical
   `projectRoot`/`appRoot` remain read-only reference locations.
3. Before and after the agent call, code records `git status --porcelain` (or an
   equivalent Host-owned changed-path inventory) in that same candidate. Admit
   only changes under Scout knowledge, reports, and the explicitly allowed App
   documentation paths; reject runtime state and unrelated paths.
4. A reviewer reads the exact diff and verifies links, including every path
   previously returned by the Task. The candidate is committed only after
   checks pass.
5. Integration remains an explicit authorized repository operation. The result
   distinguishes prepared, reviewed, integrated, and deployed states and keeps
   the candidate reference until integration is proved.

## Why this is a proposal, not enabled behavior

The current planner explicitly writes `ctx.workspace.projectRoot` and
`ctx.workspace.appRoot`; its result contract has no candidate revision or
integration state. Although ordinary Git can inventory the diff under
`ctx.workspace.root`, the workflow cannot prove from the current mapping that
both writable sibling roots point into that candidate, nor can it request an
authorized integration after review. Repointing the prompt alone could therefore
mix candidate and canonical paths, while a post-write manifest would only detect
a shared mutation after it happened. Implementing a second worktree manager
inside Scout would duplicate Host ownership and make retry cleanup unsafe. The
smallest experiment is a local Host run that supplies candidate mappings for
both roots, lets the agent make one in-place note edit, and retains the resulting
branch/diff without integration. Until that contract is proven, planner writes
remain an explicit unresolved protection limit rather than falsely protected
edits.
