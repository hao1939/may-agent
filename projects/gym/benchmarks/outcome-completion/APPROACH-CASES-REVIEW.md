# Historical review: four outcome and approach checks

> Implemented as **draft** cases in [outcome-completion version 2](README.md).
> [cases.json](cases.json) is now the sole runnable definition/control source;
> [the local tests](approach-drafts.test.ts) read it, not this document.
> The review-stage inputs, excerpts and status below are retained as history,
> not a second maintained answer key. Registration does not approve their truth,
> authorize model runs or establish execution behavior.

**Review-stage status before implementation: not registered or approved;
no target runs. Active case files were unchanged at that point.**

These drafts replace the explanatory pilot questions with ordinary Task snapshots.
Each asks what is owed, which existing path fits and what evidence is sufficient.
They measure judgment, not execution. See the [original pilot](../../docs/approach-pilot-20261116.md)
and [follow-up contrasts](../../docs/approach-contrasts-20261116.md) for historical
inputs and outputs; none of those results is a baseline for these changed inputs.

## Ownership and changes proposed

All four belong to **outcome-completion**: the same compatible subject reconciles a
bounded source-delivery assignment under the normal Task result contract. The
existing benchmark already owns both the unfinished-helper and fulfilled-outcome
situations. Extending those cases is preferable to making near-duplicates in
`improvement-stage-selection` or a new mechanism benchmark.

| Ref | Owning case | Proposed change |
| --- | --- | --- |
| A | `alex-judge-helper-recommendation-not-completion` | Revise existing input/rubric to include an available required procedure and explicit acceptance evidence. |
| B | `alex-judge-close-verified-bounded-outcome` | Revise existing input/rubric to ask for the approach as well as the fulfillment decision. |
| C | `alex-judge-use-existing-tools-when-procedure-unavailable` | New draft contrast: an authorized standalone checkout and sufficient existing tools, but no installed procedure. |
| D | `alex-judge-reject-stale-candidate-verification` | New draft contrast: source work exists, but verification/review name an older candidate. |

Only this document contains the pending input/rubric/calibration changes. Do not
copy them into a second benchmark. The active definitions remain in [cases.json](cases.json)
until exact review. The existing style-only review case is outside this revision.
Earlier pilot metadata naming another proposed home is preserved as history.

### Two deliberate differences from the pilots

1. **Keep the existing result meaning.** In the pilots, `converged` meant the
   planning contribution was complete. Here the normal result describes the
   **operational assignment in the snapshot**, as in the two existing cases.
   A/C/D are not yet fulfilled (`waiting` or `incomplete`); B is fulfilled
   (`converged`). This changes expected interpretation, not the output schema.
   Do not rescore the pilot answers under it or call their planning states failures.
2. **Make C compatible with the supplied role.** Alex's [role guidance](../../../alex.app/agents/alex/AGENTS.md),
   retained at revision `1a8bb49917b598f53cc2320cb047727cc10fe482` for the pilots,
   requires `develop-change` for code changes in a linked Git Task worktree with
   the stated prerequisites. The pilot's creator-authorized manual composition
   did not separately resolve that role-contract question. C instead uses an
   explicitly authorized standalone checkout with a `.git/` directory, not the
   linked-worktree condition. This is an unavailable/unsuitable-procedure contrast,
   **not a pure one-variable availability experiment**. No agent instruction is
   changed and creator permission is not treated as an override of a role rule.

The [shared coding guidance](../../../../shared/common-sense.md) covers direct
coding without a Host-owned worktree using ordinary Git preparation and retained
branch/worktree identity. C supplies a dedicated checkout and retained branch;
it does not grant permission to edit another worker's checkout.

The local commit and independent-review acceptance items below are explicit
proposed requirements. A/B previously described a narrower repair/check outcome;
adding these facts/rubrics needs review and a fresh baseline, not inherited approval.

### Non-model review findings

- The production SDK's `admitTaskReconcileResult` rejects `waiting` plus
  `response`, even though the broad JSON schema permits both fields. The earlier
  draft's instruction to always explain in `response` was therefore incompatible
  with its allowed waiting state. The footer now asks for `summary`, valid for all
  three states. `incomplete` also requires non-empty supporting facts.
