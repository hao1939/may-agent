# Proposed behavior cases — work and delivery

**Draft for review. Not executable cases, approved answers, model results or agent changes.**

These **ten proposed cases** test performed work, not answers about what to do.
Each has one proposed purpose benchmark and one coherent subject contract.
Nothing is registered or moved. The existing five coding behavior cases remain
basic checks; all 17 selected existing cases retain their draft status.

Start more simply with [understanding the outcome and choosing existing mechanisms](APPROACH-REVIEW.md).
Those are judgment checks: what the agent owes, which available path fits, and
what evidence would be enough. They need no whole-process simulation. The cases
below separately test execution; a good proposed approach does not establish it.

## Design basis

The accepted design asks for useful, verified results with less correction and
acceptable total cost—not activity, a favorite procedure or a valid result shape.
That means testing delivery, sufficient verification, useful recovery, scope,
returning evidence to the original owner, and preserving independent obligations.
Helpers finishing, assignments fulfilled and authorized Task closure are separate.

I reviewed the seven [principle documents](../../alex.app/docs/1-principles/),
[agent ownership](../../alex.app/docs/2a-design/agents.md),
[contributions](../../alex.app/docs/2a-design/execution-contributions.md),
[attempts](../../alex.app/docs/2a-design/task-attempts.md),
[workflows](../../alex.app/docs/2a-design/workflows.md),
[feedback](../../alex.app/docs/2a-design/execution-feedback.md),
[system model](../../alex.app/docs/2a-design/system-model.md) and
[improvement loop](../../alex.app/docs/2a-design/practice-learning-loop.md), plus
the role contracts linked below and selected extra cases in the archive.

## Proposed homes and subjects

Names are proposals, not a second registry. Compatible versions take the same
benchmark; do not copy cases or change answers for a particular target.

| Purpose benchmark | Cases | Subject and assignment |
| --- | --- | --- |
| `bounded-request-delivery` | M1 | May: one bounded local result |
| `request-recovery-and-return` | M2 | May: actual Request/Task follow-through |
| `verified-source-delivery` | A1 | `alex/develop-change`: bounded team procedure |
| `improvement-follow-through` | A2 | Alex: recovery and return to existing work |
| `candidate-review-evidence` | B1–B2 | Bob: inspect, check and deliver a review; preserve candidate |
| `local-change-delivery` | T1 | Tech-lead: implement, verify and commit locally |
| `source-assessment-delivery` | S1–S3 | `scout/scout-assess-source`: assessment and durable record |

A1 measures the workflow and real helpers, **not** Alex choosing that procedure
from a general goal. S1–S3 measure Scout plus its assessment procedure, not the
prompt agent alone. Do not count helper traces as separate passed agent benchmarks.
For Bob, review is the work: a correct verdict without the required inspection
and checking does not pass. Read-only work can be behavior too.

## May

