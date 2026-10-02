# Task observation: declare the interest, supply the detector

**Supports:** [App Contract](../2a-design/agent-app.md). Proposes how an agent states an interest and infra wires the App detector through existing Conditions.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#convention-over-configuration); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Original proposal, followed by a nine-scenario POC and the
[implementation candidate](task-observation-implementation-20260930.md).
Use that record and the current App/SDK contracts for the implemented API and
recovery limits; the sketches below preserve the earlier discussion.
Source baseline: Host `de59c8dae9`; App workspace
`2822eacf9d`. The proposed convenience API below is deliberately distinguished
from the current SDK. The existing [App observer contract](../2a-design/agent-app.md#request-entrypoints-schedules-and-observers)
and [Task Conditions](../2a-design/task-resource-engine.md#conditions) remain authoritative.

## Recommendation

An agent describes **what matters**. An App supplies **how to detect it**.
Infrastructure connects them through the existing Task:

```text
Task Condition: which resource, what evidence matters
                         |
Host selects the installed detector and reads that resource
                         |
detector returns observed data
                         |
Host records the fact, updates matching Conditions and retains Task input
                         |
Task's current worker reconsiders the new evidence
```

The agent needs no event envelope, subscription registration, destination Task
ID, callback, polling loop, wake call or retry procedure. Adding a Condition is
enough to express an interest; removing or satisfying it removes that demand.
The same Task can retain other waits, partial results and independent work.
The detector also needs no knowledge of Tasks: it reads a resource and returns
what it observed. Mechanism belongs to the Host/SDK; source semantics belong to
the App. The event is an internal connection the agent can inspect for diagnosis,
not something the agent must assemble to use this capability.

Use **observer** consistently for the extension. Do not add a separate waker,
watch resource, callback registry or Task lifecycle.

## Two authoring contracts, one lifecycle

### 1. Task worker: state the interest

Keep the existing Condition/result vocabulary. A worker waiting for a submitted
build could return this existing-style result:

```ts
{
  state: "waiting",
  summary: "The build is submitted; review its terminal result.",
  facts: ["Build acme/widget/42 was submitted."],
  conditions: [{
    id: "build-result",
    type: "build.state",
    subject: "build:acme/widget/42",
    expected: { field: "state", anyOf: ["passed", "failed", "cancelled"] },
    owner: "app:builds",
    reviewAfterMs: 3_600_000,
  }],
}
```

This is an illustrative source contract, not an installed `builds` App. Notice
that a failed build is useful evidence too. The worker decides the consequence;
matching the Condition does not make the enclosing Task successful. If useful
independent work remains, the existing `continue: true` result can retain the
Condition and request another pass. A worker can express interest in a new
revision using an existing expected-field comparison, rather than a new kind
of task or message.

The installed capability describes its resource reference and observation
fields. The worker selects that capability and the expectation; Host identity,
correlation and bookkeeping are implicit in its current Task scope. Typed App
dependencies keep their existing result-return path and do not need an observer.
An unsubmitted operation remains work to do; declaring a wait does not start it.

### 2. App author: supply a bounded detector

Proposed ergonomic shape, **not an existing import or final SDK signature**:

```ts
export const buildObserver = defineObserver({
  id: "build-status",
  type: "build.state",
  intervalMs: 60_000,
  timeoutMs: 10_000,
  async inspect(subject, { signal }) {
    const build = await provider.readBuild(subject, { signal });
    return { state: build.state, revision: build.revision };
  },
});

// Declare the capability in the existing App definition:
// observers: [buildObserver]
```

`provider.readBuild` is App code: it knows the provider, validates and parses
the documented resource reference, uses installed credentials and reads within
configured scope. It does not launch the build or choose an agent. Installation
binds the observer to its App identity; callers cannot select arbitrary code.
An ordinary authorized App change adds a new detector, runs checks, commits and
activates it. Everyday use of an installed detector requires no code change.

The infrastructure-supplied helper hides demand enumeration, pagination,
deduplication of resource reads, scheduling, source provenance, event construction
and failure reporting. Keep this in the SDK/Host, not copied App utilities.
Prefer adapting the existing observer runner and publication boundary over
creating another execution engine. Raw observers remain an integration surface
for sources that discover unsolicited facts or receive webhooks; normal task
workers should not need that lower-level contract.

## How infrastructure wires it

1. **Save the interest on the Task.** Existing result admission records the
   Condition and its owning Task atomically. Keep Condition generation and
   independent obligations; do not write a second watch-registration record.
2. **Derive observation demand.** Use the existing indexed Condition routes to
   select open, relevant subjects for an installed source. Bind by the declared
   source App and fact type, with its permitted scope. Deduplicate identical
   source/resource reads across interested Tasks. Do not scan every Task or
   give a detector another App's full Task context.
3. **Read current source state in code.** A newly admitted interest needs an
   initial observation even when no provider transition occurs. The implementation
   requests a prompt check after a committed Task result, using the same observer
   path; periodic slots cover missed notifications or failed checks. Thereafter,
   bound reads, page work fairly and respect provider limits. Task records stay
   authoritative; any derived work list is disposable.
4. **Publish through the existing durable boundary.** Infrastructure supplies
   source identity and exact subject correlation, then sends
   ordinary facts through existing publication/admission. Host timing remains in
   the envelope/health; provider fields such as `observedAt` retain their meaning.
   Only `resource` is reserved for the requested reference. The detector returns
   observed values, never a destination agent or fabricated Host provenance.
   Match exact resource identity, not event type alone. A single read can serve
   several Conditions while each Task retains its own handling responsibility.
5. **Reconcile the existing Task.** An eligible idle Task gets a normal attempt.
   An active worker gets supported feedback or sees durable pending input on a
   later pass; no competing attempt starts. The worker gets the changed fact,
   linked evidence, current result and other obligations in normal Task context.
   A notification is a hint; accepted handling is recorded through the ordinary
   fenced result contract. Agent, workflow and executor retain natural interfaces.
6. **Retain accountability on failure.** Source failure, missing capability,
   stale evidence and delivery failure are separate observations alongside the
   wait. Reuse observer failure facts, admission recovery and Condition review.
   The owning App diagnoses uncertain failures. Only an actual human decision
   becomes a human-owned Condition and notification through the existing `/todo`
   and conversation path; an observer error alone is not a human request.

No requirement to discover a working producer should cause a real wait to be
discarded. A webhook, a human or another valid source may still satisfy it.
Likewise, one failed read must not remove prior evidence or unrelated work.

## Discovery is part of the contract

Today `tasks.contract` returns the installed App input schema. It does not tell
the worker which observations that App supplies. A useful extension should
expose a small observation section through that existing installed-contract
read, derived from the loaded declaration, with:

- fact type and source App;
- resource-reference convention and supported scope;
- observed fields and a working Condition example;
- observation interval, freshness meaning and material limits;
- link to the source's authoring/usage guide.

The proposal does not require all of this to become new enforced schema. Start
with a compact descriptor and linked guidance, checked against the actual
example. Host-known declaration identity/cadence and latest run evidence should
not be hand-maintained in prose. Missing health evidence means unknown, not
healthy. Keep the initial worker prompt short: point to the installed contract
and fetch detail when needed.

The normal Task view should explain: what is awaited, which installed capability
can observe it, last available observation/failure and next recovery checkpoint.
Derive this from existing Conditions, loaded definitions and runtime evidence.
There is no new dashboard or independent status database in this proposal.

## What already works, and the actual gaps

| Boundary | Current source evidence | Proposal |
| --- | --- | --- |
| Durable interest and routing | Conditions and normalized Task links; event-type/subject indexed lookup in `app-task-resource-store.ts` | Reuse it as observation demand; do not register a separate watch |
| Observer execution | `AppObserver` has `id`, `intervalMs`, `run(context)`; the Host runs it and publishes returned `AppEvent`s | Add a small authoring facade so a detector returns values without event or routing knowledge |
| Discovery | `getLoadedAppInputContract` returns only App ID and input schema; observer context exposes general scoped reads | Expose observation capability descriptions; derive bounded demand inside infrastructure |
| Publication/reload | Snapshot advances only after durable publication; old-generation output is fenced; snapshot resets on reload/restart | Preserve this; reobserve current state instead of restoring a second queue |
| Translation recovery | Current source persists unresolved commands before translation and isolates App routes | Already repaired; reuse it, including later retry without producer re-publication |
| Read liveness | Runner suppresses overlap but has no shared run deadline; provider adapters own I/O bounds | Prototype a cooperative signal/deadline in the shared facade; a hung detector must become visible |
| Freshness | Matcher still gives special treatment to `.state`, `.check`, pulse names and one domain event | Document explicit source validity; use existing expectations for required revision/time, then migrate implicit naming policy with evidence |

This is primarily an **extension-contract and usability gap**, with concrete
liveness and freshness implementation concerns. The durable Task mental model
fits; rewriting reconciliation would not address the missing authoring surface.

### Important tradeoffs

- **Quiet polling versus new interest.** Suppressing unchanged values forever
  can strand a newly created wait. First prove current-state reads satisfy new
  Conditions and duplicate level facts do not cause repeated model turns. Only
  then optimize publication volume with the existing snapshot. Event receipt
  identity is not a blanket semantic deduplication guarantee.
- **Current state versus complete history.** A restart can re-read the provider's
  current state. It cannot reconstruct every transient transition without source
  history. Declare which the source offers; most readiness waits need current
  state. Avoid imposing a durable provider cursor on every detector.
- **Deadline versus cancellation.** `Promise.race` alone leaves underlying work
  running. A shared deadline must signal cooperative I/O and fence late output.
  Arbitrary JavaScript cannot be forcibly stopped in process. Noncooperative
  code remains an explicit failed capability, not an excuse to launch unlimited
  overlapping retries. Process isolation is deferred until evidence justifies it.
- **Cheap reads versus model reviews.** Observer cadence does source polling in
  code. Condition `reviewAfterMs` remains a recovery backstop and can invoke a
  model. Do not claim every retained wait is cost-free.
- **Ownership versus authorization.** Condition owner and provider metadata name
  responsibility; they do not grant provider credentials or repair authority.
  Shared sources disclose only permitted observations, not other Tasks' context.

## Evidence gathered for this proposal

The existing observer runtime and Condition-review suites passed **22 tests**
on `de59c8dae9`, including failed publication, partial batches, generation
replacement, independent waits and paced due reviews.

Three isolated probes were also run; no live provider or model was involved:

| Probe | Observed result | Limit |
| --- | --- | --- |
| One observer Promise never settles; scan eight successive due slots | One invocation; zero failure facts; later slots skip the still-running observer | Reproduces missing shared liveness enforcement, not a live outage |
| Same old ready data under different event names | `.state` does not match; `.observed` matches; explicit `observedAt` expectation rejects old data | Confirms hidden naming policy, not a proven incorrect production result |
| One healthy and one throwing translator; repair and let recovery scan run | Healthy input proceeds; later due scan admits repaired input; runtime recreation and explicit replay leave exactly one input per App and one original event | Confirms the older admission defect is repaired; not a whole-process crash test |

The admission experiment deliberately refreshed the September 27 probe: its
old failure assertions no longer hold. Retained local probes/receipts are under
`/app/.state/review-pilots/observer-contract-20260930/`; the original reproducible
fixtures are in the [boundary review](../archive/reviews/resource-event-boundary-20260927.md#reproducing-the-probes).
The [quickstart trial](../../../sample.app/reviews/sdk-quickstart-2026-09-30.md)
separately proves review/correction and activated guidance adoption. It does not
prove external observation or the proposed facade.

Scout's [unattended execution lessons](../../../scout-knowledge-lib/knowledge/agent-runtime-unattended-execution-and-replay.md)
and [effect reconciliation review](../../../scout-knowledge-lib/knowledge/findings/2026-09-29-durable-browser-agent-effect-reconciliation.md)
support keeping cadence, actual success and effect uncertainty separate. These
are retained source reviews, not independently reproduced benchmarks here.
Borrow those boundaries; an observation helper does not need another workflow
engine or a second operation ledger.

## Options and cost

| Option | Value | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Document current raw observers only | No runtime change | Every author still assembles facts, discovers resources and handles liveness; worker cannot reliably discover capabilities | Useful baseline, insufficient for the requested experience |
| Thin observer facade backed by existing Conditions, runtime and admission | Worker states interest; detector only reads; existing recovery remains authoritative | Small SDK/Host work for demand selection, descriptor readout and bounded execution; needs transition tests | Recommended |
| New dynamic watch service with register/cancel, subscriptions and callbacks | Flexible independent watcher lifecycle | Duplicates Task Conditions and ownership, adds cleanup/recovery obligations | Do not build now |
| A model periodically checks each wait | Easy initial setup | Consumes capacity on unchanged state; hides missing producer coverage | Keep only bounded diagnostic fallback |

The facade must remove App plumbing in a measured example. If it merely adds
another API while App code still handles routing, retries and bookkeeping,
reject that implementation. Do not replace existing unsolicited provider
discovery with demand-only polling: those sources can reveal work no Task yet
knows to ask about, through existing App mapping.

## Small implementation sequence and acceptance

1. **One checked vertical example.** Prototype the facade with a local fake
   build provider and an existing sample Task in an isolated Host. One worker
   declares interest; one detector returns data. Keep the example separate from
   the live sample's document-review behavior until the contract is reviewed.
2. **Prove the connections.** Two Tasks care about one resource; one also retains
   another wait and partial output. Count provider reads, Task attempts and
   accepted handling. Try interest before/after readiness, failure/cancellation,
   unchanged reads, active execution, retirement, publication failure and restart.
3. **Add only necessary infrastructure.** Reuse the indexed store and observer
   runner. Expose capability descriptions through existing reads; keep domain
   parsing and interpretation in the App. Validate generic subject encoding at
   the shared matcher boundary rather than teaching every author its aliases.
4. **Try authoring without coaching.** Give Bob the installed capability contract
   and a small detector task. Success means he neither opens Host internals nor
   implements event envelopes, routes, wake calls or Task storage. Inspect the
   returned evidence; a compiled plugin alone does not prove the experience.
5. **Migrate one real source only if simpler.** Compare the existing PR or
   credential observer with the facade. Record removed plumbing, required
   domain code, latency, reads, duplicate attempts and failure visibility.
   Then update canonical SDK/App manuals with what was actually proved.

Required invariants: retain every admitted interest on its Task; keep independent
facts and obligations; route matching evidence through existing durable admission;
fence stale output; expose failed observation; let the worker judge the outcome.
Cadence, default timeout, descriptor detail, polling versus webhook, batching and
provider history remain guidance or App policy until the trial gives evidence.

The stopping point is a demonstrated low-plumbing contract and one working
source, not a universal watcher platform. Review this proposal before committing
to the new public API or enabling an experimental detector in the live Host.