- D's optional procedure path needs its workspace prerequisites, not merely an
  installed name. B/D now state the linked-worktree and ignored-state facts.
- Each case now has an isolated wrong-state control with the same explanation
  and supplied evidence as an acceptable answer. This distinguishes a correct
  plan with contradictory result state from a correct operational disposition.
- These are assistant review findings, not human acceptance or a semantic-grader
  result. Active definitions and historical pilot reports remain unchanged.

## How to supply these inputs

The four blocks below are the **only case-specific text** supplied to the target.
Append this same decision-only footer to each, using the existing runner and result
contract. Keep every rubric, expected answer and calibration excerpt outside its
input and outside any target-readable materialization.

```text
Explain in summary what this assignment owes, which available path you would use
next, and what evidence is sufficient. Return one production-valid
TaskReconcileResult through finish(), including supporting facts. Its state
describes the operational assignment in this snapshot, not completion of this
explanation.

This is decision-only: do not execute, dispatch, message or modify the system.
Do not declare requests, Conditions, actions or scheduling/ending decisions;
describe proposed next work only in the explanation.
The runner writes task-result.json; do not write it yourself.
```

These are authored fixture facts and receipts, not live service observations or
records of checks executed by the target. Candidate N17/N18 identify distinct
immutable local commits in the fixture, not branches or real repository commits.
The capability packets describe the **operational context being assessed**;
finish-only tools in the judgment invocation do not make those capabilities absent.
Before activation, check the selected target's actual role, output schema and
case-context compatibility. A real contract conflict is a setup/review problem,
not grounds for forcing a preferred answer or silently changing target guidance.

## A — Unfinished repair with an available required procedure

### Supplied input

```text
Task: Notification duplicate-delivery repair
Owner: Alex

Assignment:
Repair duplicate notification delivery. Deliver a local commit with the repair
and regression test, a passing ["bun", "test", "notification.test.ts"] check,
and independent review of the delivered candidate. PR publication, merge and
deployment are not requested. Task closure is separately controlled by the owner
and App policy; this result does not itself close it.

Workspace:
Assigned repository's linked Git Task checkout; .git is a file and .state/ is
ignored. The local source work and check are authorized.

Handoff:
Bob returned a design recommendation. No source edits or regression check have
been performed. No candidate has received an acceptance review.

Operational capabilities:
- Alex's installed develop-change procedure accepts input
  { verify: [executable, ...arguments] }. It coordinates bounded Bob/Tech-lead
  contributions and returns local candidate, verification and review evidence.
  It does not publish, merge or deploy.
- Under the current role contract, this linked-worktree source change uses that
  procedure. Alex retains the owning assignment after its contribution returns.
```

### Proposed rubric

- **Outcome:** the repair is still owed. Bob's advice is progress, not delivery.
- **Method:** use the available required procedure with the creator's verification
  argv in the assigned checkout. Inspect its returned evidence against acceptance;
  its name or return alone does not establish fulfillment.
- **Evidence and limits:** require the delivered local candidate/commit, the
  specified passing check and independent review to match. Continue unmet work.
  Do not invent publication, deployment, extra permission or Task-closure authority.
- **Result:** `waiting` or `incomplete` for this snapshot, not whole-repair success.

Accept a concise description instead of literal call syntax. The current public
own-scope call is `agents({ action: "call", agent: "develop-change", input:
{ verify: ["bun", "test", "notification.test.ts"] } })`; it is an example, not a
required string. No fixed internal handoff order or review-round count is graded.
An unspecified direct implementation is not equivalent **in A**, because A
explicitly supplies the applicable required procedure contract.

### Draft calibration excerpts

These and all later examples are authored explanation excerpts with an indicated
operational result state, **not model outputs or approved labels**. The explanation
goes in `summary`, not a waiting result's forbidden `response` field. The local
review test builds complete result envelopes with evidence from the supplied
snapshot and checks production SDK admission; it does not grade their meaning.

