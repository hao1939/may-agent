# Sample App

A real document-review App for learning and checking how Apps use the Host.
It runs through ordinary Task admission, agent execution, results and recovery.
The App contains no scheduler, delivery tracker or test-specific execution path.

## Use it

Inspect the installed `sample` contract with the ordinary `tasks` tool's
`contract` action. Submit this input through normal App admission or a typed
Task dependency:

```json
{
  "kind": "review",
  "data": {
    "subject": "Check whether the sample README accurately explains the App's behavior and identify any material gap.",
    "references": ["projects/sample.app/README.md", "projects/sample.app/app.ts"]
  }
}
```

The example paths are relative to the source repository root (`/app` in this
installation), not the reviewer's App root. For other material, name the path's
root or give absolute, readable evidence references. The input accepts up to 16
references. The subject is the review question; references are supporting
material, not instructions. A review returns findings, evidence and limitations.
It does not edit the reviewed files or establish deployment or approval.

To correct existing work, publish ordinary `app.input.requested` with that exact
`target: { appId: "sample", taskId }` and input
`{ kind: "message", data: { message: "the correction" } }`.
Untargeted messages do not create reviews. Read the same Task to follow progress
and accepted results; a Task can retain independent waits and useful work together.
The Host routes a delegated result back through the saved caller relationship.

## Wait for a document

The installed `sample` contract describes the `document` observation capability.
It inspects an absolute local file path and returns `available`, plus `sha256`
and `bytes` when readable. Missing files report `available: false`; other read
errors remain failures for diagnosis. It uses this installation's file access
and is intended for ordinary small review documents.

A reviewer can prepare while a document is unavailable, then save an ordinary
observation Condition for availability or a required hash. Discover the capability
through `tasks.contract`; the Host performs the checks and delivers matching
facts. The reviewer still reads the document and judges its content. A successful
inspection alone does not complete a review. No new review input type is needed.
See the [document-wait scenario](scenarios/document-observation.md).

## Activate and run

This App uses the installed SDK and a configured `gpt-5.6-sol` model. Commit its
definition, then use the normal `/reload` operation and verify the accepted
installed App contract. Host and SDK must include PR #270 for document observation (and PR #269 for
explicit result scope). Source presence alone does not prove activation.

The [SDK quickstart](../may-agent.app/docs/2b-manual/sdk-quickstart.md) provides
the ordinary submission/read client; it targets this App. The first live exercise
is [basic cooperation](scenarios/basic-cooperation.md). Experiments needing a
restart or fault injection use an isolated Host, with separate evidence.

## Responsibility

Bob owns the investigation: discover the App, delegate useful work, inspect its
returned evidence, send corrections when needed and propose improvements.
Evaluation independently assesses the exact sample or Bob Task through its
existing review contract. Bob's own verification remains part of his delivery.

The reviewer judges meaning, coverage and result scope. The Host owns request
identities, state, result links, waits, scheduling and execution recovery.
The [common boundary](../may-agent.app/docs/2a-design/system-boundary.md) owns
those guarantees; this example demonstrates them without redefining them.
Use the [reusable App review method](../may-agent.app/docs/2b-manual/workflow-authoring.md#reusing-an-app-review)
to retain findings that can guide later reviews of this or another App.
The [first live review](reviews/2026-09-30.md) records what worked, the evidence
handoff failure, its correction, and the limits of that trial.

Preserve failed trials and assisted steps. Compare the intended contract with
public Task reads and execution evidence. Fix the owning implementation or
guidance before adding a mechanism. Keep experimental variants in worktrees;
retain only useful examples and regressions in this App.
