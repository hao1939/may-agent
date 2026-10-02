# Resource/Event boundary review — 2026-09-27

**Historical context:** [Events And Task Admission](../../2a-design/events.md). Retained rationale and evidence; this record does not define the current contract.

Host baseline: `1ff18acc`. Workspace baseline: `28580398c6`. This review changes
common design and guidance; it does not change Host code or deploy anything.
The current contract is [Events](../../2a-design/events.md#resource-responsibility-and-reconciliation).

**September 30 recheck:** On Host `de59c8dae9`, the failed-translation case in
Finding 1 is repaired: the healthy route proceeds, unresolved translation stays
in the admission plan, and a later due scan retries only the failed work. The
original probe's failure assertions no longer hold. Finding 2 still reproduces.
See the [observation proposal](task-observation-contract-20260930.md#evidence-gathered-for-this-proposal)
for current results and limits; the evidence below describes the original baseline.

## Decision and scope

Routing identifies responsibility and retains relevant input/observations.
Reconciliation decides the domain response from current state. Bounded local
updates and exact controls may finish through their existing typed writers.
Committed-state notifications prompt rereads; they do not automatically create
new work on their source. Tasks remain the durable execution mechanism. There
is no new resource class, queue, event registry or reconciler per record.

The review traced Event persistence, App routing, input/plan recovery, Condition
matching, exact controls, result projection and passive notification. It did
not certify every App subscription or installed provider behavior. In particular,
the existing HTTP/Evaluation policy gaps remain in the
[convergence index](../../proposals/design-implementation-convergence.md).

## What already fits

| Path | Source owner | Evidence and limit |
| --- | --- | --- |
| Ordinary App input | `AppInboxHost.admit`, `state/inbox.ts` | Saves input before mapping; Task/input attachment is atomic; mapping/write failure remains recoverable |
| Exact Task feedback and broad declared facts | `app-inbox-runtime.ts`, `app-task-runtime.ts` | Exact updates are bounded; broader admission retains a plan before asynchronous attachment; successful translation is still a prerequisite for that plan |
| Domain response | Task controller, attempt runner and result admission | Current claim and result fences retain independent waits, input and outcomes; an event label cannot itself prove Task completion |
| Condition observation | `app-task-condition-tracker.ts` | Applies the declared matcher and updates observed Condition state, not Task acceptance; freshness coupling is discussed below |
| Stop, retry and closure | Conversation/Task state writers and control routing | Exact controls do not become another semantic Task input; tests cover subscriber order and replay across reopen |
| Committed changes and presentation | Linked-result projection, `EventBus.listen` | Stored result identity supplies the answer; notifications are hints; passive failures do not undo accepted state |

The common rule classifies responsibility. It does not require all operations
to be asynchronous, all reconcilers to call a model, or all persisted commands
to replay after restart. Session/Host controls retain their own lifetime and
completion evidence. A simple code executor can also use normal Task settlement.

## Finding 1: failure before the admission plan

**Classification:** reproduced recovery and failure-containment gap.

[`AppInboxHost.subscriptionInputs`](../../../../may-agent/src/app/core/inbox/app-inbox-host.ts)
runs matching `toInput` functions before
[`app-inbox-runtime.ts`](../../../../may-agent/src/app/composition/app-inbox-runtime.ts)
creates the admission plan. A thrown translator or invalid translated input
exits route construction. Task resolvers are also invoked before plan creation;
the probe below specifically exercises the translator path.

The Event is persisted, and subscriber failure is visible. However, there is
neither an inbox input nor a pending plan for the existing recovery scans to
find. One failing translator also prevents a healthy App matched by that same
event from reaching admission. This is different from an intentional `null`
translation or a deliberate rejection of ambiguous routes within one App.

The isolated probe used the real EventBus, DbWriter, SQLite, registry, App
runtime, Task store and input attachment. Two Apps subscribed to one fact; the
second translator initially threw. No model, live App or external service ran.

| Stage | Translator calls | Plans / inputs | Original Event state |
| --- | ---: | --- | --- |
| Initial failed delivery | 2 | 0 / 0 | pending |
| Translator repaired; reload, input recovery and scan | 2 | 0 / 0 | pending |
| App runtime recreated on the same database | 2 | 0 / 0 | pending |
| Event expiry housekeeping | 2 | 0 / 0 | unhandled |
| Explicit replay of the same persisted Event | 4 | 1 / 2 | accepted |

Both inputs attached to actual Tasks after explicit replay; only one original
fact row existed. The runtime-recreation step is not a whole-process crash or
database reopen test. The negative result is also supported by source:
`recoverAdmissions` selects inbox rows, and `recoverAdmissionPlans` selects
existing pending plans. Neither selects this saved event without a plan.

**Smallest repair direction:** keep failed routing responsibility in the existing
admission records before executing fallible translation. Preserve event, App,
route and registry identity; use existing paced retry and diagnostics. Isolate
independent App routes and retain already accepted outcomes. Reuse exact replay;
do not add an App retry loop, rescan all historical facts, or invent a supervisor.
Within-App ambiguity/overlap checks must still reject conflicting ownership.

The implementation must define how a corrected current App definition retries
an unresolved translation while retaining its original provenance. A successfully
translated frozen command must not be silently reinterpreted on reload. Missing
or invalid routes need an explicit disposition and accountable review when
required; retrying forever is not proof that anyone has received a human action.

This also explains a possible observer interaction: the current observer advances
its snapshot after Event persistence, not downstream Task admission. That is a
reasonable separation only if admission retains its own retry responsibility.
The source makes suppression of an unchanged fact possible after this failure;
the probe did not exercise a live stateful observer or claim that it happened
in a deployed App.

Closing proof should include two independent matching Apps, a translator failure,
reload plus storage reopen, no producer re-publication, one accepted input per
route, retained failure evidence and unchanged no-work/record-only behavior.

## Finding 2: hidden freshness policy in the matcher

**Classification:** confirmed Host/App policy coupling; no live incorrect Task
outcome was demonstrated.

[`isFreshLevelObservation`](../../../../may-agent/src/app/core/tasks/app-task-condition-tracker.ts)
uses the specific name `aks.repo-ref.observed` and suffixes `.state`, `.check`,
`.pulse` and `-pulse` to select its time comparison. A focused probe supplied
identical wait/observation data, changing only the event type:

| Input | Matcher result |
| --- | --- |
| Old ready fact named `probe.state` | Does not match |
| Same data named `probe.observed` | Matches |
| `probe.observed` with explicit `expected.observedAt: {gte: 2000}` | Does not match |

The first two types need not have the same domain semantics in every App.
The demonstrated coupling is that names silently select a generic matching
rule, including a specific App event. Existing field comparators can already
express the tested freshness condition.

**Smallest repair direction:** review affected producers/Conditions and state
their real freshness requirement explicitly through existing expectations where
possible. Preserve old protections during consumer migration. Do not replace
this with a blanket "newest timestamp wins" rule: immutable historical proof,
new state observations and untrusted source clocks have different meanings.
A universal event taxonomy or new controller is not justified by this probe.

## Validation and priority

Passed against the baseline:

```sh
bun test src/app/core/events/bus.test.ts src/app/core/events/interface.test.ts \
  src/app/composition/app-inbox-runtime.test.ts \
  src/app/composition/app-inbox-containment.test.ts \
  src/app/composition/task-control-routing.test.ts

bun test src/app/core/tasks/app-task-runtime.test.ts \
  -t 'preserves event time|coalesces an exact-task event storm|does not publish a dependency requested from a stale task result'
```

The first command passed 98 tests; the second passed 3 with 152 explicitly
filtered out. They verify existing boundaries, not a repair of Finding 1.
The two probes below reproduced the reported findings. Prior containment tests
inject failure after durable input/plan creation, explaining why they can pass
while the earlier boundary still fails.

Documentation validation also passed: `bun run check:may-design` reported zero
integrity errors/warnings, passed SDK/control/admission examples and the canonical
App boundary check. A local link/anchor scan covered 56 documents and 739
references with zero issues; `git diff --check` passed. Remote URLs, full Host CI
and deployed model behavior were not tested by this documentation review.

Repair Finding 1 first, using the existing admission mechanism. Treat Finding 2
as a smaller policy migration with compatibility evidence. Keep this review's
unproven questions as guidance rather than new rejection rules.

## Reproducing the probes

Save each block to a temporary `.ts` file and run it with Bun, passing a checkout
of the reviewed Host as its first argument. These are recorded experiments,
not installed services or a second permanent test framework. The routing probe
creates and removes its own temporary SQLite/workspace data.

<details>
<summary>Admission failure probe</summary>

```ts
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const hostRoot = resolve(process.argv[2]);
const load = (path: string) => import(join(hostRoot, path));
const { Type, defineApp } = await load('packages/sdk/src/index.ts');
const { DbWriter } = await load('src/lib/db-writer.ts');
const { getDb, closeDb } = await load('src/lib/requests.ts');
const { AppRegistry } = await load('src/app/core/apps/registry.ts');
const { EventBus, EVENT_ROW_ID } = await load('src/app/core/events/bus.ts');
const { startAppInboxRuntime } = await load('src/app/composition/app-inbox-runtime.ts');
const { AppTaskResourceStore } = await load('src/app/core/state/app-task-resource-store.ts');
const { appTaskContext } = await load('src/app/core/tasks/app-task-reconciler.ts');
const { admitTaskInput } = await load('src/app/core/state/inbox.ts');
const root = mkdtempSync(join(tmpdir(), 'may-event-boundary-'));
const db = getDb(root);
const bus = new EventBus();
const writer = new DbWriter(root);
bus.setPersistenceSubscriber(writer.handler);
bus.setDeliveryRecorder(writer.recordDelivery);
let broken = true;
let now = Date.now();
let calls = 0;
let runtime: any;
const contexts = new Map();
const entries = ['healthy', 'broken'].map((id) => {
  const appDir = join(root, id + '.app');
  mkdirSync(appDir);
  const definition = defineApp({
    id, version: 1, agent: id + '-owner',
    inputSchema: Type.Object({kind: Type.Literal('message'), data: Type.Object({value: Type.String()})}),
    tasks: {},
    task: ({id: inputId}: any) => ({kind: 'desired', intent: {id: inputId, parentId: 'root', outcome: 'Review reported fact', acceptance: ['Fact considered']}}),
    subscriptions: [{id: 'change', event: 'probe.changed', toInput(event: any) {
      calls++;
      if (id === 'broken' && broken) throw new Error('injected translation failure');
      return {kind: 'message', data: {value: event.data.value}};
    }}],
  });
  const store = AppTaskResourceStore.fromDb(db, id);
  store.bootstrapSnapshot({project: id, root_task_id: 'root', project_lifecycle: 'active', groups: {root: {id: 'root', parent_id: null}}}, 'fixture');
  contexts.set(id, appTaskContext({appDir, projectDir: appDir, agent: definition.agent, resourceStore: store}));
  return {appDir, definition};
});
const registry = new AppRegistry(async () => entries);
await registry.reload();
const start = () => startAppInboxRuntime({registry, db, bus, persistDir: root, now: () => now, schedulesEnabled: false, scanIntervalMs: 60000, attachTask: (input: any) => admitTaskInput(contexts.get(input.appId), input)});
const snapshot = (label: string, eventId: number) => ({label, calls,
 event: db.prepare('SELECT id, delivery_status FROM events WHERE id = ?').get(eventId),
 plans: db.prepare('SELECT count(*) AS count FROM app_event_admission_plans WHERE event_id = ?').get(eventId),
 inputs: db.prepare('SELECT app_id, waiting_on_kind FROM app_inbox_items ORDER BY app_id').all()});
try {
  runtime = await start();
  const original = bus.emit({type: 'probe.changed', source: 'fixture', owner: 'fixture', data: {value: 'new evidence'}});
  const eventId = original[EVENT_ROW_ID];
  assert(Number.isSafeInteger(eventId));
  console.log(JSON.stringify(snapshot('after-failure', eventId)));
  broken = false;
  now += 180000;
  await runtime.reload();
  await runtime.host.recoverAdmissions();
  await runtime.host.recoverTaskResults();
  runtime.scanNow();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(calls, 2);
  assert.equal(db.prepare('SELECT count(*) AS count FROM app_inbox_items').get().count, 0);
  console.log(JSON.stringify(snapshot('after-repair-and-recovery', eventId)));
  runtime.close();
  runtime = await start();
  await runtime.host.recoverAdmissions();
  now += 180000;
  runtime.scanNow();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(calls, 2);
  console.log(JSON.stringify(snapshot('after-runtime-recreation', eventId)));
  writer.runHousekeeping(Date.now() + 300000);
  console.log(JSON.stringify(snapshot('after-expiry-review', eventId)));
  bus.redeliverPersisted(original, eventId);
  const deadline = Date.now() + 3000;
  while (db.prepare('SELECT count(*) AS count FROM app_inbox_items').get().count < 2) {
    assert(Date.now() < deadline, 'manual exact replay did not attach both inputs');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(db.prepare("SELECT count(*) AS count FROM events WHERE event_type = 'probe.changed'").get().count, 1);
  console.log(JSON.stringify(snapshot('after-explicit-same-event-replay', eventId)));
} finally {
  runtime?.close();
  await new Promise(resolve => setTimeout(resolve, 10));
  closeDb(root);
  rmSync(root, {recursive: true, force: true});
}
```

</details>

<details>
<summary>Condition naming probe</summary>

```ts
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const { matchesAppTaskCondition } = await import(join(resolve(process.argv[2]), 'src/app/core/tasks/app-task-condition-tracker.ts'));
function check(type: string, explicitFreshness = false) {
  const condition = {
    metadata: {id: 'ready', generation: 1, resourceVersion: 1},
    spec: {type, subject: 'resource:sample', expected: {state: 'ready', ...(explicitFreshness ? {observedAt: {gte: 2000}} : {})}},
    status: {state: 'unknown', observedAt: new Date(2000).toISOString()},
  };
  const event = {type, source: 'fixture', timestamp: 1000, data: {resource: 'sample', state: 'ready', observedAt: 1000}};
  return matchesAppTaskCondition(condition, event);
}
const result = {stateSuffix: check('probe.state'), observedSuffix: check('probe.observed'), explicitExpectedTime: check('probe.observed', true)};
assert.deepEqual(result, {stateSuffix: false, observedSuffix: true, explicitExpectedTime: false});
console.log(JSON.stringify(result));
```

</details>
