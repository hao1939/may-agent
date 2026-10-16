# Observer delivery intent: implementation trial — 2026-10-16

**Status:** Source candidate; full CI in progress. Not deployed.
**Supports:** [Event admission](../../2a-design/events.md#admission-state) and
[Host contract improvements](../../proposals/host-contract-improvements-20261016.md).

## Question and value

Can ordinary App observers publish useful facts without inventing work or false
delivery failures, while retaining real required-consumer failures through retry
and restart? False failure evidence can prompt unnecessary App investigation.
No token savings or live installation outcome is claimed by this source trial.

The App chooses what to observe and which facts need work. The Host saves the
fact, its publication intent and each owner's acceptance. Existing subscriptions,
exact targets and Conditions keep deciding what reaches a Task.

## Source and correction

Host baseline: merged #370, `a0b153b45`. Candidate branch:
`fix/observer-delivery-intent-20261016`, revision `8fca1840ce8a422cb2fa321581f74b9f48e31919`.
Design baseline: `fd30c1344facfc55551ce1445294a9869d141112`.

- Ordinary observer output and observer-failure diagnostics use the existing
  trusted record-only marker. No extra App declaration or routing option is added.
- `events.record_only` retains original publication intent. Schema setup adds it
  with default zero for existing rows. Keyed retry restores the saved value even
  if today's producer supplies another value; journal loading restores it too.
  No event-name inference or rewrite of historical failure evidence occurs.
- Storage-only acceptance cannot replace an unhandled receipt or another
  consumer's direct acceptance. App admission acknowledges its own inspection
  separately inside the same transaction. Real required delivery can still
  recover through its existing owner; this is not a global prohibition on retry.
- Metric measurement/evaluation failure producers already declare observations.
  Their two event-name exclusions are removed so failed required delivery counts.
  Five other legacy exclusions remain outside this focused producer review.

The cost is one private integer per Event and, when App admission acknowledges,
one extra update within the existing bounded transaction. There is no public SDK
shape change, new queue, scheduler, agent instruction or model call.
Schema initialization must run before workers using the new reader/writer.
Normal Host startup owns this additive setup. Reverting code can leave the unused
column in place, but old code cannot preserve this intent on new publications.

## Trials and findings

Portable tests use fresh temporary databases and synthetic Apps; no external
providers, live App operation or model calls are required.

| Boundary | Evidence |
| --- | --- |
| Ordinary observation | Two different Apps publish facts without observation selectors; source failures remain in health and diagnostic history; no inbox input or Task is created |
| Crash before receipt | Append without a delivery recorder, close storage, then recover through the production App inbox runtime; saved intent survives even when the observer is no longer registered |
| Declared work | A real subscription admits observer output through the saved admission plan and reaches the Task attachment boundary |
| Keyed retry | Retry with the opposite marker; retain original intent, one Event identity, and no ordinary side-effect replay |
| Required consumer failure | Failure stays pending then expires as unhandled; a later observation fallback cannot erase the receipt |
| Independent acceptance | A storage-only App inspection clears its own admission marker without replacing a direct consumer receipt |
| Worker relay | Existing real worker/parent cases cover absent, accepting and failing consumers; reopened journal reads also retain the original observation marker |
| Upgrade | Add the column to an existing schema twice; an old unhandled Event keeps its note, status and default classification |

The first receipt trial failed: after a required consumer failed and its receipt
expired, replay without that consumer replaced the failure with a successful
record-only receipt. The receipt writer now preserves the independent evidence.
The initial integration fixture also needed the actual AppInput wrapper, Task
policy and `completed` admission-plan status; these were test setup corrections.

Reproduction:

```sh
bun test src/app/core/events/persisted.test.ts src/lib/db/schema.test.ts
bun test test/integration/observer-delivery.test.ts src/app/adapters/producers/app-observer-runtime.test.ts
bun test src/app/task-worker-integration.test.ts src/app/metric-source-measurement.test.ts
bun run ci
```

The 19 persistence/schema tests passed, as did all 19 existing real worker
boundary cases. The three final observer integration cases passed. Full CI is
running on the candidate. `bun run check:may-design` passed with zero errors and
the existing unclassified `reports` warning; 310 local links/heading targets passed.

## Limits and remaining work

This does not repair historical false failures whose intent was never saved.
It does not make receipt expiry restart-independent; that is the next separate
fix. It also does not change App investigation policy, automate model judgment,
or guarantee exactly-once observation. Repeated consideration remains acceptable;
saved identity and admission owners protect the existing effect boundaries.
