# Task context discovery and agent-directed work

**Status:** Implemented candidate; five main local trials completed, not merged.
**Contract owners:** [Workspace convention](../2a-design/workflows.md#task-entry-and-discovery)
and [one handoff contract](../2a-design/workflows.md#one-handoff-contract).

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
The polished candidate retains a bounded filesystem error code in this fallback,
so the agent can distinguish an unavailable directory from other failures.

Loaded agent/skill/workflow definitions may be newer than a Task checkout. The
brief links the selected executor's actual instruction path and directs other
capability discovery through pinned catalog paths. The App workspace path is
not presented as the loaded definition source.

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
4. A larger portable coding example requiring independent review, without naming
   a helper or workflow. Check whether May discovers and selects useful team
   execution, and independently assess the resulting implementation.
5. After polishing observed path-discovery problems, repeat a focused loaded-source
   question on the updated Host. Record whether the invalid-path detour recurs.

Portable checks cover App/Task/attempt isolation, preserving omitted input,
excluding live/provider capabilities from files, helper/workflow propagation,
and graceful navigation-write failure. Run Host CI and May App/design checks.
Record unsuccessful iterations and polish only demonstrated gaps.

## Uniform handoff refinement

**Host candidate:** `32a8ece5`, extending the shared-execution branch.


The same bounded-contribution contract applies in all four agent/workflow call
directions. Keep one shared Task entry and a separate assignment on each
execution. A review of Gym's trainable behaviors, for example, receives the full
rebuild context but owns only that review contribution. Team names and the
chosen procedure remain App policy; this common mechanism does not encode Gym,
May, Bob or tech-lead.

The implementation reuses the SDK's `ExecutionResult` vocabulary through a small
Host adapter shared by model agent calls and workflow agent calls. Model
workflow results also expose its fields while retaining existing diagnostic
aliases. The model agent tool replaces its raw text/finish/structured payload
aliases with the common fields, avoiding additional copies of large results.
A completed session reporting blocked, partial or failed work must not
appear to its caller as successful contribution completion. Partial output and
the original finish facts remain available. Existing UI execution-row projections
describe runtime sessions and are not the assignment acceptance contract.

The manager supplies the same contribution guidance and exact execution/caller
references to helper sessions reached through either route. This Host-authored
guidance belongs in system context, separate from the caller payload; appending
it to a JSON assignment broke a portable context-preparation consumer in the
first full check and was corrected. No source text or caller instruction is
promoted to system context. The agent tool's
separate mandatory delegation-memo prose is removed; explicit context files and
success criteria remain supported caller instructions. The generated Task brief
labels its outcome as the overall Task outcome rather than a specialist's
assignment. Specific assignments stay in existing session metadata and workflow
input records; no new file or handoff registry is introduced.

A workflow that cannot start a requested nested workflow must report the failed
invocation. It must not return the parent run ID as if it identified that child.
Errors without an execution record remain control errors or exceptions; shared
rules do not require inventing evidence or hiding cancellation in a success
shaped response.

Portable boundary coverage exercises direct agent calls, agent-selected workflows
and nested workflows, all using real execution/tool paths with only the model
provider replaced. Two concurrent Tasks exercise exact caller isolation, shared
entry and assignment discovery, feedback without automatic acknowledgment,
normalized results and cancellation cleanup. Separate regressions check explicit
partial/blocked/failed agent results and unavailable nested workflow identity.
Live trials inspect actual choices and returned evidence; a model choosing one
route is not evidence that it tested every route.

This slice does not finish explicit input-incorporation bookkeeping or historical
input pagination. Those remain the adjacent work below. It also does not promise
that arbitrary authored JavaScript can be preempted, require exact mid-call crash
recovery, or turn diagnostic row projections into a second acceptance authority.

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

The initial Host candidate is `d26e4793`; the path/diagnostic polish is
`2ca9e59b`. May App executable definitions are `7b930d169e`. Both Host revisions
extend the shared-execution branch rather than the older canonical checkout.

| Iteration | Observed result |
| --- | --- |
| Focused fallback question | May first read `TASK.md`, searched actual source, checked current Task state and answered correctly in 139 words. One May session; no delegation. An unavailable `python` command was replaced with an available shell command without human help. |
| Engineering review and diagnostic sample | May read the entry and full context, discovered indexed documents omitted from the brief, reproduced the cwd defect, verified a one-line repair in a temporary copy and committed the report. The original fixture remained unchanged. |
| Same-Task clarification | A new attempt received a distinct snapshot with the prior result and new input. May enumerated the sample directory, discovered a newly added clarification absent from the old index, reused the investigation and committed the revised report. |
| Larger coding example | May selected `develop-change` without the request naming it or the team. May, Bob and tech-lead read the same entry. Bob designed, tech-lead implemented, Bob reviewed, and May checked returned evidence before delivery. The clean four-file candidate passed eight authored tests and independent checks. |
| Polished loaded-source question | On Host `2ca9e59b`, May read the entry, followed pinned source paths, read the loaded instructions and explained the bounded `ENOTDIR`/`UNKNOWN` diagnostic. No tool error or obsolete App-local-path detour occurred. The loaded and legacy global checkout profiles had different hashes. |

The first report candidate is `3bdd814f8f04ad63024e1b62ac3dde83b42292d1`;
the clarified candidate is `1b5ebfcb754722b79796c0673ea0681c47d2c72d`.
Each changes only the requested report. The latter includes the exact requested
sentence, "A resolved path is a location, not permission." Independent inspection
confirmed scope, content and clean worktree. Word counts differ by tokenizer but
both reports satisfy the requested 400–650 word range.

The coding candidate is `882c22f676b269c0aed55508ce50e322702be8af`, containing
only `README.md`, `index.mjs`, `cli.mjs` and `test.mjs` beneath
`projects/may.app/examples/task-reference-demo/`. Independent source review and
execution confirmed its eight tests plus preservation of 101 immutable entries
with duplicate labels/paths across six page sizes, Task-root path resolution,
absolute references and the distinction between empty and missing files. The
Task retained checksummed development report/evidence references. This example
remains a local evaluation candidate; it is not added to the Host or proposed as
a required reference registry.

The larger trial exposed an attempted read of an obsolete worktree-relative May
profile. The agent recovered, but this justified the small source-path polish.
It also showed that useful reviewer tools permit Bob to search the actual source.
The navigation convention does not eliminate repeated investigation or prove that
every team choice is efficient.

An independent reviewer initially checked the absent App-local checkout profile
instead of the legacy global checkout profile actually compared by May, and
incorrectly challenged the valid differing-hash statement. Rechecking the exact
tool arguments and all three paths corrected the evaluation. Both feedback
messages are retained, and the completed same-Task follow-up identifies all
three paths correctly, including the two verified hashes and the absent file.
This is an evaluator error, not a reproduced Host defect or evidence
that May's original hash comparison was false.

Local evidence is retained under the installation's
`.state/review-pilots/may-task-context-20260917/`: `trial-*-input.json`,
`trial-*-result.json`, `trial-*-observations.json`, `independent-review.json`,
`independent-code-review.json`, `independent-source-review.json`, the immutable
source copies and activation records. Observations contain tool
calls and selected facts, not copied model reasoning. The temporary harness is
not a production workflow or committed runtime dependency.

Both Host revisions passed CI: 3,082 tests with three installation-only skips; May
App checks passed 50 with one optional integration skip, and design checks passed.
All five main trial requests and both evaluator follow-up inputs settled on
their original Tasks. These bounded trials
do not prove complete historical discoverability, exact crash recovery or a
general autonomous success rate. Explicit live-input incorporation is still the
separate work described above.

## Recommendation after the trials

Keep the small entry/snapshot/catalog convention and broader reviewer tools.
The demonstrated value is discovery and useful handoff: direct work stays direct,
the agent can choose a team procedure when useful, and a correction can reuse
saved work. Code owns paths and exact identity; agents choose what to inspect
and judge the evidence. No scenario-specific input, mandatory team pipeline or
new workspace lifecycle is needed.

Next, make omitted historical input reachable through the existing scoped read
surface and complete explicit input-incorporation bookkeeping. Measure before
removing large fields from the current owner prompt or adding continuous
snapshot refresh. Precise crash continuation remains deferred.
