# Keep the Host boring and let Apps change

**Decision date:** 2026-10-05

**Status:** Review proposal; no runtime change is authorized by this document.

**October 16 follow-up:** [Strengthen Host contracts while keeping Apps free to evolve](host-contract-improvements-20261016.md)
adds the later review's focused mechanism fixes and recovery trials. This page
retains the release-boundary recommendations and dated October 5 evidence.

**Task:** `alex/input/app_34f89d39-e936-4bec-bff0-6fe0c3537c12`

## Recommendation

Keep the current boundary:

> **The Host owns durable, fenced, observable execution mechanics. An App owns the meaning of work, policy, capabilities, and acceptance; its agent owns the outcome.**

The architecture is substantially right and already supports independent App evolution. The recent volume of Host fixes is mostly stabilization of the same durable Task contract—not evidence that App policy belongs in the Host or that another plugin/controller framework is needed. The smallest valuable next step is to turn the strongest existing lifecycle tests and the real-App compatibility check into one explicit release boundary suite, then fix the stale boundary documentation. Do not rewrite the Task engine, add a registry, or pursue identical syntax across every executor.

A stable Host still receives security, compatibility, performance, and invariant bug fixes. The target is narrower: ordinary changes to an App's agents, tools, workflows, schedules, subscriptions, observers, inputs, and policy should not require a Host edit.

## Evidence scope and revisions

This review distinguishes three independently versioned things:

- **Apps source reviewed:** `e4c882d0d29e8240dba039d30e6ecfceb8dff6dd` in the assigned isolated worktree before this proposal commit.
- **Host source and bundled artifact reviewed/tested:** `cebedfde63240351fad199b587d259003d4e1a6b`; `bundle/may-agent.provenance.json` binds artifact SHA-256 `33b70437b2e2e8a9d7ecf01be91cf8980f53808800c703c550483696fa0ad538` and the same SDK/UI revision. The checkout was clean but two commits behind its recorded `origin/main` (`4f5cf99a3`, `285100b18`); both are test-fixture/release commits, not a reviewed runtime change.
- **Loaded App definitions observed for this execution:** `cbe90c40124c84bb0ac72f43b58a2f2b32489834-definitions-v5`, source commit `cbe90c40124c84bb0ac72f43b58a2f2b32489834`.

The running Host binary revision was not independently queried through its control socket. The matching local bundle provenance is strong source/artifact evidence, not a runtime deployment proof. No live model, Telegram, reload, restart, or production mutation was performed.

## Contract and responsibility map

