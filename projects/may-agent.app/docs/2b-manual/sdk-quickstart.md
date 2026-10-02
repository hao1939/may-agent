# App SDK quickstart

**Supports:** [May-Agent SDK](../2a-design/sdk.md). Provides a checked starting path from App declaration to admitted work.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

Run a real document review, inspect its evidence, and send a correction to the
same Task. Then change the reviewer guidance and check a fresh execution.
The [sample App](../../../sample.app/README.md) is the runnable source for this
walkthrough; the examples import it rather than maintain a second App.

The responsibility split is small:

| Part | Responsibility |
| --- | --- |
| Host | Preserve input and context, schedule attempts, retain results and waits, and return delegated results to their caller. |
| App and worker | Define the outcome, find relevant information, perform the work, and judge what remains. |
| Control client | Submit and inspect work from outside the App. App code uses the SDK's scoped capabilities during execution. |

The [App capability map](../2a-design/sdk.md#the-host-as-an-apps-environment)
explains what the Host provides for execution, cooperation, context, recovery
and improvement, and which decisions remain with the App.

## 1. Check the installed sample

This walkthrough uses this source workspace, Bun, and an already running Host
with its paired SDK and a configured model. It does not install the Host. The
[operator guide](user-guide.md#starting-and-development-modes) covers installation usage; obtain the
control socket and definition source checkout from your installation operator.
The sample configures `gpt-5.6-sol`; select an available model in its `agent.json`
if your installation differs, then activate that source change as in step 5.

Run commands from the installation's source workspace, which must contain
`projects/may-agent/packages/control/src/client.ts` as well as the App files.
The example client imports that Host source; a Task worktree containing only
Apps is insufficient. In this installation, use `cd /app`. An installed client
can instead import the equivalent `@may-agent/control/client` package when the
installation supplies it. The sample worker's App root is `projects/sample.app`;
that is a different working directory. Source references below are relative to
the source workspace root.

```sh
sample_socket=/absolute/path/to/may.sock
bun projects/may-agent.app/docs/examples/client.ts apps "$sample_socket"
```

For this workspace's local background instance the socket is
`/app/.state/instances/background/may.sock`. Use your installation's actual
endpoint. The response must contain App `sample` with owner `sample-reviewer`.
If it is absent, activate the committed sample using step 5, then check again.
A connection error calls for checking the endpoint and Host readiness.

## 2. Submit one review and inspect the result

Choose one request key and keep it for retries of this submission:

```sh
review_key="quickstart-$(date -u +%Y%m%dT%H%M%SZ)"
bun projects/may-agent.app/docs/examples/client.ts submit "$sample_socket" "$review_key"
```

The [client](../examples/client.ts) asks the sample to compare its README with
`app.ts` and reviewer instructions. Repeating `submit` with the same key and
input refers to the same admitted work. Keep the variable's value for retries;
a distinct review uses a new key. Changing the question requires changing the
client's `reviewInput` and choosing a new key.

The receipt includes an `eventId` and normally a request link. For example,
`{"eventId":123,"delivery":"accepted","links":[{"kind":"request","id":"app_…"}]}`
is an input acknowledgment, not a completed review. Read that exact event:

```sh
bun projects/may-agent.app/docs/examples/client.ts event "$sample_socket" 123
```

Replace `123` with your receipt's event ID. Use the request link's `id` below.
This sample's [mapper](../../../sample.app/app.ts) defines its Task ID as
`review/<request-id>`; this is an App choice, not a universal naming rule.

```sh
sample_task='review/REQUEST_ID'
bun projects/may-agent.app/docs/examples/client.ts task "$sample_socket" "$sample_task"
```

Replace `REQUEST_ID` with the exact linked request ID. If the Task is `null`,
read the event's delivery state and request link again: attachment may still be
pending, or admission may have failed. Preserve those identifiers for diagnosis.
Use subsequent exact Task reads to follow execution; the Host schedules work.

A completed read includes `status: "done"`, a summary and `acceptedAttempt`.
The client's `acceptedEvidence.page.items` contains up to four accepted results,
newest first. Inspect each entry's `acceptedResult`: the sample's structured
`result` contains findings, coverage, limitations and file evidence. Its free-form
layout may vary; artifacts may appear under coverage. `done` means the Host accepted an
outcome; read the answer and evidence to decide whether it satisfies the request.
A Task can accept later corrections until it is closed by its owner.

`pending` and `running` indicate outstanding execution. For `waiting` or
`attention`, inspect the retained Conditions, input waits, summary and events;
those states can coexist with useful results. Diagnose the named issue through
[ordinary recovery](app-operations-recovery.md#unfinished-request).

For file evidence, the current shared consumer expects an absolute path and a
SHA-256 hash of the reviewed bytes. Prefer immutable definition sources or
Task-scoped retained copies: working files can change after the review. The
existing [artifact reader](../../../../shared/tools/task-evidence.ts)
`readPinnedArtifact` verifies accessibility and identity; it does not judge the
claim. Missing, mismatched or truncated evidence remains a review limitation.

## 3. Send a correction to the same Task

After the first result, ask for a specific additional check:

```sh
bun projects/may-agent.app/docs/examples/client.ts message "$sample_socket" \
  "$sample_task" "$review_key-correction-1" \
  "Also check the reference-count limit in app.ts. Explain whether the README needs to mention it, with evidence."
bun projects/may-agent.app/docs/examples/client.ts task "$sample_socket" "$sample_task"
```

The message targets `{ appId: "sample", taskId: sample_task }`. It keeps the
same Task and adds new input; it does not start another review Task. Retain this
message's receipt too. Reuse its key and identical text if submission is uncertain.

The immediate read may still show the earlier result while new work is pending.
Read again after execution. Success means a new accepted attempt answers this
correction and the earlier accepted evidence remains accessible. Check the
attempt identity and response, not just the word `done`. A supported conclusion
that no README change is needed is valid. Our [first live review](../../../sample.app/reviews/2026-09-30.md)
shows why delivery, evidence accessibility and review quality need separate checks.

## 4. Understand the App you ran

| File | What it contributes |
| --- | --- |
| [app.ts](../../../sample.app/app.ts) | App address, validated input schema, default agent, and a pure input-to-Task mapping with outcome and acceptance criteria. |
| [agent.json](../../../sample.app/agents/reviewer/agent.json) | Configured model and tools. |
| [AGENTS.md](../../../sample.app/agents/reviewer/AGENTS.md) | Reviewer's stable responsibility, evidence requirements and pointers to additional guidance. |
| [tasks/seed.json](../../../sample.app/tasks/seed.json) | Structural root referenced by new Task intents. |

This App needs no workflow: its selected agent performs the review. Importing
`app.ts` declares policy; execution starts when the Host admits and schedules
work. The App owns the Task; selecting an agent chooses its worker.

At an attempt's start, the Host supplies current Task identity, outcome, input,
acceptance, pending updates and links to retained context. The worker follows
relevant links and uses available reads to gather more information. A file's
presence in the repository does not put its contents in the prompt. Link useful
material from the Task or `AGENTS.md`; the [agent convention](agent-convention.md#prompt-files)
explains what is loaded and what is read on demand. Stable guidance belongs in
agent files; a one-off correction belongs on the Task.

## 5. Change guidance and verify adoption

Before changing a cited file, preserve the original reviewed bytes if the result
points to mutable source. Saving its path and hash alone cannot recover old
content. For each such reference, copy its actual `path` and `sha256` from the
accepted result into this example, run it from the source workspace, and retain
the returned reference alongside the original accepted attempt ID:

```ts
import { EvidenceStore, readPinnedArtifact } from "./shared/tools/task-evidence.ts";

const reference = { path: "/absolute/cited/file.md", sha256: "HASH_FROM_RESULT" };
const read = await readPinnedArtifact(reference);
if (read.status !== "read" || read.content === undefined) {
  throw new Error(`Original evidence is ${read.status}; resolve this before editing`);
}
const retained = await new EvidenceStore(
  "/absolute/task-notes/reviewed-bytes",
).put(read.content, "md");
console.log(JSON.stringify({ original: reference, retained }));
```

Substitute an actual Task evidence directory too. This example preserves the
sample's UTF-8 text evidence using the existing shared helper. Already immutable,
readable snapshot references need no extra copy.

In your definition source checkout, make one small change to
`projects/sample.app/agents/reviewer/AGENTS.md`, for example: "End each review
with one sentence identifying the most important untested assumption."
Choose an observable behavior so the next result can confirm or contradict it.
An agent carrying out this exercise also needs the installed file-edit authority.
If its tool denies the edit, request the change from an authorized owner through
ordinary cooperation and record that assistance. A Task assignment alone does
not change the tool's permissions.

Run the existing checks, inspect the diff, and commit only your intended change:

```sh
bun run check:may-design
git diff -- projects/sample.app/agents/reviewer/AGENTS.md
git add projects/sample.app/agents/reviewer/AGENTS.md
git commit -m "docs(sample): clarify the review's untested assumptions"
sample_commit=$(git rev-parse HEAD)
bun projects/may-agent.app/docs/examples/client.ts reload "$sample_socket" "$sample_commit"
```

Reload activates App/agent definitions from the installation's configured source
checkout; an arbitrary worktree commit is not automatically selected. Pass the
exact commit from that configured source. Reload pins that commit into the staged
release and rejects dirty executable definitions in the configured source; a
clean side worktree does not make a dirty configured source eligible. This
operation affects the installed registry, so perform it within your installation's
normal operator authority.

Read the reload receipt's `eventId` using the client's `event` command. Once
finished, its `operation` link names `event:COMPLETION_ID` and says `succeeded` or
`failed`. Read that completion event and verify `event.data.ok: true` and
`event.data.sourceCommit` equal to `sample_commit`. An input acknowledgment alone does
not confirm activation. Console's `/reload` is the interactive alternative;
[reload recovery](app-operations-recovery.md#failed-app-reload) covers rejection.
Reload changes definitions; it does not update the Host binary or SDK.

Submit a fresh review with a new request key using step 2. Inspect the new result
for the changed behavior and usable evidence. Keep the original result for
comparison, and record assistance and limitations. The source checks validate
SDK/control types, seeded Task replay and result admission; only the live trial
checks model behavior. The [reusable review method](workflow-authoring.md#reusing-an-app-review)
explains how to retain lessons for another App.
The [quickstart trial](../../../sample.app/reviews/sdk-quickstart-2026-09-30.md)
records the observed adoption, documentation corrections and assistance.

## Extend when the work needs it

Use [Task authoring](handler-authoring.md) for result scope, waits and typed App
dependencies; [workflow authoring](workflow-authoring.md) for repeatable procedures;
and the [App contract](../2a-design/agent-app.md) for fact routing and observations.
The [result recipes](../examples/app.ts) are illustrative: their pipeline and
governance Apps are not installed by this sample. The
[adoption checklist](agent-app-adoption-playbook.md) helps apply these choices to
your own App. Keep the Host's bookkeeping and recovery in the existing Task path.
For long waits, use [fact-driven wake-up](../2a-design/sdk.md#wake-on-new-facts-and-offload-polling)
so dependencies and observers carry status checking while the worker yields or
continues useful independent work.

For a new resource detector, start with the [checked observer example](../examples/observers.ts).
The App implements `inspect(resource, {signal})`; the Host supplies the rest.
An agent can discover the installed capability with `tasks.contract`, then
build a Condition without knowing event fields:

```json
{
  "action": "contract",
  "target": { "appId": "builds" },
  "observation": {
    "observerId": "status",
    "id": "build-result",
    "resource": "acme/widget/42",
    "expected": { "field": "state", "anyOf": ["passed", "failed", "cancelled"] }
  }
}
```

Return the reply's `condition` in the Task result's `conditions`. The contract
read alone starts no wait. Workflow/executor code uses `read.contract(appId)`
and SDK `observationCondition` for the same result. The `builds` App here is an
example, not an installed provider. Install the matching Host/SDK before using
the new declaration. For diagnosis, exact `apps.list {appId}` reads show recent
resource inspection health; the Task's saved review deadline still provides a
review opportunity if detection stops entirely.


### Smoke-test the installed observation path

Use an ordinary Task with a safe, known resource that already satisfies the
expected state. Saving its observation Condition requests a prompt check through
the installed observer; it need not wait for the next normal polling interval.
There is no separate smoke mode, watcher registration or synthetic success event.
The [checked workflow example](../examples/observation-smoke.ts) uses a known
finished build and the [build observer example](../examples/observers.ts).
Install the workflow in the owning agent's normal workflow directory, then
assign a Task selecting `workflow: "observation-smoke"` with
`input: { resource: "acme/widget/123" }`. Replace that reference with an allowed
known resource of the installed provider; these examples do not install one.
An agent can carry out the same steps using `tasks.contract` and Task results.

1. Discover the installed descriptor and save the Condition in a waiting result.
2. Let the Host read the source, persist and deliver a matching fact, and schedule
   the Task's next owner attempt. Let that attempt inspect the evidence.
3. Accept the smoke outcome only after receiving the exact source/resource fact.
   Retain its event ID and observed data; read the Task with
   `acceptedEvidence: { limit: 2 }` to inspect the waiting and receiving attempts.
   The example result also records delivery time and the provider's observation
   time when supplied. A failed build can pass this transport smoke test: the
   test verifies observation and continuation, not whether the build passed.

If the result is still unverified, inspect the Task's current Conditions and
pending input, exact source App `observerHealth`, event receipt, and accepted
attempts. These distinguish source failure, unmatched evidence, delivery failure
and an owner that did not continue. Keep the Task unresolved for diagnosis using
its existing review deadline. Periodic observation retries failed reads and
covers missed prompt notifications. Host capacity and provider latency still
apply; a successful smoke run is evidence for that resource and moment, not a
promise that every future check succeeds.

## Find the assignment and current evidence

Use the supplied Task entry and exact context/catalog references to discover the
assignment, result contract and available reads. A helper keeps its own narrower
contribution. The generated snapshot describes a captured revision; use the
scoped Task reader when a decision needs current state. Native adapters must
actually expose a read capability before their workers can call it.

Keep assigned input separate from the currently unclaimed pending window. An
empty pending window does not erase a correction already assigned to this attempt.
Accepted results, unfinished requirements and independent Conditions can coexist.
Reading them does not acknowledge or fulfill them. Unavailable evidence differs
from an empty successful read. Follow exact detail links when omitted information
matters to the decision; no mandatory sequence of tool calls is required.

The [Task resource proposal](../proposals/task-resource-layout-20260929.md) records
the missed-review case and remaining usability comparison. The current
[Task read contract](../2a-design/task-resource-read-interface.md) owns the API.
