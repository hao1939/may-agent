# Execution feedback implementation and PoCs

September 13, 2026. This records an isolated source candidate, not a live rollout.
The [repair plan](../../proposals/execution-feedback-repair-plan.md) owns scope;
[System Model](../../2a-design/system-model.md#execution-and-outstanding-results)
owns the running/waiting distinction.

## Candidate and decisions

Host base: `6fdc03d8ce8c538e315740b5d1e9fd64971e1762`, following v3.0.1 and the
previous feedback fixes. These focused local commits implement this round:

| Revision | Change |
| --- | --- |
| `a4d23444` | Inject the canonical execution read into system status; unavailable remains unavailable. |
| `96b9e6da` | Show retained waits during execution and queued continuation; preserve static dependency gates in shared read projections. |
| `88c3514a` | Share execution ownership validation; route escalation feedback to the exact Task; remove raw PID fallback and optimistic cancellation status writes. |
| `013b7290` | Enforce fixed execution budgets for bounded Task paths; remove native silence nudges/interrupts. |
| `b478bc5c` | Admit explicit useful parent continuation through existing result settlement and the normal queue. |

Scout revision: `09d24de65a`. It replaces the private credential cache and
probe marker with Host observation memory. It uses the already-supported
observer contract, independently of the new continuation field. Continuation
consumers must use the matching Host and SDK before emitting that field.
No data migration, production restart, image build, public push or PR occurred.

Continuation requires `waiting`, `continue: true`, typed dependencies and progress
facts. It cannot be combined with `report`. Settlement retains the original
unanswered input and waits, releases the attempt and uses the existing pending
phase and queue, without success or failure settlement. Omit `continue` when only
results remain. Each new attempt has its existing fixed execution budget; no
Task lifetime budget is added.

## Iterations and findings

1. The four repairs remove competing authority. Status no longer treats a
   saved running row as proof of live execution. A waiting Task's new wake
   appears queued only when its static dependency gate permits it. Retained
   Conditions remain visible during running work. Session controls use trusted
   stored identity and live ancestry; only a caller's own bounded helper gets
   the helper cancellation exception. Unknown or unreachable execution returns
   an error without changing its stored state.
2. The Scout/Host experiment failed credential-event publication deliberately,
   then scanned the same unavailable state again. The second publication
   succeeded, and a later identical successful observation stayed quiet. An
   older in-flight scan was replaced; its late unavailable result was discarded.
   A ready observation reached the exact waiting Task and allowed a new claim.
   The experiment used real observer and Task code, synthetic source results
   and a fixture persistence subscriber. It made no browser or model calls.
3. Scout already had `xhsWaitResult`, supplying credential identity, Condition
   matching, human guidance and review cadence. The experiment reused it.
   Another wait API would duplicate an existing capability. The real subprocess
   fixture also confirmed the existing 30-second inspector bound.
4. Quiet useful work now finishes inside its admitted budget. Hung managed
   Task work still stops, including while activity keeps arriving. Native
   execution has one budget covering startup, turns and schema correction;
   output cannot renew it. Cancellation uses the existing client/process cleanup.
   Native client tests retain request-timeout and process-drain coverage.
5. `waiting` plus `continue: true`, dependencies and progress facts admits the
   dependency once and queues a normal pending pass of the same parent. A
   round-trip fixture starts that pass before the child returns, without a
   fabricated wake. Repeated dependency submission preserves the same input;
   normal delivery and source recovery both return the exact original answer.
   File-backed tests reopen storage, retain the original input and waits, reject
   an overlapping or stale claim, park an ordinary subsequent wait, and honor
   owner closure. A fresh status question is answered separately; only its
   eventual matching result fulfills the older waiting input.
6. One model invocation checked the contract's usability against three
   synthetic situations: submit review while preparing notes, park once notes
   are ready but review is pending, then answer after review succeeds. It
   returned schema-admitted `waiting + continue`, `waiting`, and `converged`
   respectively in 11.74 seconds. This checks interpretation of the contract;
   it is not an autonomous end-to-end production run.

The first full gate caught six failures: five legacy fixtures still expected
optimistic cancellation or a cold session without saved identity, and the new
agent guidance exceeded its four-kilobyte budget (4,325 bytes). The fixtures now
exercise the revised ownership/acceptance contract, including a real unreachable
socket whose child remains alive. The guidance was shortened; the prompt limit
was retained. An earlier typecheck also caught union narrowing around the new
optional field; normalization now reads the admitted object correctly.

## Verification and reproduction

Run from the Host candidate checkout:

```sh
bun test src/lib/tools/system-status.test.ts src/app/core/reads/execution-status.test.ts
bun test src/app/human-task-service.test.ts src/app/core/state/app-task-resource-store.test.ts
bun test src/lib/agents-tool.test.ts src/lib/create-tool.test.ts src/app/command-router.test.ts test/integration/command-router.test.ts test/integration/legacy-instance-control.test.ts test/integration/escalation-lifecycle.test.ts
bun test src/lib/timeout.test.ts src/lib/session-observation-timeout.test.ts src/app/adapters/executors/codex/codex-goal-executor.test.ts src/app/adapters/executors/codex/codex-goal-client.test.ts
bun test packages/sdk/src/task-contract.test.ts src/app/core/tasks/task-continuation.test.ts src/app/core/tasks/app-task-runtime.test.ts
bun run ci
```

Scout's strict typecheck and 83 App/observer/workflow tests passed with 306
assertions. Its watcher plus inspector checks passed nine tests with 18
assertions, including the real 30-second stuck-child timeout. Run those from
the Scout checkout with the candidate SDK resolved:

```sh
bun run typecheck
bun test ./app.test.ts ./watchers ./agents/scout/workflows
bun test ./watchers ./agents/scout/tools/lib/xhs-credential.test.ts
```

To reproduce the combined source experiment, wire Scout's
`observeXhsCredential` into `createAppObserverRuntime` with an injected
inspector. Use `xhsWaitResult` to defer a temporary Task. Make the fixture
persistence subscriber throw for the first `credential.state`, then return
durable receipt identities. Scan twice after recovery, replace a pending scan,
and publish ready from the replacement. Assert that only unavailable then
ready are delivered, and claim the original Task again. Owning regression
suites cover publication memory/generation fencing and the App adapter separately;
the combined experiment checks their composition.

The model experiment used ephemeral `codex exec`, a temporary read-only root,
no tool use, the candidate result schema and the three situations above.
Validate all returned results with `admitTaskReconcileResult`; do not substitute
string matching for admission. Its outer execution allowance was 90 seconds.
Credentials and transcript content are not part of the portable tests or record.

The full Host gate passed 3,013 tests, with three skips, zero failures and
13,375 assertions in 148.24 seconds. It included typechecks, boundary checks,
lint, daemon, subprocess and browser tests. Verification after commit cleanup
also passed with zero failures: 3,046 executions and 13,561 assertions in
150.76 seconds. That latter count includes 33 repeated SDK cases discovered
through the temporary SDK link used for document checks; it is not additional
coverage. The temporary links were removed afterward.

`bun run check:may-design` passed with zero integrity errors/warnings, checked
SDK/control examples and canonical App integrity. The contract document's
length check initially rejected the added explanation; the concise contract
now links to this evidence instead of expanding beyond its existing limit.

## Cost, limits and next trial

There is no new daemon, queue, polling model or operation registry. Status and
waits are reads of existing authority; indexed phase filters remain tested.
Scout removes a file write and duplicate generation marker. Native execution
removes the periodic silence check in favor of one execution deadline.
Continuation costs an additional bounded attempt when the agent requests it.
It introduces no lifetime budget for a months-long Task; its owner still
decides whether continued work is worthwhile.

Legacy executions without a proven finite bound retain their silence protection.
The daemon's separate error-only-turn detector remains; current Task worker
relay does not supply its turn-end inputs. Concurrent model review of an awaited
helper remains deferred. Missing owners remain visible failures handled through
normal admission/recovery or operator action; there is no automatic ownership
transfer. Generic provider actions still need provider-specific idempotency or
source inspection across acceptance-before-reference crashes. This round proves
typed dependency and credential observation paths, not every external operation.

The next deployment trial should separately verify useful May/Scout work,
command responsiveness, exact feedback and fixed-budget cleanup at an idle-point
rollout. These source tests do not establish long-run container reliability.
