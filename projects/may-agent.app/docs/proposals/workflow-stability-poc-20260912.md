# Workflow PoC: make the process dependable

**Supports:** [Workflow Discovery And Execution](../2a-design/workflows.md). Tests dependable sequencing and failure handling rather than treating workflow use as better judgment.

**Choice basis:** [Applicable philosophy and convention](../1-principles/code-vs-data.md#composition-preserves-execution-rules); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Local investigation, September 12, 2026. No production changes.
**Revises:** The workflow conclusion in the [first PoC](agent-adoption-poc-20260912.md).
**Proposal:** [Teaching agents and extending abilities](agent-behavior-and-capability-extension.md).

## The corrected question

A workflow is not primarily a way to make the model smarter or faster. It makes
a necessary process dependable. Equal review findings do not disprove its value.
Ask whether required steps, evidence checks and failure handling can be relied
on, and what that reliability costs.

The previous three-file collector was too weak a test: it gathered available
files, but did not enforce a coherent-revision collection procedure. Its `done`
meant “available files gathered,” not “complete evidence certified.” That was a
narrower contract, not a reason to reject workflows generally.

## A small procedure, using the existing runtime

```text
read head -> pin revision -> collect change/checks/comments
  -> validate all required responses -> recheck head
  -> complete coherent packet OR explicit limitation with partial evidence
  -> agent judges findings and what to do next
```

The new fixture workflow enforces that sequence. It retries only a read returning
HTTP 503, once; it never retries a 403, malformed response or incomplete comment
set. These are explicit fixture rules, not a general production retry policy.
The owning adapter should define retryable operations and respect its provider's
limits; do not retry an uncertain mutation as though it were a read.

Required sources stay in the packet, including errors and both attempts of a
retried read. The collector does not infer the cause of a defect or decide merge
readiness. A complete packet containing failed CI is still successfully collected
evidence; it is not permission to merge. An incomplete packet can still contain a
useful finding. Neither result closes the owning Task.

The experiment uses Host `49272b5ac545aa2c4b7ab887c10183f5a76a8bd0` plus the
local PoC harness from `dc4a2530`, on branch `poc/agent-behavior-adoption-20260912`.
Final follow-up source is preserved in local commit
`a6d7b91ab5d3a2a34b8e37806bd7acffc0ecaf7c`; it has not been pushed.
New files are `scripts/poc/workflow-stability.ts`, its test, and fixture modules
`stable-review-evidence.ts` and `review-source.ts`. No Host runtime code changed
in that measurement; the subsequent source candidate is described below.
They use real workflow discovery, execution, persistence and inspection, with a
synthetic loopback HTTP provider. No real GitHub/ADO data, writes or credentials.

## What the fault tests establish

Each row ran three times through May's actual workflow tool: **27 fault-matrix
executions**, with exact source-call and stored-result assertions.

| Input condition | Required observed result |
| --- | --- |
| Stable revision and complete sources | Complete packet; head checked before and after collection |
| One transient 503 | Exactly one retry; both read attempts retained; complete packet |
| Checks return 403 | No retry; incomplete packet; other evidence retained |
| Head moves during collection | No certification of the old packet as current |
| Checks belong to another revision | Explicit revision mismatch; no current passing-CI claim |
| Comments marked partial | Incomplete packet, not silently complete comments |
| Malformed checks response | Explicit invalid/missing-field limitation |
| Persistent 503 | Two attempts total, then incomplete packet |
| Correct-revision checks failed | Complete packet containing the failure, not a success verdict |

The tests show enforcement of this authored procedure in these fixtures. They
are not proof of all real provider shapes, every race, or production availability.
The provider's revision-labelled comments are deliberately simplified: a real
adapter must preserve actual PR/review coverage, not invent revision provenance.
The final head read only establishes the snapshot at that point; it cannot stop
a later push. A later action needs its own expected-revision precondition.

## Fair direct-agent comparison

Both arms receive the full same procedure and the same read-only source helper.
The direct agent performs collection itself. For the workflow arm, the experiment
caller runs the procedure first, then the agent judges the returned evidence,
with the original sources still available. This tests the workflow **once chosen**,
not natural discovery or a guarantee that a model will invoke it.

Five cases—stable, transient 503, denied checks, moving head and stale checks—run
twice per arm, reversing arm order on the second pass: **20 model-backed
executions** on the same configured `gpt-5.6-sol` route, with a 90-second limit
per execution and no fallback. Full answers, tool calls and source-call records
are in the [sanitized evidence](evidence/workflow-stability-20260912.json).
All 20 model executions returned `done`; only four of the ten initial workflow
collections returned complete packets, and six returned honest limitations.
Returned usage summed to 72,297 tokens, including repeated context; it is not
an invoice or a unique-content count.

The direct agent followed the supplied protocol in the observed cases, including
one permitted retry and final head checks. Both approaches retained the supplied
null-input defect, kept the cosmetic comment non-blocking, and treated missing
or stale checks honestly. There is no demonstrated reduction in agent failure
rate from this small comparison.

The moving-head case illustrates the useful division of work: the collector
returned an explicit limitation rather than silently repairing its own contract.
The judging agent then chose to recollect at `v2`. The direct agent did likewise.
The workflow arm kept its original blocked packet as historical evidence; the
later agent result did not rewrite that run into success.

This is not evidence that workflows are unnecessary. For direct execution, the
model is remembering and following the sequence. For the selected workflow, the
sequence and checks are ordinary testable code, independent of its later judgment.
Choose this mechanism when that explicit contract is needed; do not claim a
measured reliability gain or require better bug discovery as its admission test.

## Two runtime limits reproduced in the baseline

### Cancellation fences results; it does not preempt arbitrary helpers

A deterministic test held the checks response, cancelled the workflow, then
released that response. The runner returned an error and kept that terminal
record. Late diagnostics were suppressed. However, the imported helper completed
its HTTP read and workflow code started a final head read **after cancellation**.
The source log grew from two completed reads at cancellation to five after release.

The baseline SDK context did not expose the workflow cancellation signal to that
helper. The runner cancels managed agent steps and rejects a late workflow result;
it does not kill arbitrary JavaScript. Existing SDK effect fences are valuable
but cannot protect raw external calls that bypass them.

For this read-only collector, bounded late reads are an accepted PoC limitation.
Before using such a procedure for effects, propagate cancellation/deadline through
the existing execution context and helper calls, and retain authority/revision
and idempotency checks at the action boundary. A narrow `AbortSignal` is worth
evaluating; no cancellation service or new lifecycle is needed. It still cannot
undo a committed effect or preempt synchronous JavaScript.

A separate fresh invocation recollected all sources and completed successfully,
leaving the cancelled run unchanged. This supports simple read-only redo. It is
not a process-crash test, same-Task recovery trial or proof of exactly-once writes.

### Run inspection does not automatically preserve helper output

`readWorkflowEvidence` returned stored status, reason, authored diagnostics and
zero child-agent steps for this code-only workflow. The full source packet was
returned to the caller but was not present in that inspection result. The test
checks this explicitly; a useful log is not the same as retained raw evidence.

A real caller's Task result or tool transcript may separately preserve the
packet; this experiment does not prove those paths lose it. Before promising
“investigate from this workflow run,” retain one bounded canonical output or
artifact and expose its link through existing run inspection. Reuse an existing
result when available rather than duplicating the packet in several stores.
Do not add a metrics pipeline or event subscriber to solve a result-link gap.

## Smallest recommended design

- **Skill/instructions:** teach how to judge evidence and choose useful methods.
- **Workflow:** encode the necessary stable sequence and explicit failure results.
- **Existing Host runtime:** bound execution, retain/link evidence and fence results.
- **Agent/App:** decide the next authorized action; the Task keeps the obligation.

A workflow can be optional to choose and strict internally. If an operation
requires certified evidence regardless of model choice, enforce that precondition
at its existing action boundary. Do not add another semantic router, supervisor,
preference registry or mandatory workflow for every conversation.

The candidate below addresses those two gaps for the synthetic procedure. A real
provider adapter and natural adoption still need their own checks. Preserve the
agent's useful direct work; do not turn collection into a full repair/approval/
release controller.

## Local source candidate

This section preserves the original local candidate and its validation. Its
runtime/SDK fixes were subsequently extracted into
[Host PR #159](https://github.com/hao1939/may-agent/pull/159), refined after
review, and passed current-head Quality and Container checks. The
[next-phase report](conversation-adoption-poc-20260912.md) records that work,
real-daemon teaching and natural optional workflow selection. The original
experimental branch remains unpushed for audit.

The follow-up source is local commit
`11d7fe04c645ee86b80829d7b5a7abdbbe079a8e` on the isolated PoC branch. It is not pushed,
merged or deployed, and does not modify installed guidance or live Task state.
The original model results and evidence JSON remain unchanged; no additional
model calls were needed for these mechanical fixes.

**Cancellation:** replace the runner's separate expiration flag with one
per-run `AbortController`. Expose `ctx.signal`, propagate it into nested runs,
and have the existing collector pass it to its imported HTTP helper and check
before continuing or retrying. End the signal when the run settles, and remove
its parent listener and timer. Agent-step cancellation remains best effort; a
cleanup exception cannot prevent the caller receiving its original cancellation.

Tests cover caller cancellation, a parent's shorter deadline with a longer-lived
child, cancellation before entry, synchronous cancellation inside authored code,
caught cancellation/late returns, cleanup failure and independent later runs.
The HTTP fixture observes an aborted request, releases the held server response,
and confirms no final head read. A fresh collection completes and the cancelled
run stays failed. Bun's HTTP shim reports the abort on the request, not the
response's `close` event; waiting for the latter initially timed out. The test
now waits for the actual request event rather than a fixed delay.

**Returned evidence:** retain the JSON representation of `done` output or
`blocked` evidence in the existing run artifact. No SQLite migration, parallel
store or metrics component. The [owning contract](../2a-design/workflows.md#execution-evidence-candidate)
specifies the 64 KiB value limit and best-effort redaction. Oversize, circular,
BigInt or throwing serializer results are explicitly unavailable for inspection
without changing completed work into an error. The immediate caller keeps the
authored value; inspection keeps a separate sanitized snapshot, never a resume
checkpoint or Task acceptance decision.

All 27 source-fault executions now assert that the returned packet is inspectable
after storage reopen, including both retry attempts and blocked partial evidence.
Runtime tests additionally check credential redaction, unchanged caller data,
missing/corrupt artifacts and payload serialization failures. Large results must
use existing artifact references; this change does not upload or retain those
referenced bodies automatically. An interruption before return can leave logs
without a packet. Serialization and arbitrary imported code are not sandboxed.

This is a worthwhile small fix because it closes measured execution and inspection
gaps without extending the workflow's responsibilities. It does not establish a
better model error rate, complete provider coverage, crash recovery, exactly-once
effects or deployed behavior. Integration order is Host/SDK first, then workflows
that rely on `ctx.signal`; existing workflows may ignore the new capability,
while manually constructed typed test contexts need to provide it.

Candidate verification on Node 24.20.0 and Bun 1.3.14:

- **48 focused tests, five files, 461 assertions:** runtime cancellation,
  evidence persistence, discovery/dispatch, SDK boundary and the HTTP PoC.
- **Full `bun run ci`: 2,780 passed, three skipped, zero failed**, across
  285 files, with 10,770 assertions. The three skips are installed-agent/fleet
  configuration checks; ordinary CI does not require an installation. The first
  full run found three old context-key expectations; they were updated to assert
  an active signal in direct, runtime and Task execution. The final full rerun
  took about 140 seconds for tests; this is not a workflow speedup measurement.
- Candidate Host/SDK and explicit PoC type checks, lint and changed-code
  formatting checks passed. Canonical design, source-SDK examples and App
  integrity checks also passed. No container gate, model rerun or production
  trial was performed for this source change.

Those source/container and isolated conversation checks have now been performed
in the [next phase](conversation-adoption-poc-20260912.md). Its GitHub-shaped
procedure and read-only real-response capture still do not certify a deployed
provider adapter. Installed authority, catalog and background Task adoption
remain separate boundaries; do not hide them behind these runtime fixes.

## Reproduce and limits

See `scripts/poc/agent-adoption.README.md` in the local PoC checkout.
Baseline validation passed: **59 focused tests across eight files**, experiment-script
type checks, lint and formatting, plus canonical design/SDK/App integrity checks.
This was not full release CI, a container test or production verification.

```sh
bun test scripts/poc/workflow-stability.test.ts --timeout 30000
bun scripts/poc/workflow-stability.ts
# Explicitly authorized model calls, not ordinary CI:
bun scripts/poc/workflow-stability.ts --live
```

The fixture uses no external writes and preserves only synthetic data. The
comparison is small, fully instructed and single-model; model behavior remains
variable. It does not cover real pagination, repeated head churn, live permission
changes, crashed processes, long-lived Task continuation or arbitrary effectful
helpers. The original trial's unsupported test-coverage speculation also appeared
in one workflow-arm review: fixed collection does not make every inference true.
Do not confuse `done` agent execution with successful collection or correct judgment.
