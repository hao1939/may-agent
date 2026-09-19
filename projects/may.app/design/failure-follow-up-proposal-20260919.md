# Following failures through the improvement process

Refined for a user-authorized May implementation assignment, September 19, 2026.
Copied deliberately from the uncommitted reviewer source at
`/app/projects/may.app/design/failure-follow-up-proposal-20260919.md`, SHA-256
`74d729af8a7af520904fb60cbe0fd8e9804c3813aa0a0f562aa107fd840e14de`;
this candidate copy is Prettier-formatted, so its file hash differs while the
proposal decisions are retained. Preparation, isolated implementation and trials
are authorized. This document does not claim installed behavior or authorize application to live source.
This is May installation policy.
The common responsibility contract remains in
[System boundary](../../may-agent.app/docs/2a-design/system-boundary.md#ownership-and-intervention).
The existing [improvement loop](evaluation-improvement-loop.md) owns candidate,
approval, application and outcome follow-up. This proposal adds another source
of evidence to that loop; it does not create a parallel repair lifecycle.

## Second review: alignment, simplicity and value

The [core review rule](../../may-agent.app/docs/1-principles/core-principles.md#review-rule)
requires a useful outcome, a simpler-alternative check and a lifetime cost
judgment. The useful outcome here is that an observed unresolved failure reaches
someone who decides what to do, and a worthwhile repair can use the established
approval/application path. Creating more repair Tasks is not the goal.

| Choice                                                      | Existing design and value                                                     | Cost and decision                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Recover through the current worker and assigning owner      | Existing caller feedback, Task recovery and responsibility contract           | Reuse; another recovery agent adds a handoff without a demonstrated benefit                                        |
| Let execution evidence enter the improvement decision       | Avoid waiting for periodic Evaluation when a blocker is already known         | Start with May guidance and ordinary message/Task context; retain source-specific evidence validation              |
| Retain the decision and repair link in current Task results | Existing authority and current-first resource convention                      | Reuse readable results; no issue registry, mandatory per-error record or mirrored status                           |
| Agent decides whether and how to repair                     | Existing agent-selected workflow and value/cost rules                         | Guidance first; no failure classifier, numerical score or forced workflow                                          |
| Use suitable verification and exact human approval          | Existing deterministic checks, optional Gym comparison and approval contracts | Verify these compose for execution-origin findings; do not manufacture an Evaluation report or Gym success receipt |
| Add a new fallback route, scanner or timer                  | Could cover currently unsupported cases                                       | Defer until a bounded trial demonstrates a gap that existing feedback and due review cannot address                |

The lower-cost first candidate may consist of App guidance, a small clarification
to an existing helper, and meaningful composition checks. No Host code change is
a valid result when existing mechanics suffice. Documentation alone is insufficient
to claim the agent selected and completed the intended follow-up in a trial.

## One process, immediate recovery and considered improvement

A failed attempt first belongs to the work that produced it. The worker reads
the result and chooses a safe next action within its assignment. Existing Host
recovery handles vanished executions and paced retries on the same Task. Neither
an error log nor a retry proves that someone has addressed the cause.

When the failure suggests a worthwhile change beyond ordinary recovery, the
assigning owner coordinates help. May is this installation's coordinator for
cross-App work. She reuses a linked repair or assigns the responsible App/team
one independently owned outcome. Known failures need not wait for Evaluation's
periodic sample. Evaluation provides independent evidence and can also discover
poor results that completed without an execution error.

```text
execution failure -> original worker/owner -> recover within current work
                                        \-> worthwhile change
Evaluation finding or user correction ----> same improvement decision
                                             -> responsible team prepares
                                             -> appropriate verification
                                             -> human approval
                                             -> application and adoption check
                                             -> original outcome rechecked
```

These are composable actions through ordinary Tasks, messages and capabilities.
The agent selects useful workflows. Code does not launch a fixed development
workflow whenever a command returns a nonzero exit status.

## Who follows up

| Responsibility                                                    | Accountable party                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Interpret a tool result and continue within the assignment        | Current worker, whether agent or workflow                                       |
| Decide scope, seek help, accept the outcome or stop spending      | Assigning owner                                                                 |
| Coordinate cross-App repairs and judge their necessity and value  | May, under standing preparation authority                                       |
| Diagnose, implement and verify a change                           | Responsible App/Host team; May can delegate technical work to Bob and tech-lead |
| Independently assess observed work                                | Evaluation, within its supported subject scope                                  |
| Compare behavioral candidates when needed                         | Gym                                                                             |
| Approve applying the exact change and displayed activation scope  | Human                                                                           |
| Retain evidence, deliver supported feedback and recover execution | Host and source adapters                                                        |

An existing owner need not ask May to coordinate every routine mistake. Gym
does not own repairs or judge every failed test. Host mechanics need portable
regression and integration tests; behavioral changes may need Gym comparisons.
A broken Evaluation or Gym capability is work for its responsible team, using
independent checks. It must not be required to certify its own repair.

## When to act

Separate delivering a fact from commissioning a change. Delivery uses the
existing supported return path immediately. The agent decides what the fact
means at its next safe execution/reconciliation boundary.

| Observation                                                                | Initial response                                                  | When improvement work is justified                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Expected negative test or unsuccessful search                              | Interpret the result in context                                   | Only if it reveals a real requirement gap                                           |
| Temporary outage or correctable command mistake                            | Recover safely in the same Task                                   | Recurring cost, unacceptable risk or an identified reusable defect                  |
| Repeatable failure prevents the requested outcome                          | Tell the assigning owner with evidence and attempted alternatives | Investigate promptly; the first convincing occurrence can suffice                   |
| Successful execution produces poor work                                    | Owner/user feedback or independent Evaluation                     | A current, useful finding survives review                                           |
| Report matches accepted repair work                                        | Update/link that work                                             | Changed evidence can change priority or scope; transport repeats do not create work |
| Execution disappears                                                       | Existing Host recovery                                            | Investigate separately if recovery itself is defective                              |
| Feedback cannot reach its owner                                            | Retain the delivery failure and expose it                         | A configured supervisor can help; do not silently transfer the original action      |
| A due review finds an unresolved blocker or repeated unproductive attempts | Reconcile current Task facts through the owner                    | Agent judges whether to change approach, seek help, defer or close                  |

Do not hardcode a universal failure count or interpret silence as lack of
progress. A single serious incident may justify investigation; many expected
failures may justify none. Repeated retries should supply useful evidence to
the owner, not become proof that unlimited spending is worthwhile. Retrying an
external action first requires checking whether it already took effect.

Use existing due reviews/schedules as a backstop for supported current work,
not a new service scanning every log. Test missed-notification and restart
behavior before promising automatic follow-up. May's existing Conversation
supervision schedule covers linked work, not every Task in every App. Conditions
cover their declared waits. Neither is evidence of universal failure discovery.
The separately observed Evaluation schedule catch-up limitation remains outside
this implementation slice.

## What should be enforced, and what stays judgment

Infrastructure should preserve the originating App/Task/operation identity,
retain bounded facts with links to full evidence, and route asynchronous returns
through the existing exact caller relationship. Synchronous tools already return
their results; duplicating them as improvement notifications creates noise.
Transport retries use existing idempotency. Agents judge whether different
reports describe the same issue by rereading current state and linked work.

Use each source's existing evidence reader: Evaluation's publication check for
Evaluation reports, and current Task/execution/operation evidence for execution
failures. When a file materially supports completion or recovery, retain a
structured verified Artifact reference such as `artifacts: [{ path, sha256 }]`
in the owner's Task result so bounded independent review can read it; a path in
prose is not a reference. Use the shared `EvidenceStore` for newly written
evidence and ordinary hash tooling for an existing authoritative file. A hash
binds bytes, not authority or truth. A missing source reference is an
investigation limit, not a reason to invent a report hash or declare recovery.
Share the owner's decision and later repair stages, without replacing all source
adapters with a universal intake.

An owner decision uses accepted Task results and existing Conditions: what is
currently affected, what disposition was chosen, why, who acts next, and any
linked repair/evidence. Do not add a second issue registry, required per-error
Task, or new public input type. A new Task is useful only when the repair has an
independent outcome or lifetime. The original assignment and repair remain
linked without copying their histories into each other.

Keep semantic criteria as guidance: impact, urgency, recurrence, confidence,
benefit versus cost, simpler alternatives, and whether doing nothing is better.
May applies this judgment both before candidate preparation and before asking
for approval. Passing tests alone does not establish that a change is worth
applying. The exact-candidate approval and application checks remain enforced by
the existing improvement application path; ordinary recovery within existing
authority does not need a new approval for every attempt.

The common design explicitly defers automatic supervisor fallback. If evidence
justifies implementing it, use one configurable delivery-problem route through
ordinary App input, preserving original ownership and delivery evidence. Do not
create a recursive fallback hierarchy. If May is also unavailable, retain the
problem visibly for human/operator intervention. A recorded event is not proof
of accepted responsibility or a functioning supervisor.

## Current state first, and honest closure

At first glance show: the affected outcome, present impact, accountable owner,
current action or wait, and the next review/action. Link evidence, prior attempts,
candidate and approval details. For example:

> May's verification is blocked by inherited worker settings. Tech-lead is
> preparing the linked Host repair; next is independent review and full CI.
> The live installation is unchanged. Evidence and candidate are linked.

PR readiness, merge, deployment and recovery of the requested outcome are
different facts. Close repair work only against its declared acceptance; check
the actual adopted revision and the original symptom. Continue a still-open
original Task when the prerequisite is satisfied. Do not reopen cancelled work
or repeat completed external actions just because a repair shipped. Independent
Evaluation of new work can establish whether a broader behavioral benefit holds.

## May assignment and acceptance

Own one ordinary May goal for this independently reviewable improvement. Read
the existing owner/feedback implementation and ask Bob for an independent
alignment, simplicity and value review; use tech-lead for implementation where
useful. Choose the method and workflows. Begin by mapping each required step
to an existing capability and reproducing a concrete missing behavior. Implement
only the smallest necessary correction; a guidance-only candidate is acceptable
if the actual agent trial supports it.

Keep this separate from the ongoing Host worker-context repair/PR #199. Reuse
its evidence as an example, coordinate shared files and tools, and use an
isolated checkout for this candidate. Update May policy and discovery guidance
in `may.app`; change common design in `may-agent.app` only if an actual common
contract changes. Do not copy common rules into a second authoritative spec.
Fold accepted policy into the existing improvement-loop design and keep this
proposal as the scoped decision/trial record.

Bound the pilot to supported May-owned work and linked App feedback. Generic
supervisor fallback, global failure scanning, new health dashboards, schedule
redesign and unrelated Host changes are out of scope. Report any demonstrated
gap separately with its impact and smallest proposed correction. Missing scope
coverage must remain visible rather than being described as healthy.

Preparation ends with a committed candidate, focused checks, retained local
trial evidence, Bob's review and a necessity/value/simpler-alternative judgment.
Separate tests of deterministic mechanics from model-backed agent judgment.
Use temporary workspaces and harmless bounded tasks; a synthetic publication or
approval is clearly marked as fixture evidence. Apply to live source only after
exact human approval through the existing route. Do not send external messages,
bypass PR review, or deploy as a test side effect.

## First trial

Use the current worker-environment defect as a concrete repair example. Preserve
its original blocker, May's team assignment, reproduced baseline, isolated
candidate, review, approval and post-adoption ordinary-command result. This is
currently a human-initiated repair; it is not evidence of automatic discovery.

Before adding machinery, exercise the existing paths with a few bounded cases:

1. An expected failure and a recovered transient create no unnecessary repair.
2. An unresolved defect reaches its owner without waiting for daily Evaluation.
3. A later duplicate Evaluation report links the same accepted work.
4. Changed evidence is reconsidered while old approval remains bound to its
   exact candidate; rejected or absent approval causes no application.
5. A worker crash recovers the same Task; a delivery failure stays visible.
6. After approved adoption, a fresh check demonstrates that the original
   operation works, or leaves the remaining failure open and attributable.

For the pre-approval candidate, case 6 runs in isolation and the live follow-up
remains explicitly pending. Include one real local agent-selected continuation
using candidate definitions in isolation: a task encounters a controlled failure,
May reads the evidence and chooses recovery or repair without a human naming a
workflow. Observe the admitted owner result and linked work; publishing an event
alone is insufficient. Keep the first round bounded to one such blocker and one
expected/recovered control, then expand only to explain a failure or uncertainty.
The deterministic suite covers duplicate delivery, changed evidence, missing
approval, crash recovery and visibility using production modules where relevant.
Reuse existing tests when they already prove the contract; do not rebuild the
whole loop or require a model call for each mechanical case.

Measure accepted ownership, time to a useful decision, duplicate/unnecessary
repair work, cost of repeated attempts, and verified recovery. Log volume,
candidate count and test-pass totals alone do not measure successful follow-up.

## Candidate decision and retained evidence

The bounded pilot selected the guidance-first alternative. The implementation is
commit `28d9751cbd8b9485c5e2d3136168fe58eadc301a` against base
`9eab4e18cb56cd3fabdb0a803579f4bc38d7e35c`. Both agent trials read the
candidate May definition from commit
`f875c95e670d8bab6890e1fefcdf7e049eebd1e6`; that definition is unchanged in the
final commit and has SHA-256
`1ab67c0d485a114ee2d128f0df7f31716c14bc4fe09076cd5b7edb19318a25f9`.
The final commit adds only reliable teardown to the approval fixture after that
trial definition. No Host primitive was justified: existing exact caller
feedback, Task recovery, linked work, source-specific evidence readers and the
approval path were sufficient when May had explicit decision guidance.

The full May check passed typecheck and formatting with 87 tests passed, one
existing Host-path test skipped and no failures. Its retained execution is
`/app/.state/sessions/s_1789762332675_efb38037-be35-4256-aa65-ec02a2a86b69`.
Focused production-module checks cover changed evidence and repair-link reuse,
truthful non-Gym evidence, missing approval causing no source application, and
execution-origin identity in the approval proposal. Existing Host tests supply
the interrupted-execution recovery and feedback-delivery-limit evidence; this
candidate does not claim universal delivery or discovery.

The admitted behavioral evidence consists of two strongly prompted synthetic
feasibility trials, not an unprompted discovery, a baseline improvement
comparison or proof of semantic deduplication:

- `goal/appdep_55cc2eb21d7385388e0488af`, accepted attempt
  `r_1_5edc9f42-726e-4aa1-85ed-d061df93aef4`, observed controlled exit 23 and
  chose `reuse-link-and-stop` for existing Task
  `goal/app_86bea4d7-27bf-4c89-8f51-913c1de62dac`; it created no repair Task.
  The original trial workspace disappeared, so the retained command and report
  readbacks are in
  `/app/.state/sessions/s_1789762264828_90bd216d-17de-461b-81b4-5d0a3ba79326/session.jsonl`.
- `goal/appdep_1faa627cc9d1033b7a37bf13`, accepted attempt
  `r_1_10050441-0ede-47c1-8edd-ac6a3eb5f9a6`, kept a transient in the same Task
  and ran its safe continuation from exit 24 to exit 0 with `recovered=true`;
  it created no repair or improvement work. The retained command and receipt
  readbacks are in
  `/app/.state/sessions/s_1789762265092_55d564fe-d6b2-4137-81dc-269dd7babe67/session.jsonl`.

Bob independently reviewed the exact final commit, canonical accepted Task
results and retained trial readbacks, then approved this bounded candidate for
reviewed source integration. The review is retained at
`/app/.state/sessions/s_1789762434220_8da846a5-8c11-484a-b0b9-7c064951bfa1/result.json`.
The content-addressed evidence index is
`/app/.state/review-pilots/failure-follow-up-20260919/final-evidence.json`
(SHA-256
`6f9d4dc17dd5b441b12e96690a38fd49c1165985bd121087c7ed19b6a7ed762a`).

This evidence supports reviewed source integration, not live activation,
automatic supervision, universal semantic deduplication or recovery of the
original symptom. Source integration, live adoption and a fresh symptom check
remain distinct facts.