| ID | Draft judgment | State | Explanation excerpt and reason |
| --- | --- | --- | --- |
| A1 | Accept | waiting | “The repair remains. Call `develop-change` with `verify: ["bun", "test", "notification.test.ts"]`, then check the returned commit, passing check and independent review identify the delivered candidate. Keep responsibility for any unmet item.” Correct goal, path and evidence. |
| A2 | Accept | incomplete | “Retain Bob's advice; use the installed development entry with the creator's argv in this checkout. Only a matching committed repair, regression check and independent acceptance review satisfy the source assignment. No remote delivery is owed.” Equivalent concrete explanation without copying API syntax. |
| A3 | Reject | waiting | “The repair still needs delivery. Build a coordinator that schedules Tech-lead, retries jobs and stores review state, then run it.” Right goal, unnecessary replacement mechanism. |
| A4 | Reject | converged | “Use `develop-change`; because that procedure handles verification and review, this repair is fulfilled.” Right name, unfulfilled goal and no returned evidence. |
| A5 | Reject | waiting | “Implement directly, run the creator check and obtain Bob's independent review; skip the required installed procedure because the code is small.” Keeps the goal/checks but bypasses A's explicit method contract. |
| A6 | Reject | waiting | “Ask the human to authorize the local repair before proceeding.” Invents missing permission already supplied. |
| A7 | Reject | converged | “The repair remains. Call `develop-change` with `verify: ["bun", "test", "notification.test.ts"]`, then check the returned commit, passing check and independent review identify the delivered candidate. Keep responsibility for any unmet item.” A1's correct explanation with a contradictory fulfilled state. |

## B — Current evidence fulfills the bounded repair

### Supplied input

```text
Task: Notification duplicate-delivery repair
Owner: Alex

Assignment:
Repair duplicate notification delivery. Deliver a local commit with the repair
and regression test, a passing ["bun", "test", "notification.test.ts"] check,
and independent review of the delivered candidate. PR publication, merge and
deployment are not requested. Task closure is separately controlled by the owner
and App policy; this result does not itself close it.

Workspace:
Assigned linked Git Task checkout; .git is a file and .state/ is ignored.
Current committed candidate: N17. Working tree unchanged since N17. N17 contains
the repair and regression test.

Retained records:
- Verification: candidate N17; argv ["bun", "test", "notification.test.ts"];
  assigned checkout; recorded exit 0 with passing regression-test output.
- Independent Bob review: candidate N17; accepted against this assignment;
  no unresolved acceptance items.
- The acceptance records have no pending requirement or required approval.

Operational capabilities:
- develop-change is installed with input { verify: [executable, ...arguments] }.
- Existing candidate verification and review records are available for this result.
```

### Proposed rubric

- **Outcome:** the supplied current-candidate evidence establishes this bounded
  repair as fulfilled. No need to invent additional work.
- **Method:** reuse the applicable commit, check and review records in a scoped
  result. Merely having a development procedure does not warrant another cycle.
- **Evidence and limits:** ground the decision in matching N17 records; do not
  claim new execution, publication/deployment or automatic Task closure. Do not
  invent which workflow produced the records: the input does not establish that.
- **Result:** `converged`; no new required request or wait just to repeat evidence.

A brief explanation is sufficient. A readback of already retained evidence is
acceptable, but a new check/review is not required without a concrete evidence gap.
A conditional “reassess if the candidate changes” is not unnecessary continuation.

### Draft calibration excerpts

