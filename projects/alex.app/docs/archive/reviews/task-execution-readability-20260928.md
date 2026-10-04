# Task execution readability review — September 28, 2026

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Candidate source reviewed; full local CI and design/example checks passed.
This record does not establish merge, deployment or model behavior.

## Finding and change

The ownership model is sound: core claims the Task and settles its result;
adapters execute; the App supplies method and acceptance. The implementation
made that harder to follow because agent, workflow, registered-executor and
Conversation branches each entered the same attempt wrapper separately.

Open that existing wrapper once around dispatch in `runClaimedTask()`:

```text
claim -> workspace preparation -> prepare Task context
  -> subscribe and renew lease -> select and run handler
  -> remove subscriptions/timer -> validate and settle report
```

Two explicit core-private input types replace adapter-derived `Omit` types and
repeated parameter lists. Concrete agent/workflow adapters still receive the
restricted contracts in `execution.ts`; the core's claim, store and runtime
options are removed before invocation. The workflow runner is named
`runTaskWorkflow`, matching its actual responsibility.

Review also found a preparation leak. The original context builder subscribed
before reading the agent role and other context. If a read threw, it never
returned its cleanup handle. The regression observed the abandoned callback
reading cancellation state on a later Task event. Construct context before
acquiring subscriptions. After repair, the existing unsuccessful-attempt path
retries and accepts the same Task; no new recovery rule is needed.

## Scope and cost

Baseline: Host `edc43e16b481e88ef1cca67dffb68dd1e4dd76f7` (#264).
Candidate branch: `refactor/task-execution-readability-20260928`.
Validated source: `eb2a8b066104a8e3454664e7d3fbb304c93b4410`.
Host review: [PR #265](https://github.com/hao1939/may-agent/pull/265).

Reviewed the claim/dispatch/settlement path, `execution.ts`, managed-agent and
workflow adapters, composition, and their context handoff into the manager.
This is a focused source review, not an exhaustive audit of every executor.

Production code has 50 fewer lines, with fewer nested callbacks and one visible owner
for the attempt scope. Most diff lines remove indentation around unchanged
handler bodies or move context construction before resource acquisition. One
new regression exercises failed preparation, later event delivery and repair.
There is no SDK, storage schema, prompt policy or App contract migration.

The scope now includes handler-selection work: missing registered executors
and workflow-verifier lookup during agent handoff pass through the same attempt
boundary. Workspace preparation remains earlier; result validation and durable
settlement remain later. The execution lease and subscriptions are not a second
Task authority. Existing claim and result fences still govern stored effects.

## Context and extension decisions

Keep the saved assignment, workspace discovery files and refreshed decision
brief. They serve different lifetimes: invocation evidence, discoverable detail,
and current model context. A short prepared request can rely on the brief while
retaining the full request as recovery evidence and discovery-failure fallback.
Workflow typed input and reconciliation context also remain intact. Similar
text alone does not prove unnecessary model tokens or justify deleting evidence.

Extend method through App agents, tools and workflows. Composition installs a
new executor when an execution mechanism is needed; it accepts the existing
Task surface and returns a proposal. Shared scheduling, cancellation observation,
event acceptance and settlement continue to belong to core. See the
[source reading guide](../../2b-manual/source-reading-guide.md#4-read-the-attempts-main-path)
for the concrete routes and the
[Host/App boundary](../../2a-design/system-boundary.md#execution) for ownership.

## Verification

- Agent/workflow/executor/context checks: 162 passed before the preparation fix.
- Conversation and worker-process checks: 61 passed before the preparation fix.
- New preparation regression failed before reordering: one abandoned cancellation
  read. After reordering it passed, including successful retry of the same Task.
- Final `bun run ci`: 3,278 passed, 3 skipped, 0 failed; includes type checks,
  SDK/boundary checks, lint, real worker/daemon and browser tests. The three
  skipped checks require installed agent/App configuration, outside portable CI.
- `bun run check:may-design`: document integrity, checked SDK/control examples
  and canonical App integrity passed, using the candidate Host checkout.

The regression waits for the same Task event stream, rather than assuming a
separate asynchronous observer has already drained. Its retry is explicitly
driven; it demonstrates retained work and correct settlement, not autonomous
model diagnosis or scheduler discovery. Existing integration suites cover those
other mechanical paths separately. No live Task or binary was changed.

## Further review

The result-settlement branches remain the largest part of `attempt-runner.ts`.
Preserve their ordering and independent obligations when simplifying them;
do not combine successful, waiting and rejected reports just because code looks
similar. Workflow loading, step evidence and invocation scope in
`workflow-tool.ts` deserve their own bounded review. Before changing context
assembly, compare actual provider input and recovery behavior; source text
duplication alone is insufficient evidence.
