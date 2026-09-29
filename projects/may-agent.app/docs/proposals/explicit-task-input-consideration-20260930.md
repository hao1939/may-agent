# Explicit consideration of earlier Task input

**Status:** Source prototype and deterministic trials; not deployed. The owning
contracts are the [Task engine](../2a-design/task-resource-engine.md) and
[Task reader](../2a-design/task-resource-read-interface.md).

## Problem and evidence

A worker deferred several related requests to a future review time. After a
later correction, it correctly answered the new input and retired the obsolete
approval. Older requests without a Condition link remained waiting until their
timers were due. A different, legitimate timed request has the same storage
shape; the Host cannot infer which ones the correction withdraws.

The existing recovery index retained the deadline across restart. A production
function trial confirmed that due recovery returns those inputs and can settle
them. Recovery scheduling was working. The gap was that the same automatic
selection controlled both context retrieval and which older input an active
worker could answer. There was no exact read/result option for acting earlier.

## Small contract extension

1. Discover outstanding admission keys in `currentObligations.inputWaits`.
2. Read original requests with `read.tasks.get(taskId, { inputKeys: [key] })`.
   Agent tools and App socket/HTTP reads use the same canonical reader.
3. Return ordinary Task output with `consideredInputKeys: [key]` to include an
   older request in the result, even before its review timer is due.

The selected keys add to the input already assigned to the attempt. Convergence
answers that combined set. Waiting and incomplete outcomes can report on it,
but do not answer it. Unselected obligations and independent Conditions remain.
Reading never consumes input. Both options accept at most eight keys per call.

The App judges whether the same answer applies to the older requests. The Host
validates exact Task ownership, unanswered admissions and existing outstanding
work, preserves the ordinary attempt/new-input fences, and atomically saves the
accepted result and input-to-result links. The additional selection is retained
in accepted evidence. It needs no new SQL column, service, timer, action, or
record migration.

## Comparison and trial

Baseline Host source: `c9fec72407f07ab795e307873d2200fbd9373eca`.
Candidate source: `8d77ea5686ef826459f283e1936191f9e9971086`
(branch `fix/explicit-task-inputs`).

The portable lifecycle trial reproduces three related timed requests, an
independent timed request, a human approval, and a later correction. It uses
real admission, Task state, accepted-result reads and SQLite close/reopen.

| Trial | Observed outcome |
| --- | --- |
| Omit explicit selection | New correction answered; all three earlier timed requests remain waiting |
| Select those three requests | Same accepted answer reaches all three before their deadlines |
| Independent timer and approval | Retained unchanged in both cases, including after restart |
| Waiting or incomplete selected result | Progress report available; original input remains unanswered |
| Missing, foreign or already answered key | Rejected; no partial completion or overwritten answer |
| Newer input or stale attempt | Existing fences prevent premature settlement |
| Independent timer expires during execution | Input remains unanswered and returns at the next claim; accepted live context can include it in the current result |
| Tool versus executor reads | Same original request and source returned through both interfaces |

The registered-executor trial passes through real result normalization and
attempt settlement for converged, waiting and incomplete results. This checks
the connections, not only the lower-level reconciler. SDK tests cover the same
field through agent and workflow finish schemas. These are deterministic
worker trials, not claims about model judgment or live recovery.

A further timing trial failed on the first candidate: settlement recomputed
timer eligibility using the finish time, so an unrelated input becoming due
during execution received an answer without being presented. The correction
keeps the claim's saved selection and extends the timer window only through
accepted live input. Merely finishing later cannot add requests. The same
selector still applies explicit keys and correlated Condition changes. Both
the unseen-input and accepted-live-input variants now pass; the remaining due
input is selected normally on the next claim, without a new recovery path.

Final candidate validation: `bun run ci` passed with **3,298 tests passed,
0 failed and 3 installation-only checks skipped**. The design integrity, SDK
example and canonical App-boundary checks also passed. No live restart or
Task-state mutation was used for the trial.

Reproduce from the candidate Host checkout:

```sh
bun install --frozen-lockfile
bun test packages/sdk/src/task-contract.test.ts \
  src/app/core/tasks/app-task-common-lifecycle.test.ts \
  src/app/core/tasks/app-task-runtime.test.ts \
  src/app/core/reads/app-read.test.ts \
  src/app/app-task-read-tool.test.ts packages/control/src/control-socket.test.ts
bun run ci
```

## Value, cost and limits

This removes the need to wait for a timer after an agent has enough evidence to
answer an older request. Host code does not guess semantic relationships from
text or clear every wait after apparent success. The implementation adds one
read option and one result field, their transport wiring and validation; the
existing admission and accepted-result records remain authoritative.

One attempt still has one common disposition. Different answers or completion
versus deferral for separately assigned inputs require separate passes; this
prototype does not add a per-input result language. Default discovery remains
capped at 100 outstanding inputs with explicit truncation. Exact reads can load
known keys beyond that window, but this is not new inventory pagination.

The worker must actually inspect the original requests and judge relevance.
The Host checks identity and settlement, not whether the judgment is correct.
After review and a separately authorized rollout, try the same scenario with a
real worker: verify that it reads the originals, chooses only relevant keys,
and leaves the independent approval visible. Existing historical records can
continue through their normal scheduled recovery meanwhile.
