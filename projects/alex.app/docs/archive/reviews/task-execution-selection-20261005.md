# Explicit execution selection trial — October 5, 2026

**Supports:** [Task attempts](../../2a-design/task-attempts.md#selecting-the-attempt-mechanism).
**Choice basis:** [Apps own meaning; the Host owns mechanics](../../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics), [simple first](../../1-principles/core-principles.md#simple-first), and [purpose](../../1-principles/purpose.md).

## Question and decision

Can an App return routine work to its configured procedure after agent recovery,
without making the Host infer that a successful result ends recovery?

The previous contract deliberately retained agent execution for the whole Task
generation. A selector read timeout therefore changed every later selector wake
into agent execution. It also allowed the agent to manually substitute a different
reviewer and capacity policy. The underlying cause of that five-second read delay
was not established. This trial addresses persistent method selection, not the
read latency or model judgment quality.

Add one action through existing live/final Task changes: `select-execution`,
with `execution: declared | agent` and a reason. Save the choice on the ordinary
attempt; the next eligible claim records the chosen handler. No separate recovery
Task, mode, timer or App-specific Host rule is needed. Convergence does not choose
a method. Alex's guidance asks its recovery agent to restore the selector and
return routine work to its configured workflow when appropriate.

## Source and fixture observations

Host candidate: `02b64fbb2fd40d6afdfb139b137b0dd6ba11fb45`, branch
`fix/task-execution-selection-20261005`, based on `285100b18`.
App companion: branch `fix/selector-execution-choice-20261005`, based on
`e4c882d0d2`. The companion includes the owning contracts, evaluator guidance
and a selector regression; it changes no installed definitions.

The combined fixture used the actual Host claim/change/settlement functions,
file-backed Task state reopened after the agent result, and the actual selector.
Only the catalog, metric reader, emitted-event sink and agent decision were
scripted. One initial catalog timeout was followed by restored reads. A retained
Sol-only review was present throughout.

| Run | Recovery and later handlers | Scripted agent passes | Routine reviewer |
| --- | --- | --- | --- |
| No execution choice | Agent recovery, then agent on three later wakes | 4 | Control agent did not execute the selector |
| Explicit declared choice | One agent pass, then workflow continuation and three later workflow wakes | 1 | `evaluator-deepseek` on each selector emission |

In the explicit-choice run, the original input remained unanswered after the
agent's partial result and was fulfilled by the resumed workflow. Restart did
not erase the choice. The Sol backlog did not block DeepSeek selection. This
establishes the routing correction under the scripted decision; it is not a
measured token-saving percentage or a live behavior claim.

Host regressions additionally cover both workflow and executor return, retained
Conditions and deadlines, repeated recovery in the same generation, stale claims,
specification revisions, atomic rollback, replay after a newer decision, ordinary
convergence without handback, unavailable selected agents, and final `needs-agent`
precedence over an earlier live choice. Normal runtime tests cover both final-only
and live-plus-final actions. The selector regression checks that a catalog timeout
remains an error and subsequent successful selection preserves DeepSeek routing.

## Reproduction and limits

From the Host candidate checkout:

```sh
bun test ./src/app/core/tasks/app-task-retry.test.ts ./packages/sdk/src/task-contract.test.ts
bun test ./src/app/core/tasks/app-task-runtime.test.ts -t 'returns to the configured workflow through'
bun run ci
```

From the App companion checkout with its source SDK available:

```sh
bun test ./projects/alex.app/agents/evaluator/workflows/task-outcome-selector.test.ts
bun run check:may-design
```

The local combined harness and JSON output are retained under
`.state/evaluator-execution-choice-poc-20261005/`. Its `trial.ts` takes
`TRIAL_HOST_SOURCE` and `TRIAL_APPS_SOURCE` pointing to those checkouts. It uses
only temporary databases and synthetic reads; its attempt driver is manual.
The committed regressions own the enduring contract, not this disposable harness.

No paid model, installed controller, downstream review delivery, container restart
or live Task mutation was used. The trial does not show that the evaluator reads
the guidance or reliably judges when handback is appropriate. It does not certify
all selector failure paths, the timeout's underlying cause, or live cost reduction.

Install the Host capability before activating App guidance that uses it. Then
observe the existing selector Task through recovery, an explicitly selected
workflow attempt, and later ordinary wakes; verify exact reviewer routing,
retained input and session usage. A merged source PR alone is not that evidence.
