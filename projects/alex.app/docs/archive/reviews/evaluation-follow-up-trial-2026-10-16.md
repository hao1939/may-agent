# Evaluator follow-up decision trial — October 16, 2026

**Supports:** [Useful completed work](../../1-principles/purpose.md): retain
useful assessments without paying for another agent to reconsider each one.
**Choice basis:** [Agents judge; code executes](../../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
The [owning contract](../../evaluation/task-outcome-evaluation.md#follow-up-is-an-evaluator-decision)
lets the evaluator request attention explicitly. App code performs the routing.

## What was tested

The App source candidate is `22e21e7473`, with the completion-guidance refinement
recorded alongside this review. The native runner uses Host `cbd71af075` (#344),
matching locked dependencies, the configured `deepseek-v4-flash` route, the actual
candidate result schema, shared criteria and evaluator instructions. Only the
`finish` tool is available. There is no fallback model, live Task admission,
report publication, message delivery or production-state write during the trial.
Each invocation is bounded to three minutes. Prompts, inputs, source identities,
execution manifests, complete sessions and receipts are retained under:

`/app/.state/runtime-review-20261015-1535/followup-trial/`

Two historical cases use hash-checked saved reports and their original workflow
prompts. Four controlled cases distinguish an unreported failure, an active
repair covering it, a different finding during that repair, and an unsupported
claim of completion. These are small judgment checks, not a representative
accuracy benchmark or a production cost comparison.

## Findings

The controlled judgments distinguish independent facts correctly: an existing
repair can justify keeping the same concern quiet, while a different uncovered
finding still warrants attention. The latter request reused the existing return
relationship instead of commissioning a parallel repair. An unsupported delivery
claim produced a request for evidence or correction, rather than quiet acceptance.
These are recommendations for Alex to judge, not authority for automatic changes.

The initial metric replay requested an investigation. Inspection showed that its
initial prompt lacked the live reads through which the original reviewer had
verified recovery. Its predeclared `none` expectation was therefore unsupported
by that input; this run is not scored as a recovery-classification failure. A
second frozen replay included the original diagnostic tool results, excluding
the original evaluator judgment. With unchanged guidance it returned `none`.
This supports supplying useful context and preserving evidence gaps; it does not
justify suppressing follow-up merely because a metric later falls below threshold.
The report still loosely called the incident “self-recovered” without establishing
the repair actor. Correct routing is not proof that every sentence is supported.

The first historical healthy-wait run attempted the expected quiet judgment but
omitted `verification_facts`; the provider then returned `stream_read_error`
during correction. That invocation is retained as a failure. Other initial runs
also repeated full reports to repair missing outer finish fields, and one quiet
decision supplied an invalid empty `message`. These are completion errors,
separate from the follow-up judgment. The same missing-verification correction
also occurs in the saved production sessions, predating this change.

The refinement clarifies the existing finish envelope and the exact `none`
shape in the canonical evaluator instructions. It changes no Host contract,
provider settings or schema. Repeating the same controlled active-repair and
unreported-failure cases preserved `none` and `request`, respectively. The quiet
case completed in one reply without a correction. The actionable case still
omitted `verification_facts` once and completed in two replies. Both had needed
three replies and two corrections before clarification. The remaining omission
is not fixed by this evidence; these are two comparisons, not a reliability or
latency guarantee. The separate healthy-wait replay completed
with `none` using the original guidance; its first failed run remains retained.

| Evidence supplied | Completed decision | Interpretation |
| --- | --- | --- |
| Historical justified human wait | `none` on the one bounded retry | Keep the existing obligation and wait |
| Historical metric breach, initial prompt only | `request` | Recovery had not been established by this input |
| Same breach plus original diagnostic read results | `none` | Later completed attempts and a valid wait support no new intervention |
| Repeated unreported publication failure | `request` | Ask the credential owner for the missing scope and inform the caller |
| Same concern with active repair and return path | `none` | Avoid commissioning duplicate work |
| Different candidate-integrity finding during repair | `request` | Address the new finding through existing work |
| Claimed publication without receipt or return evidence | `request` | Obtain evidence or correct the unsupported claim |

Across ten bounded invocations, nine returned valid judgments and one failed
with the retained provider error. All four controlled attention decisions matched
their expectations; both clarification rechecks preserved their decisions. The
initial metric expectation was invalid for its incomplete input, as explained
above. These counts describe this trial, not deployed evaluator accuracy.

The clarified failure sample also misinterpreted the synthetic `pendingInputs`
field and recommended replacing the original publication input. That advice is
unsupported: the original promise remains owed while credential recovery runs.
No such mutation was performed. This reinforces the existing boundary: Alex
must inspect the current Task before acting; the follow-up request is evidence
for owner judgment, not an executable Task update. Completion validity and
correct attention routing do not certify all proposed repair details.

## Activation

The local installation activated Apps revision
`20c24fc1af4d0f14288c7a86b72c4917ea3a1519`. Reload request `6664788` completed
successfully in event `6664790`; the reported revision and loaded App/agent bytes
match the integrated source. Host/SDK remain at `cbd71af075` (#344). The timeline
candidate remains separate and unactivated.

The next naturally scheduled Task review used that definition release and
published event `6664818` with `followUp: {kind: "none"}`. The retained JSON and
Markdown hashes match the publication, its marker exists, and the completed
admission plan contains only Alex's admitted `noop` route. No Alex review Task
was requested by that publication. The evaluator made four model replies while
reading evidence, with zero finish-validation corrections. This establishes one
live quiet publication, not sustained savings or general judgment accuracy.
The actionable route is covered by the Host-backed fixture and model decisions;
no synthetic actionable report was sent to production to exercise it.

The installation receipts, byte checks and publication/admission proof are in
`followup-reload-completed.json`, `followup-activated-bytes.json` and
`followup-live-proof.json` under the local review directory. During observation,
subscriber failures `6664792` and `6664804` concerned Alex's earlier direct message
`6664767` to `tech-lead`, which has no canonical owner App address for that route.
That input predates this rollout; it is a separate unresolved delivery issue,
not an Evaluation publication failure.

## Deterministic verification and separate timeline repair

The report-routing candidate passed 240 tests / 1,353 assertions, strict checking
of its changed App/workflow dependency graph and the design checks. Host-backed
fixtures retain quiet publications without Alex admission, deliver a later
actionable report even when May's conversation handler is broken, and preserve
publication retry/legacy behavior. Report bytes bind the saved decision.

Alex's separate, unactivated timeline candidate was corrected in `901c07d1c2`
on its existing Task branch. It now applies the shared meaningful-history filter
before selecting timeline references. A regression proves that 80 skipped checks
or profiles without attempts neither evict useful entries nor change the full
review hash; actual attempts, failures, changed input and App-authored history
still change that identity. Its 101 focused tests / 411 assertions, changed-helper
strict typecheck and design checks pass. The broader candidate retains an existing
strict optional-string error in its unchanged publication code; the report-routing
candidate already corrects that independently. No timeline activation or improved
model detection is claimed; its intended comparison remains separate work.

## Limits

The finish-only trial cannot establish live discovery, delivery, repair quality,
sampling coverage or durable savings. Gateway pricing is unknown; zero cost
placeholders are not evidence of free inference. The first provider failure and
all envelope corrections remain in the receipts. A justified `none` is the
reviewer's judgment, not guaranteed health. Historical reports without the field
retain their original routing, and already-running executions retain their
definition snapshot during rollout.
