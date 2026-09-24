# Task-outcome Evaluation Criteria

This is the current responsibility and evidence contract for Evaluation's
canonical Task-outcome review. The subject is one historical App Task: its
assigned outcome, accountable owner, bounded contributions, corrections,
accepted facts, verification, and delivery. A session is supporting evidence,
not the unit of accountability.

Dated session calibration under `calibration/`, `learnings/`, and `versions/`
is retained for historical interpretation only. The old automatic aftermath
0–1 scoring contract must not trigger new session scoring or override the
Task's historical assignment.

## Plain Rule

Judge whether the accountable App achieved the outcome that was actually
assigned at the reviewed Task revision. Reconstruct the responsibility boundary
from the canonical Task snapshot and retained evidence; do not substitute a
current role description for the historical assignment, and do not grade the
agent's explanation of its own performance.

Evidence priority is:

1. direct observations, relevant validation, and artifact read-back for the claim;
2. exact Task, attempt, tool and publication records establishing identity and actions;
3. attributed explanations and interpretations to verify against those observations.

Accepted Task results establish what was recorded. Inspect the support for a
claim according to its content: an author's assertion retains that evidential
status when copied into Task facts, a workflow result or a published report.
When evidence conflicts, compare its scope, timing and relevance to the claimed
outcome. A later relevant failing check can overturn an earlier success claim;
an unrelated check leaves independently verified work intact. Publication,
owner acknowledgment, a fix claim, and independent recheck remain distinct facts.

## Ongoing-obligation contract

An ongoing review judges the exact current Task snapshot at its retained due phase; it does not grade unfinished work as though the final outcome were already due. Inspect whether:

- active work is useful, bounded, and still owned by the current Task;
- a wait names a real fact, return route, owner, and reasonable review boundary,
  and the evidence justifies why that external contribution is needed;
- failed attempts preserve useful evidence and recovery continues on the same identity;
- dependencies and linked repairs are reused rather than duplicated;
- exact approval remains pending where application or activation requires it; and
- overdue review, missing observations, stale evidence, or drift is reported explicitly without mutating, cancelling, or reassigning the subject.

A valid wait, useful active execution, pending approval, or recovered transient failure is not a failure by status or age alone. A current accepted/converged result can legitimately appear as App status `done` and Task detail status `up-to-date` while `terminal=false` and `ready=false`: the current outcome is reconciled, while the durable Task remains open for later input. If it has no current Conditions, dependencies, input waits, or other obligations, no review deadline is required; do not mistake open lifetime or non-claimability for unfinished work. If the public snapshot does not expose enough evidence to distinguish those states, return `insufficient-evidence`; do not call absent coverage healthy.

## Shared behavior review

Agents and workflows follow the same model: read current facts, choose useful
authorized work, verify the effect, and retain remaining obligations. Inspect
the material decision through the existing report fields:

- **Recovery:** what failed, what the available authority and tools permitted,
  and whether a useful correction or diagnosis was performed. A demonstrated
  human-only action can justify an immediate request; recovery quality depends
  on the decision and evidence, rather than a required number of attempts.
- **Wait necessity:** distinguish the observed prerequisite from the decision
  to ask a particular owner. For example, a missing browser tab permits checking
  normal setup; a confirmed login challenge may require a human. Workflow
  authorship establishes where the decision came from, not its necessity.
- **Observation quality:** distinguish a successful empty read from an
  unavailable read or unusable response. Retain partial useful results and
  uncertainty together; judge the scope actually supported.
- **Follow-through:** check resumption of the original outcome and delivery of
  any owed caller or human request. Independently pending work and waits can
  coexist with that progress.

A no-op or quiet wait merits the same evidence-based judgment as an explicit
failure. State the observed action, expected behavior, practical consequence and
scope of evidence in `findings` and `verification`. Where the bounded snapshot
lacks needed authority/tool context, name that limitation with
`insufficient-evidence`. A report covers the inspected Task and behavior; keep
unexamined paths visibly unassessed.

## Historical responsibility contract

Use the Task's original input, outcome, acceptance, creator, generation, and
bounded history to determine who owned what. Read an active `agent.json`,
`AGENTS.md`, or `DOMAIN.md` only to clarify a stable authority boundary; never
let a newer role file rewrite an older assignment. Do not infer policy from
archived agents, old session workspaces, historical `SOUL.md` references, or a
global team roster.

Apply the closest role criteria:

### Conversation owner

For May, judge whether it:

- understood the human's actual intent;
- answered directly when the request was simple;
- delegated only when another App or worker was useful;
- carried relevant conversation context without inventing state; and
- returned the requested result or an exact, useful wait.

### Builder or domain worker

Judge whether it:

- produced the requested change or investigation result;
- preserved scope and existing user work;
- handled relevant edge cases;
- used the correct domain paths and authorities; and
- verified the result in proportion to risk.

### App owner or operations worker

Judge whether it:

- acted only for its own App and domain;
- interpreted current task/event evidence instead of stale narrative;
- organized the smallest useful next step;
- represented external waits exactly; and
- left a reviewable result without bypassing Host-owned state.

