# Ownership boundary review — September 13, 2026

**Status:** Source review and isolated reproductions; suggested fixes are not
implemented by this document. The owning contract is
[Host and App Boundary](../../2a-design/system-boundary.md#ownership-and-intervention),
with implementation history in the [feedback proposal](../../proposals/execution-feedback-and-review.md).

The Task core largely fits the agreed model. The most consequential drift is
around its edges: older session helpers can control execution independently,
some adapters retain their own feedback memory or strategy, and generic tools
still infer authority from names. Repair those boundaries in focused changes.
A new notification daemon or a replacement Task controller would add cost
without addressing these causes.

## Scope and evidence

Host reviewed: `6fdc03d8ce8c538e315740b5d1e9fd64971e1762`, based on v3.0.1
`6935b3252912328212f04e8ee3552dc1c575afaa`. This local candidate includes the
previous progress, status and public-control fixes; it is not deployment evidence.
App reference: `3ca8696a9011702858113e53d31952271e1592e2`, with the current
May/Scout definitions and observer source checked locally. Unrelated working
design drafts and research files were preserved.

The review followed admission, Task execution and recovery, dependency results,
worker relay, session controls, escalation, tools, watchdogs, observers,
maintenance, permission checks, HTTP reads and reporting. It is representative
source coverage, not a claim to have executed every path or certified live uptime.

Evidence labels below distinguish a production-function reproduction using
temporary state from source inspection and deferred product choices. No models,
external services, live App mutations or process signals were used in the new
reproductions. Recording manager methods proved calls were attempted; they did
not demonstrate a duplicate live worker or actual process termination.

## Priority and smallest fix

| Priority | Finding | Smallest change and responsible layer | Value and cost |
| --- | --- | --- | --- |
| First | Escalation resolution bypasses Task ownership when resuming sessions | Route Task-bound resolution through the exact owning App/Task; validate supported standalone controls. Host composition/session adapter. | Prevents execution outside the Task. Small initial guard; caller migration needs focused tests. |
| First | The `agents` tool has a separate cancellation path | Apply execution-ownership checks at this entry point; preserve exact parent-owned helper cancellation. Never turn a rejected control into a raw process kill. Tool adapter/composition. | Makes all controls obey the same contract. Small to medium, including detached-session cases. |
| First | Scout remembers a transition before publication succeeds | Use existing observer `previousObservation` / `nextObservation`; remove duplicate discovery cache. Scout adapter. | Restores the periodic safety net. Small, no new Host service. |
| First, small read fix | Running detail hides waits; ready work can still look parked | Read retained waits alongside current execution and eligibility. Human Task read adapter. | Shows useful work and pending results together; no schema change. See clarification evidence below. |
| First, small read fix | The agent's `system_status` tool has a second definition of active execution | Inject the canonical execution read; distinguish unavailable sections from empty results. Tool adapter/composition. | Avoids contradictory status and false reassurance. Small; replace tests that currently expect stale rows to count as active. |
| Next | Independent session jobs coexist with durable Tasks | Inventory `agents.fork` consumers; move durable assignments only after proving replacement concurrency and feedback. Retain bounded calls and provider-owned async operations. | Removes an alternate work lifecycle; current result-only delegation is not a complete replacement for every concurrency need. |
| Next, with a supported consumer | Agent protocol requires mechanical wait authoring | Have the supplying capability provide trusted source/operation identity and review defaults. Keep the validated internal contract. | Removes routine event/timer bookkeeping from the agent. Medium; prove early result and restart behavior before changing the protocol. |
| Next | Executors contain inconsistent progress/timeout policy | Document explicit execution limits separately from observations; make uncertain strategy an owner decision at a supported boundary. | Clearer behavior and fewer false interventions. Policy change needs evidence; concurrent review is additional work. |
| Next | Name-based privilege remains in generic tools | Supply narrow trusted installation/tool capabilities; keep existing protections until replacements pass. | Clarifies supervisor scope. Medium, security-sensitive migration. |
| As needed | Hung observers have no generic recovery | Bound source I/O; expose an unresolved adapter for intervention. Add a shared cancellation primitive only if a consumer needs it. | Avoids overlapping abandoned operations; a generic timeout alone cannot stop arbitrary promises. |
| Deferred | Automatic unavailable-owner fallback is not complete | One installation-selected problem-report route, then visible human attention. Reuse existing inputs and diagnostics. | Useful for unattended failures, but needs a real consumer and failure-path tests. |
| Cleanup | Legacy project mutation and embedded App labels persist | Remove/move demonstrated callers into their owning adapter/App; distinguish labels from routing and privilege. | Reduces confusion; lower urgency than control and publication correctness. |

These are review priorities, not authorization for a broad rewrite or a promise
to implement every optional feature. Start with independently useful fixes.

## 1. Escalation resolution can control the wrong execution owner

**Reproduced call-path gap.** `src/app/daemon-events.ts:285` installs
`createEscalationLifecycleSubscriber`. In `src/lib/escalation-lifecycle.ts:299`,
the session branch asks only whether the daemon manager has that session locally.
It sends to a local session or calls `resumeSession` directly. It does not check
Task binding or a foreign worker process. The presence of a source session
takes precedence over the project/workflow owner route.

`src/lib/manager.ts:1220` likewise does not validate Task ownership when called
this way. Resume resets the session row and accepts an optional binding supplied
by its caller. Resolving a historical escalation can therefore attempt work
outside the current Task admission path. The new public session-control guard
does not protect a direct method call.

An isolated probe saved session metadata with binding
`sample/work`, generation 1, attempt `attempt`. The public validator rejected
Steer. Publishing `escalation.created` followed by `escalation.resolved` with
outcome `fixed` to the real lifecycle subscriber nevertheless called the recording
manager's resume method once and persisted `resume_attempted`, then
`resume_started`. No actual manager execution was launched. Existing
`test/integration/escalation-lifecycle.test.ts:163` expects cold resume of a
historical Task-looking session but does not give it a real Task binding.

**Fix:** look up trusted ownership before acting. Task-bound resolutions become
evidence/input for the same Task. A closed Task keeps evidence without reopening.
Standalone controls use the common ownership check. Keep low-level executor
resume available to the actual Task executor; do not ban all internal resume.
Test active, completed, replaced and missing Task targets plus valid standalone
resumption. Missing ownership must produce a truthful problem, not a guessed job.

## 2. Agent-tool cancellation bypasses the public guard

**Reproduced local branch; detached branch inspected.**
`src/lib/manager-agents-tool.ts:435` cancels a locally active session directly.
For detached sessions it tries a socket, catches failure, falls through to
`SIGTERM`, and updates the registry as interrupted. It can therefore treat an
ownership rejection like a transport failure. The final fallback also calls
`manager.cancel` and reports cancellation without confirming a reachable owner.

The probe used the same Task-bound metadata. Public Cancel was rejected, but
`createAgentsTool(...).execute(..., { action: "cancel", sessionId })` called the
recording cancel method once. No process was killed. Tool exposure is real:
`src/app/loader/toolset-loader.ts:71` loads this preset, and the reviewed May
agent configuration includes it; Scout's configuration uses coding and finish.

**Fix:** validate trusted target ownership at the tool entry point through a
shared capability, without importing the command router into core. Preserve a
caller's ability to cancel its own bounded helper. Task controls, Conversation
Stop and standalone cancellation keep their distinct scope. Reject forbidden
targets before any signal or registry write. For allowed detached execution,
distinguish unreachable transport from rejected authority and verify process
identity before using process-level fallback. Test these separately.

## 3. Scout can consume a change before anyone receives it

**Previously reproduced; source reconfirmed.**
`projects/scout-knowledge-lib.app/watchers/xhs-credential.ts:61` writes private
discovery state before returning facts. Discarding an unavailable-state batch
to simulate failed publication yields batch lengths `1, 0` across two unchanged
scans. The second scan believes the change was already reported. Ready-state
facts are emitted every scan; the demonstrated gap concerns unavailable state.

The Host already supports publication-aware snapshots in
`src/app/adapters/producers/app-observer-runtime.ts`. Advance memory only after
durable publication, retaining its generation checks. Scout should use that
contract for discovery state; source evidence and domain documents remain in
Scout. Verify lost publication, unchanged reread, duplicate delivery and reload.
This needs no additional notification store, daemon or agent registration.

## 4. Independent sessions retain a second continuation policy

**Source finding.** `agents.fork` in `src/lib/manager-agents-tool.ts:332` calls
`runAgent`, returns a session ID, and tells the caller to peek for progress.
It records ancestry and a message event, but does not admit a durable Task or
establish the ordinary Task dependency result link. Traceability is not durable
responsibility. Direct synchronous `agents.call` is a valid bounded capability.

`createAutoResume` in `src/lib/session-subscribers.ts:97` maintains in-memory
retry counts and delayed resume callbacks. It excludes `kind: call` and explicit
cancellation. Current managed Task execution explicitly uses `kind: call`,
Task binding and `APP_TASK_RECOVERY_OWNER` in
`src/app/adapters/executors/managed-agent.ts:180`. This review does **not** show
that this auto-resume path normally duplicates current Task attempts.

**Fix:** decide which standalone capabilities are still supported and inventory
their callers. Move independent ongoing assignments to existing typed Task
dependencies, then retire their separate resume policy. Do not wrap every helper
call in a Task or recreate legacy retry timers inside a new framework. Verify
caller result delivery, parent cancellation, restart and exact same-Task reuse.
The clarification below qualifies this migration: current result-only delegation
parks the parent absent another wake. Preserve useful parent work before removing
an existing asynchronous consumer.

## 5. Silence and error counts still influence strategy

**Source finding plus a detector probe.** Several mechanisms currently differ:

- `src/lib/manager.ts:1812`: a five-minute default no-observation deadline
  interrupts job/call execution. Native activity forwarding fixes missing
  observations; truly quiet work can still expire.
- `src/lib/session-subscribers.ts:24`: four error-only turns warn; six request
  cancellation. The probe confirmed a bounded call still requests cancellation,
  while suppressing its separate escalation. However, current worker relay sends
  only persisted Events. `turn_end` is not persisted by `DbWriter`, and the
  detector is installed in the daemon, not the Task worker. Do not present this
  as a reproduced six-turn cancellation of current Task workers.
- `src/app/adapters/executors/codex/codex-goal-executor.ts:384`: silence causes
  an automatic nudge after the default two minutes, then interruption after
  the hard stale interval, default ten minutes. Sending the nudge resets the
  silence clock, so ten minutes is not necessarily measured from the last
  provider activity. Its default goal/turn wait timeout is thirty minutes.
- `src/lib/workflow-finish-recovery.ts:29`: a default 24-tool threshold can ask
  for bounded finish; admitted longer execution budgets defer that prompt until
  near their deadline. Explicit operation allowances also apply.

**Fix:** separate observed inactivity, explicit execution budgets, and semantic
judgment. Adapters implement provider communication and cleanup; code enforces
documented limits; the owner decides whether to continue, steer, narrow scope,
wait or quit. Agents should not maintain timeout counters. Keep validated exact
finish recovery and bounded provider repair: preserving a schema-valid result
is different from choosing a new strategy. Do not remove all limits to eliminate
these heuristics. Review while a helper is awaited remains deferred; until it
exists, retain and accurately document the current safety behavior. Test quiet
valid work, failed providers, real progress, deadlines and process cleanup.

## 6. Generic tools still identify privilege by names

**Source finding.** `src/lib/tools/cross-edit-guard.ts:125` exempts May;
evaluator and tech-lead names receive special treatment. The agents tool uses
a `may-break-glass:` request-ID prefix for cross-App access. Other May defaults
in health and Event diagnostics are labels or policy, not all permission grants.
Do not treat these different cases as one security finding or claim a public
caller can forge the trusted metadata without further evidence.

**Fix:** installation composition supplies narrow trusted operational scope,
and tools enforce it. A supervisor role grants no blanket access. Migrate actual
privileges with positive and negative tests before removing protections.
Moving a name to a constant would not repair the authority boundary. Existing
[App-policy cleanup](../../proposals/app-policy-and-host-boundary-cleanup.md)
owns the wider migration; no competing permissions framework is needed here.

## 7. Periodic checks and fallback have honest limits

**Observer reproduction already recorded; fallback is a capability gap.**
An unresolved observer keeps `running` true until it settles, suppressing later
scans. A previous temporary fixture advanced ten intervals and invoked two
scans; its unresolved run was called once. This prevents overlapping effects,
but a periodic schedule alone cannot rescue a hung source operation. Scout's
credential subprocess already has a 30-second kill timeout.

Bound external I/O at its adapter, preserve failure evidence and allow normal
later scans after cleanup. Do not clear the flag on a timer and accumulate
abandoned operations. An unresolved in-process adapter may require operator
intervention; a generic cancellation contract should earn its cost.

Failed admission plans retain `last_error` in
`src/app/core/state/app-event-admission-store.ts`. Controller errors emit
`handler.failed` with App/Task identity and retry disposition in
`src/app/core/tasks/app-task-runtime.ts:626`. These preserve diagnostics; they
do not prove a capable agent received a repair assignment. Likewise,
`agent:may` on an Event is not automatic supervisor routing. The reviewed May
subscription list does not provide a universal delivery-failure handler.

If unattended owner failure warrants it, use one explicit composition-selected
supervisor route for a problem report, followed by visible human attention if
unavailable. Preserve original ownership and caller correlation. Test unavailable
Apps, rejected admission, supervisor failure and repeated hints. No recursive
handler selection, automatic ownership transfer or mandatory global LLM scan.

## 8. Legacy domain paths are cleanup, not a core rewrite

`src/app/command-router.ts:155` still appends legacy project discussion and
reactivates saved project status, with a `project.nudge` event. It explicitly
skips a canonical App directory. This is domain behavior in an interface path,
but the guard matters: it is not evidence that current App Tasks are reactivated
by this branch. Inventory remaining legacy callers, then remove the branch or
put the policy in their owning App adapter.

Provider-specific Event catalog entries, May diagnostic defaults and the
`http/read-model/state-db.ts` writable SQLite interface deserve clearer scope.
The inspected HTTP reads use shared schema/storage; this review found no direct
Task mutation through that adapter. A writable type is not proof of illicit
writes. Move or narrow a boundary when its consumer warrants the change; avoid
cosmetic file moves that leave ownership unchanged.

## What already fits and should stay

- **Task authority:** the controller, exact generation/attempt fences, persisted
  input, accepted results and explicit owner closure provide one work lifecycle.
  A finished attempt does not necessarily close its Task or conversational ask.
- **Caller feedback:** `core/inbox/input-result.ts` preserves exact dependency
  return links through normal and recovery paths. Keep this shared mechanism.
- **Mechanical recovery:** same-Task retries and process/lease checks restore
  execution. Session recovery tells the next attempt to inspect uncertain
  external effects. Continuing retries need effective owner judgment about
  value and cost; that does not automatically justify another retry counter.
- **Result validation:** Codex terminal output passes common Task result
  admission. A native goal claiming completion does not itself satisfy the Task.
- **Execution reads:** the candidate's core status reader uses current shared
  claims and process evidence; transports present it. Activity and goal progress
  remain different. A fresh workflow claim is not proof of process health.
- **Maintenance:** the Host-private adapter contains failures, uses deadlines
  and retains in-flight ownership until settlement. Composition selects its
  conversational notification target. Its private storage access is not a
  public App SDK leak.
- **Reporting:** workflow health reports read historical facts without owning
  work. The corrected dashboard label says Recently Seen Agents. Keep historical
  reporting distinct from current execution.

## Clarification review: execution and pending results

The clarified contract separates open responsibility, current execution and
outstanding results. A Task may run while a dependency remains unresolved. One
scheduling phase is sufficient; do not introduce an `executing-and-waiting`
state or make an agent profile globally waiting. The owning
[System Model](../../2a-design/system-model.md#execution-and-outstanding-results)
now describes this explicitly.

Revisited Host `6fdc03d8` without changing its source. The findings are:

| Capability | Current evidence | Assessment |
| --- | --- | --- |
| Release execution while preserving a wait | `deferAppTask`, `app-task-reconciler.ts:3660`, finishes the attempt and clears its current claim while retaining Conditions/input links. | Fits. A durable wait is not a suspended model call. |
| Run with unresolved waits | Claiming checks fresh input independently of open Conditions (`app-task-reconciler.ts:2644`). A real claim retained the open Condition during phase `running`. | Fits. No parallel parent attempt is required. |
| Answer new input while older work remains | `completeAppTask` removes satisfied Conditions and retains unresolved ones; the resulting phase can still be waiting (`app-task-reconciler.ts:3639`). | Fits. A particular input's answer does not erase other obligations. |
| Resume after feedback or missed delivery | Existing dependency/input correlation and Condition recovery; chain tests include discussion, lost notification and reopen. | Fits the tested routes; not a promise for arbitrary async tools. |
| Start a new child and continue the parent immediately | SDK admits new dependencies only on `waiting`; `attempt-runner.ts:711` submits them after executor return. A quiet parent then has no continuation wake. | Expressiveness gap. Later work on fresh input is supported; automatic immediate continuation is not. |
| Display execution alongside outstanding results | `HumanTaskService.getTask`, `human-task-service.ts:1031`, computes `waitingOn` only for phase waiting. | Reproduced presentation gap. Running detail loses the normal wait list although diagnostics retain it. |
| Distinguish parked work from eligible continuation | `human-task-service.ts:225` only projects ready converged rows to pending. After fresh input, the fixture had phase waiting and indexed ready 1; its public status still said waiting. | Reproduced presentation gap. Read current eligibility alongside waits; do not treat a retained waiting phase as proof no work can run. |
| Treat an awaited coding helper as detached work | `run-cli-agent.ts:100` explicitly waits for its terminal result; cancellation applies to that call. | Unsupported by contract. Keep it bounded; progress updates do not make it durable delegation. |

### New isolated evidence

Using a temporary resource store, the production claim/settlement functions and
`HumanTaskService`, the probe:

1. Admitted a Task and returned one pipeline Condition. The attempt ended,
   `currentAttemptId` cleared and a passive claim returned waiting.
2. Admitted fresh review input. Before claim, the index said ready 1 but the
   public status still said waiting. Then claimed the same Task. Its phase was running,
   its original Condition remained, and the public view named the current
   attempt. `waitingOn` was absent while diagnostic Conditions numbered one.
3. Accepted the review result. The unresolved pipeline Condition remained and
   the ordinary wait list reappeared. Passive inspection did not start new work.
4. Called real SDK admission with new dependencies. Waiting was accepted;
   converged returned `dependencies are valid only for waiting`; incomplete
   returned `incomplete cannot include actions, Conditions, or dependencies`.

This uses actual Task transitions and read projection, not manually changing a
phase to invent an impossible state. No executor/model or external pipeline ran.
Temporary state was removed. To reproduce, build `appTaskTestContext` with one
root group; use `observeAppTaskIntent`, claim, `deferAppTask`, then
`recordAppTaskTrigger` and claim again. Compare `HumanTaskService.getTask` and
the resource's `conditionIds`, then call `completeAppTask` for the new input.

Nine existing focused tests passed, zero failed, with 93 assertions:

```sh
bun test src/app/core/tasks/app-task-runtime.test.ts src/app/core/tasks/app-task-reconciler.test.ts --test-name-pattern 'schedules unexpected exact-task input|keeps passive checks asleep|adds distinct work for the same App|follows A -> B -> C -> B -> A|keeps later Condition events pending|keeps the source Task runnable when its dependency'
```

They cover two independent waits, input arriving during execution, additive
same-App work across restart, rejected dependency admission, and exact caller
chains with discussion, blocker reports, missed delivery, reopen and owner
cancellation. The runner filtered 306 unrelated tests. This is a targeted
recheck, not a new full-CI or live-uptime claim.

### Revised recommendation

Keep the original control and publication fixes. Add the small human-read fix:
show bounded outstanding waits for an open running/pending Task using existing
state, and distinguish genuinely eligible work from a parked wait. Preserve
explicit static dependency gates; a trigger alone does not establish eligibility.
Do not relabel every Task with Conditions as parked. Verify running, parked,
queued and closed views and preserve truthful unavailable-source behavior.

Narrow the session-job migration: durable assignments belong to Tasks, bounded
helpers remain direct, and provider-owned async operations keep their native
identity. The words agent and worker do not determine their lifecycle.
Prove useful parent concurrency before removing the old path. The preferred
[continuation PoC](../../proposals/execution-feedback-and-review.md#delegation-and-useful-parent-work)
would retain dependencies and make the same parent Task runnable at an ordinary
attempt boundary. No new Task phase, scheduler, mandatory supervisor or
mid-helper model review is needed. This extension remains unimplemented.

The doc review also corrected three misleading formulations: a Condition does
not block all unrelated work, an external dependency need not end a run that
has useful independent work, and old achieve/maintain labels do not determine
Task closure. The stale suggestion that a worker updates its own assignment was
replaced with the assigning-owner boundary. Existing unrelated draft edits in
the Task resource-engine document were preserved.

The clarification documentation passed `bun run check:may-design`: zero design
errors or warnings, with SDK/control examples, Task admission/replay, Condition
and dependency result admission, and canonical App integrity passing. This
turn changes documentation only; all new implementation findings remain open.

## Component-family review

This pass revisits the same Host candidate against the simpler agent model:
**running execution and waiting for results are independent**. The agent does
not select an infrastructure lifecycle. Core preserves work and executes its
mechanics; capabilities supply useful actions and evidence; the agent/owner
judges the next move. The owning
[boundary table](../../2a-design/system-boundary.md#core-external-capabilities-and-composition)
defines those responsibilities.

The inventory covers production `src/app`, `src/lib`, SDK and control-package
families, plus the May/Scout definitions involved in feedback. Table paths use
`src/app` as their base; `lib/` means `src/lib`, `tools/` means `src/lib/tools`,
and `packages/` starts at the Host repository root. Other bare filenames share
their named component's directory. App source is marked separately.
Related small helpers are grouped with their owner. This is a component-level review of contracts and
representative paths, not an every-file correctness certification. Existing
findings above remain open; this pass implements no runtime changes.

| Component family and source | Boundary | Assessment and smallest response |
| --- | --- | --- |
| App definitions/registration: `core/apps/registry.ts`, `definition-validation.ts` | Core validates identity and accepted generations; App supplies meaning | Fits reviewed contract. Failed discovery/activation keeps the accepted definition; retain one registry. |
| Discovery and agent/tool/skill loading: `adapters/discovery/*`, `loader/*`, `lib/skills.ts` | External capability, wired by composition | Conventional source discovery and `.disabled` exclusion fit. Keep definition loading outside core; named privilege exceptions need the separate fix in finding 6. |
| Input admission and caller results: `core/inbox/*`, `core/state/app-event-admission-store.ts` | Core | Exact input/Task links and recoverable admission fit. A recorded notification remains distinct from accepted work. Unavailable-owner handling is not universal. |
| Events and routing: `core/events/*`, `canonical-app-event.ts` | Core mechanisms with App-selected routes | Fits normal exact-target feedback. Provider event catalogs and May default labels remain cleanup; labels are not supervisor delivery. |
| Storage, projections and journals: `core/state/*`, `lib/db/*`, `lib/db-writer.ts`, `lib/persistence.ts` | Core facts; execution artifacts support those facts | One accepted state authority fits. SQLite implementation files in `lib` are still core infrastructure; moving folders would not improve the contract. Retained cutover code is not another active controller. |
| Task controller, queue and settlement: `core/tasks/controller.ts`, `app-task-runtime.ts`, `app-task-reconciler.ts` | Core | Existing claims, acceptance and owner closure fit. Running with retained waits already works; do not add combined phases or an agent availability service. |
| Timing and capacity: `core/scheduling/*`, Task recovery/checkpoints | Core | Eligibility, leases and bounded resource use fit. Keep required recovery timing independent of optional schedule producers. A static `dependsOn` gate must retain its meaning. |
| Dependency admission and Conditions: `core/tasks/dependency-admission.ts`, `app-task-condition-tracker.ts` | Core correlation; App/capability supplies required facts | Durable feedback fits. Immediate continuation after new typed delegation is missing; evaluate the existing scoped continuation PoC before replacing concurrent session consumers. |
| SDK contracts: `packages/sdk/src/{app,task,task-contract,workflow,event}.ts` | Typed boundary for Apps/capabilities and core | Keep explicit validation. Model-required Condition mechanics are a simplification gap, detailed below; a technical SDK is not itself a design violation. |
| Conversation and Requests: `conversations/*`, `composition/conversation-task-turn.ts`, `core/state/conversation-requests.ts` | Core stores/guards; replaceable handler judges scope and response | Shared Task execution and separate Request fulfillment fit. Pending work need not prevent another answer. Source guarantees do not prove the model always judges fulfillment correctly. |
| Managed agents/workflows: `adapters/executors/{managed-agent,workflow}.ts`, `lib/agent-execution.ts`, `lib/workflow.ts` | External executors | Proposed results return to core admission. Keep that split; timeout/finish heuristics require the finding 5 policy review. Prompt bookkeeping is addressed below. |
| Native coding and process I/O: `adapters/executors/codex/*`, `lib/cli-agent.ts`, `tools/run-cli-agent.ts`, `tools/bash.ts` | External execution capability | Progress is evidence; terminal claims require accepted results. Keep provider control and cleanup here. Awaited coding calls are not restart-safe delegation; do not promise otherwise. |
| Direct and background tools: `direct-agent.ts`, `lib/background-exec.ts`, `loader/toolset-loader.ts` | External capability with its own execution lifetime | Direct runner cleans up in `finally`. Background exec keeps in-memory process handles and loader-owned cleanup; it is not durable accepted work. Normal App-owner execution filters it out. Do not replace it with a generic async-job service. |
| Session manager, recovery and controls: `lib/manager.ts`, `manager-agents-tool.ts`, `session-subscribers.ts`, `escalation-lifecycle.ts` | Execution adapter/composition; Task core owns durable authority | Mixed. Public controls were fixed in the candidate; alternate cancellation/resume and independent session jobs retain the concrete gaps in findings 1, 2 and 4. |
| External observation: `adapters/producers/app-observer-runtime.ts`; App `watchers/xhs-credential.ts` | Adapter reads sources; Host persists publication/discovery progress | Host publish-before-advance fits. Scout's duplicate memory loses an unavailable transition; use the existing contract. Bound source I/O before relying on periodic scans. |
| Schedule production: `adapters/producers/app-schedules.ts` | External producer selected by composition | Declared inputs/facts and explicit catch-up semantics fit. Disabling these registrations must not turn off Task recovery. |
| Host-private maintenance: `adapters/maintenance/*`, `composition/maintenance*.ts` | Optional private Host capability | State access for mechanical maintenance fits; timeouts retain in-flight ownership until settlement. A maintenance notification is not App admission. Keep failure containment and avoid a public storage escape hatch. |
| Installation liveness: `modes/maintenance.ts` | External process recovery | Socket/heartbeat checks, canonical execution reads and bounded restart policy serve process availability. Keep separate from judgments about meaningful worker progress. No LLM is required to restart an unresponsive daemon. |
| Human/control interfaces: `human-task-service.ts`, `transport/*`, `http/*`, `packages/control/src/*`, CLI modes | External presentation/control, consuming shared core reads | Current execution and outstanding waits must both be visible. Task detail and `system_status` drift are concrete read defects. Legacy project policy in the command router remains finding 8. |
| Reporting/metrics: `adapters/reporting/*`, `lib/metrics.ts`, `tools/system-dashboard.ts`, `tools/system-status.ts` | Optional read capability | Historical reports fit; Recently Seen Agents is an honest label. The separate system-status tool still presents history as current activity; see reproduction below. |
| Workspace/artifact lifecycle: `core/tasks/workspace.ts`, `adapters/workspaces/git.ts`, `adapters/executors/agent-workspace.ts`, `lib/artifacts.ts` | Core orders/adopts facts; adapters implement Git/files | Contract split fits. Git operations are bounded; unintegrated/failed work retains recovery evidence. Waiting does not by itself authorize deleting work or merging it. |
| Model/provider configuration: `model-registry.ts`, `lib/agent-runner.ts`, `lib/agent-execution.ts` | External capability and installation composition | Provider catalog, endpoint limits and credentials are outside core Task policy. Keep them there; this review did not revalidate remote model behavior. |
| Permissions and guard tools: `lib/tools/*guard*.ts`, `lib/security/*`, loader tool selection | Capability enforcement with trusted installation scope | Mechanical checks fit; name-based privileges and alternate control paths remain concrete boundary debt. Preserve protections while migrating them. |
| Bootstrap, reload, worker processes and shutdown: `app-runtime.ts`, `daemon*.ts`, `composition/*`, `interface-startup.ts` | Composition | Selects executors, workers, state, timing and interfaces. Pinned worker definitions and accepted generations fit. This wiring should not accumulate new domain decisions or its own work lifecycle. |

Import checks in `eslint.config.mjs:95` prohibit core imports from executor,
composition, Conversation, HTTP and transport implementations. Executor checks
also reject direct imports of Task mutation modules, while permitting types.
These checks support the boundary; they cannot establish that every helper
outside those directories obeys it. The session/control and read gaps illustrate
why source tracing is still necessary.

### New reproduced gap: agent status disagrees with core

`src/lib/tools/system-status.ts:234` reads any session whose saved status is
`running` or `idle`, without checking its end time, current Task attempt or live
process marker. Its active section labels those rows as current execution.
The tool is exposed by `loader/toolset-loader.ts:188`; the reviewed May config
includes `system-status`. This is separate from the socket status repaired in
the candidate.

A temporary SQLite fixture inserted a running session row with no execution
marker. Calling the production readers returned:

| Read | Result |
| --- | --- |
| `readExecutionStatus` | Zero sessions; `activeWork: false` |
| `createSystemStatusTool(...).execute(...)` | One active session |

A second fixture placed a regular file where the state directory should be.
The core read threw; the tool returned `activeSessions: 0` and an empty active
section. Its unrelated Ops Queue text said `DB unavailable`, so this is a
misleading per-section result, not complete suppression of every diagnostic.
No live process, model or App was involved; temporary state was removed.

**Fix:** supply the canonical execution reader through the tool's composition
boundary, keeping history as history. Report an unavailable active read as
unavailable; do not equate it with zero. Keep query work bounded. Existing
`system-status.test.ts:321` explicitly expects a projection-only session with
no execution marker to be active; replace that expectation with a real current
execution fixture and stale/replaced/unavailable cases. Add current workflow
claims to the presentation where useful without inventing an agent session.

Reproduction uses `upsertSession` for one standalone `running` row without a
process marker, then compares the two exported readers. For the failure case,
use a temporary regular file as the state path. The private probe reported
`canonicalSessions: 0`, `dashboardSessions: 1`, `failedReadActiveSessions: 0`.

### New source gap: the agent still authors notification mechanics

`adapters/executors/managed-agent.ts:85` gives the model `appTaskAgentProtocol`
and `taskAgentResultSchema`. `packages/sdk/src/task-contract.ts:75` requires a
Condition ID, event type, typed subject, expected value, owner and
`reviewAfterMs`. The protocol explains that naming an owner does not send a
request and choosing review timing does not repair anything. These rules are
accurate, but routine supported waits still require infrastructure bookkeeping
from the model. The agent should choose the desired result and next useful
action; the capability should supply those mechanics.

**Fix:** start with one supported operation, using the App/tool's existing
typed contract to supply its trusted operation reference, feedback route and
review defaults. Keep the expected domain outcome visible for agent judgment.
Preserve internal validation and exact identity; do not accept invented owners
or event names from untrusted output. A human decision can still be requested
explicitly through its supported capability. Unsupported sources should state
the limitation rather than imply notification exists.

This is a scoped interface improvement, not proof that every SDK Condition
author is wrong or that all async tools already have a return route. Before
adoption, show result-before-yield, parent continuation, a quiet durable wait,
lost notification/restart recovery and cancellation through existing records.
An ordinary FYI must not create a wait. Do not introduce an operation registry,
global agent state, universal tool API or another daemon for this PoC.

### What this changes in the recommendation

Keep core Task execution, events, storage and recovery. Fix the two control
entry points, Scout publication memory and the two read projections first.
Then prove capability-provided wait mechanics and useful parent continuation
with one real consumer before retiring independent session jobs. Keep uncertain
progress decisions with the worker/assigning owner; retain documented execution
limits until a tested replacement exists.

This gives clearer behavior without a core rewrite. The small fixes repair
demonstrated contradictions. Protocol/continuation work has a larger correctness
cost and needs the focused PoC. Automatic supervisor fallback, concurrent model
review and a generic notification framework remain unnecessary for these fixes.

The added component checks ran 43 tests across nine files: zero failures,
152 assertions. They cover import restrictions, registry replacement, disabled
discovery, schedule activation, foreground capacity, maintenance admission/
failure isolation, optional reporting, and liveness decisions. They do not
certify process restart on a live installation. Reproduce with:

```sh
bun test scripts/eslint-config.test.ts src/app/core/apps/registry.test.ts src/app/adapters/discovery/app-definitions.test.ts src/app/adapters/producers/app-schedules.test.ts src/app/core/scheduling/host-capacity.test.ts src/app/adapters/maintenance/runtime-boundary.test.ts src/app/composition/maintenance-activation.test.ts src/app/composition/reporting.test.ts src/app/modes/maintenance.test.ts
```

The refined docs also passed `bun run check:may-design`: zero design errors or
warnings, valid SDK/control examples and Task/Condition/dependency admission,
and canonical App integrity. No full-CI rerun or deployment was needed for
this documentation change.

## Validation and next change

The new isolated probe invoked the real escalation subscriber, EventBus,
DbWriter, session metadata, public validator, agents tool and stuck detector
with recording execution methods. Results: public controls rejected the bound
session; escalation attempted one resume; the agents tool attempted one cancel;
six error-only turns requested one cancel and zero independent escalations for
a call. Temporary SQLite state was removed after assertions; model calls: zero.

To reproduce, save Task-bound metadata with `writeSessionMeta`, show that
`validateSessionControl` rejects it, then publish a matching escalation creation
and fixed resolution through `createEscalationLifecycleSubscriber`. Record the
manager call and persisted resume events. Separately mark that session active
in the recording manager and invoke the agents tool's cancel action. For the
detector, supply `session.start` with `kind: call`, followed by six `turn_end`
events containing one failed tool call each. This deliberately tests production
entry points without asserting that a live worker was resumed or killed.

Prior Host candidate CI passed 2,997 tests with three installation-only skips
and zero failures; see the linked feedback proposal for exact scope. That gate
predates this document and is not new live evidence. For this documentation
change, `bun run check:may-design` passed: design integrity had zero errors or
warnings; SDK/control examples, seeded Task admission/replay, Condition and
dependency result admission, and canonical App integrity passed.
Implementation should begin with the
two control entry points and Scout publication memory in separate focused
changes, adding regressions at those boundaries. Keep fallback, concurrent
review and broad policy migration separate until their value warrants the cost.
