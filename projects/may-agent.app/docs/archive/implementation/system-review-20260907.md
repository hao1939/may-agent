# May whole-system review — 2026-09-07

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Source-review evidence, not a new design authority.

## Conclusion

May's core design is sound. Keep the one App-owned Task and bounded Host
execution path. The best next simplifications remove misplaced responsibility,
not merely lines or files. Do not replace this with another framework.

The most concrete finding is that a metric collector repairs the evidence it
measures. Full App checks also expose failed Evaluation reviews being reported
as converged; correct that outcome boundary before moving evaluation out of HTTP.
Documentation and cross-repository delivery also need attention: a green Host
PR does not mean the companion Apps and design updates have reached main.

## What was reviewed

- Host source at `2c6da773` (May PRs #63–#67 are merged).
- App source at `6237bd7e60`, plus the separate companion branch at
  `9ae692e344` for recent design/Gym changes. These are different snapshots,
  not one deployed release.
- The observational-metrics fix is committed as `5bfcd6cb6a` on top of App
  main, independently of those pending companion changes.
- The system model, principles, Host/App boundary, work model, composition,
  Task engine, human surfaces, HTTP, metrics, scheduling, and active convergence
  tracker, traced against their main implementation paths.
- Local Host verification, App manifest loading, paired workflow/maintenance
  compatibility, and the Host Operations App check.

This is an architectural source review, not a line-by-line audit of every file.
It did not inspect live Task state, run model-backed conversations, deploy,
restart May, or certify user-visible behavior in production. Existing dirty
files in `/app` were not used as a release candidate or modified.

Source paths below are relative to either the Host repository or the App
repository. Design authority remains in the current documents linked by
[INDEX](../../INDEX.md); unfinished work remains in the existing
[convergence tracker](../../proposals/design-implementation-convergence.md).

## The path to preserve

```text
human / adapter / scheduled event
  -> durable event admission
  -> May understands a turn, or an App resolves its input
  -> one Task owned by the responsible App
  -> Host schedules one fenced, bounded attempt
  -> App accepts the result, waits for an exact fact, or continues
  -> Host persists the outcome
  -> Conversation and Task views inform the human
```

May's conversational decision can finish without creating a Task. That is an
intentional exception for understanding and answering a turn, not permission
to run destination work in the adapter. A request correlates input; a session
records an attempt. Neither should become another work lifecycle.

## Assessment by responsibility

| Area | Finding | Source evidence |
| --- | --- | --- |
| Composition and ingress | The main wiring is explicit. Optional interfaces wrap shared admission/control. Preserve this; do not introduce a service locator. | Host `src/app/app-runtime.ts`, `interface-startup.ts`, `event-interface.ts` |
| Request and Task ownership | Requests link to Tasks; the admission coordinator persists work before waking controllers. Recovery retains exact identities. | Host `app-inbox-runtime.ts`, `app-inbox-host.ts`, `task-admission-process.ts` and their tests |
| Scheduling and execution | Shared capacity, isolated Task workers, generation/attempt fences, and exact waits solve real concurrency/restart problems. Their existence is not accidental complexity. | Host `app-task-controller.ts`, `task-attempt-process.ts`, `app-task-runtime.ts`, `app-task-reconciler.ts` |
| Persistence | Installed Task descriptors require resource authority. Remaining JSON import/fixture support is not evidence of a second live store. | Host `app-task-resource-store.ts`, `app-task-store.ts`, `app-task-runtime.ts` startup checks |
| Human interaction | Conversation, Topic links, and exact Task reads provide the intended shared context. Automated coverage exists, but natural-language usefulness still needs a separate authorized scenario evaluation. | Host `app-inbox-runtime.ts`, `human-task-service.ts`, control/terminal/Telegram packages |
| HTTP | Evaluation prompting and direct feedback-file writes still live in the adapter. This violates the intended thin-adapter boundary. | Host `src/app/http/server.ts`, `handleSessionEvalGenerate`, `handleSessionEvalComment` |
| Observation | The snapshot handler inserts missing lifecycle events before reporting its mismatch count. It can conceal missing evidence. | Apps `projects/may-agent.app/agents/tech-lead/handlers/metrics-snapshot.ts` |
| Acceptance | Evaluation's owner-review fallback preserves child state but reports an invalid result or failed executor as a converged review. Preserving state is not proof that the review succeeded. | Apps `projects/evaluation.app/agents/evaluator/workflows/evaluator-heartbeat.ts`, `fallbackResult`, `normalizeAgentResult`, `execute` |
| Integration and delivery | Portable Host tests, paired App checks, and image smoke have distinct scopes. Companion design/Gym commits remain off App main. | Both repositories' check scripts, contribution policy, and branch history |

Large modules remain: `app-task-runtime.ts` is 4,963 lines,
`app-task-reconciler.ts` 4,273, and HTTP `server.ts` 4,298 at the reviewed Host
revision. Splitting files alone would not reduce the responsibilities or runtime
cost. Extract a module only around an identified responsibility, with no new
lifecycle or generic framework.

## Findings and next steps

### 1. Keep measurement separate from repair — implemented on this branch

The snapshot handler searched for terminal sessions lacking `session.end`,
inserted up to 50 synthetic end events through raw SQL, then recomputed the
finding. Those rows bypassed normal event publication and had no source or
indexed session identity. In a fixture with one missing end, measuring the
problem concealed it instead of leaving it visible for investigation.

The fix removes that insertion/recount block. Repeated measurements now leave
session/event evidence unchanged and keep the mismatch visible. When matching
end evidence subsequently arrives, the next measurement reflects it normally.
No replacement worker, queue, repair service, or scheduler was added.

The new regression fails on unmodified App main for all three terminal states
(`done`, `error`, `interrupted`), then passes with the fix. It also checks repeat
samples, preserved stored evidence, later end evidence, and a running session.

This does not diagnose why a live session might lack an end event or backfill
history. Host lifecycle/recovery code still owns that investigation and any
authorized repair. Existing synthesized rows are preserved. The metric still
uses its existing recent window and 5,000-session bound; it is not an exhaustive
history audit. A higher observed count after rollout may expose old hidden
findings rather than indicate a new execution failure.

### 2. Make failed Evaluation reviews honest — next correctness change

The full Evaluation check produced **104 passes and three failures**. Its
heartbeat fixtures still omit required Condition owners/review intervals or use
the noncanonical owner `evaluator`. Current SDK validation correctly rejects
them. This was not detected by manifest loading or workflow compilation.

There is also a production acceptance gap, not just stale tests:
`fallbackResult` returns `state: "converged"` for invalid structured results and
failed executions, and `execute` returns `ctx.done(...)`. The existing tests
explicitly accept that fallback. Desired child state is preserved, and failure
events/evidence are recorded; this does not falsely complete the children.
However, the review itself is shown as converged without a successful review.

Do not weaken Condition validation or only edit fixtures until tests turn
green. Update valid fixtures to canonical identities and recovery intervals,
and route invalid/failed attempts through the existing non-success execution
result so the Host can expose attention/recovery. Keep a genuinely justified
no-op as successful. Test both distinctions and preserve exact child state and
evidence. This needs no new review coordinator or retry loop.

No Evaluation source was changed in this branch. It is the next scoped fix,
ahead of the larger adapter-boundary change.

### 3. Move evaluation meaning out of HTTP — subsequent paired change

`handleSessionEvalGenerate` constructs a detailed evaluator prompt in the Host.
`handleSessionEvalComment` appends directly to `session.eval.jsonl`, outside
the event ingress path. The latter was confirmed by code inspection, not an
HTTP failure reproduction. The Evaluation App already consumes
`evaluation.session.requested`, so use that existing ownership boundary.

Keep the current user-facing controls. The adapter should validate identifiers
and publish structured input. Evaluation should own interpretation and feedback
evidence. Do not simply move HTTP functions into another Host file or start a
new generic command bus.

Before implementation, define whether feedback is a record-only fact or a
request with a promised result. Test exact session/line identity, replay and
retry behavior, malformed input, and failure visibility through the real HTTP
and App path. Publish compatible paired Host/App revisions and state rollout
order; preserve the current UI until that path is verified.

### 4. Make the reviewed version unambiguous

The companion branch at `9ae692e344` includes ten commits beyond its common
base with App main, covering design plus a Gym evidence change. It does not
contain App main's independent cleanup. Review and integrate those changes
deliberately, without replacing main or merging unrelated local edits.

The source audit also found stale design status: `cron.md` still described two
metric snapshot schedules, and the Task engine/tracker still described missing
Condition validation and dropped review deadlines. Current code has one Cron
snapshot declaration, validates new handler-returned Conditions, and tests wait
deadline preservation. Correct these claims rather than implementing them again.
Retained optional Condition fields do not exempt new handler results from
runtime validation.

Use the existing paired compatibility gate for changes to public APIs. It
checks workflow/maintenance compilation; it does not replace all App tests or
the real Gym CLI import checks that caught the earlier adapter deletion.

### 5. Finish remaining simplification only with an owner and evidence

- Classify remaining central metrics by meaning. Many now measure Host
  mechanics; moving every definition merely to remove `ALL_METRICS` is not a
  useful goal. Remove invalid proxies or move demonstrated domain ownership
  one at a time, retaining sample meaning and history.
- Retire offline JSON compatibility only after accounting for its actual
  import and fixture consumers. Never discard restart fencing to reduce code.
- Retire historical public incident inputs only after checking unfinished
  consumers in the target installation. This review did not perform that live
  check and does not authorize deleting them.

## Verification and limits

- Fresh Host `bun run ci`: **2,417 pass, 3 explicit installation-dependent
  skips, 0 fail** across 253 files, using Node 24 and Bun 1.3.14. Includes the
  existing daemon/socket and browser checks.
- Both reviewed App snapshots load all **five App manifests** against the
  current Host SDK. This is artifact/load compatibility, not App acceptance.
- App main plus this fix passes the existing paired gate for **24 workflows
  and five enabled maintenance handlers** (type check and bundle).
- Host Operations `bun run check`: syntax, type, formatting, and **111 tests
  passed**; the four new metric observation tests are included.
- May and Gym App full checks pass (**7** and **94** tests). Evaluation's full
  check fails with **104 passes and three failures**, diagnosed above. Therefore
  this is not an all-Apps-green or whole-system-ready claim.
- Scout's full check passes (**296 tests**, 108.56 seconds in the test step).
  All five App check commands were run; the compilation gate alone would have
  missed Evaluation's failures.
- Design integrity: **0 errors, 0 warnings**. This checks structure/links, not
  whether every prose statement describes live behavior.
- No new container build or hosted CI run was performed for this App-only
  change. Host source is unchanged. The isolated App fixture uses an explicit
  sibling link to the reviewed Host checkout, not deployed Host code.

The immediate result is a demonstrated boundary fix and an updated review map.
The next material change is honest Evaluation review outcomes, then the paired
HTTP/Evaluation boundary, not another mechanical line-count cleanup.
