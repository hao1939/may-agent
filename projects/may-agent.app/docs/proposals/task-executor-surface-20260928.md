# Task execution surfaces: retained implementation and trial evidence

**Supports:** [Execution boundary](../2a-design/system-boundary.md#execution). Keep an assignment usable across agents, workflows and native executors without another work lifecycle.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource); [evidence-first changes](../1-principles/evidence-first.md); [value and cost](../1-principles/design-philosophy.md#value-and-cost).

**Design status:** Historical implementation evidence, synthesized October 3.
**Implementation status:** Host #265/#266 merged; the September 28 record includes
bounded rollout checks. This cleanup did not repeat them or inspect current
installed behavior. Current contracts, not this historical prototype, own usage.

## Question and useful change

Can each executor receive the same assignment, independent obligations and scoped
reads while preserving input through execution and settlement?

The implemented direction supplies workflow starting state, shares Task readers,
and reuses factual context projections for native packets. Adapters select their
presentation. A snapshot does not give a native process live JavaScript tools.
Reading or forwarding a correction does not establish fulfillment; Host retains
the exact input and admits the worker's judgment through normal settlement.

The current [agent/workflow/infra proposal](task-execution-capability-contracts-20261003.md)
continues that direction, including the remaining native live-capability gap.
The old standalone `task-executor-interface.md` draft is not restored as a second
contract: its live input `accept` description predates later settlement changes.
Use the [Task engine](../2a-design/task-resource-engine.md) and SDK types.

## Evidence worth retaining

| Passage | Recorded result | Limit |
| --- | --- | --- |
| Starting workflow/native context | Earlier tests passed while initial context was incomplete; strengthened production-boundary tests failed against the old projection and passed with the repair | Delivery of facts is not proof that a model understood them |
| Missing scoped reader | Regression rejected the old successful-empty fallback and preserved explicit read failure | No expanded global read authority |
| Managed-worker correction and follow-up | Corrected Thursday output, retained approval, and another pass for remaining input | Small sequential trials, not a population benchmark |
| Large DeepSeek trial | Correct draft but repeated invalid finish payloads reached the eight-request trial bound; smaller trial finished after seven requests | A useful file alone did not establish accepted completion; the trial cap was not production retry policy |
| Navigation-only wording experiment | Request bytes changed from 449,706 to 433,745 in the recorded comparison | No demonstrated efficiency benefit; bytes are not billed tokens |
| Optional resolver refactor | Baseline and candidate comparison checks both passed | No established behavioral benefit; refactor was removed |

The harness itself needed correction: an overridden file-tool callback did not
inject the expected event, and an assertion incorrectly required `waiting` when
a converged contribution could coexist with independent approval. The final
trial checked persisted input and Conditions. These failed iterations explain
why transport success and a preferred phase label were insufficient evidence.

Final local source validation at Host `427350b1` recorded 3,281 passes, three
installation-dependent skips and no failures. Earlier candidate counts belong
to their own revisions and do not certify later ones.

## Dated rollout checks

The September record says #266 was installed at `65741c756a05`, with matching
artifact and loaded SHA-256
`41efcd840ca4653b97606c169b8e28980629a92cfd8ebf9f291cbbecdf7a0469`.
The receipt path is
`/app/projects/may-agent/.state/deploy-receipts/merged-266-65741c75-20260928.json`.

May Task `goal/app_3276ad1a-48c4-46c1-9d5c-4f9ebf2203cb` retained an assessment,
accepted a correction from Tuesday to Thursday after its first waiting result,
and preserved independent simulated approval. A matching operator fact then
woke it; the original and correction request links became done with all three
accepted attempts readable. This was not an in-flight correction test.
Evaluation's existing report-reader workflow separately returned three reports
in a fresh accepted attempt. It did not perform semantic evaluation.

Two trial input mistakes were corrected: an unregistered event type and a
missing operator owner. Rejected inputs did not satisfy approval. These are
bounded managed-agent/workflow observations, not universal recovery, a native
live-tool trial, or evidence of current deployment.

## Source and reproduction

The complete original narrative is Git blob `dfcab7d8f4`, originally on
`docs/task-executor-surface-20260928`; its full ID and original path are in the
[workspace review](workspace-hygiene-review-20261003.md) manifest. The archive
retains Apps and Host Git bundles, trial source and non-cache workspace evidence.
Old `/tmp` logs are historical locations and are not promised to still exist.

On restored Host experiment `4bab088b`, the deterministic harness command is:

```sh
bun experiments/task-read-trial.ts contracts
```

The missing-reader regression used:

```sh
bun test src/lib/workflow-tool.test.ts -t 'unavailable Task reads'
```

The original record contains the separately gated model-trial commands at
`4bab088b` and navigation comparison `7ea44123`. Reproduction needs that pinned
source and compatible dependencies; new paid trials need their own allowance.
Do not run those historical fixtures against a live store. Raw rollout snapshots
remain under `/app/.state/review-pilots/task-read-rollout-20260928/`.
