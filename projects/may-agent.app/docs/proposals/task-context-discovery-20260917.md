# Task context discovery and agent-directed work

**Status:** Proposed; local implementation and evaluation in progress.
**Contract owner:** [Workspace convention](../2a-design/workflows.md#task-entry-and-discovery).

## Problem and intended experience

An agent receives a bounded assignment, but relevant input, instructions, source,
earlier results and failure evidence are scattered across prompts, files and Task
reads. A specialist may not know where omitted information lives. A reviewer
without search tools cannot investigate efficiently even when the source exists.

Every participating agent should receive one Task entry path. It can read the
brief, follow full context references, discover unlisted files or capabilities,
and diagnose a failed operation without asking the human for hidden paths.
The agent chooses what to inspect and how to work. Code supplies reliable facts,
paths and supported reads; it does not choose the method or infer completion.

## Small first implementation

The Host generates one navigation projection per attempt beneath its existing
runtime artifact root:

```text
task-context/<hash of App and Task>/
  <hash of generation and attempt>/
    TASK.md          brief and discovery routes
    context.json     full supplied Task/reconciliation snapshot
    catalog.json     pinned capability descriptions and source references
  notes/             optional agent-owned working notes
```

Hashing prevents collisions and path traversal through Task names. The Host
supplies the actual absolute entry path to managed agents and to workflows as
`ctx.workspace.taskFile`. Helpers inherit the same Task context. The source
worktree and output roots stay where the Host already allocated them; artifacts
and session/workflow evidence retain their existing locations.

The brief is generated from existing context. It links the complete supplied
input, current Task reads, paginated Task discovery, instruction/source roots,
full skill catalog, workflow roots, result references and diagnostic evidence.
Every omitted category has a concrete read/list/search route or an explicit
availability limitation. Agents inspect arbitrary additional input references
and directory/index contents; the generator need not predict their relevance.

The first slice preserves the existing owner prompt. Full input is also available
to specialists through the shared snapshot. Moving large owner prompt fields to
references is a later measured change, not necessary to establish discoverability.
Navigation generation failure leaves the existing prompt/read path usable and
reports the limitation. It does not stop otherwise useful execution.

## Authority, freshness and limits

Task state and original evidence remain authoritative. The entry records exact
App/Task/generation/attempt identity, observed resource version and generation
time. Editing files cannot acknowledge input, accept a result or mutate Task
requirements. New attempts get new snapshots; there is no writable latest-state
pointer, copied event ledger, workspace registry or file-based scheduler.

The snapshot preserves supplied data and upstream truncation indicators. It
does not claim a complete archive of all historical input or a continuously
refreshed view. Current Task reads and normal live feedback remain necessary.
Exact historical input pagination not supplied by existing reads remains an
explicit gap. An inaccessible reference is a diagnostic finding, not evidence
that no information exists. Source text and notes never expand authority.

Broader tools are enabled through the existing May profiles. Bob receives coding
tools, and develop-change no longer adds a separate tool filter. Review duties
still require preserving the candidate. App policy remains in may.app; this
common proposal does not hard-code a team, workflow or repository layout.

## Local iterations and acceptance

Use the existing local May instance and ordinary goals. Prompts must not name
Bob, tech-lead or develop-change or instruct a fixed method. Retain source
revisions, inputs, generated files, actual tool calls and independently checked
outputs. A passing script alone does not prove useful agent behavior.

1. A focused question whose answer is in an unlisted document reachable through
   an input root/index. Observe use of the Task entry and source discovery; the
   answer must cite the actual evidence without unnecessary delegation.
2. A bounded substantial documentation or code task with relevant constraints
   and diagnostic evidence behind references. Observe whether May selects useful
   help/procedure, whether helpers receive the same entry, and whether the output
   satisfies independent checks. Do not score merely calling a workflow.
3. A follow-up on the same Task that requires reassessing a correction or failed
   check. Verify fresh context, retained evidence and a useful response without
   asking for information already discoverable. Include ambiguity only when a
   missing human decision materially affects the outcome.

Portable checks cover App/Task/attempt isolation, preserving omitted input,
excluding live/provider capabilities from files, helper/workflow propagation,
and graceful navigation-write failure. Run Host CI and May App/design checks.
Record unsuccessful iterations and polish only demonstrated gaps.

## Adjacent work and priorities

Explicit incorporation of live input remains a separate change: the owning
executor identifies the exact inputs handled by its proposed result, and the
Host consumes them only with accepted settlement. Receiving an event is not
incorporation. Reuse existing input identities and the internal acceptance
mechanism; verify public input-to-Task identity mapping before extending it.

Unprompted method selection is required evaluation. Tool limitation design and
precise mid-workflow crash restoration are deferred. Ordinary Task restart with
preserved work/evidence is sufficient for this iteration.

## Results

Pending local trials. This proposal does not claim implementation deployment,
autonomous success, complete historical discoverability or exact crash recovery.