| Guarantee or choice | Owner | Current source / consumer | Finding |
| --- | --- | --- | --- |
| Validate one App generation and typed input | Host | Host `packages/sdk/src/app.ts`; `src/app/core/apps/`; `src/app/core/inbox/app-inbox-host.ts` | Keep. App declarations load without Host-private imports. |
| Map input/fact to desired work and acceptance | App | `projects/*.app/app.ts`; sample mapper at `projects/sample.app/app.ts:15-47` | Keep. This is policy and varies correctly across Sample, May, Alex, and Scout. |
| Persist input before work and retain exact caller link | Host | `src/app/core/inbox/`, `src/app/core/state/inbox.ts` | Keep; recent journal recovery fixed a real invariant defect. |
| Canonical Task, generation/resource fences, one attempt, atomic settlement | Host | `src/app/core/state/app-task-resource-store.ts`; `src/app/core/tasks/{controller,attempt-runner,app-task-reconciler}.ts` | Keep. This is the dependable core, not App code. |
| Agent/workflow/registered-executor method | Composition + adapter | `src/app/core/tasks/attempt-execution.ts`; `src/app/adapters/executors/` | Keep separate adapters under one Task attempt contract; do not pretend execution internals are identical. |
| Decide continue, wait, converge, or report incomplete | Agent/App worker | SDK `packages/sdk/src/{task,task-contract}.ts`; the invocation's result schema | Keep. Host validates mechanics; it must not infer semantic completion. |
| Durable cross-App request and optional caller interest | Host mechanics; caller chooses interest | `src/app/core/tasks/{task-changes,dependency-admission}.ts`; SDK `TaskChanges` | Keep request/Condition separation. It allows receiver ownership without forcing the caller to stop. |
| External observation and offloaded waits | App defines detector/meaning; Host schedules and retains | SDK `observer.ts`; Host `adapters/producers/app-observer-runtime.ts`; Sample/Scout observers | Keep. The App supplies `inspect`; the Host owns demand, retry, fencing, health, and delivery. |
| Agents, tools, workflows, schedules, subscriptions | App | Agent directories; App declarations; Host discovery/loaders | Keep conventions. A new tool is an agent-local factory; there is intentionally no `AppDefinition.tools` registry. |
| Event admission, retry, and exact Task wake | Host | `src/app/core/events/`; `src/app/composition/app-inbox-runtime.ts` | Keep. A fact starts work only through an explicit route. |
| Interface/provider protocol | Adapter | `packages/control`, `packages/terminal`, HTTP/Telegram and executor adapters | Keep adapter-specific failure semantics visible; do not move provider policy into core. |
| Installation identity and file grants | Installation, validated by Host | `packages/control/src/interface-binding.ts`; `shared/file-write-policy.json` | Corrected by Host #326. Names no longer confer generic privilege. |
| Context selection, role instructions, domain acceptance | App/agent | `AGENTS.md`, skills, workflow code, App context preparation | Keep outside Host. Host supplies current canonical facts and bounded reads. |

Canonical design owners are [Host/App boundary](../2a-design/system-boundary.md), [Architecture](../2a-design/architecture.md), [Task engine](../2a-design/task-resource-engine.md), [Task attempts](../2a-design/task-attempts.md), and the [source-reading guide](../2b-manual/source-reading-guide.md).

## What already works

### App-only extension is real

No Host source edit is needed for the reviewed Apps to vary substantially:

- Sample declares a new input mapper and `documentObserver` in `projects/sample.app/app.ts` and `observers.ts`.
- Alex declares review workflows, event-to-input policy, schedules, metrics, and different agents in `projects/alex.app/app.ts`.
- May maps conversation/goal policy and declares GitHub/metric observers in `projects/may.app/app.ts`.
- Scout declares source workflows, seven schedules, subscriptions, an XHS credential observer, actions, and a local workspace in `projects/scout-knowledge-lib.app/app.ts:409-540`.

The paired compatibility command loaded all four declarations against the reviewed Host SDK with `authoringBoundary: "canonical"` and zero errors. This proves source-level App-only extension and loader compatibility at these revisions. It does not prove each model's judgment or a production reload.

### Handoff, wait, update, and independent progress share one path

`packages/sdk/src/task-contract.test.ts` proves a request can be submitted while converging or paired with a separate caller Condition while waiting/continuing. `task-changes.ts` uses one fenced, transactional admission path for live tools and final declarations; `dependency-admission.ts` saves request lineage, resolves `{requestId}`, and reuses the accepted request after retry.

The focused runtime suite exercised both live-event and recovery return paths for an exact cross-App answer. It also retained original input and independent waits. This is the right mechanism; do not replace it with a second RPC/job lifecycle.

### Failure and transition behavior is strong but was learned incrementally

Focused tests proved:

- persisted App admission recovers from the Event journal after lock/failure;
- exact waits survive restart;
- lost feedback is recovered from saved answers without repeatedly invoking a waiting owner;
- observer publication/admission failures retry without another source read;
- a previous-runtime session becomes interrupted and the same Task is requeued;
- a failed executor process produces a failed attempt and then a completed attempt on the same Task;
- concurrent input does not replace outstanding waits.