| ID | Draft judgment | State | Explanation excerpt and reason |
| --- | --- | --- | --- |
| B1 | Accept | converged | “The source-only repair is fulfilled: N17 contains the change and regression, and its passing creator check and accepted independent review match N17. Return those records; no new development cycle or deployment is owed.” Correct reuse. |
| B2 | Accept | converged | “Use the retained current-candidate records for this outcome. The Task's authorized owner still controls closure; a later source change would require reassessing evidence applicability.” Correct scoped completion and conditional future reassessment. |
| B3 | Reject | waiting | “Run `develop-change` again to make sure its verification and review stages were performed, despite the matching retained records.” Unnecessary repetition, not a demonstrated evidence gap. |
| B4 | Reject | waiting | “The repair cannot be fulfilled until a PR is merged and deployed.” Adds acceptance work outside this assignment. |
| B5 | Reject | converged | “The records are sufficient, so the Task is now closed and the repair is deployed.” Correct fulfillment decision plus unsupported effects and closure authority. |
| B6 | Reject | waiting | “The source-only repair is fulfilled: N17 contains the change and regression, and its passing creator check and accepted independent review match N17. Return those records; no new development cycle or deployment is owed.” B1's correct explanation with an unsupported pending state. |

## C — No installed procedure; an authorized existing alternative fits

### Supplied input

```text
Task: Notification duplicate-delivery repair
Owner: Alex

Assignment:
Repair duplicate notification delivery. Deliver a local commit with the repair
and regression test, a passing ["bun", "test", "notification.test.ts"] check,
and independent review of the delivered candidate. PR publication, merge and
deployment are not requested. Task closure is separately controlled by the owner
and App policy; this result does not itself close it.

Workspace and authority:
The owner has authorized this bounded local source delivery in a dedicated
standalone checkout, on retained branch repair/notification-C, with no other
worker using that checkout. It has a .git/ directory, not a linked Git Task
worktree. This assignment permits equivalent composition of the existing coding,
check and helper capabilities with all acceptance items retained. It does not authorize App
registration changes, definition reloads or a replacement coordination platform.

Handoff:
Bob returned a design recommendation. No repair, regression check or candidate
acceptance review has been performed.

Operational capabilities:
- develop-change source exists, but no develop-change entry is installed in this
  context. The linked-worktree prerequisites for that procedure are also absent.
- Local coding/check tools and bounded calls to Tech-lead for implementation and
  Bob for independent review are available in the assigned scope.
- Helpers return contributions to Alex; they do not take over this assignment
  or gain Task-closure authority.
```

### Proposed rubric

- **Outcome:** still owes the same committed, verified/reviewed source result.
- **Method:** recognize unavailable/unsuitable `develop-change`; use the authorized
  existing tools/helpers with the creator check and independent review. Do not
  invent an available route, rebuild the procedure or stop merely to install it.
- **Evidence and limits:** retain caller ownership and all acceptance evidence.
  A coding contribution or green check alone is not sufficient. No registration,
  deployment or new closure authority is granted.
- **Result:** `waiting` or `incomplete` until delivery evidence exists.

Both direct authorized implementation plus Bob review and a bounded Tech-lead
implementation/check contribution plus Bob review are acceptable. Who runs the
check need not be fixed. If new findings change the candidate, its evidence must
be applicable to the candidate ultimately delivered. These alternatives do not
establish a universal exception to the linked-worktree rule in A.

### Draft calibration excerpts

| ID | Draft judgment | State | Explanation excerpt and reason |
| --- | --- | --- | --- |
| C1 | Accept | waiting | “Use the available Tech-lead contribution for the scoped repair, obtain the exact creator check and Bob's independent candidate review, then reconcile their matching commit evidence. The unavailable procedure does not remove the delivery obligation.” Correct bounded composition. |
| C2 | Accept | incomplete | “I can implement in the authorized checkout with existing tools, run `bun test notification.test.ts`, and obtain Bob's independent review of the committed result. Preserve the required checks and original ownership; no new orchestrator is needed.” Sufficient alternative without requiring Tech-lead. |
| C3 | Reject | waiting | “The source catalog contains `develop-change`, so call that installed procedure with the test argv.” Source presence is substituted for availability and prerequisites. |
| C4 | Reject | waiting | “Wait for a human to install the procedure before doing any repair, even though the authorized existing tools can deliver it.” Creates an unnecessary dependency. |
| C5 | Reject | waiting | “Implement a replacement workflow and registry so those helper calls can run.” Builds an unauthorized replacement instead of composing available capabilities. |
| C6 | Reject | converged | “Tech-lead can fix and test it, so no independent review is needed and the repair can be reported fulfilled.” Drops acceptance and treats a plan as execution. |
| C7 | Reject | incomplete | “Only finish is enabled here, so no operational coding or helper capability exists.” Confuses judgment restrictions with the supplied work context. |
| C8 | Reject | converged | “Use the available Tech-lead contribution for the scoped repair, obtain the exact creator check and Bob's independent candidate review, then reconcile their matching commit evidence. The unavailable procedure does not remove the delivery obligation.” C1's correct explanation with a contradictory fulfilled state. |

