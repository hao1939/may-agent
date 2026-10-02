# External components: simple, solid, and clearly organized

**Supports:** [Host And App Boundary](../2a-design/system-boundary.md). Repairs specific responsiveness and clarity gaps without expanding every external component.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** First milestone accepted for implementation; follow-ups remain
conditional.
**Implementation status:** The Scout fix and owning documentation are integrated
into the App workspace's `main`. Host #132 and #133 merged as `23968acd` and
`39a23f22`; the three source fixes are complete. See
[candidate evidence](#candidate-evidence). No deployment or live provider trial
was performed as part of this milestone.

## Goal and stopping point

Keep ordinary conversation and authorized work responsive and understandable
at an acceptable total cost. Improve external components only where the change
serves that outcome. Follow the [value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
and [core principles](../1-principles/core-principles.md): start with a simpler
contract, then use the smallest implementation that is robust enough.

The first milestone is three focused corrections: misleading guard wording,
a blocking credential probe, and unbounded Telegram requests. Stop after their
checks pass. The remaining findings are choices for later work, not promised
phases of a seven-part refactor. A known architectural gap can remain documented
when fixing it costs more than its current consequences.

The [system simplification review](authority-boundary-simplification.md#design-choices-before-code-moves)
now compares feature/path reductions before broader organization work. This page
retains ownership of the external decisions below, especially evaluation UI scope.
The later [observer feedback proposal](observer-feedback-and-resource-conventions.md)
owns the separately reproduced checkpoint-before-publication gap and a first
convention-based provider integration. It does not reopen general observer
cancellation or precise restart recovery from this milestone.

## What changed after reviewing the plan

The previous draft treated all findings as required work. It proposed observer
cancellation/reload machinery before inspecting the real consumer, bundled
metric freshness with ownership migration, and preserved advanced evaluation
features without establishing their value. Its directory tree also risked
becoming a file-move checklist.

The narrower decisions are:

| Area | Smallest worthwhile choice | Capability or guarantee we can give up |
| --- | --- | --- |
| Guard | Correct the unsupported sentence | No file-change detection to justify a warning |
| Observer | Fix the actual blocking provider call first | No new general cancellation API, seamless hot replacement, or precise observation recovery |
| Telegram | Bound each request and cancel owned I/O on close | Delayed/missed display and occasional duplicates; no guaranteed delivery |
| Evaluation UI | Prefer viewing retained evidence; keep only operations the App actually supports | Automatic line-trail generation and inline feedback may be disabled instead of rebuilt |
| Metrics | Expose sample time to an existing consumer when needed | No automatic freshness classifier or mandatory catalog migration |
| Collection | Keep one collector; isolate a demonstrated failure at its existing boundary | Startup selection is sufficient; live removal is unnecessary |
| Layout | Document owners and move code when changing that responsibility | No repository-wide directory migration |

Preserve the consequences that matter: accepted asks and Task identity, honest
results, required action checks, and safe handling of committed external effects.
Duplicate presentation can be affordable; duplicate consequential actions may
not be. Removing a feature must preserve its retained data and expose its
unavailability. Revise the owning contract with a behavior change rather than
silently weakening it or treating every existing guarantee as permanent.

## Evidence and its limits

The original Host review examined `0d8c7658` and candidate `0b420287`.
The cited external code was unchanged at subsequently fetched `main` `765ce79c`.
The earlier **79 focused tests across 11 files** passed; synthetic probes showed
that a never-settling observer skips later scans, reload can start another call,
late facts are discarded after close, and metric reads omit sample time.
These facts do not establish incident frequency or prove that a general observer
framework would repay its cost. Source/PR baselines must be refreshed before
implementation; this is not a deployment audit.

The philosophy review followed actual source consumers:

- The App-declaration search found `scout-knowledge-lib.app`'s credential observer.
  Its `watchers/xhs-credential.ts` calls `inspectXhsCredential`, whose implementation
  in `agents/scout/tools/lib/xhs-credential.ts` uses `spawnSync` with a 30-second
  timeout. It runs through the Host observer callback. An asynchronous function
  around that call still blocks the Host; an AbortSignal alone cannot fix it.
- `transport/telegram-client.ts` awaits fetch without an explicit client deadline.
  The surrounding refresh queue retries on later wakes, not an automatic delivery
  backoff loop. The earlier plan overstated that existing capability.
- `src/lib/tools/read-dedup-guard.ts` counts reads but asserts unchanged content.
- Host Operations' `platform-owner-review.ts` uses `ctx.read.metric` in its review
  packet, providing a concrete potential consumer for sample time.
- The [evaluation trail contract](../2a-design/session-eval-trail.md) already records
  that the current Task does not produce the requested HTTP line trail. Preserving
  the UI feature would require more than moving code.

These are source findings, not a census of live usage. Do not call providers,
inspect live credentials, or build a usage-measurement system to complete this
planning exercise.

## First milestone

### 1. Correct misleading guard guidance

Remove the claim that file content has not changed. Keep the observed read count
and advisory meaning in `src/lib/tools/read-dedup-guard.ts`. Do not add hashing,
watchers, or blocking behavior.

**Value/cost:** A tiny edit removes incorrect guidance from a shared execution
path. **Proof:** Run the existing guard tests and review the wording; no new
wording-only test suite is needed.

### 2. Make the existing credential probe nonblocking

Replace the synchronous subprocess with an ordinary bounded asynchronous call.
Keep the current 30-second provider budget and output interpretation initially;
await the result in the observer and its other caller, `scout-explore.ts`, and
update their typed dependencies together. Use synthetic subprocess fixtures.

Keep failure visible and preserve current credential/Condition semantics. A
missed observation can wait for the next ordinary scan. Check that the async
conversion does not make the probe's local cache or a late result override newer
evidence. Use a small local guard or defer a busy replacement if necessary;
do not expand this into a general observer lifecycle or reload redesign.
If safe replacement needs substantial coordination, support replacement after
settlement or restart and document that limitation.

**Value/cost:** This removes a concrete path that can occupy the Host event loop
for up to the provider timeout. It is narrower than adding an SDK signal and
tracking every observer generation. **Proof:** A pending fixture process leaves
an unrelated event-loop callback responsive; success, timeout, and late-result
cases preserve the existing result semantics. Run the affected observer and
workflow tests. Do not run the real credential probe to test the change.

The generic observer deadline/cancellation gap remains documented. Revisit it
when another asynchronous observer needs the same facility or an actual failure
justifies it. Never simulate cancellation by releasing a slot while unbounded
old work continues; a visible stop or delayed replacement is an acceptable limit.

### 3. Bound Telegram I/O without expanding delivery guarantees

Add client-owned cancellation and finite request deadlines in the existing
`telegram-client.ts`; connect them to the bot's existing close path. Start with
one ordinary-request default and a long-poll deadline above the existing
30-second server wait. Choose conservative constants from the current request
paths; the previous draft's exact values were not measured requirements.
Prevent further chunk sends and polling after close. Keep current controls,
provider message IDs, and confirmed-render tracking.

Restrict plain-text resend to confirmed formatting rejection; alternatively
send plain text where formatting adds little value. A timeout does not prove
that a message was not delivered. Keep the current wake-driven refresh behavior:
a later wake may retry an unconfirmed message and produce a duplicate. Without
a later wake, display may remain missing; the durable answer is still readable
through the existing Conversation surfaces. Do not add periodic retry, durable
delivery state, or a second queue to strengthen that promise.

**Value/cost:** Explicit bounds and cleanup improve a normal human channel with
little new state. **Proof:** Local network fixtures cover a stalled request,
long polling, close during I/O, and the distinction between formatting rejection
and uncertain timeout. Existing chunk, refresh, ordering, and Stop tests remain
the contract owners. Accepted input/actions retain their deduplication guarantees.
Update [Telegram notifications](../2a-design/telegram-notifications.md) with the
accepted display limitation; no layout extraction is required for this fix.

## Candidate evidence

Implementation started from Host `765ce79c` and App workspace `8cb0e2dc05`.
The shared checkouts remain on `main`; implementation uses isolated branches.

| Change | Source / review | Evidence |
| --- | --- | --- |
| Truthful guard guidance | [Host #132](https://github.com/hao1939/may-agent/pull/132), candidate `013b7226`, merged `23968acd` | Existing 8 guard tests and full local CI passed: 2,664 pass, 3 deployment-only skips |
| Nonblocking credential probe | App workspace `main`, source commit `2e1b713e09` | All 350 App tests passed, including parser-failure containment; syntax, types, changed-file formatting, projection, links and navigation thresholds passed; see the aggregate-check limitation below |
| Telegram request bounds and close | [Host #133](https://github.com/hao1939/may-agent/pull/133), candidate `280d06ad`, merged `39a23f22` | Focused network, input, refresh, multipart, Stop and integration checks passed; full local CI passed: 2,670 pass, 3 deployment-only skips |

Scout retains its 30-second budget and existing ready/unavailable interpretation.
A temporary marker in its existing cache fences stale results across separately
loaded modules; there is no observer registry or recovery loop. Its full
`bun run check` stops on pre-existing formatting in
`scripts/accepted-source-outputs.test.ts`; the remaining checks were run
individually. That unchanged file is outside this fix.

The first hosted Quality run for #132 timed out in the unchanged browser Stop
fixture while waiting for a diagnostic event. The fixture does not wait for
its WebSocket subscription before publishing. The test passed in local
isolation; the first failure is recorded in the PR and the failed job was
rerun once successfully. Quality and Container passed on both Host candidates.
The first failure remains recorded; the browser fixture still has a potential
subscription race. Check the PRs for later revisions and review results.

Tests use synthetic child processes and local network fixtures. No real XHS or
Telegram call, credential inspection, live App-state operation, restart or deployment
was used as validation. The App fix and Host fixes can land independently.
Workspace integration preserved later `main` documentation changes; the 38
affected Scout tests and `check:may-design` passed again before landing.
GitHub merge state was rechecked September 11, 2026. Both Host fixes are on remote
`main`; the canonical local checkout remains at `743aa5de`. Source integration
does not establish which runtime is deployed.

## Conditional follow-ups

These are alternatives to consider when the first milestone is complete. Each
needs an actual consumer or recurring failure; neither folder symmetry nor an
old backlog entry is enough.

| Finding | Default decision | Evidence that would justify more work |
| --- | --- | --- |
| HTTP owns evaluation instructions and feedback writes | Prefer a read-only trail view and disable unsupported write/generation controls together with their routes. Keep existing artifacts and supported App review operations | Regular use of inline/line-level review that cannot be served adequately by existing conversation/App tools |
| Metric reads omit sample time | If needed by the existing owner-review packet, add last-successful-sample time from retained snapshots; show unknown when unavailable | A consumer needs age to make a better decision; definition-update time must not stand in for sample time |
| Collector attachment is mixed with daemon setup | Keep the implementation; add a small composition/cleanup seam only when omission or failure containment requires it | A fixture demonstrates collector failure blocking unrelated startup/work, or a supported deployment needs collection omitted |
| Central domain metric definitions | Keep the gap visible. Retire unused/noisy metrics; migrate a measurement when its domain owner is changing it | Conflicting writers, repeated calibration problems, or a useful App change makes ownership separation worth the paired migration |
| Scattered executor files | Update the navigation map; group touched backend files in the next real backend change | Repeated edits cross unrelated responsibilities or cause import/wiring mistakes |

The evaluation recommendation is a proposed feature reduction, not an approved
removal or a claim that nobody uses it. Before changing it, inspect known callers
and explain the retained user path. Update the Host/UI and
[HTTP](../2a-design/http-boundary.md)/[evaluation](../2a-design/session-eval-trail.md)
contracts together. Retain historical reads and explicitly reject unavailable
operations; never report an unsaved comment as saved. If retaining the feature
is worthwhile, use the existing Evaluation App route and its state authority.
Do not prebuild a feedback journal, migration bridge, or new retry protocol.
This supersedes the mandatory paired migration in the earlier draft; the
[authority follow-up](authority-boundary-simplification.md#remaining-work) keeps
the underlying ownership gap visible.

Metric sample time, collector cleanup, and catalog ownership are separate
choices. Do not bundle them. Keep one snapshot cadence and the existing metric
service. A raw timestamp plus a clear unknown value may be enough; automated
freshness states and dedicated health storage need their own use. If a metric
migration proceeds, preserve useful history and meaning and remove the old
writer in the same cutover, following the
[ownership rule](design-implementation-convergence.md#remaining-metric-ownership-migration).

## Code organization without a move project

Use the [architecture](../2a-design/architecture.md) and this ownership map.
Existing names need not match the ideal immediately.

| Responsibility | Home for changes |
| --- | --- |
| Accepted work, state consistency, events | Existing core/state/runtime modules |
| Conversation policy and context | `src/app/conversations/`, building on the existing state/handler extraction |
| Concrete executor, producer, reporting, discovery, workspace, maintenance implementations | Their existing `src/app/adapters/` families; flat implementations can stay until a useful extraction |
| Input/output transport | Existing `src/app/transport/` and `http/` files |
| Concrete selection and lifecycle wiring | `src/app/composition/` and existing composition roots |
| Public contracts and human clients | Existing SDK, control, terminal, and Web UI packages |
| Domain probes, prompts, workflows, and acceptance | The owning `projects/<id>.app/` |

Move implementations and tests together only when doing so clarifies the change.
Keep ordinary calls for local reads/atomic operations and events for independent
consumers. No generic plugin interface, new service layer, empty folders, or
compatibility wrappers are needed. Discovery, schedules, workspaces, Console,
skills, and maintenance already have useful boundaries; keep them unless a
specific failure warrants change. Required recovery is not optional housekeeping.

## Review and verification

For each chosen change, state the useful outcome, smallest alternative, accepted
limitation, and focused proof. If it grows into new persistent state, multiple
coordination paths, or a cross-component migration, revisit the feature first.
This is a stopping rule for scope, not a new approval process for routine edits.

Use small independent PRs for cohesive fixes. Keep shared checkouts on `main`
and isolate source edits. Follow the relevant repository checks: affected
fixtures first, full Host `bun run ci` and current Quality/Container checks for
a Host PR, affected App tests for App changes, and `bun run check:may-design`
when contracts change. Pair Host/App revisions only when the actual change
crosses that boundary. Reuse existing regressions; do not add an exhaustive
optional-component matrix or model-backed trial for these mechanical fixes.

The milestone is complete when its three corrections have sufficient proof.
Do not continue through the conditional table automatically. Reliability can
come from dropping a feature, delaying an observation, using another existing
surface, or restarting a faulty optional capability. Additional automation must
repay its implementation, maintenance, compute, and human-attention cost over
its likely useful lifetime.
