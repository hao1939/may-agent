# Reliable observer feedback without a subscription system

**Supports:** [Events And Task Admission](../2a-design/events.md). Explores returning provider facts through existing observation and caller ownership.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**September 30 follow-up:** [Task observation contract](../archive/reviews/task-observation-contract-20260930.md)
proposes an agent-facing contract that derives observation needs from existing
Conditions. It records a fresh source review and probes; read it for current
capabilities and remaining gaps. The September 11/13 material below is historical.

## Original proposal and historical implementation notes

**Design status:** Proposed implementation for review, September 11, 2026.
The [feedback contract](../2a-design/execution-feedback.md#execution-feedback-and-agent-wakes)
and [contract-and-convention principle](../1-principles/core-principles.md#convention-over-configuration)
are accepted; the implementation choices below are not yet approved.
**Implementation status:** Source review and a synthetic failure reproduction
only. No runtime changes, provider operations or deployment were performed.

**September 13 source update:** The reviewed Host v3.0.1 (`6935b325`)
already implements the publication-aware snapshot support described below.
The reviewed Scout source still uses its file cache; provider discovery and
end-to-end adoption remain separate work. The earlier status and baseline below
record the original proposal, not the present Host implementation.
[One execution feedback model](../archive/reviews/execution-feedback-and-review.md) owns the
shared contract and immediate CLI progress/status gaps. Review during execution
and automatic fallback are deferred; provider work here does not depend on them.
Do not recreate the implemented Host capability.

## Outcome and stopping point

An agent starts authorized work and receives useful feedback on the same Task
without managing polling, output discovery or per-resource watch registration.
Code executes, observes and preserves evidence; the agent judges meaning and
the next action. These are responsibilities in the existing work loop, not
new services.

Make two bounded improvements:

1. Fix the existing credential observer's lost-feedback path without repeatedly
   invoking the agent for an unchanged failure.
2. Prove one GitHub PR observer discovers resource-carried Task ownership and
   feeds May's existing exact Task route.

Stop when both paths pass the acceptance checks below. Do not expand into a
general watcher platform, a second executor or a rewrite of Task lifecycle.
Source completion and an authorized live trial are separate milestones.

## Evidence: what exists and what is missing

The review used Host `f614edbb`, read in an isolated checkout, and App workspace
`af04c5f8d1`. The canonical Host installation remained at `5857529e` and was not
changed. Herdr `36926c4` supplied the comparison. Refresh these baselines before
implementation; concurrent Task-lifecycle work is not part of this proposal.

| Boundary | Current evidence | Consequence |
| --- | --- | --- |
| Observer execution | `src/app/adapters/producers/app-observer-runtime.ts` schedules bounded-by-adapter reads, publishes returned facts and rejects replaced generations' late results | Reuse it; no new daemon or scheduler |
| Publication | `EventBus.emit` persists first; downstream route failures can be contained without throwing | Judge durability from the existing publication boundary, not a passive listener or completion claim |
| Task routing | `src/app/composition/app-inbox-runtime.ts` accepts exact `{appId, taskId}` targets before broad subscription resolution | Resource feedback needs no new per-resource subscription route |
| Scout credential observer | `scout-knowledge-lib.app/watchers/xhs-credential.ts` writes its state before returning facts; unchanged unavailable state returns no event | Failed publication can permanently hide the current failure until another transition |
| Scout consumer | `xhs-credential-attention` maps unavailable facts to `library-maintenance`; ready facts can satisfy exact Conditions | Publishing every unavailable scan would repeatedly schedule maintenance; suppressing every repeated ready fact would break fresh waits |
| Resource discovery | The reviewed May Host has the generic observer runner, not a convention-based GitHub PR source | Add one provider adapter through the existing App declaration |

The synthetic probe used the actual observer and Host runner, a temporary
directory, an injected credential result and in-memory publication. It performed:

```text
ready -> publication succeeds
unavailable -> publication fails
unavailable -> publication is healthy again

Persisted credential states: [ready]
```

The missing `unavailable` fact reproduced the gap. No credential probe, browser,
real provider or model was called. Preserve this sequence as a regression test
during implementation; this reproduction is not evidence of incident frequency.

## 1. Let the Host advance observation memory after publication

### Small contract change

Give an observer an optional, read-only snapshot of its previous successfully
published observation. Allow it to return a candidate next snapshot alongside
its facts. The Host installs that snapshot only after publication succeeds and
the observer generation is still current.

Illustrative proposed shape, not an available SDK API:

```text
run({ ...existingContext, previousObservation })
    -> { events: AppEvent[], nextObservation: small JSON value }
```

Retain `AppEvent[]` results for stateless observers. The new result form is one
optional SDK capability, not a callback registry or general state service.
An observer reads a defensive copy and returns data; it cannot advance the
Host's snapshot itself. Validate the complete result, including bounded,
JSON-safe snapshot data, before publishing any fact.

The snapshot is **process-local observation memory**, keyed by the existing
App/observer identity. Clear it on restart or definition replacement. It is
not Task authority, a durable subscription list, a queue of undelivered events
or a promise to recover every intermediate provider transition. Adapters
reobserve current source state on the next eligible scan.

Publication rules:

- Before persistence, failure leaves the previous snapshot unchanged. The next
  ordinary scan can report the current state again.
- Once facts are durably recorded, existing event admission/recovery owns them.
  An agent need not run or finish before observation memory advances. Test a
  persisted event whose Task admission initially fails; `emit` returning alone
  must not be described as successful Task handling.
- If a batch partially publishes, retain the previous snapshot and accept that
  re-observation can repeat its published prefix. Preserve Task identity and
  safe effect handling; do not add batch transactions or exactly-once delivery
  machinery merely to avoid an occasional duplicate.
- Late results from replaced or closed generations publish neither facts nor
  snapshots. Already recorded facts remain evidence. Keep the existing
  generation fence; do not add another lock or resume protocol.

Restart or reload may produce one initial observation again. That can mean an
extra Task reconsideration. Accept this cost initially; unchanged change-driven
observations within the same generation stay quiet. Level observations may
repeat for fresh Conditions without waking already satisfied waits. If measured
restart noise later justifies durable suppression, reconsider its storage
boundary separately.

### Apply it to Scout

Keep the existing five-minute cadence, bounded asynchronous credential probe,
ready/unavailable meaning and App/Condition routes. Replace the watcher file
cache, probe marker and their read/write helpers with the Host-supplied snapshot.
There is no shared file for an old module to overwrite; its late return is
discarded by the existing Host generation fence.

| Current observation | Facts to return |
| --- | --- |
| Ready | Return the current ready level, including on later scans, so newly established Conditions can observe it |
| Unavailable, different from the last successfully published state | Return the unavailable fact for the existing owner route |
| Still unavailable after successful publication | Return no fact; no repeated maintenance wake |

Always return the candidate observed state with the batch. A rejected result
or failed publication does not teach the next scan that the notification was
handled. Old cache files become unused evidence; removing installation files
is not part of source implementation.

This small capability also supports a PR adapter remembering resource revisions.
It removes App-owned file coordination while leaving source interpretation in
the adapter. Do not add generic cancellation, seamless reload or durable
observer recovery to this change. Adapter I/O remains explicitly bounded.

### Why this option

| Alternative | Decision |
| --- | --- |
| Keep the current file checkpoint | Reject: it advances before the Host can publish or reject the generation |
| Publish every state on every scan | Simpler recording, but the existing unavailable consumer would repeatedly schedule work; not a complete fix |
| Add an App publication callback that updates its file | Reject: leaves file/reload coordination and delivery bookkeeping in App code |
| Persist a separate watcher queue and checkpoint | Defer: additional storage and recovery are unnecessary for current-state observation with affordable replay |
| Host-held disposable observation snapshot | Recommend: one small boundary improvement reused by both concrete sources |

## 2. Prove resource ownership by convention with GitHub PRs

Start inside the existing Host Operations App (`appId: may-agent`), scoped to
one explicitly configured repository and trusted resource authors. Do not
scan every repository or attach unrelated Apps' work. An ordinary
`observers/github-pr.ts` module is composed through that App's `observers`
declaration. No new Host event route, provider plugin loader or service is needed.
Assign this first watched scope to one May installation. App/Task identities
are not globally unique across independent installations; do not enable the
same scope in several installations and assume the metadata distinguishes them.
A deployment namespace is a later contract choice if that need arises.

Proposed PR-body convention:

```markdown
## May Task
- App ID: may-agent
- Task ID: <existing-task-id>
```

Require one unambiguous block. The creation tool or agent writes it as part of
creating the PR, using its actual Task context. It does not call a watch API.
Human-created or existing PRs are not silently claimed. Do not use branch,
pane or session names to guess responsibility.

The adapter reads authoritative provider metadata within the trusted scope,
checks the allowed App identity and uses the scoped Task reader for the exact
existing Task where needed. The Host remains the final authority on admission
and current lifecycle. A PR author allowlist is a narrow first integration
choice, not a new identity system. A repository allowlist alone does not make
every contributor's metadata trusted, and an author filter is not proof of who
last edited the body. Use a controlled scope whose metadata writers are trusted.
External text never supplies credentials, Host provenance or permission for a
new action.

### What to observe and return

Observe PR head, open/closed/merged state, draft state, check outcomes, and
review/comment changes. Build a stable revision from the declared relevant
provider fields and ownership link, excluding the local polling timestamp.
Read the necessary review/comment identities and updates; do not claim review
coverage from check status alone. Bound requests, returned evidence and the
snapshot. Refuse incomplete state for revision comparison, and expose a
material discovery limit instead of claiming the whole scope was checked.

For a new resource or revision, return an ordinary App fact such as
`github.pull-request.observed`, addressed to its existing App and Task. Include
the scoped resource identity, observed time, source head/revision, bounded
status/review facts and evidence URLs. This is an adapter fact using the
existing envelope, not a new core event family or a public ingress grant.

The candidate snapshot remembers source identity, owner and last published
revision, not full logs, a copy of Task state or a subscriber list. Revalidate
ownership on fresh reads. An ownership change must not be suppressed because
the checks are unchanged; an invalid link must not reuse its cached owner.

Use bounded discovery of open/recent PRs and direct refresh of remembered open
resources, so a PR closing does not disappear before its terminal observation.
Keep a published terminal revision quiet while the PR remains in discovery;
forget it after it leaves that window. After restart, rediscover within the
documented window. A resource that completed outside that window may require
the Task's existing wait review and a direct provider read. Do not promise a
complete provider history or import Herdr's durable checkpoint to cover it.
This is current-state observation, not raw test/metric history collection;
retained execution records remain the evidence for historical reporting.

### Feedback and judgment

The existing event journal and exact Task route carry the fact. If the Task is
busy, retain its input for normal reconciliation; never start another session
or prompt a worker directly. Ordinary progress stays readable without an agent
turn per log line. The resumed agent reads current Task context and the linked
provider evidence, then decides whether to fix, wait, ask or finish.

Put the small response guide with the responsible App agent: reread current
provider authority, distinguish execution failure from outcome failure, check
which head the evidence covers, and report the next useful action or wait.
No provider-specific repair strategy belongs in the observer or event router.

Missing credentials, invalid metadata and incomplete provider reads must be
visible through existing observer diagnostics/logging. Do not translate them
into a passed/failed PR or invent an automatic supervisor-repair workflow.
Stopping the observer stops its reads; it neither cancels nor completes Tasks.

## Verification and acceptance

Use injected providers, in-memory or temporary SQLite and portable fixtures.
Count persisted facts, exact Task inputs and selected executions, not only
messages emitted to a fake listener. Test the boundaries together where the
failure crosses them; reuse existing unit coverage for unrelated mechanics.

| Case | Required evidence |
| --- | --- |
| Lost credential notification | Ready, failed unavailable publication, healthy retry: unavailable reaches the existing owner route |
| Quiet failure and fresh readiness | Repeated unavailable state schedules no new work; repeated ready state can satisfy a newly created exact Condition |
| State recurrence | Ready -> unavailable -> ready -> unavailable reports both outages; permanent state hashes do not hide the second episode |
| Partial publication / route failure | No candidate snapshot hides unpublished facts; persisted-but-unadmitted input recovers with its durable identity |
| Reload / shutdown / restart | Late generation results cannot publish or change memory; restart reobserves safely with documented possible duplication |
| Convention and trust | Valid metadata wakes exactly its named Task; missing, duplicate, untrusted, cross-App or unknown targets cannot create work or choose another owner |
| PR change coverage | Head, checks and review/comment fixtures produce useful revisions; unchanged state stays quiet |
| Resource lifecycle | Closure is observed, changed ownership is revalidated, removed metadata is not cached authority, closed Task is not reopened |
| Bounds and provider failure | Timeout, access failure, truncation and discovery-window limits remain visible without invented resource status |
| Busy Task and useful context | Retained facts and evidence enter the same Task's bounded input; no extra worker or lost input |

After source validation, an authorized isolated live trial should create or
use one explicitly linked test PR, trigger a check/review change, and trace
provider fact -> durable event -> exact Task input -> useful agent response.
Confirm a later unchanged scan produces no redundant turn. Record source
revisions and observed counts; do not claim savings or deployment from fixtures.
Live activation, credentials and external writes are not authorized by this
planning document.

## Landing order and boundaries

1. **Host source PR:** add the optional observer result/context snapshot and
   publication/generation tests in the existing producer runtime and SDK.
   Preserve stateless observer compatibility. No Task lifecycle or EventBus
   rewrite; use a portable consumer fixture to prove the new contract.
2. **App workspace commit:** migrate Scout, remove its file-based coordination
   and add the cross-boundary regression. Activate this App revision only with
   a Host/SDK supporting the new result shape; source merge is not deployment.
3. **App integration change:** add the one GitHub observer and response guide,
   provider fixtures and an activation recipe. The optional source remains
   disabled until trusted scope/access are explicitly configured. Run the live
   trial separately with appropriate authority.

Run affected Host tests/checks and Scout tests, plus `bun run check:may-design`
and the canonical App checks. Coordinate with the separate Conversation/Task
lifecycle proposal; use its merged APIs if they land, but do not implement or
wait for that redesign to fix observation publication.

Keep existing execution/result readers and workflow evidence. This proposal
does not add a dashboard, a second metrics store, general event replay,
per-resource subscriptions, a durable queue, provider retries chosen by code,
another agent role or an alternate worker-wake path. Additional executor
instrumentation needs its own demonstrated missing fact, not a blanket rewrite.

Success means a real feedback gap is closed and one new capability integrates
locally through the shared contract. It does not mean every possible provider
has been implemented or every transient failure is perfectly recovered.
