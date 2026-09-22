# Recover current work from execution evidence

**Status:** Design refinement and bounded verification plan, September 22, 2026.
No new recovery runtime is implemented by this document.
**Contract owners:** [System boundary](../2a-design/system-boundary.md#recovery-uses-evidence-before-repetition),
[Task runtime](../2a-design/task-resource-engine.md),
[workflow evidence](../2a-design/workflows.md#evidence-retention-and-autonomous-recovery).
May-specific decisions and improvement approval belong in
[May's integration](../../../may.app/design/evaluation-improvement-loop.md#recover-current-work-improve-future-work).

## Outcome and scope

An implementation can fail without losing the assignment. The responsible
worker should be able to inspect what happened, restore useful progress within
its authority, and verify the original outcome. When restoration is impossible,
the exact unresolved need must reach an available owner or human. Honest
escalation is a safe result, but does not count as successful restoration.

A permanent correction may follow later through ordinary investigation,
isolated development, comparison when useful, human approval and activation.
Immediate recovery does not wait for that loop when a safe authorized route
already exists. A required source repair can still be a dependency when no such
route exists. Recovery and improvement can proceed together.

Keep one Task, ordinary evidence and existing owner feedback. Do not add a
recovery App, incident registry, second scheduler, universal error schema or
automatic strategy-selection state machine. This review does not enable the
paused may-agent App or change tool policy.

## What our failures teach

These are different failures of the existing loop, not reasons to encode one
special recovery branch per incident.

| Observed case | What broke | General lesson |
| --- | --- | --- |
| #225/#226 public admission | An earlier boolean check hid the shared validator's detailed rejection; tests mocked that connection or expected the generic error. | Check the caller-visible boundary. Poor error detail should trigger contract/step inspection, not abandonment. |
| Evaluation reviewer execution failed | App code called its completion helper without publishing the required review. | An unsuccessful required operation cannot become completed work merely because the wrapper returned normally. |
| May's missing post-adoption review | Rejected requests were followed by a result that stopped carrying the independent review obligation. | Compare current evidence with original acceptance; deployment, another completed task and absence of waits cannot discharge an unrelated requirement. |
| Wait preservation fixes | Adding an App dependency replaced other waits at one layer despite lower-layer preservation. | Failures, useful work, human questions and dependencies coexist. Change only the fact or wait actually resolved. |
| September 12 owner-help trial | Worker found an unavailable source but hid the needed human action in a quiet wait; repeated checks exhausted the trial allowance. | Diagnosis, owner delivery and resolution are separate. Test the actual owner return and useful next action. |
| Same trial after guidance/settlement correction | Human received the request, the original work survived and completed after a simulated source repair; a below-threshold result stayed adverse. | Existing mechanisms can recover. A single assisted trial is not an autonomous reliability rate. |
| Task command environment failure | Agent-created commands inherited Host worker-specific configuration. | Keep infrastructure-specific requirements inside their owning boundary; recovery should have ordinary diagnostic tools. |
| Unrelated creator changes invalidated Evaluation evidence | Completed work appeared changed when the creator Conversation changed. | Follow relevant evidence links; history/navigation is not automatically an outcome dependency. |
| Deployment formerly depended on App execution | Fixing the running system could depend on the App path being repaired. | Preserve a standalone operator/installation route for infrastructure repair. |

Evidence: [wait corrections](task-wait-recovery-20260918.md),
[owner-help trials](controller-poc-deeper-review.md#capability-and-owner-help-probes),
[command environment](task-worker-command-context-20260919.md),
[ownership review](../archive/reviews/ownership-boundary-review-20260913.md),
[PR #225](https://github.com/hao1939/may-agent/pull/225) and
[PR #226](https://github.com/hao1939/may-agent/pull/226).
September 22 exact local event/Task evidence is retained under
`/app/.state/review-pilots/apps-health-20260922/repair/`, especially
`WHY-SELF-REVIEW-MISSED.md`, `PR225-ROLLOUT-REVIEW.md` and the public socket
before/candidate receipts. These installation paths are evidence pointers,
not prerequisites for portable tests.

## One ordinary recovery pass

1. **Read the current obligation and facts.** Start from the current Task,
   pending input, acceptance, independent waits and previous attempt. Follow
   linked accepted evidence when the latest summary is incomplete. Do not
   restart from an old prompt or assume a completed command fulfilled the task.
   A request rejected before admission remains the caller's problem: no
   destination work exists yet, so recovery belongs in that caller's execution.
2. **Diagnose only as deeply as necessary.** Use a useful structured error or
   receipt directly. Otherwise follow the exact operation/step/session links,
   inspect its input and output, compare the actual contract, and identify
   the first relevant mismatch after the last verified result. Read command
   output or source when the summary is insufficient. This is bounded evidence
   discovery, not a scan of every historical task or replay of every step.
3. **Choose the smallest safe next action.** Correct input, reuse a verified
   result, try a supported alternative, inspect an uncertain effect, wait for a
   real prerequisite, or report the needed owner action. A retry may itself be
   a useful bounded probe of a transient condition; it needs no invented change
   in facts. Repeating an unchanged deterministic failure provides no such
   evidence. Continue independent work where useful.
4. **Verify and retain the result.** Check the requested outcome or intermediate
   fact, not just the exit code. Preserve remaining obligations and link exact
   evidence. A restored service, admitted request, completed review and accepted
   user outcome are different facts. Use existing result/facts/Conditions.
5. **Report unresolved limits through the existing owner link.** A real wait
   retains its return route; a caller-relevant problem needs an actual report.
   Do not create a replacement Task simply to retry or diagnose. Preserve
   partial work and any separate improvement link.

These are reasoning guidance for any agent/workflow owner, not five runtime
states or required JSON fields. Healthy waits and already verified completion
should remain quiet unless relevant facts change.
An internal tool error corrected during the attempt needs no additional owner
wake or repair Task. Optional logging failure does not invalidate otherwise
verified delivery; a missing required independent review does remain owed.

## What code guarantees, and what judgment decides

| Responsibility | Current mechanism and evidence | Remaining proof or limitation |
| --- | --- | --- |
| Preserve and retry unfinished execution | Task store, claim/settlement fences, persisted backoff and indexed recovery; retry/reopen/timer tests | The same deterministic handler can run again without diagnosing. Frequency control is not effective strategy or a lifetime cost bound. |
| Return failure to the caller | Existing admission correlation and report revision, including execution-error reports; caller reads exact attempt | Automatic failure reports do not relay every unchanged retry; explicit reports carry later meaningful updates. Owner consideration must be verified. |
| Discover more detail | Per-attempt TASK.md/context, previousAttempt, session outputs and exact workflow/step/child links | Optional logs are bounded; not every authored operation retains all useful receipts. Missing detail stays explicit. |
| Recover when diagnostics fail | Inline Task context fallback, original failure retention, nonblocking failure reporting | A missing evidence source may require another read/probe or owner help; absence is not proof of success. |
| Avoid duplicate effects | Existing admission/local keys, current target reads, fenced settlement | Arbitrary external tools do not provide exactly-once effects. An unknown outcome must be investigated before unsafe repetition. |
| Recognize semantic incompleteness | App acceptance judgment, owner review and independent Evaluation | A plausible false completion can escape mechanical checks. Sampling/budgets mean Evaluation is not an immediate universal safety net. |
| Restore an unavailable executor or Host | Existing owner controls and standalone install/restart route | An in-process agent cannot repair a dead process. Automatic unavailable-owner supervisor routing is deferred. |

Caller reports are selected per input, not broadcast to every structural parent.
The existing [caller-feedback refinement](caller-feedback-and-waiting.md)
already covers failure plus an independent wait and later explicit updates.
Do not restore the old automatic notification for every retry or invent a
second escalation mechanism to replace this route.

Source anchors at the #225/#226 boundary:
`src/app/core/tasks/app-task-reconciler.ts` (failure settlement, reports,
previous-attempt evidence), `app-task-state.ts` (paced retries),
`app-task-recovery.ts` (indexed wake recovery), `controller.ts` (dispatch
failure/report isolation), `src/lib/task-workspace-context.ts` (navigation),
`workflow-facts.ts` and `workflow-diagnostics.ts` (bounded execution evidence).
The control client already distinguishes definitive rejection from
post-send-unknown outcomes; do not flatten those facts into a generic safe retry.

## Contain failures in recovery itself

The failed business implementation must not be the only path that notices and
reports its failure. A thrown workflow error must still be retained by the
outer execution boundary and reach its exact caller. The owner can then
investigate using ordinary tools. An explicit workflow assignment changes only
through its authorized owner or the supported needs-agent result; the Host does
not silently replace a workflow after an error count.

Use the narrow fallback already available: current Task read if TASK.md is
unavailable; exact session/step/source evidence if the summary is weak; an
existing caller report if local recovery cannot progress; installation
supervisor/operator if the Host cannot execute. Do not create recursive
supervisor escalation or require a broken App for binary restart.

One important gap remains: code has no universal guarantee that an unavailable
owning App reaches a live supervisor or human. Existing periodic review is
useful but cannot be represented as that guarantee. First reproduce the
specific missed route. If required, wire one explicit installation-selected
fallback through existing inputs and current diagnostics, with delivery and
duplicate tests; do not introduce another work lifecycle. This is a conditional
candidate, not a feature implemented or required by this document.

Structured evidence is preferred, not a precondition for recovery. Diagnostic
access can itself fail. Preserve the original failure and the new limitation;
never require the unavailable log writer or failed evaluator to certify that
the failure exists. A broken authoritative store requires operator repair;
this design assumes trusted state is readable before resuming consequential
work. Restoring state does not restore permissions or authorize replay.

## Small trials before more implementation

Use real entry, execution, settlement and caller-return wiring with temporary
storage and controlled external effects. Keep the actual agent's tools and
normal Task entry; give the outcome and discoverable fixture root, not the
diagnosis or the repair steps. Keep an independent checker outside the agent.
Use a clean control, retain failed attempts, and hold budgets comparable.

| Case | Required observation |
| --- | --- |
| Clear validation error | Agent corrects the input and completes the same assignment; rejected input creates no work and retry creates one accepted request. |
| Same problem with a vague error | Agent follows the contract or linked input/step evidence and finds the correction without a human supplying it. |
| Persistent workflow defect | Outer failure returns to the existing owner; useful diagnosis/authorized method correction replaces repeated identical execution; workflow selection is not silently overridden. |
| Effect succeeded but acknowledgment was lost | Agent reads actual effect/receipt and avoids repeating the side effect; unknown remains explicit when verification is unavailable. |
| Restart or missed return notification | Same Task and exact accepted result survive; caller receives it without duplicate work or loss of unrelated waits. |
| Missing diagnostic artifact or failing reporter | Current facts and alternate evidence remain usable; original failure survives; necessary help is delivered when the evidence cannot be recovered. |
| Apparent success with a remaining acceptance item | Owner/Evaluation identifies the unfinished obligation and returns it through the existing link; no false success. |
| Healthy wait and genuine completion controls | No needless repair, repeated human notifications or forced new investigation. |
| Owner/Host unavailable | Demonstrate the installed fallback or explicitly fail the unattended-recovery criterion; no simulated receipt presented as delivery. |

Record whether the injected failure actually occurred, outcome restoration,
diagnostic actions/evidence used, duplicate effects, preserved obligations,
owner delivery/consideration, attempts, elapsed time and human intervention.
Report restoration and safe escalation separately. A successful rerun alone
cannot establish that diagnosis helped. Multiple attempts/cases are needed
before making a reliability claim; no invented success-rate target yet.

Initial source check: 80 existing tests across retry, recovery scheduler,
controller, accepted results, Task context and workflow facts passed with zero
failures. Their production mechanics are unchanged between #225 and #226.
They cover persistence, restart, reporting isolation and navigation; they do
not establish agent diagnosis. The earlier #226 real-socket A/B proves useful
errors and safe admission, with no model calls.

## Automatic recovery composition criterion

The supervisor's next correction requires the full installed route, not just a
model-authored edit followed by author-driven runtime calls. Admit the original
work once (disclosing any seeded delegation), then let the production controller,
recovery scheduler, persisted lifecycle events and normal inbox composition carry
failure publication, exact caller return, owner wake, retry and final settlement.
The harness must not advance that chain with direct reconciliation, Condition/result
recovery calls or synthetic failure/success wakes after start. Natural production
startup/recovery calls remain part of the system under test.

Source audit found that `startAppInboxRuntime` already refreshes exact results on
`project.task.reconciled` and publishes caller feedback. Its event admission requires
persisted event identity; a bare EventBus is not sufficient composition. Reuse those
routes rather than constructing a fixture-only projector. Preserve the first actual
missing fact, return, wake or decision if the bounded run fails. A demonstrated Host
fix belongs in a separate Host worktree with its owning regression, not in this Apps
experiment or an invented recovery subsystem. No generation bump is needed simply
to activate a source-only repair in a fresh helper subprocess.

One corrected isolated trial now exercised that automatic composition: failure report
and normal feedback woke the real owner; its sole source edit repaired the helper;
the already-scheduled same-generation/workflow retry produced the exact output; final
success feedback woke the owner to verify accepted evidence and retain the unrelated
audit. A fresh worker control passed. Two owner invocations used 57,764 ms overall.
The unchanged Task update did not cause retry: its queue entry already existed before
the owner finished. No Host defect or Host candidate was demonstrated.

This is bounded to seeded delegation and one capacity slot in an in-process fixture.
The model held that slot while investigating, so concurrent multi-slot retry behavior
remains unproved. The executed run predates post-run oracle/teardown hardening; retained
transcripts/results independently verify actual final consideration and provenance
without another model run. No live activation, crash/unavailable-owner route or broad
reliability is established. The current
[report](../../experiments/recovery-workflow-20260922/REPORT.md) retains exact hashes,
identities, cost, setup seams and those corrections separately from earlier manual evidence.
The independent routing audit is retained at
`/app/.state/review-pilots/apps-health-20260922/repair/AUTONOMOUS-RECOVERY-ROUTING-AUDIT.md`.
Evaluation policy mapping tests do not establish installed end-to-end enablement;
current owner-review selects the evaluator agent with `codex-goal`, not the legacy
`evaluator-heartbeat` workflow. Neither that legacy file nor Evaluation's intentional
self-exclusion proves a reachable defect or universal caller-less coverage.

## Earlier manually advanced unfamiliar-code recovery observation

Hao clarified that known interruption handling, prepared alternative methods and an
experiment-author idempotency guard do not establish recovery from unfamiliar broken
code. Those earlier trials below remain mechanical prerequisites only.

One isolated real-agent trial now demonstrates a narrow positive case: an authored
workflow launched a fresh helper that failed before structured result, reporting only
an ordinary generic execution error plus command-record path. The tested owner was
given the original outcome, ordinary Task/run/source/contract discovery and ordinary
coding tools, not fault details or a repair. It read the record, order contract and
source, made the source edit itself, and verified a scratch probe. The unchanged
`deliver-order` workflow then completed the original `effect-child` at **generation 1**
through production retry/settlement. Its exact caller input became done; the final
owner read accepted Task evidence and actual output, preserved the independent audit,
and a fresh-order control passed. An unchanged `tasks.update` call did not revise the
assignment despite the model saying it requeued/revised it. A source repair can work
through ordinary retry without a specification change.

The [current-first report](../../experiments/recovery-workflow-20260922/REPORT.md)
retains prompts, successful investigation reads and edit, source before/after, IDs,
attempts and costs at the durable supervisor evidence root. Independent supervisor
verification checked the actual store, both transcripts and 57 evidence hashes.
Two author interventions fixed only harness errors: an initial-context check wrongly
rejected the owner's learned diagnosis in its final prompt, and a count assertion
mistook the root group for a fourth Task. The same store was continued; the tested
helper was never repaired by the author and no extra paid repair trial was run.

This is one small unfamiliar-code repair, not unattended reliability, degraded-evidence
coverage, arbitrary unknown-failure competence or installed production activation.
Delegation is seeded and reconciliation manually driven. Ordinary tools are scoped by
instructions, not an OS sandbox. The healthy control checks the repaired operation,
not healthy owner judgment. No new recovery mechanism or deployment follows.

Existing optional Evaluation ongoing-failure assessment already provides another
reasoning route through review/publication and May's ordinary message intake. It is
opt-in and allowance/capacity limited, not universal immediate recovery; inspect that
existing route before proposing another monitor.

## Earlier mechanical prerequisite observations

The prepared-alternative and operation-guard trials are retained, not unknown-failure
success. Their
[current-first report](../../experiments/recovery-workflow-20260922/REPORT.md)
and reproducible source are retained with this repository. Raw runs remain
local and ignored by Git.

In the failure-before-effect case, the authored method threw before a structured
result. Production admission, workflow execution, failed-attempt settlement and
exact caller return retained the attempt and workflow-run identities. A real
`gpt-5.6-sol` owner read ordinary Task/contract evidence, revised the same child
to another explicit workflow, and a later owner attempt considered the returned
one-marker result. The unrelated audit Condition survived. This is a prepared-alternative
judgment path, not unfamiliar-code repair or a reliability rate.

The acknowledgment-loss baseline exposed a different boundary. In baseline-3,
method A wrote the marker and threw; the owner successfully read that existing
effect, kept the dependency wait, but revised the child to an unguarded method B,
which appended a second marker. In the earlier baseline-2, the owner read the
effect and retired only its dependency Condition; a later method-A execution
also duplicated the effect. The latter correctly did not cancel an independent
child Task. Better discovery and correct Condition semantics did not make the
operation safe.

The bounded candidate changed only the fixture operation: exclusive create of a
stable operation target followed by exact expected-content verification. Under
the same acknowledgment-loss case, the owner selected the fallback before
reading the effect, but method B verified and reused it, returned `reused:true`,
converged the same child and left one marker. A final owner attempt read the
actual marker. The improvement is therefore at the operation boundary, not in
agent judgment or Host recovery mechanics. Direct checks also rejected empty,
wrong, duplicate and inaccessible existing evidence without writing.

This guard is only a single-host filesystem demonstration. It proves neither
fsync durability, remote-provider atomicity, distributed concurrency nor
universal exactly-once behavior. Real external effects still need a
provider-supported stable idempotency identity or trustworthy current-state
verification. No Host/runtime mechanism or deployment follows from this trial.

The harness uses production App admission, Task claim/settlement, workflow
adapter, failure report/answer projection, creator-authorized update and real
provider execution. It seeds initial dependency admission from a fenced owner
claim and manually invokes exact reconciliations instead of daemon scheduling;
the healthy control checks the worker operation, not owner judgment. A separate
Host audit exercised automatic retry of the guarded operation without a model:
two attempts of the same generation, one effect, seven assertions, retained at
`/app/.state/review-pilots/apps-health-20260922/repair/recovery-scheduled-effect-trial-3.log`
(audit worktree commit `c68613cd`). Do not attribute that scheduling proof to
the manual harness.

Tech-lead independently reviewed the receipts, workflow runs, prompts and actual
session tool records. That review caught a harness oracle which incorrectly
looked for tool results inside assistant content; session JSONL records top-level
`role:"toolResult"` messages. Retained transcripts show the baseline owner read
the effect before revision, while the guarded candidate owner read it only in
the final consideration. The harness now separates those observations. No
costly model rerun was needed to correct the narrative.

During the #226 rollout, the service restart interrupted May's active repair
attempt. Runtime requeued the same Task; a later stale result was also rejected
and retried. May read the successful deployment receipt, completed its rollout
and design-review obligations without a duplicate deployment, and retained the
separate unresolved Evaluation wait. This is a real recovery observation during
instructed delivery, not the controlled vague-error/workflow diagnosis trial.
Two additional real-runtime tests passed for exact child-failure return to
Conversation, with unsuccessful execution kept separate from completion. They
use scripted executors and do not prove model judgment. Exact local evidence:
`recovery-design-task-after.json`, `pr226-live-verification.json` and
`recovery-caller-boundary-tests.log` in the September 22 evidence directory.

## Learning without importing another framework

Scout's [failure-mode review](../../../scout-knowledge-lib/knowledge/agent_failure_modes.md)
summarizes controlled research where retries reproduced latent mistakes and
where trusted reference evidence improved recovery. Its
[recovery state review](../../../scout-knowledge-lib/knowledge/findings/2026-09-15-agent-recovery-plan-state-contract.md)
distinguishes unknown external effects from known failure and warns that schema
validity is not runtime enforcement. Those are retained source reviews, not
experiments rerun here or production success rates.

Borrow three small lessons: verify current external state before replay;
use independent evidence to correct a mistaken premise; compare the same
failure under similar budgets so extra retries are not credited as diagnosis.
Do not import their ledgers, registries, checkpoint engine or recovery DSL.
Our Task state, operation identities, receipts and source control already own
those facts.

## Delivery order and decision gates

1. Activate merged #226 through the existing reviewed deployment path and verify
   exact running identity. Keep its receipt separate from recovery-behavior proof.
2. Run the clear/vague-error and persistent-workflow trials first. Investigate
   the first lost fact, unreadable link, missed owner return or incorrect
   judgment before changing anything.
3. Repair demonstrated mechanics in Host/shared adapters and demonstrated App
   judgment at its owner. Add only the regression that exercises the failed
   boundary; rerun the affected agent trial and healthy control.
4. Test ambiguous effects, degraded diagnostics and unavailable owners before
   claiming unattended recovery. If a fallback is absent, state that limitation
   and decide its value against the cost of a small explicit route.
5. Reuse confirmed recurring failures in the existing improvement process.
   Recovery should keep delivering while later approved changes remove the
   need for repeated workarounds.
