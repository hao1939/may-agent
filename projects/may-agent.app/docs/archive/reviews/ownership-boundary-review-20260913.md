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
| Next | Independent session jobs coexist with durable Tasks | Inventory `agents.fork` consumers; move durable assignments to typed Task dependencies. Retain bounded direct calls and explicitly supported standalone chat. | Removes an alternate work lifecycle. Medium consumer cleanup. |
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