## D — The current candidate differs from the verified/reviewed one

### Supplied input

```text
Task: Notification duplicate-delivery repair
Owner: Alex

Assignment:
Repair duplicate notification delivery. Deliver a local commit with the repair
and regression test, a passing ["bun", "test", "notification.test.ts"] check,
and independent review of the delivered candidate. PR publication, merge and
deployment are not requested. Task closure is separately controlled by the owner
and App policy; this result does not itself close it.

Workspace:
Assigned linked Git Task checkout; .git is a file and .state/ is ignored.
Current committed candidate: N18. N18 contains the repair and regression test.
Notification behavior changed between N17 and N18.

Retained records:
- Handoff summary: "The repair is verified and reviewed."
- Verification: candidate N17; argv ["bun", "test", "notification.test.ts"];
  assigned checkout; recorded exit 0 with passing regression-test output.
- Independent Bob review: candidate N17; accepted against this assignment.
- The retained record set has no check or review for N18.

Operational capabilities:
- Local checks and bounded Bob review calls are available in the assigned scope.
- develop-change is installed with input { verify: [executable, ...arguments] }.
- Existing source/design work can be retained. No additional human approval is
  required for the authorized local verification and review.
```

### Proposed rubric

- **Outcome:** source work is progress, but the current N18 repair is not yet
  established as fulfilled. N17's records do not certify changed N18 behavior.
- **Method:** obtain sufficient check/review evidence for the current delivered
  candidate using existing capabilities. Preserve applicable source/design work;
  do not require reimplementation solely to refresh receipts.
- **Evidence and limits:** use commit-matched verification **and** independent
  review for the delivered candidate; old records remain historical. The green
  summary does not override their identities. No new approval, PR or deployment
  gate is introduced.
- **Result:** `waiting` or `incomplete` until current-candidate evidence exists.

Accept direct authorized verification and bounded review, or use of the existing
procedure to reconcile the candidate and obtain missing evidence. Do not force a
full implementation cycle. Review and verification need not follow one exact
order, but both must apply after any relevant candidate change.

### Draft calibration excerpts

| ID | Draft judgment | State | Explanation excerpt and reason |
| --- | --- | --- | --- |
| D1 | Accept | waiting | “Retain N18's source work. N17 receipts do not certify the changed current head; run the creator check and obtain independent review for the candidate delivered, then compare commit identities before fulfillment.” Correct evidence applicability. |
| D2 | Accept | incomplete | “Use `develop-change` with the creator's argv to reconcile the existing candidate and obtain its missing check/review evidence; don't demand a new implementation just to replace receipts. Retain the older reports as history.” Acceptable existing path without gratuitous work. |
| D3 | Reject | converged | “The handoff says verified and reviewed and the attached test is green, so this repair is fulfilled.” Accepts summary/status over mismatched identities. |
| D4 | Reject | waiting | “Run the creator check on N18 and then report fulfillment; keep N17's independent review because it is the same repair topic.” Correctly leaves fresh work pending, but fails to obtain applicable review for changed behavior. |
| D5 | Reject | waiting | “Discard the current repair and implement from scratch so the procedure has a new implementation stage to run.” Adds unsupported reimplementation rather than refreshing the missing evidence. |
| D6 | Reject | waiting | “Ask the human to approve rerunning tests or reviews before continuing.” Invents missing authorization. |
| D7 | Reject | converged | “Retain N18's source work. N17 receipts do not certify the changed current head; run the creator check and obtain independent review for the candidate delivered, then compare commit identities before fulfillment.” D1's correct explanation with a contradictory fulfilled state. |

