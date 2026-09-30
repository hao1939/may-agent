# Task observation implementation and recovery evidence

**Status:** Source implementation candidate; not deployed. This follows the
[proposal](task-observation-contract-20260930.md) and POC branch
`poc/task-observation-20260930` at workspace commit `fe77f03b9b`.
Implementation branch: `feat/task-observation` in the Host and App workspace.
Host implementation: `00379d0d0ca96e0eb326e2622feadf1a8ea68eb2`.
Baselines: Host `de59c8dae911c8a4e39c925d619164128610301a`; workspace
`fe929bd5b31a755a7c38540cb3da96a69612c21c`.

## What changes

A Task worker states what evidence matters; an App supplies the detector; the
Host connects them using existing Conditions, observers and durable event
admission. There is no watch registry, new Task state or separate recovery loop.

- An App declares `defineObserver({ id, type, description, intervalMs,
  timeoutMs, inspect })`. The detector receives an opaque resource reference
  and abort signal, and returns observed JSON data. It owns provider semantics,
  permitted scope, credentials and response validation.
- An agent discovers descriptors through existing `tasks.contract`. Supplying
  `observation` returns a ready-to-save Condition. Workflows and executors use
  the same descriptors through `read.contract`, and the same pure
  `observationCondition` builder. The worker must return the Condition through
  ordinary Task settlement; the helper does not register anything itself.
- The Host derives demand from indexed Condition routes, groups Tasks interested
  in the same resource, reads four resources per observer slot, adds exact source
  identity and publishes through existing durable admission. App authors do not
  assemble event envelopes, subscriptions, destinations or wake calls.
- A matching fact updates the Condition and retains Task input through existing
  reconciliation. It does not declare the Task successful. Other waits, partial
  results and independent work remain intact.