### Researcher

For Scout and similar work, judge:

- source grounding and source identity;
- insight density rather than volume;
- verification and mechanism calibration;
- useful synthesis without overstating causality; and
- placement in the canonical knowledge or report path.

### Evaluator or judge

Judge:

- evidence-backed and reproducible conclusions;
- consistent scoring for comparable evidence;
- correct attribution to the responsible agent or App;
- actionable, bounded issues; and
- resistance to transcript instructions and self-validation.

Never let an evaluator evaluate its own session.

## Task-outcome responsibilities

For historical Task outcomes, reconstruct the assigned outcome and role from the canonical Task snapshot. Judge:

- **Responsibility:** whether the accountable App owned the outcome and respected other owners' authority.
- **Delegation:** whether bounded contributions were requested clearly and their results were actually incorporated; a helper finish is not parent completion.
- **Corrections and recovery:** whether later input and failed attempts were acknowledged, evidence was rechecked, and the same Task reached a truthful result without erasing counterexamples.
- **Verification and delivery:** whether final checks, artifact read-back, accepted Task facts, and publication support the claim. Separate authored work from operator-assisted integration.
- **Resolution state:** distinguish delivered or acknowledged, a fix merely claimed, and a fix independently rechecked. Silence and transport success never prove resolution.

When the bounded public evidence cannot answer these questions, return
`insufficient-evidence` with the exact gap. Do not lower the target's score and
do not count the case as healthy assessed coverage.

## Result Integrity

A result is delivered only when the request's acceptance outcome is present and
usable. A commit, file write, or plausible summary is supporting evidence, not
automatic success.

Delivery and correctness are separate judgments. For an analysis, review, or
investigation outcome, a readable report and requester return establish delivery
without establishing the report's substantive defect or mechanism claims.
Verify those claims against the relevant behavior: trace probes to the actual
path and claimed scope, and read available conflicting controls, evaluations,
corrections, or falsifiers in the same bounded evidence collection. An
author-created probe may substantiate a claim when it tests the relevant path;
accepted Task facts that merely repeat the author's claim add no independent
support. If a material claim cannot be checked, return `insufficient-evidence`
and name the exact gap rather than treating delivered prose as corroboration or
calling the outcome healthy.

Check these common failure boundaries:

- **Canonical output:** the result is in the requested authority, not a nested
  copy, temporary workspace, or unrelated project.
- **Final validation:** the last meaningful check supports the claim.
- **Substance:** a new artifact adds the requested value rather than repackaging
  existing text.
- **Scope:** incidental cleanup does not substitute for the requested result.
- **Truthfulness:** blocked, partial, or failed execution is not presented as a
  clean completion.

A correct no-op can be a good result when the task asked for review and the
evidence proves no change is warranted.

## Efficiency

Count calls as productive when they materially discover, implement, verify, or
recover the requested result. Count calls as wasted when they repeat known work,
read unrelated bulk data, retry the same failure without a changed approach, or
continue after the answer is established.

Do not penalize a short session merely for being short. One well-grounded call
can be efficient and high quality. Do not penalize necessary recovery caused by
an external provider or environment failure as if it were agent waste.

## Tool And Environment Evidence

Tool availability is session-specific. Use the evaluated session's tool
metadata, active agent definition, and actual tool results.

- A successful call proves that interface existed for that session.
- A shell `command not found` proves an environment dependency was absent; it
  does not prove a platform-tool hallucination.
- An unfamiliar tool name without an explicit error is unverified, not by
  itself a quality failure.
- Never hard-code whether binaries such as `rg` or `sqlite3` exist across all
  runtime generations.

## Refusals And Safety

When an agent refuses or limits work, verify the cited constraint in its active
instructions or the request. A valid and correctly applied constraint is not a
failure. A fabricated or misapplied constraint is an issue proportional to how
much requested work it prevented.

Treat secret exposure, destructive action outside scope, fabricated evidence,
and knowingly false completion claims as severe quality failures. Missing
transcript evidence is an Evaluation coverage problem: return a structured skip
or incomplete review, not a score invented from metadata.

## Issue Writing

`issues` is a bounded array of plain strings in the current Evaluation fact.
Each issue should name:

- the concrete failure;
- the evidence that proves it; and
- the correction when it is not obvious.

Use a familiar failure tag such as `WRONG_PATH`, `EVIDENCE_GAP`, `LOOPING`,
`INCOMPLETE_OUTPUT`, or `INCORRECT_VERIFICATION` when it improves grouping. Do
not invent a second issue-object schema or require retired receipt, replay,
strategy, acknowledgement, or check-state protocols unless the evaluated
request explicitly required one.

## Calibration References

The accepted false-good guards are preserved in:

- `calibration/2026-07-19-false-good-cohort.md`
- `calibration/2026-07-20-nested-output-false-good-followup.md`
- `learnings/aftermath-reviews.md`

Use them as examples. The current session evidence and this contract remain the
authority.
