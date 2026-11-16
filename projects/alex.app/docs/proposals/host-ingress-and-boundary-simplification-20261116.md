# Host ingress and SDK convergence: remaining work

**Supports:** [Host/App boundary](../2a-design/system-boundary.md#ingress-task-process-and-bounded-execution). Keeps input ownership, durable Task mechanics and bounded worker execution distinct.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource), [simple first](../1-principles/core-principles.md#simple-first), and [apps own meaning](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics). Share execution and existing caller records rather than adding another lifecycle.

**Design status:** Partially promoted. Established contracts now live in their owning design documents. This record owns remaining integration choices and acceptance gaps.
**Implementation status:** Merged Host baseline `f70f55ab5e3c881838b13419554a4cd3e4276f68` includes #566 and #568–#572. Local follow-up branches repair transactional Task-input fencing and retained Conversation returns, and migrate App SDK imports/contexts. These patches are unmerged. Shared hosted execution, a domain-only development worker with automatic continuation, and single-Task Conversation ownership remain incomplete. Source checks and deployment are separate facts.

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

## Completed source and partial slices

| Original slice | Source position | Remaining scope |
| --- | --- | --- |
| 1 — ingress cleanup | #568 merged | Preserve canonical declared input/control routing. |
| 2 — event journal | #568 merged | This does not remove child SQLite writers. |
| 3 — reads and App identity | #569 merged reads/action removal; local attachment fence | App/Project identity remains; publish and integrate the verified fence. |
| 4 — reconciler modules | Deferred | Optional mechanical extraction after settlement stabilizes. |
| 5a — SDK/shared execution | #566 merged authoring, helpers and settlement component | No production shared-`run()` settlement callers; Host still wraps execution and opens SQLite in the attempt child. |
| 5b — App/Gym adoption | Local SDK context/import migration passes the 24-workflow paired check | Domain-only development and automatic blocked/resume are not established by compatibility checks. |
| 6 — Conversation ownership | #570 removed discovery; local retained-return repair | Integrate the repair before retiring the stable execution Task or adding completion Hooks. |

## Remaining gaps and implementation order

### Integrate the prepared correctness and compatibility patches

The local Host repair restores delivery for retained Topic subscriptions and
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
The paired source check passes all 24 workflows. The earlier 127 diagnostics
remain historical evidence, not the current patch's result. The retained
`develop-change` procedure still needs Host capabilities and intentionally blocks
standalone before effects; compatibility does not complete its domain-input
migration or automatic continuation.

Review and integrate these local patches against their recorded bases before
claiming merged-source completion. The [verification record](../archive/implementation/host-ingress-sdk-source-review-20261116.md#local-correctness-and-compatibility-repair)
records their tests and limits. Continue with the connected worker below.

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

| Gate | Required evidence | Current gap |
| --- | --- | --- |
| SDK semantics | Root worker types and runtime preparation require no Host Task/Conversation identity; explicit coordinator domain tools remain opt-in. | A symbol-name snapshot alone misses Task-bearing nested deferral/CLI types. |
| Hosted parity | Same pinned worker/input/capabilities through standalone and Host; compare prepared messages, tool/finish schemas and first-turn bytes. No Task brief, unrequested tools or `TASK.md` turn. | Real Host caller migration remains; the historical target is less than 5% payload overhead under equivalent inputs. |
| Parent-owned storage | Instrument the attempt process and exercise restart/settlement; zero Host SQLite connections in execution children. | Journal cleanup is not this proof, nor a guarantee that every unrelated SQLite test can never contend. |
| Finite closure | Accepted complete finite assignment closes atomically; oversized/rejected/stale/partial/helper results and standing duties do not. Replay preserves that decision. | Component checks exist; production caller/App eligibility and end-to-end replay remain. |
| Input and retained return | Attachment generation race, legacy/Topic/late links, closure, deduplication and restart preserve exact caller obligations. | Local Host repair covers these cases; integration remains. |
| Paired adoption | Exact Host/App/Gym revisions pass contract/type checks and a blocked → wake → fresh-input → done scenario. | Local 24-workflow compatibility passes; connected blocked/resumed/finished worker evidence remains. |
| Single domain Task | One delegated outcome creates one target Task; Conversation needs no wrapper Task; Request-scoped result delivery survives retry, Stop and restart. | Current Conversation still uses a stable execution Task; Hook cutover is unimplemented. |

The next implementation milestone is to integrate the prepared correctness and
compatibility patches, then connect one hosted domain worker through wait,
recovery and accepted completion. Removal of mechanical housekeeping and
Conversation ownership cutover follow that evidence. Source checks remain separate from any
installation rollout or behavior-improvement claim.