The broad focused run completed **298 tests, 0 failures** across the SDK contract, direct-event recovery, inbox runtime, Task runtime, and resource observer suites. These are deterministic fixture/in-process proofs, not daemon crash, OS kill, or arbitrary external-effect exactly-once proofs.

## Why Host edits have recurred

A bounded sample of recent changes shows four different causes. Counting changed files alone would misdiagnose them.

| Host change | Classification | Boundary judgment |
| --- | --- | --- |
| `43161f99d` recover App admission from Event journal (#336) | **Host invariant defect** | Accepted event/admission work must survive lock, restart, and lost acknowledgment. Correct Host fix. |
| `fc3b9cab3` fence new input against concurrent Task writes (#324) | **Host invariant defect** | Atomic version fencing is core. Correct Host fix. |
| `d6ad3a1b0` preserve work evidence across checks/App removal (#337) | **Weak implementation of adequate contract** | The design already required truthful retained evidence; implementation/read filtering lagged. |
| `86e00ee13` preflight explicit result input keys (#335) | **Weak implementation / usability** | Same admission rules now reject knowable errors before the worker exits. No new owner. |
| `797c7ee35` shared Task request admission (#285) | **Legitimate generic capability** | Apps could not dependably submit durable cross-App work through all worker surfaces. The fix reused Task/input/Condition records rather than adding a registry. |
| `169396a40` expose responsible agents in reads/context (#314) | **Generic discoverability gap** | Owner identity is common Task state; exposing it avoids App guessing. |
| `932a6f879` observer polling and receipt links (#276) | **Host adapter/implementation defects** | Demand scheduling and truthful receipt links are Host promises; observer meaning remains App-owned. |
| `0317016b6` Codex resume/correction reachability (#284) | **Executor-adapter parity defect** | Native execution must honor current Task context and correction semantics, but need not share the managed-agent implementation. |
| `11c563f6f` move installation policy out of runtime (#326) | **Boundary/migration correction** | Hard-coded installation names and Gym/Evaluation policy were unnecessary Host policy. Moving declarations to Apps/config was correct. |

The pattern is not “Apps need more Host internals.” It is that a broad durable state machine acquired its transition coverage over time: failure before Task creation, failure after accepted result but before caller feedback, concurrent input, adapter interruption, and history growth. Recent fixes generally strengthened shared invariants and added regression tests. The one genuine extension (#285) stayed narrow and reused existing records.

Two counterexamples prevent overclaiming:

1. A synthetic probe invoked the ordinary `message` tool twice and observed two `message.created` records with no idempotency key. This is **not** a violation of durable Task delegation because the tool explicitly records a one-way fact and promises neither durable work nor retry-safe delivery. Use Task requests/communication when that promise is required. Defer a Host change until a real one-way-message operation needs retry identity.
2. Arbitrary shell/provider effects are not made idempotent by Task admission. Each capability must own or disclose its effect boundary. Do not advertise exactly-once semantics.

## Gaps

### G1 — Boundary evidence exists but is not presented as one release contract

**Type:** verification/release gap; Host owner with paired Apps CI input.

The strongest tests are spread across large suites and recent PRs. `scripts/check-canonical-app-boundary.ts` mostly rejects retired authoring patterns; `verify-app-artifact-compatibility.ts` proves definitions bundle/load. Neither alone proves the essential transitions. This makes reviewers rediscover which tests establish the boundary and allows a generic API change to look safe while a recovery path differs.

### G2 — Current boundary documentation contains stale deployment language

**Type:** documentation/adoption gap; Alex docs owner.

`system-boundary.md` still says the October 4 #326 candidate is “not deployed” and lists domain-policy gaps, while `app-policy-and-host-boundary-cleanup.md` records verified rollout and the reviewed bundle is later. It also describes a 30-minute hosted default without qualifying the current Task managed-agent path, whose reviewed source supplies a 15-minute bound (`attempt-execution.ts` to `managed-agent.ts`). Source, loaded definitions, and runtime deployment remain distinct, but contradictory or over-broad current-design statements are avoidable. Correct the current page to point at the verified rollout, qualify executor-specific limits, and retain only genuinely unresolved items.

### G3 — Cross-repository compatibility is checked manually rather than as a paired release gate

**Type:** release/migration gap; Host release owner + Apps release owner.

The compatibility script already accepts explicit Apps and SDK roots and successfully loaded all four real Apps. The missing part is consistently running it for a proposed Host SDK and the intended Apps revision before activation, then retaining the identities in the release receipt. No new compatibility registry or semantic-version negotiation is needed.

### G4 — Some public operation semantics remain capability-specific and easy to misuse

**Type:** documentation/discovery gap, not a universal API defect.

Task requests, Task-scoped emits, message facts, bounded helpers, and native adapters have intentionally different lifetimes. The contracts are accurate but distributed. Add or refine operation descriptions only where a real caller confused “recorded,” “accepted,” and “fulfilled.” Do not force a universal result envelope or identical executor surface.

## Ranked recommendations

### 1. Make a small Host boundary contract suite mandatory — first tranche

- **Problem:** regression evidence is comprehensive but scattered; recent fixes repeatedly added the missing transition test after a defect.
- **Owner / classification:** Host; verification and implementation-hardening gap, not a design rewrite.
- **Smallest remedy:** define one existing test command (or a thin script that invokes existing named tests) covering: App artifact load; request versus Condition; live and recovered cross-App answer; Event-journal admission recovery; concurrent input/wait coexistence; interrupted session requeue; executor failure/same-Task retry; observer failure/recovery. Run it in Host Quality/release CI. Do not duplicate test bodies.
- **Benefit:** makes the stable promise reviewable and catches transition regressions near the change.
- **Cost/risk:** low; the 298-test local run took about 45 seconds, but CI can use the smaller named subset demonstrated by the 4-test trace.
- **Simpler alternative:** document the exact existing commands only. Start there if CI time is constrained.
- **Verification:** fail one invariant in a temporary branch and prove the suite fails; restore and prove green. Retain Host commit, SDK tree hash, and Apps commit.
- **Migration:** none to stored data or Apps.

### 2. Run the existing real-App compatibility verifier at the paired release boundary — first tranche

- **Problem:** SDK/definition compatibility can drift across separate repositories and revisions.
- **Owner / classification:** Host and Apps release owners; release/migration gap.
- **Smallest remedy:** invoke existing `verify:apps-artifact` with the proposed SDK root and exact Apps root before reload/deploy; store its JSON result or hashes with the activation/deployment receipt.
- **Benefit:** proves canonical loading of actual Apps without granting Host knowledge of their policy.
- **Cost/risk:** low; no new registry. A false failure is explicit and pre-activation.
- **Simpler alternative:** require the command in the rollout checklist without automating it.
- **Verification:** four current Apps load; an intentionally incompatible fixture fails, as `verify-app-artifact-compatibility.test.ts` already demonstrates.
- **Migration:** existing incompatible Apps must update declarations before activation; retained old definition generations remain untouched.

### 3. Reconcile the current boundary page with verified #326 adoption — first tranche

- **Problem:** current-design and implemented-proposal pages contradict each other.
- **Owner / classification:** Alex documentation; documentation/adoption gap.
- **Smallest remedy:** update only the stale implementation/source-adoption paragraphs and link the rollout receipt/proposal. Keep explicit source/runtime distinction.
- **Benefit:** prevents unnecessary repeat investigation and accidental reintroduction of name-based policy.
- **Cost/risk:** trivial; risk is overstating live deployment, avoided by citing exact receipt/revisions.
- **Simpler alternative:** add a dated correction note; editing the owning current page is clearer.
- **Verification:** `bun run check:may-design` and link check; reviewer compares current page with `app-policy-and-host-boundary-cleanup.md` and bundle/definition identities.
- **Migration:** none.

### 4. Require an invariant label and existing-suite pointer for Host Task/Events PRs — next, only if useful

- **Problem:** a change can appear App-specific or local while altering a common transition.
- **Owner / classification:** Host contribution practice; documentation/review gap.
- **Smallest remedy:** in the existing PR template, ask which invariant/adapter boundary changes and name the test. No new approval body or recurring review loop.
- **Benefit:** improves review focus and discourages special cases.
- **Cost/risk:** very low, but process fields can become ritual.
- **Simpler alternative:** add this to reviewer guidance only. Prefer that unless omissions continue.
- **Verification:** sample three later PRs; each either names a boundary test or says “no shared invariant change.”
- **Migration:** none.

### 5. Defer broader capability unification and new coordination machinery

- **Problem claimed:** workers use different syntax/surfaces and one-way messages are not durable requests.
- **Owner / classification:** no demonstrated design defect requiring work now.
- **Decision:** **do nothing** beyond accurate capability descriptions and actual adapter needs. Preserve the existing TaskChanges foundation and [capability proposal](task-execution-capability-contracts-20261003.md), but do not create a universal dispatcher, operation registry, watcher registry, exactly-once layer, or caller-managed retry protocol.
- **Reason:** existing App paths and tests already support the requested extension cases. Uniform syntax would hide meaningful lifetime/cancellation differences and add another compatibility surface.
- **Revisit when:** a concrete App assignment cannot be expressed through current typed input, Task request, Condition, observer, workflow, or local tool, with a reproducible gap.

## First tranche acceptance

The first tranche is complete when one reproducible release check, using existing infrastructure, proves all of the following for pinned Host/SDK and Apps revisions:

1. canonical App artifacts for Sample, May, Alex, and Scout load without retired/private APIs;
2. an App-only observer/input/policy change needs no Host edit;
3. a request is accepted once, a caller Condition is optional, and the exact result returns after live delivery and after recovery;
4. new input, independent waits, failures, and accepted progress coexist without erasure;
5. an interrupted session and a failed executor retain evidence and resume the same Task without overlapping claims;
6. observer failure stays visible, unrelated work proceeds, and repaired observation resumes the retained wait;
7. the current design page and release receipt name the exact reviewed/activated revisions.

Suggested existing commands (paths relative to `/app/projects/may-agent`):

```sh
MAY_AGENT_VERIFY_APPS_ROOT=/path/to/apps/projects \
MAY_AGENT_VERIFY_SDK_ROOT=$PWD/packages/sdk \
bun run verify:apps-artifact

bun test \
  ./packages/sdk/src/task-contract.test.ts \
  ./src/app/composition/direct-event-recovery.test.ts \
  ./src/app/composition/app-inbox-runtime.test.ts \
  ./src/app/core/tasks/app-task-runtime.test.ts \
  ./test/integration/resource-observer.test.ts
```

For a faster review case, select the existing named tests for cross-App return through event/recovery, previous-runtime requeue, and executor-process retry. The full focused command above was the bounded evidence used in this review.

## Unverified assumptions and limits

- No hard Host kill/restart experiment was run; restart behavior here is deterministic process/database reconstruction in tests.
- No external provider effect was interrupted after commit but before acknowledgment; safe retry remains capability-specific.
- No live App reload or model judgment trial was run; compatibility and mechanics do not prove behavioral quality.
- The running daemon revision was not independently read back; local bundle provenance is not a deployment receipt.
- Origin's two newer commits were inspected by identity/summary only, not included in the focused test revision.
- Test success proves covered invariants, not every transition or future schema migration.

## Bottom line for Hao and May

Do not respond to recent Host churn with another architecture layer. Keep the accepted Host/App boundary and the existing Task/input/Condition machinery. Spend the next small tranche on making the already-good invariants a visible release gate, checking real Apps against the exact SDK, and removing stale documentation. After that, require new Host work to point to a common mechanical invariant; otherwise implement the change in the App.