The public API and complete example are maintained in
[App design](../2a-design/agent-app.md#task-driven-resource-observation),
[SDK design](../2a-design/sdk.md), and
[quickstart](../2b-manual/sdk-quickstart.md). The earlier proposal's sketches
are not an alternative supported API.

## Recovery is part of the normal Task

Every generated Condition has a review interval, defaulting to one hour. If a
detector fails, disappears or stops producing events, the saved wait still
reaches the existing review checkpoint. The same Task becomes eligible for an
owner attempt. Code guarantees that opportunity and preserves evidence; the
owner decides what failed and whether to repair the source, change the wait,
continue other work or seek help.

Each resource read has a deadline and receives cooperative cancellation. A
late result cannot publish after timeout, replacement or shutdown. A hung
provider retains its occupied slot across App reload, with at most eight
unsettled reads per source. This limits abandoned I/O rather than starting
another request for the same hung resource. It cannot terminate arbitrary
in-process CPU loops; a dead Host needs its external supervisor/operator.

Exact `apps.list {appId}` exposes parent-runtime observer health and up to 64
recent resource checks. Last completion, last error and last successful resource
check coexist. A completed batch is not proof that all resources succeeded or
that downstream delivery occurred. Health is disposable diagnostic evidence;
absence after restart or eviction means unknown. Failure events retain durable
failure evidence. No status table or heartbeat event is added for every poll.

Evaluation's existing Task-outcome workflow reads this evidence for unresolved
observer Conditions after selecting and budgeting the review. It saves the
capture separately from the Task snapshot in the immutable report. Quiet polling
therefore does not change the Task evidence hash or force another assessment.
The evaluator is instructed to distinguish unchanged observations, failed reads
and missing evidence, and to recommend investigation by the source owner or
May coordination for shared defects. Existing report delivery remains unchanged.
This does not guarantee review coverage or autonomous repair: those depend on
installed selection, capacity, agent judgment and authorized execution.

## Implementation map

| Responsibility | Source |
| --- | --- |
| Detector descriptor and Condition builder | Host `packages/sdk/src/observer.ts` |
| Shared installed contract projection | Host `src/app/core/reads/app-contract.ts` |
| Demand from existing Conditions | Host `src/app/core/state/observation-demand.ts` |
| Bounded reads and recent observation suppression | Host `src/app/adapters/producers/resource-observer.ts` |
| Scheduling, generation fencing, publication and health | Existing Host `src/app/adapters/producers/app-observer-runtime.ts` |
| Admission and automatic record-only observation routes | Existing Host `src/app/composition/app-inbox-runtime.ts` |
| Evaluator's bounded supplementary evidence | Evaluation `agents/evaluator/workflows/lib/observer-evidence.ts` |

Snapshot validation was moved into a shared producer helper rather than copied.
Adapters expose the shared contract to agent tools, workflow reads and executor
attempt reads. The numerous small interface changes carry the same descriptor;
they do not implement separate behavior per worker type.

## Trial and verification

Production tests replace the POC's local implementation. The committed Host
integration fixture uses temporary file-backed SQLite and the real Condition,
event, admission and reconciliation code. It also exercises the actual installed
App observer, exact App health reads and reload.

Scenarios cover shared reads across two Apps; quiet observations; independent
waits and partial output; a newly interested Task after the source is already
ready; publication and admission failures; evidence arriving during an active
attempt; cancellation and database reopen; hung reads and late results; silent
observation stoppage; an unknown provider-format failure followed by repair;
bounded paging; and rejection of another source's fact.

The silent-failure test advances the deadline and inspects the existing recovery
candidate/claim path. The unknown-failure test deliberately repairs the fixture
provider. These establish recovery mechanics, not autonomous agent diagnosis or
fully scheduled restoration. The reload test proves occupied reads remain
bounded and repaired observation reaches the original Task.

Evaluation tests verify exact source reads, per-resource filtering, missing or
stopped detection, prompt inclusion, immutable report retention and report reuse
when healthy polling advances. Final local verification: Host `bun run ci` passed **3,317 tests**, with three
installation-catalog checks explicitly skipped; Evaluation passed **227 tests**.
Host/SDK type checks, lint, App-boundary checks, Evaluation type checks and
common design/example checks passed. The initial full run caught the public SDK
export snapshot change; its reviewed snapshot was updated before the successful
run. Browser and daemon tests ran; no live model or deployment test ran.
The Host revision is recorded with the companion commit/PR. Reproduce with:

```sh
# Host repository
bun run ci
# App workspace
bun run check:may-design
cd projects/evaluation.app
bun run typecheck
bun test ./agents/evaluator/workflows/lib/observer-evidence.test.ts ./agents/evaluator/workflows/task-outcome-review.test.ts
```

## Limits and integration order

1. Land the Host/SDK change before activating Apps that import the new helper.
   The Evaluation companion tolerates an older Host by reporting unavailable
   observer evidence. Publish/reload a real detector only through the normal
   reviewed deployment procedure. No live installation was changed in this trial.
2. The next useful live trial is one existing source and an uncoached worker:
   discover the contract, save the interest, let the normal scheduler deliver
   it, break the detector, and observe owner diagnosis and evaluator follow-up.
   A model-backed trial has not run, so autonomous recovery is not claimed.
3. Four resources per slot and the Host's scan cadence bound throughput; declared
   intervals are not delivery SLAs. Demand grouping still processes matching
   indexed Conditions, and production-scale query latency has not been measured.
4. Suppression caches the latest 64 resources per observer generation. Reload or
   eviction may republish unchanged data. This avoids unbounded memory but is
   not a universal exactly-once event or provider-history guarantee.
5. Existing raw `AppObserver.run` adapters remain supported and do not gain the
   resource detector's per-read timeout. Converting one is worthwhile only when
   it removes App plumbing without changing its source semantics.
6. On rollback, remove/convert new resource declarations before reverting the
   Host. Conditions remain ordinary saved Task data with their review deadlines;
   a missing capability must remain visible as an unresolved wait.