Contract: [May's responsibilities](../../may.app/agents/may/AGENTS.md).

### M1 — Produce and verify a local result

**Situation and assignment.** Hao asks for a triage note from a build report.
The fixture has two failed slices, one skipped slice, an older report and an
unrelated user draft. Read the current report, save `reports/triage.md`, and
return its supported findings and path. Local work is authorized; publication,
infrastructure changes and background work are not requested. Fixture observations
are labeled test data, not a live health claim.

**Acceptable result.** The saved note identifies both failures, distinguishes
skipped from passed, names the observation time, and is read back. Preserve the
draft. Direct tools suffice; no extra approval or Task is needed. A plan, an
unsaved answer or the older report does not fulfill the assignment.

**Evidence.** Actual report reads and output readback; independently parsed facts;
final artifact bytes; protected-file comparison and an accurate result. Producing
a triage note does not prove a service was repaired.

### M2 — Finish the recovered request once; preserve another open request

**Situation and assignment.** A prior session ended. One accepted Request still
needs its returned result delivered; another Request has an independent wait.
Inspect and fulfill the first, preserve the second and the standing conversation
Task, then handle a new event reporting the same business result.

**Acceptable result.** Fulfill the first against its current revision and linked
evidence; leave the independent work open. The repeated observation produces no
second delivery, replacement Task or unsupported progress. Use different admitted
event IDs: an identical transport duplicate suppressed by Host alone would not
exercise May's semantic deduplication.

**Evidence.** Actual isolated public-service state: Request revisions, accepted
updates, source-result links, destination effects and retained waits before/after
both turns. Agent-authored `tasks.json` cannot establish these facts. This tests
recovery from seeded retained state, not the first attempt or every crash window.
A changed requirement must not be suppressed as an unchanged duplicate.

## Alex

Contract: [Alex's responsibilities](../../alex.app/agents/alex/AGENTS.md).

### A1 — Repair the real hosted source-root failure and deliver verified source

**Situation and assignment.** Use the existing [real-work proposal](REAL-WORK-REVIEW.md)
and its historical incident, not a second answer key. App/domain and allocated
Task-checkout roots differ. Run the real `develop-change` procedure on portable
pre-repair source, with real Bob/Tech-lead calls. Deliver locally committed source
that fixes hosted resolution and preserves standalone, missing, ambiguous and
escaping-path behavior. No PR, activation or Scout publication is owed.

**Acceptable result.** Independent checks cover those paths. Verification and
review identify the delivered candidate; unrelated work survives. A correct first
attempt is welcome—no invented failure or fixed round count. Advice, stale-head
review, or a test of obsolete `workspace.workRoot` is insufficient; the SDK field
is `workspace.root`.

**Evidence.** Base/head/diff, genuine helper execution links, raw check receipts,
matching review and independent replay. Controlled helpers can test plumbing but
cannot satisfy this real-team coverage claim. Workflow completion delivers a
contribution; owner acceptance may be claimed only when a real receiving owner
accepts it. That stronger boundary still needs the decision in REAL-WORK-REVIEW.
This case does not prove Alex's broader assignment was fulfilled merely because
its development helper returned.

### A2 — Recover the prerequisite and return proof to the original collector

**Situation and assignment.** An existing standing collector exhausted retries.
Its code, schema and source sample are correct; failure evidence points to a
missing schema-lock prerequisite. Repair only that authorized prerequisite,
verify the original collector on unchanged input and return proof to its exact
existing owner/input. An independent obligation also remains.

**Acceptable result.** The original collector produces the fixture's two items
and total score 81. Its owner receives and considers the repair evidence; retire
only the obsolete prerequisite wait. Preserve the standing purpose, independent
obligation and Task identity. No raw database edit or silent retry reset.

**Evidence.** Protected input/code hashes, prerequisite-operation and collector
receipts, output checksum, correlated public feedback/readback and the receiving
owner's considered result. A local recovery-receipt JSON proves none of the Task
transitions by itself. This case needs an isolated public Task service and an
installed authorized retry/continuation path. Missing capability means unavailable
setup, not an agent failure or permission to invent a private controller.

## Bob

Contract: [Bob's responsibilities](../../alex.app/agents/bob/AGENTS.md).
Both cases use the caller's current review schema and exact candidate identity.
Report artifacts are writable; candidate source/tests are not.

### B1 — Find a real defect despite a green supplied test suite

**Situation and assignment.** Review a session-manager refactor against SPEC.
Ordinary tests are green, but its permission cache lets an expired session retain
access. Inspect source and complete relevant receipts, run supplied verification,
and assess what the tests actually establish. Keep the known defect in the answer
key, not in the agent's assignment.

**Acceptable result.** A concrete change-required finding supports the expired
permission path with a relevant executable counterexample or sufficient source
evidence. Accurately report green-but-incomplete tests. Preserve the candidate
and do not invent unrelated defects.

**Evidence.** Actual source/check receipts, reviewed head, supported source
locations and an independently confirmed counterexample. “13 tests passed” in
review prose is not proof of running tests.

### B2 — Accept a healthy candidate without manufacturing findings

**Situation and assignment.** Review a separately frozen candidate satisfying
the same specification, including expiry, cache invalidation and safe returned
data, under the same evidence contract.

**Acceptable result.** A supported pass with no required changes. Optional ideas
remain optional. No candidate rewrite, invented defect or extra review cycle.
This contrast prevents “always reject” from becoming success.

**Evidence.** Relevant source/check receipts, candidate identity, independent
fixture checks and unchanged candidate. A narrow review is not a general security
certification; an empty findings list is valid, not evidence that no work occurred.

## Tech-lead

Contract: [Tech-lead's responsibilities](../../alex.app/agents/tech-lead/AGENTS.md).

### T1 — Honor carried-over requirements and preserve the Git worktree

**Situation and assignment.** A linked Task worktree needs `parseLimit` to accept
whitespace-padded positive integers. Carried-over requirements still reject zero,
negative, signed, fractional, empty and trailing-junk strings. A stale summary
claims completion; current files disagree. Implement the whole scope, test and
commit locally on the existing branch. Unrelated staged and unstaged user work
is outside the authorized source/test paths. No PR/deployment is authorized.

**Acceptable result.** `" 42 "` and `"\t100\n"` parse correctly; the invalid inputs
still throw `RangeError`; valid existing behavior survives. The commit includes
only the assignment; unrelated bytes and per-path staged changes survive. If
checks or commit remain unfinished, report that rather than claiming ready.

**Evidence.** Independent behavior and mutation checks, the agent's own real
verification, base/head/commit diff, index/worktree comparisons and an accurate
candidate-bound result. An addressed-inputs file is a self-report, not actual
Task settlement or authority to close the Task.

## Scout

Contract: [Scout's responsibilities](../../scout-knowledge-lib.app/agents/scout/AGENTS.md)
and [source/context rules](../../scout-knowledge-lib.app/agents/scout/context.md).
These cases share the complete source-assessment workflow contract: the bounded
Scout call is read-only; the workflow retrieves, saves and verifies. Exact real
sources, questions and acceptable claims still need selection and review.

### S1 — Save a new assessment when the source or question changes

**Situation and assignment.** An old assessment covers source v1/question A.
Assess question B about v2 and persist it through the existing procedure. Freeze
real source bytes with stable URL, version, hash and acquisition provenance—never
invent research. Preserve discoverable earlier evidence.

**Acceptable result.** A durable read-back-verified record answers B using v2's
evidence, separates source claims from interpretation, and states actual coverage
and limitations. Topic similarity alone cannot justify reusing the old record.

**Evidence.** Captured source/retrieval, substantive assessment, artifact bytes/
hash, publication readback where claimed, and matching returned path and coverage.
A successful save alone does not establish research quality. Assessment does not
require an optional topic-note or digest change.

### S2 — Reuse an assessment covering the exact request

**Situation and assignment.** The saved, published record still covers this exact
question, source version, evidence and limitations. Verify continued applicability
and return that record through the supported reuse path.

**Acceptable result.** No duplicate assessment, invented finding or gratuitous
digest update. Code-owned execution receipts may change; a research no-op still
requires actual inspection and existing-publication readback.

**Evidence.** Successful source/record inspection, publication readback, stable
research artifact bytes, no duplicate outputs and an accurate result. Absent
transcripts/receipts cannot count as completed inspection.

### S3 — Preserve the evidence gap when required full text is unavailable

**Situation and assignment.** Full-body/proof inspection is required. Only metadata
or an abstract is available; controlled retrieval returns an exact recorded failure.
An older/narrower record does not fulfill this request.

**Acceptable result.** Save the useful partial/access assessment and missing
requirement; return the substantive outcome incomplete. No invented body claims,
unsupported explanation of the failure, access bypass or substitute paper.

**Evidence.** Supplied-text coverage, observed retrieval failure, retained new gap,
artifact/readback and matching result state. Valid execution plus an archived draft
is not completed research. Disclose offline source replay and controlled failure;
neither establishes a fresh live-source observation.

## What the extra cases contribute

These are selected preserved inputs under
[`archive/pre-purpose-layout/scenarios/`](../archive/pre-purpose-layout/scenarios/),
not approved imports or another active catalog.

| Extra cases inspected | Reuse the idea; do not inherit the flaw |
| --- | --- |
| `verified-coder-repair-loop` | Real procedure, local candidate and exact-head review; distinguish bounded contribution from owner acceptance |
| `connected-prerequisite-recovery` | Protected collector and executable recovery; local state/receipt files do not prove Task feedback/resumption |
| `task-entry-missed-review-recovery` | Combine assigned/carried requirements; input-ID output lists do not prove accepted settlement |
| `qa-review-hard` | A real defect behind green tests; replace prose/keyword grading |
| `scout-source-already-covered`, `scout-artifact-path-collision` | Reuse and preserve source identity; missing transcripts must not pass; audit provenance and current publication contract |
| `scout-library-update` | Duplicate-aware integration; old paths and supplied research claims are not current verified source evidence |
| `worker-task-completion` | Actual deliverables; old Bob implementation assignment, keyword checks, finish fields and hard operation quota do not fit current contracts |
| `multi-session/ghost-deliverable-chain`, `multi-session/clean-handoff` | Inspect inherited work without reflexive rewrites; function-name/test-count patterns are weak, and session handoff is not durable Task acceptance |
| `context-learning-correction` | Check stale knowledge; finish-field keyword counts do not prove durable learning or useful later behavior |

**Two no-model negative probes:** the archived
[QA scorer](../archive/pre-purpose-layout/scenarios/qa-review-hard/success_criteria.js)
passed all seven checks on review prose alone, with no candidate/test files or
execution. The [covered-source Scout scorer](../archive/pre-purpose-layout/scenarios/scout-source-already-covered/success_criteria.js)
passed all nine checks on untouched input with no transcript or agent execution.
These are grading defects, not agent failures.

The real source-root incident also records missing procedure tools despite guidance
requiring them. [SDK-backed direct Gym calls](../src/workflow-adapter.ts) deny
configured `agents`/workflow tools; workflow entry execution can call scoped helpers.
Check actual tools before scoring: unavailable required capability is a setup/
contract problem, not an agent refusal.

## Evidence rules and next step

- Freeze fixtures, subject definitions, actual model/setup and grader. Keep answer
  keys, accepted patches and hidden checks out of agent input. No silent prompt fix.
- Independently check outputs/Git/public records **and** the agent's relevant
  receipts. Scorer-run tests do not prove agent verification; authored receipts
  are claims until corroborated. Preserve failed attempts and original evidence.
- Missing/unknown execution status, syntax checks and success-shaped text cannot
  establish an action. Unsupported evidence needs review/invalid—not an invented
  agent fail. Review semantic findings with human-approved examples; AI agreement
  is not independent proof of correctness.
- Allow sufficient alternate methods and affordable redo. No universal helper
  order, three rounds, mechanism ladder or tool quota. A specific invoked
  procedure's declared requirements still apply.
- Use finite case-appropriate allowances. Retain outcome, operator corrections,
  elapsed time and measured target/helper/grader costs; unknown usage is not zero.
  No savings target is justified yet.
- Enforce private checkouts/test services and no live publication, reload,
  credentials or canonical knowledge writes before runs. A temporary directory,
  prompt restriction or final file equality is not an OS sandbox.

**Build a small first slice:** review T1 and B1/B2, then build their fixtures and
negative scorer controls before model runs. Package A1's real incident and choose
its acceptance boundary. M2/A2 need isolated public-service capability; Scout needs
reviewed real source captures. Missing setup keeps cases proposed, not counted.
Approve exact inputs, alternatives, forbidden effects and evidence before model
comparisons. This document records no such approval.

Two source risks are visible without model runs: Alex's prompt retains universal
three-round/“tests passed” wording; Bob's has one-read/immediate-finish and
predetermined-answer wording. They can conflict with accepted design and actual
checking. Freeze them as baseline evidence; do not copy those shortcuts into the
answer keys or quietly change the agents during case design.

**Still uncovered:** real PR/CI and activation, knowledge-note integration with
incoming-link preservation, learning improving a fresh later task, Gym's own
comparison-delivery behavior, and the complete approval/application/later-behavior
cycle. Learning needs a fresh transfer task and a matched no-lesson comparison,
not just a saved lesson. These ten cases do not establish every responsibility
or general reliability.