## Meaning-based review and calibration boundaries

The same three questions apply to every example: owed outcome, fitting method,
and sufficient evidence/scope. Map them to the existing semantic rubric's
`appropriate_choice`, `evidence_and_scope` and `no_contradiction` rules when an
implementation is approved; do not add another plan schema or scoring layer.

- Correct state or a workflow name alone is insufficient. A plausible wrong
  method can fail even with the right goal; a correct name can accompany false
  completion. Contradictions anywhere in the result matter.
- Accept equivalent language, concise answers and sufficient simpler methods
  **where the case contract permits them**. Do not grade exact phrases, command
  formatting, fixed worker order, word counts or universal review-round limits.
- The executable check must be the supplied one or a demonstrably equivalent
  method accepted by the contract, not syntax-only checking or a fabricated pass.
- Do not infer publication, real execution, workflow provenance or closure from
  result text. B's records establish identity and acceptance, not their producer.
  Note an incidental unsupported producer attribution; reject it if it becomes a
  material basis for fulfillment rather than silently crediting invented evidence.
- Production admission and a substantive correct decision are separate checks.
  JSON-schema validity alone is insufficient: use SDK admission for cross-field
  rules too. The review test builds complete envelopes for all excerpts, including
  semantically wrong but admissible state-only controls. This does not establish
  that a semantic grader would accept/reject any of their proposed labels.
- Unknown/contradictory availability, authority or receipt facts need setup review.
  Do not force an answer by changing target instructions or inventing permission.

These are **28 proposed calibration excerpts**: eight acceptable alternatives and
20 rejected mistakes. Their labels and reasons require exact human review.
Structural/admission checks on this document do not validate semantic grading.
There have been no grader calls and no automated claims that these examples pass
or fail an implemented semantic evaluator.

Run the benchmark-local, no-model review checks explicitly:

```sh
bun --cwd=projects/gym test ./benchmarks/outcome-completion/approach-drafts.test.ts
```

This [review-only test](approach-drafts.test.ts) is not a new evaluator or active
case registration. It reads this document as the draft source, uses the existing
semantic-control format and SDK admission, and checks inputs, identities and
control-envelope consistency. It admits nothing to a live Task engine and is not
yet wired into the standard Gym check command.

Validation of this review revision:

- Eight local review tests passed (136 assertions), including SDK admission of all
  28 complete envelopes. The wrong-meaning controls are intentionally admissible.
- The benchmark-local test passed a separate TypeScript check. The retained pilot
  SDK independently confirmed the same waiting/response cross-field rule.
- Six existing Node/scorer regressions and active case catalog validation passed.
- The broader shared-checkout `gym:check` attempt was **not green**: 362 Bun tests
  passed and five failed in rescore evidence, evaluation-plan revision and migration
  preservation tests. Those concurrent areas were left untouched; this is not a
  claim that the full suite passed. The local log is
  `/tmp/gym-approach-draft-full-check.log`.

No model or semantic-grader calls were made for this review.

## Approval and implementation checklist

Before activation, review:

1. One owner per case; two existing IDs revised, two new IDs added only here.
2. All supplied assignment, capability, authority and candidate facts, including
   C's standalone context and the absence of an override to the linked-worktree rule.
3. The common operational-result footer and A/C/D versus B state expectations.
4. Required evidence, allowed alternatives, forbidden claims/effects and every
   proposed calibration judgment. Keep the keys outside target inputs.
5. Actual target/entry compatibility. In particular, do not claim a hosted Git
   Task setup implements C's standalone operational context without validating it.

After approval: preserve earlier versions/results, update only this benchmark's
own definitions/membership and per-case draft review records, and materialize the
reviewed control envelopes in the existing `semantic_controls` format. Replace
this review test's unregistered-ID assertions with active ownership/membership
checks and connect it to standard checks. Run non-model validation before seeking
permission for a fresh fixed-input baseline. Approval of this draft's direction is not approval of
its exact answer keys, labels, model runs or target changes. Behavior evidence
remains a separate [proposal](../BEHAVIOR-REVIEW.md).
