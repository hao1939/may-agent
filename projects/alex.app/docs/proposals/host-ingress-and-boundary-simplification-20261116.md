# Host ingress and SDK convergence: remaining work

**Supports:** [Host/App boundary](../2a-design/system-boundary.md#ingress-task-process-and-bounded-execution). Keeps input ownership, durable Task mechanics and bounded worker execution distinct.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource), [simple first](../1-principles/core-principles.md#simple-first), and [apps own meaning](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics). Share execution and existing caller records rather than adding another lifecycle.

**Design status:** Partially promoted. Established contracts now live in their owning design documents. This record owns remaining integration choices and acceptance gaps.
**Implementation status:** Host `main` at `0b164bec75c54b75f4960a35f840b5311f69bee0` includes #576 and #577: transactional Task-input fencing, retained caller returns, fair recovery, and parent heartbeat supervision are merged. The authorized local installation runs Host source `81c3720dd3` with Apps definitions last verified at `e78e66d207`; binary activation is distinct from App reload and current `main`. Shared hosted execution, a domain-only development worker with automatic continuation, and single-Task Conversation ownership remain incomplete. The first delivery follow-up needed operator intervention and did not establish its final addressed Telegram readiness notice. The user selected existing PR #574 for the next trial: assign the outcome to May, observe normal execution, and repair demonstrated gaps at their owning boundary.

The [source and verification record](../archive/implementation/host-ingress-sdk-source-review-20261116.md) retains exact revisions, historical measurements, repaired findings and verification limits. It replaces the original assumption that every slice was still future work.

## Promoted contracts

| Responsibility | Owning document | Established behavior |
| --- | --- | --- |
| Three responsibility layers | [Host/App boundary](../2a-design/system-boundary.md#ingress-task-process-and-bounded-execution) | Ingress owns addressed input/communication; Host owns deterministic Task mechanics; workers own domain judgment and bounded iteration. |
| SDK authoring and completion | [SDK](../2a-design/sdk.md#stable-root-surface) | Root `AgentContext`/`ExecutionResult`, App/Task binding under `/app`, explicit standalone/test input, domain `output` and `facts`. |
| Execution lifecycle | [Shared runtime](../2a-design/agent-runtime.md#source-convergence) and [workflows](../2a-design/workflows.md#scoped-context) | Shared standalone preparation, explicit services/skills, bounded helper calls and cleanup; Host adoption remains partial. |
| Canonical ingress | [Events](../2a-design/events.md#purpose) | No implicit addressed-agent `message.created` routing or special `escalation.*` feedback routing. |
| Event journal | [Storage](../2a-design/storage.md#decision) | Execution records own lifecycle/recovery; `event_pair_runs` and its restart repair are retired. |
| External Task reads | [App contract](../2a-design/agent-app.md#one-external-task-read-contract) | One human-facing socket/HTTP Task reader; internal scoped SDK reads remain. Raw-JSON project action invocation is retired. |
| Caller return and retained relationships | [Conversation execution](../2a-design/conversation-execution.md#routing-and-authority) | Exact inbox-backed projection exists; local compatibility repair preserves retained relationships until an equivalent return migration exists. |

These contracts preserve the original five ideas: separate worker execution from
Task bookkeeping; leave business iteration with agents/procedures; share one
execution engine; keep one domain Task per owned outcome; and treat explicit
coordinator Task knowledge as domain data/tools. The last two execution/ownership
outcomes are still integration work, not consequences of the import migration.

## Host responsibility model

**Host owns reliable execution and faithful records; the agent owns domain
judgment and conclusions.** The accepted
[Host responsibility matrix](../2a-design/system-boundary.md#responsibilities-through-a-task)
owns the stage-by-stage contract. This proposal tracks its incomplete execution
and recovery wiring. “Admit the result” means validate and commit the agent's
decision under declared contracts, not independently certify its correctness.
App domain checks remain App policy. Caller review is needed when its own
assignment requires a decision about the contribution; admission adds no
mandatory evaluator or second approval.

For the first finite development assignment, the intended connected path is:

```text
App input -> durable admission and Task mapping -> eligible bounded attempt
  -> agent/procedure works and judges its contribution
  -> Host admits the current, authorized result
       progress: retain evidence and continue eligible work
       wait: retain exact producer/Condition -> fact -> fresh bounded attempt
       complete finite assignment: apply authorized settlement/closure policy
  -> retain and deliver the exact caller result
  -> caller handles the contribution under its own assignment/Request contract
```

These are Task dispositions, not new SDK return variants. Bounded workers still
return `done` or `blocked`; App policy maps continuation facts to Task mechanics.
The progress/wait branches reuse the same Task. Closure and caller delivery have
their existing independent records; a delayed notification cannot undo committed
work. An automatic finite closure needs the agent's full-assignment completion
decision and explicit eligibility; helper completion, idle state or a passing
test alone supplies none. Standing work, Conversation and Task-created/delegated
assignments retain their applicable owner/creator controls.

Three facts must remain distinguishable in implementation and reads: execution
ended, result was admitted, and the caller received it. A process can exit with
no admissible result; an admitted result can await delivery; a delivered
contribution can leave the caller's wider ask unfinished. None establishes that
the agent's conclusion is true. Host-produced execution failure diagnostics keep
their origin and cannot stand in for an agent conclusion. Preserve useful
accepted work while correcting or continuing what remains.

Liveness means eligible work can progress under capacity and policy, or has a
readable execution/recovery blocker. A genuine external wait and administrative
pause need no running model. “Agent failed to handle it” must become observable
failure evidence or an App-owned progress judgment before it triggers a declared
recovery route. Host does not diagnose an ineffective strategy from silence or prose.
Existing retry budgets and explicit controls
still apply; recovery/escalation does not invent a new assignment or authority.

## Completed source and partial slices

| Original slice | Source position | Remaining scope |
| --- | --- | --- |
| 1 — ingress cleanup | #568 merged | Preserve canonical declared input/control routing. |
| 2 — event journal | #568 merged | This does not remove child SQLite writers. |
| 3 — reads and App identity | #569, #576, #577 merged | Project read-model sync retired; fenced Task inputs and external reads active. |
| 4 — reconciler modules | Deferred | Optional mechanical extraction after settlement stabilizes. |
| 5a — SDK/shared execution | #566, #578 merged authoring, helpers, native preflight and settlement component | No production shared-`run()` settlement callers; Host still wraps execution and opens SQLite in the attempt child. |
| Cross-cutting — execution supervision | #577 merged parent heartbeat liveness (`5m`) and recovery timeout (`10m`) | Preserve responsiveness and confirmed exit cleanup across worker lifecycle transitions. |
| 5b — App/Gym adoption | Local SDK context/import migration passes the 25-workflow paired check | Domain-only development and automatic blocked/resume are not established by compatibility checks. |
| 6 — Conversation ownership | #570, #577 merged retained-return repair | Retain compatibility reader until single-Task Conversation ownership and completion Hooks land. |

## Remaining gaps and implementation order

### Preserve merged correctness and complete paired adoption

The merged Host repair restores delivery for retained Topic subscriptions and
`conversation-follow-up:` admissions through live notifications and bounded
periodic recovery. It reuses existing admission/result receipts, preserves late
links and historical Topic references, and does not restore the retired
supervision command. A contribution does not acquire caller communication
authority or fulfill unrelated Requests. Keep this compatibility reader until
an equivalent migration preserves those obligations and deduplication identities.

Exact HTTP Task messages now carry `targetTaskGeneration` in the Host envelope.
Admission persists it independently of domain context and checks it inside the
input-to-Task transaction. Accepted replay lookup precedes the fence, so a lost
acknowledgment can recover its original receipt after requirements advance or
close. The HTTP reader recognizes both old and new accepted envelopes; new
messages always use the fence. Historical rows without a fence stay readable.

The companion App patch moves App/Task symbols and legacy Host-aware procedures
to `/app` and `AppWorkflowContext`; bounded procedures use root `AgentContext`.
It also updates Gym and retires the obsolete event-pair metric collector.
The latest paired source check passes all 25 workflows. The earlier 127 diagnostics
remain historical evidence, not the current patch's result. The retained
`develop-change` procedure still needs Host capabilities and intentionally blocks
standalone before effects; compatibility does not complete its domain-input
migration or automatic continuation.

Host [#577](https://github.com/hao1939/may-agent/pull/577) was externally merged
at `d8b91905f8` on 16 November. Its final head had Container success and a Quality
failure in the reload/translation regression; an earlier green head does not
certify that revision. Independent follow-up #580 owns the reload-test timing
repair. The [verification record](../archive/implementation/host-ingress-sdk-source-review-20261116.md)
retains source, activation and trial facts separately. Continue with the
connected worker below; merge alone establishes no new installed behavior.

### Complete supervision and execution-policy coverage

The merged production attempt parent supervises heartbeat liveness with a
five-minute silence bound; it no longer imposes a fixed 121-minute lifetime.
The worker sends private IPC heartbeats during preparation and execution.
The execution adapter owns numeric deadlines and supported `unlimited` policy;
recovery retains its separate ten-minute bound. Parent timeout handling requests
termination, escalates after five seconds, and retains capacity until child
closure. Preserve these distinct limits rather than deriving another process
lifetime from an App deadline.

The remaining high-value verification is the real factory/worker/native-adapter
boundary for long numeric and unlimited policies, plus interrupted cleanup and
recovery. Portable coverage under review should observe actual timer selection
without waiting hours, and fail if either a fixed parent cap or an ignored App
policy returns. Passing independent policy and scripted-child tests alone does
not cover that composition.

Continue checking non-cooperative workers, parent loss and interrupted recovery.
Human control must stay responsive, stale results must remain fenced, pending
input must survive, and replacement execution must wait for safe cleanup.
Stopping the process neither reverses external effects nor proves successful
Task recovery. A heartbeat establishes process responsiveness, not domain
progress; ineffective work and escalation remain App-owned judgments.

### Connect shared execution and settlement

Have Host agent/procedure adapters invoke `run(target, input, options)` with the
same worker prompt, tools and finish schema as standalone. Supply real declared
capability providers, including supported CLI calls, and preserve limits,
execution identity, pinned definition/generation, recovery and caller behavior.
Keep Host SQLite writes in the parent supervisor. A child may execute bounded
work and report evidence; it must not reopen Host stores for settlement.

The settlement translator already exists. Wire it through the real attempt
runner and checkpoint replay, rather than adding a second execution/result
normalizer. Domain `output.state` remains data. Admit size/shape/facts before
finite-done provenance; retain cleanup uncertainty and stale-attempt fences.
Keep the [agent judgment/admission boundary](../2a-design/task-attempts.md#agent-judgment-and-infra-admission)
through this wiring: validate and persist the declared conclusion, deliver
actionable rejection feedback, and recover the original receipt after a lost
acknowledgment. No generic semantic-success predicate or automatic review agent
belongs in this adapter. Preserve accepted contributions and independent waits
when other inputs remain.
The current root also exposes Task-bearing deferral and nested CLI evidence;
remove that implicit coupling without weakening explicit coordinator tools.

Standalone uses the supplied `cwd`/`workRoot` and reads source files directly
after #572; do not restore snapshot read pinning or infer a Git-checkout gate
from `workspace: "task"`. Current workspace metadata still uses `task`. Decide the compatible transition
to the proposed `isolated` spelling and update validation/callers together;
do not document it as available merely because it appeared in the target sketch.

### Complete one blocked, resumed and finished worker

Use `alex/develop-change` as the first paired vertical slice. Its prototype
must be integrated with current App policy and the accepted Host revision.
Only the complete verified/reviewed assignment returns outer `done`; partial or
budget-exhausted work returns `blocked` with truthful domain continuation facts.

Wire pure App blocked translation, an actual observation/continuation wake and
fresh input reconstruction, including `priorEvidence` and later corrections.
Check evidence against current requirements, authority and candidate identity;
retained output does not grant permission to repeat effects. A wait with no
producer is not automatic resumption. A helper's `done` never closes its parent.

Define finite-assignment eligibility at the App/Host boundary. Closure follows
accepted work with current input, wait, generation and creator fences; it must
not close standing duties or Task-created/delegated work merely because one
bounded contribution finished. Retire only mechanical disposition/closure
housekeeping after this path works. Domain workload prioritization, acceptance,
opportunity judgment and scope decisions stay with the owner agent.

### Carry unresolved failure to its declared owner

An active invocation gets actionable contract/tool feedback within its current
allowance. If it cannot start, finish or safely resume, retain the original
Task/operation, last accepted work, failure stage, retry/exhaustion evidence and
known or uncertain effects. Deliver that packet through the saved caller or
App-declared operational route. Its owner chooses correction, repair, another
method, a real wait or a request for help; Host executes the authorized decision.

Use existing failure episodes, admissions and delivery receipts to avoid a new
investigation per retry. A saved diagnostic, destination admission and recipient
execution are different observations. Missing routing or an unavailable recovery
recipient remains a readable delivery/startup blocker. Retries of the original
operation can continue under policy while independent investigation proceeds;
neither route resets the other's allowance or authorizes duplicate effects.

The [recovery adoption proposal](unified-agent-recovery-20261017.md) owns the
remaining recipient-startup and pre-attempt routing evidence. Reuse that route
and ordinary Task controls in this integration; add no recursive supervisor
lifecycle, guessed fallback owner or automatic human-approval requirement.

### Single-Task Conversation ownership

The intended Layer 1 `Conversation`/`Request` owns history, accepted human asks
and response delivery. Delegate durable work through App input to one target
Task, with an outbound completion relationship to the exact caller/Request.
A Condition means external fact to waiting Task; a completion Hook means Task
update to caller. Neither is another work Task or another queue.

Current source still creates a stable Conversation execution Task; #570 did not
remove it or implement that Hook contract. Before the cutover, define accepted
bounded turns, Stop/cancellation scope, Request revisions, partial updates,
terminal blockers and continuation ownership. A blocked contribution does not
by itself close a human Request. A Task result can complete only the covered ask,
not every Request in a Conversation.

Reuse existing durable caller/result records where sufficient. Retain a
Task-update identity and exact Request revision so delivery can retry and dedupe
across restart, including completion before caller yield. Preserve pending
relationships on upgrade. Retire the stable wrapper only when those contracts
and one-domain-Task admission are covered together.

### Remaining identity cleanup and optional extraction

Finish Slice 3 separately: loaded Apps and their Tasks replace the saved-project
table read path, `syncProjectReadModel` and `PROJECT.md` status scraping. The
remaining project-comment UI already publishes App input; route human intent
through canonical Conversation or exact Task messages without reviving raw-JSON
actions. Removing the old project event alone would not finish this cut.

Split the reconciler along admission, scheduling, settlement and mutation phases
only when it makes the now-stable contracts easier to maintain. Preserve its
public facade and behavior. It is not a prerequisite for shared execution.

Leave isolated diagnostic endpoints, test-support readers, inert historical
tables and small focused helpers alone unless an active competing model or
concrete defect requires a change.

## Acceptance and next useful milestone

The immediate user-facing delivery goal is one coding assignment through Alex's
bounded workflow, PR publication, real CI/comment observation, same-Task follow-up
and a Telegram notification linking the ready PR. The human reviews and approves
on GitHub. The [Task reference case](../2a-design/task-resource-engine.md#solid-use-case-a-pr-through-ci-and-review)
owns that boundary; the [pilot plan](../2b-manual/standalone-to-host-pr-pilot.md)
tracks the connected proof. Existing Task-aware procedures may establish this
milestone without waiting for the full shared-execution or Conversation cutover.
Host schedules and delivers; Alex judges readiness from current-head evidence;
Telegram delivery does not stand in for GitHub approval. The historical
[PR #579 trial](../archive/implementation/host-ingress-sdk-source-review-20261116.md#local-paired-activation-and-native-delivery-trial)
proved workflow execution, real watcher-driven same-Task CI continuation and a
Telegram mirror send, with an operator queue continuation. It did not prove an
addressed durable final notification or a substantive repair cycle.

The active acceptance target is existing [PR #574](https://github.com/hao1939/may-agent/pull/574).
May owns the human promise; Alex Task `input/appdep_1ee136a45d4c842a8ae0f507`
owns the PR. The run exposed three App handoff gaps: a new PR was routed into
unrelated exhausted work; the superseded writer was not drained before handoff;
and the corrected assignment omitted the saved cross-repository checkout
selector, allowing direct specialist calls to bypass the workflow. App guidance
repairs are activated through `2a2a583d3a`. May used her explicit revision
procedure to correct the same Task through generation 4, preserving its caller,
PR and consumed allowance. `develop-change` run `wr_1794866610210_ki6q` verified
and independently reviewed the retained candidate. Source-bound watcher event
6730879 woke that same Task, which rearmed against its observed fingerprint.
That continuation required no operator queue wake.

The initial Quality timeout is now diagnosed and repaired: its test repeatedly
submitted obsolete `verification_facts` to a finish schema requiring `facts`.
Alex fixed that field, verified the whole file and affected shard, obtained Bob
review and pushed `3fc13d76f0` to the same PR under May's explicit direct-repair
exception. The original workflow receipt certifies the prior candidate; it does
not certify this later repair. All four hosted shards now finish. Container
passed, but Quality exposed the existing reload/translation fixture race also
addressed in unmerged #580. Native watcher event 6731128 observed the actual
failed current-head checks and woke the same generation-4 Task, without operator
continuation. Alex's local passes did not explain that failure; operator evidence
identified the matching existing correction rather than supplying a CI rerun.
Guidance now requires reading the failing assertion/source and related open fixes
before treating local passes as grounds for credential escalation. Current-head
green CI, accurate repaired-candidate evidence, the caller return and the final
addressed Telegram provider receipt remain required. This is not yet a completed
autonomous delivery claim.

Bounded reproduction narrowed the stall to a single live-input test. A repair
workflow reached its caller deadline before implementation; Host automatically
continued the same Task, and the exhausted workflow escalated to May. May chose
one bounded direct fixture repair without renewing the workflow allowance.
Her first waiting result stored that decision but left Alex's escalation open,
creating a mutual wait. Corrected App guidance at `238f476d3d` made the distinction
explicit; May then converged only the answered escalation input, and its actual
caller return woke the same Alex Task. This owner disposition is an exception to
workflow execution, not evidence that the repair ran through `develop-change`.
The same source also fixes pinned workflow evidence recovery when a creator
revision changes the execution output directory. Sixty-four workflow/evidence
tests pass, including the failing-before regression and conservative exhausted
or corrupt usage; successful activation is 6731019. The original delivery promise
and final readiness/notification gates remain open.

The run also exposed Bash cleanup that confirmed only the original process
group, allowing nested GNU `timeout` groups in the same session to survive.
Supporting draft [#582](https://github.com/hao1939/may-agent/pull/582) drains the
owned session for live and persisted cleanup. Its four real-process regressions
fail before the fix; 55 focused tests and full local CI (3,439 pass, two skips)
pass afterward. This is unpublished-to-runtime source evidence, not installed
cleanup proof. Descendants that create a separate session remain outside scope.
Apps use `timeout --foreground --kill-after=5s` when an inner timeout is needed.

| Gate | Required evidence | Current gap |
| --- | --- | --- |
| Judgment and admission | A well-formed agent conclusion within the declared contract is recorded without an added semantic reviewer; malformed, stale or unauthorized changes return specific feedback. Domain `output.state` stays data. | Keep this distinction through production shared settlement; existing contract/component checks alone do not prove caller wiring. |
| SDK semantics | Root worker types and runtime preparation require no Host Task/Conversation identity; explicit coordinator domain tools remain opt-in. | A symbol-name snapshot alone misses Task-bearing nested deferral/CLI types. |
| Hosted parity | Same pinned worker/input/capabilities through standalone and Host; compare prepared messages, tool/finish schemas and first-turn bytes. No Task brief, unrequested tools or `TASK.md` turn. | Real Host caller migration remains; the historical target is less than 5% payload overhead under equivalent inputs. |
| Execution supervision | Use production attempt/recovery factories with a non-cooperative worker; independently enforce declared bounds, confirm cleanup and retain responsive controls. Stop is not automatically retried; timeout follows its policy. | Heartbeat liveness replaces the fixed attempt lifetime; recovery retains ten minutes. Native numeric/unlimited policy coverage passes focused tests, but its full suite failed and complete connected cleanup/recovery proof remains. |
| Parent-owned storage | Instrument the attempt process and exercise restart/settlement; zero Host SQLite connections in execution children. | Journal cleanup is not this proof, nor a guarantee that every unrelated SQLite test can never contend. |
| Crash and effect recovery | Lose the acknowledgment after commit and interrupt after an external effect; replay the same receipt, preserve accepted work, inspect uncertain effects, and block unsafe replacement until cleanup is known. | Reuse existing receipts and operation-safety contracts; prove the complete connected worker path, without claiming exactly-once arbitrary effects. |
| Failure ownership | Return correctable feedback to the active invocation; deliver exhausted/unstartable work to the declared owner, preserving the original obligation. Missing route/recipient stays visible. | Connected recipient-startup/pre-attempt evidence remains separate; saving or admitting a notice does not prove it was handled. |
| Finite closure | Accepted complete finite assignment closes atomically; oversized/rejected/stale/partial/helper results and standing duties do not. Replay preserves that decision. | Component checks exist; the native trial finished its caller Request but left Alex converged/idle with a closure recommendation. Creator closure and end-to-end replay remain. |
| Input and retained return | Attachment generation race, legacy/Topic/late links, closure, deduplication and restart preserve exact caller obligations. | Local repair is running; live delegation, same-Task CI follow-up, caller return and a Telegram send are verified. Restart and addressed durable delivery remain separate proof obligations. |
| Paired adoption | Exact Host/App/Gym revisions pass contract/type checks and a blocked → real producer event → fresh-input → done scenario across restart and background pause, with the same Task and retained evidence. | Local 25-workflow compatibility, activation and the native PR-delivery loop pass. Shared-worker blocked/resumed/finished and restart evidence remain. |
| Single domain Task | One delegated outcome creates one target Task; Conversation needs no wrapper Task; Request-scoped result delivery survives retry, Stop and restart. | Current Conversation still uses a stable execution Task; Hook cutover is unimplemented. |

The immediate next movement is to complete the #574 trial through the owning
May/Alex path, repair demonstrated gaps at their App or generic Host boundary,
and retain explicit interventions. No operator relay of each coding, publication
or CI stage should be needed. Observe a real repair/comment cycle; do not
manufacture feedback or count a historical mirror send as the requested final
notification. Creator closure, restart delivery and shared-worker parity remain
separate acceptance obligations after this trial.

Removal of mechanical housekeeping and Conversation ownership cutover follow
that evidence. Source checks remain separate from wider rollout or an unmeasured
behavior-improvement claim.
