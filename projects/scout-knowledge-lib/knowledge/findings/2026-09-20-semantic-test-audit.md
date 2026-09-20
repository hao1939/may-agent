<ai_context>
summary: "A new test-audit CLI treats green tests as claims that need semantic review, classifies whether tests cross real seams or merely reproduce mocks and implementation logic, and adds diff-aware checks for regressions that do not distinguish old from new behavior. Its reported precision is repository-authored and partly based on private cases, so it is an implementation signal rather than independent validation."
triggers: ["agent-written tests", "semantic test audit", "vacuous tests", "mocked seam", "regression distinguishability", "lgtm test auditor"]
last_updated: "2026-09-20"
source_basis: "HN 49775566 and stardeckai/lgtm revision 3fb5008578a224a626bc94f5f044abdde4c5cc0c; README and published evaluation results inspected."
</ai_context>

# Green agent-written tests still need a semantic audit

**Date:** 2026-09-20  
**Source:** https://news.ycombinator.com/item?id=49775566  
**Repo:** https://github.com/stardeckai/lgtm  
**Inspected revision:** [`3fb5008578a224a626bc94f5f044abdde4c5cc0c`](https://github.com/stardeckai/lgtm/commit/3fb5008578a224a626bc94f5f044abdde4c5cc0c)

## Observation

A current Hacker News scan surfaced `lgtm`, a CLI that reviews test blocks together with their implementation rather than treating a passing suite or coverage count as sufficient evidence. Its checks name recurring semantic failures: assertions weaker than the test name, expected values that reimplement production logic, mocks replacing the seam under test, call assertions without observable outcomes, swallowed errors, impossible fixtures, and over-mocked tests.

The most useful design is its diff-aware pair of checks. `regression-does-not-distinguish` asks whether a regression test would also pass on the pre-fix code, while `changed-in-lockstep` looks for implementation and expected values moving together. That moves verification from “did an agent add green tests?” to “does the test distinguish the claimed change from the broken alternative?” The bundled `/actually-test` workflow also asks the coding agent to prove tests red before iterating to green.

The repository publishes a labelled corpus and per-check thresholds rather than only a single aggregate score. At the inspected revision it reports 783 cases, including 521 public and 262 private/anonymized cases, with a 165-case holdout. The results file explicitly warns that roughly three held-out positives per check make its per-check numbers a sanity check, not a precise estimate. Several high-precision thresholds have low holdout recall—for example, reported recall is 0.20 for `over-mocked` and 0.33 for `mocks-seam-under-test`—which fits an advisory tool better than a completeness gate.

## Implication

Agentic coding pipelines should treat tests as another agent-authored artifact requiring an independent discrimination step. A useful verification receipt should bind:

1. the test and implementation revision;
2. the behavior the test claims to distinguish;
3. a negative control, such as the pre-fix implementation or a targeted mutation;
4. whether real collaborators or mocked seams were exercised; and
5. the auditor version, threshold, and unavailable/error states.

Semantic review can prioritize suspicious tests, but it does not replace executing the suite, reproducing the failure, mutation testing, or integration tests across real boundaries. In particular, a model-generated probability is not proof that a test is useful or useless.

## Evidence and limitations

- **Read:** current HN item metadata, repository metadata, README, and `evals/RESULTS.md` at the pinned revision.
- The HN submission had 1 point and no comments when inspected, so it is a discovery lead rather than evidence of adoption.
- The repository and its evaluation were published by the tool author on the same day as this observation. Scout did not run the paid Jev-backed classifier.
- The 262 private cases cannot be independently inspected from the repository; public cases and aggregate result tables are author-provided evidence, not an external benchmark.
- The reported held-out precision/recall measures labels in this corpus, not whether using the tool reduces escaped defects in production.

**Disposition:** useful new source-grounded finding; no existing library file contained the HN item or repository URL.
