<ai_context>
summary: "Waza's current main branch makes an evaluation capability's evidence ceiling explicit: its controlled release path preallocates attempt identity, freezes selected input bytes, and rejects historical, partial, cached, or unsupported observations, but currently admits only offline mock, no-skills, native-text cases. The published v0.38.10 binary does not include this path. This is static source and project-authored test evidence, not an executed evaluation or release result."
triggers: ["Waza", "agent evaluation", "controlled comparison", "evidence ceiling", "mock evaluation", "release gate", "attempt provenance", "skill evaluation"]
last_updated: "2026-10-15"
source_basis: "Pinned static inspection of microsoft/waza at 54bac1ba9d9579fc2465825921f1a05e8c09728c: repository README and complete tree, release matrix, controlled-comparison contract, controlled orchestration implementation, and project-authored tests. Scout did not build Waza, run its tests, execute an evaluation, or reproduce a release decision."
</ai_context>

# Agent evaluation claims need explicit evidence ceilings

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/microsoft/waza  
**Inspected revision:** [`54bac1ba9d9579fc2465825921f1a05e8c09728c`](https://github.com/microsoft/waza/commit/54bac1ba9d9579fc2465825921f1a05e8c09728c)

## Question

How should an agent-evaluation tool stop a narrow, well-recorded harness result
from being promoted into a stronger claim about agent quality or release safety?

## Source-grounded finding

Waza's current main branch treats **observation capability** as part of the
release contract rather than assuming every successful run has the same
evidential weight.

Its controlled path requires a complete attempt origin before execution, keeps
that origin attached to snapshot capture, freezes the prepared request so
execution consumes the same selected bytes that planning bound, and refuses
cached or ungraded execution. The implementation also rejects partial or
historical origins and configurations whose observations it cannot attribute
strictly, including skills, hooks, parallelism, program graders, multiturn
responders, repository modes, and several dependency paths. Project-authored
tests cover preallocated-origin capture, rejection of unsupported paths, and
rejection of incomplete or historical origins.

The important signal is the deliberately low ceiling on what this currently
proves. Waza's controlled-comparison contract says affirmative collection is
limited to offline **mock, no-skills, native-text** cases. It explicitly says a
mock success checks the harness, not agent quality or live-service safety.
Missing, unassessed, and error states stay distinct and cannot pass by default;
metadata or a historical result does not become strict evidence merely because
it parses.

The repository also separates source state from released product state. At the
inspected revision, the controlled release path is documented as main-only and
is not part of the published standalone `v0.38.10` binary. The release matrix
further distinguishes ordinary execution, selected-file evidence, authored-case
assurance, paid calibration, and controlled strict collection instead of
presenting them as one interchangeable “evaluation” feature.

## Reusable implication

An agent-evaluation receipt should carry at least four independent dimensions:

1. **Artifact version:** the exact evaluator source or released binary used.
2. **Observation class:** mock, recorded, live model, live tool, or external
   effect observation.
3. **Attribution envelope:** which inputs, attempt identity, graders, runtime,
   and evidence bytes were actually bound.
4. **Claim ceiling:** the strongest conclusion the observation is allowed to
   support, with unsupported and unassessed states preserved explicitly.

A narrow harness can therefore produce a valid receipt without producing a
valid agent-quality verdict. Release policy should ask whether the receipt's
observation class and attribution envelope satisfy the requested claim, not
merely whether a run exited successfully.

## Evidence and limits

- GitHub Repository Search for `AI agent durable execution checkpoint replay in:readme,description stars:>20 pushed:>=2026-09-15` returned 378 matches with `incomplete_results=false`; `microsoft/waza` was selected from the first 20 results sorted by recent update.
- The inspected commit was pinned before content review, and its recursive tree
  response reported `truncated=false` with 1,983 entries.
- Scout reviewed the README, release matrix, controlled-comparison contract,
  controlled orchestration implementation, and its project-authored tests.
- Scout did not build Waza, run its tests, invoke a model or grader, execute a
  mock or live comparison, inspect a generated receipt, or reproduce a gate or
  release decision. Code and tests are evidence of the authored contract, not
  evidence that a deployment enforces it correctly.
- The controlled-comparison document contains substantial main-only and private
  groundwork. This finding does not treat internal readers, writers, plans, or
  schemas as public production capability.

## Relation to existing Scout knowledge

- [Agent Evaluation](../agent-evaluation.md#a-skill-gate-should-preserve-what-was-checked-what-was-compared-and-what-can-block--skillevaluator-github-sep-2026) records SkillEvaluator's separation of static coverage, paired skill lift, and admission policy. Waza adds a concrete version-and-capability boundary: a controlled receipt can remain intentionally below the threshold for any live-agent claim.
- [Agent Runtime: Verdict Integrity](../agent-runtime-verdict-integrity.md) argues that valid evidence and an authorized verdict are separate facts. Waza demonstrates the earlier step: an evaluator should refuse to manufacture strict evidence outside its supported observation envelope.

## Primary evidence reviewed

- [Repository at the inspected revision](https://github.com/microsoft/waza/tree/54bac1ba9d9579fc2465825921f1a05e8c09728c)
- [README](https://github.com/microsoft/waza/blob/54bac1ba9d9579fc2465825921f1a05e8c09728c/README.md)
- [Release matrix](https://github.com/microsoft/waza/blob/54bac1ba9d9579fc2465825921f1a05e8c09728c/site/src/content/docs/reference/releases.mdx)
- [Controlled-comparison contract](https://github.com/microsoft/waza/blob/54bac1ba9d9579fc2465825921f1a05e8c09728c/docs/CONTROLLED-COMPARISONS.md)
- [Controlled orchestration implementation](https://github.com/microsoft/waza/blob/54bac1ba9d9579fc2465825921f1a05e8c09728c/internal/orchestration/controlled.go)
- [Controlled orchestration tests](https://github.com/microsoft/waza/blob/54bac1ba9d9579fc2465825921f1a05e8c09728c/internal/orchestration/controlled_test.go)

## Discovery coverage

Case-insensitive searches for the primary repository URL and `microsoft/waza`
found no existing Scout source record. Broader topic searches found existing
notes about skill evaluation and verdict integrity, but none assessed Waza's
pinned source, its main-versus-release boundary, or its explicit mock-only
controlled-evidence ceiling.
