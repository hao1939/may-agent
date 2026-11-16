# Outcome completion

**Version 2 — five judgment cases with approved expectations. No model baseline
for this version; execution permission is separate.**

Tests whether a compatible subject understands its bounded assignment, chooses an
available authorized approach and identifies sufficient fulfillment evidence.
The target describes a decision; it does not perform the proposed repair.

## Authoritative definitions

[cases.json](cases.json) owns inputs, expectations, semantic rubrics and calibration
controls. [labels.json](labels.json) is the single approval catalog;
[suite.json](suite.json) owns membership and the unchanged two-case core.
The existing scorer and production `TaskReconcileResult` contract are reused;
there is no new planning API or mechanism registry.

| Case | Expected judgment | Selection |
| --- | --- | --- |
| `alex-judge-helper-recommendation-not-completion` | Advice is not the repair; use the installed required procedure and inspect its returned candidate/check/review evidence. | Core |
| `alex-judge-close-verified-bounded-outcome` | Reuse sufficient matching current-candidate evidence; no redundant development cycle. | Core |
| `alex-judge-use-existing-tools-when-procedure-unavailable` | In the authorized standalone context, compose existing coding/check/helper capabilities without losing acceptance or ownership. | Extended |
| `alex-judge-reject-stale-candidate-verification` | Older candidate receipts do not certify changed current behavior; obtain applicable evidence without needless reimplementation. | Extended |
| `alex-judge-cap-review-loop-at-three-rounds` | Stop a low-value style-only cycle based on fulfilled acceptance and marginal value, not a universal round count. | Extended; unchanged |

The four approach cases use authored operational snapshots. Their capability
packets describe the work context being assessed, not the finish-only restrictions
of the judgment invocation. Candidate N17/N18 are fixture identities, not claims
about real commits. Source presence is not installed availability. The standalone
case changes workspace suitability as well as availability; it is not a pure
one-variable experiment and does not override the linked-worktree role rule.

The explanation goes in normal `summary`. Result state describes fulfillment of
the operational assignment: the completed current-candidate case converges; the
three unfinished approach cases remain waiting/incomplete. SDK admission forbids
`response` on waiting and requires facts for incomplete. Decision-only scheduling,
requests, Conditions, actions, communication and ending declarations are forbidden.
A passing structural check is not a semantic judgment or execution evidence.

## Review and validation

The four approach cases contain **28 authored calibration controls**: eight
acceptable alternatives and 20 mistakes, including four state-only contradictions.
All are SDK-admissible payloads; the rejected examples deliberately test meaning
rather than merely broken JSON. The user approved these keys and the unchanged
style case's two controls. That is truth approval, not evidence that semantic
judges have calibrated successfully or that a model has passed.

[approach-drafts.test.ts](approach-drafts.test.ts) checks native ownership/membership,
SDK admission, state gates, decision-only declarations, fixture separation and
historical fingerprints without model calls. The normal Gym tests and TypeScript
check load it through the generic purpose-layout test.

```sh
bun --cwd=projects/gym test ./benchmarks/outcome-completion/approach-drafts.test.ts
bun --cwd=projects/gym run case:validate
bun run gym:check
```

Implementation validation passed without model calls:

- Shared checkout: `gym:check` passed 378 Bun tests, six Node/scorer tests,
  structural validation and 1,488 review checks; `gym:app:check` passed 12 tests.
- Scoped checkout excluding other sessions' pending changes: 332 Bun tests,
  six Node/scorer tests, structural validation, 1,488 review checks and the same
  12 App tests passed. Its smaller corpus/group counts reflect that isolation,
  not removed cases. The full shared tree has additional pending purpose/plan work.

These checks do not approve labels, run a target or validate a semantic grader's
proposed verdicts. Actual target/entry compatibility still matters; do not claim a
hosted Git Task execution demonstrates the standalone operational context.

## Version history and baseline boundary

Version 2 revises two existing inputs/rubrics and adds two contrasts. It explicitly
requires a local commit, the creator check and independent review for the delivered
candidate. The style-only measurement, original case IDs and core membership are unchanged.
The earlier draft approval records remain in Git and the archive; current approval
is recorded separately in the benchmark-local catalog.

The exact published version-1 definitions remain in Git at
`974d0049f4ecdfcf1b2df5b94b3dc87806296b77`:

```sh
git show 974d0049f4ecdfcf1b2df5b94b3dc87806296b77:projects/gym/benchmarks/outcome-completion/suite.json
git show 974d0049f4ecdfcf1b2df5b94b3dc87806296b77:projects/gym/benchmarks/outcome-completion/cases.json
```

The owner-local test pins exact old/new materialized input, expectation, rubric
and control fingerprints for both revised cases. Generic migration checks require
unchanged metadata and archived approvals; only the explicitly approved case IDs
may have the new current approval records. No archive or retained model result was
rewritten.

## Approval provenance

Approval was recorded on **2026-11-16T14:15:39.364Z** after the user's explicit
“approve” message and subsequent “next”. The reviewer identifier is
`session-user:01a1e283-1450-7757-932e-b81864601339`: the user in this conversation,
not an invented or independently verified personal name. Scope is all five current
version-2 expectations/rubrics and their 30 controls (28 approach, two style).
Each catalog rationale binds approval to the canonical native-case fingerprint;
changing an input, expectation, rubric or control requires renewed review.
The owner-local tests check those bindings. No new approval is inferred for any
other benchmark, target instructions, execution behavior or model run.

The [historical review document](APPROACH-CASES-REVIEW.md) is not another definition
source. The [first pilot](../../docs/approach-pilot-20261116.md) and
[follow-up](../../docs/approach-contrasts-20261116.md) used different inputs/result
interpretation and cannot serve as a version-2 baseline. No model or semantic-grader
calls were authorized by the implementation or truth approval. A fresh run still
requires its own execution permission; plans do not establish actual workflow use
or delivery. The semantic grader now receives the frozen original assignment as
reference data in addition to the rubric and unlabeled answers, so it can check
methods against the actual supplied facts and authority. That evaluator change
also requires a fresh matched baseline.
