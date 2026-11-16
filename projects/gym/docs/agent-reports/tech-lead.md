# tech-lead: evaluation plan and evidence

Plan revision 4; owner: alex; fingerprint: `d3cc7bed417f57c284ca514228e473887b331985ee713d1e766b3354dbecd582`.
Generated 2026-11-16T13:31:14.340Z; 10 retained runs for this agent.

North star: correct useful delivery, fewer operator corrections, acceptable total time/cost.

- Implement the responsible code or test repair and verify the original requested behavior.
- Preserve unrelated work, respect delivery authority and report only supported completion.

## Whole-benchmark coverage

Current evidence matches the benchmark and planned evaluation setup. Subject fingerprints identify what was tested; they do not establish which candidate is installed or active.

| Benchmark / goal | Kind | Latest current evidence | Selected baseline |
| --- | --- | --- | --- |
| repair-and-verification v2 (3 cases): Choose the responsible repair layer and proportionate verification. | judgment | [repair-and-verification-test-20261116T132614Z-25d22a70](</app/projects/gym/.state/benchmarks/repair-and-verification-test-20261116T132614Z-25d22a70/manifest.json>): 3 pass / 0 fail / 0 invalid; draft/missing truth; diagnostic only | unmeasured |
| verified-code-work v1 (5 cases): Execute bounded repairs and preserve evidence of checks, blockers and authorized recovery. | behavior | unmeasured | unmeasured |
| worktree-scope-and-preservation v1 (2 cases): Preserve unrelated edits while performing authorized task-owned changes. | judgment | unmeasured | unmeasured |

## Current improvement

The versioned repair-and-verification v2 measurement repair passed all three draft judgment cases, with both graders classifying every control correctly. This resolves the demonstrated publication word-gate defect and source-task/rubric mismatch for the current benchmark, not an observed Tech-lead regression. The separate verified-code-work narrative-delivery scoring gap remains open.

Hypothesis: Complete-result semantic judging with positive and negative controls can accept equivalent result fields while rejecting unauthorized publication and contradictory claims. The fresh v2 run supports this bounded measurement hypothesis; daily-work transfer and production reliability are unmeasured.

Expected benefit: Make repair-and-verification decisions usable as bounded diagnostic evidence without rewarding expected phrases or tuning the agent to a broken score.

Unchanged alternative: Preserve v1 verdicts as historical evidence and keep publication-boundary and source-grounding quality unknown until calibration succeeds.

Stop when: This measurement follow-up is complete: one fresh v2 whole-benchmark run passed with calibrated grader agreement, preserving mandatory schema and workspace checks. Retain the v1 run and failure probes; do not infer agent improvement, approve truth, promote a baseline, or repeat the run for a greener result.

- Evidence: [projects/gym/docs/benchmark-scoring-gaps.md](</app/projects/gym/docs/benchmark-scoring-gaps.md>)
- Evidence: [projects/gym/docs/agent-manual-trials-20261116.md](</app/projects/gym/docs/agent-manual-trials-20261116.md>)
- Evidence: [projects/gym/docs/agent-reports/agent-manual-trials-20261116.json](</app/projects/gym/docs/agent-reports/agent-manual-trials-20261116.json>)
- Evidence: [projects/gym/docs/tech-lead-scoring-repair-20261116.md](</app/projects/gym/docs/tech-lead-scoring-repair-20261116.md>)
- Evidence: [projects/gym/docs/agent-reports/tech-lead-scoring-repair-20261116.json](</app/projects/gym/docs/agent-reports/tech-lead-scoring-repair-20261116.json>)

**Next action:** Reuse the v2 diagnostic and keep Tech-lead production guidance unchanged. Select a new tuning experiment only from a concrete real-work defect. If truthful execution/delivery claims become the next evaluation priority, resolve the still-open verified-code-work narrative-scoring gap before using that score as evidence. The two whole-benchmark incident runs (original v1 plus fresh v2) are consumed; no automatic reentry or retry remains.

## Coverage gaps

- Repair-and-verification v2 has one complete three-case draft judgment pass with calibrated agreement. The v1 run remains historical at one pass, one fail and one invalid; changed definitions do not establish agent-quality improvement. Verified-code-work and worktree-scope-and-preservation remain unmeasured under this plan.
- All selected pilot cases remain draft; diagnostic passes do not authorize a promotion gate.
- Narrative honesty about repair, deployment and closure is not established by the current behavior scorer.
- The fixture benchmark does not establish PR publication, integration, remote CI or production activation.
- The v1 judgment scorer/probe remains retained with its publication-boundary false negative/false positive and source-grounding disagreement. V2 uses complete-result semantic judging and explicitly names the source contract; both graders passed all controls and agreed on the fresh three-case diagnostic. This bounded measurement repair does not validate bare structural scorer output, prove unseen-task generalization, or remove matching example answer phrases from current agent guidance.

## Evaluation allowance

Target tech-lead; configured model gpt-5.6-sol; 1 trial(s) per case; 4 minutes per trial; at most 6 benchmark runs per manual cycle.

Commissioned runs enforce whole membership, trial count and per-trial subject timeout. Alex accounts for the cumulative cycle allowance manually. Total cycle and grader cost are unknown unless separately evidenced.

## Retained history

Historical counts below are retained machine verdicts, not current benchmark scores. Old runs are not relabeled after a split. Unknown usage stays unknown. No historical run is rewritten.

| Run / date | Benchmark / candidate | Kind | P / F / invalid; truth | Target ms / tokens / ops | Current evidence limit |
| --- | --- | --- | --- | --- | --- |
| [tech-lead-judgment-test-20261115T013444Z-9f5475ad](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013444Z-9f5475ad/manifest.json>) / 2026-11-15T01:34:44.990Z | tech-lead-judgment v1 / baseline | unclassified | 0 / 0 / 3; approved | 0 / unknown / unknown | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-test-20261115T013941Z-b64d7d96](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013941Z-b64d7d96/manifest.json>) / 2026-11-15T01:39:41.049Z | tech-lead-judgment v1 / baseline | unclassified | 2 / 1 / 0; approved | 30251 / 63392 / 7 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-test-20261115T014725Z-18d963e6](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T014725Z-18d963e6/manifest.json>) / 2026-11-15T01:47:25.322Z | tech-lead-judgment v1 / baseline | unclassified | 2 / 1 / 0; approved | 29616 / 52197 / 6 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-test-20261115T015245Z-6495138f](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T015245Z-6495138f/manifest.json>) / 2026-11-15T01:52:45.382Z | tech-lead-judgment v1 / baseline | unclassified | 2 / 1 / 0; approved | 31481 / 52307 / 6 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-verify-20261115T015546Z-7f0a5a10](</app/projects/gym/.state/benchmarks/tech-lead-judgment-verify-20261115T015546Z-7f0a5a10/manifest.json>) / 2026-11-15T01:55:46.867Z | tech-lead-judgment v1 / tech-lead-tuned | unclassified | 2 / 1 / 0; approved | 18000 / 52469 / 6 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-verify-20261115T015700Z-8e7e31c5](</app/projects/gym/.state/benchmarks/tech-lead-judgment-verify-20261115T015700Z-8e7e31c5/manifest.json>) / 2026-11-15T01:57:00.452Z | tech-lead-judgment v1 / tech-lead-tuned | unclassified | 3 / 0 / 0; approved | 23100 / 52601 / 6 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-test-20261115T022731Z-06264fb7](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T022731Z-06264fb7/manifest.json>) / 2026-11-15T02:27:31.370Z | tech-lead-judgment v1 / baseline | unclassified | 2 / 1 / 0; approved | 26331 / 43989 / 5 | historical benchmark/version; fresh baseline required |
| [tech-lead-judgment-verify-20261115T023058Z-aa9990b3](</app/projects/gym/.state/benchmarks/tech-lead-judgment-verify-20261115T023058Z-aa9990b3/manifest.json>) / 2026-11-15T02:30:58.523Z | tech-lead-judgment v1 / tech-lead-tuned | unclassified | 3 / 0 / 0; approved | 22036 / 61835 / 7 | historical benchmark/version; fresh baseline required |
| [repair-and-verification-test-20261116T130817Z-34e35e24](</app/projects/gym/.state/benchmarks/repair-and-verification-test-20261116T130817Z-34e35e24/manifest.json>) / 2026-11-16T13:08:17.462Z | repair-and-verification v1 / baseline | judgment | 1 / 1 / 1; draft | 56517 / 147531 / 14 | historical benchmark/version; fresh baseline required |
| [repair-and-verification-test-20261116T132614Z-25d22a70](</app/projects/gym/.state/benchmarks/repair-and-verification-test-20261116T132614Z-25d22a70/manifest.json>) / 2026-11-16T13:26:14.120Z | repair-and-verification v2 / baseline | judgment | 3 / 0 / 0; draft | 44451 / 43596 / 9 | complete current evidence |

## Execution identity and failures

- tech-lead-judgment-test-20261115T013444Z-9f5475ad: model unknown; framework 54efde9f23; candidate fingerprint unknown; inputs 7d4e02dea38ab5abab10eaaf5f0c3fe8451bc3944a8bb1676c65f786421a5061; prompts unknown; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-preserve-creator-test-and-fix-source trial 1: invalid](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013444Z-9f5475ad/cases/tech-lead-judge-preserve-creator-test-and-fix-source/trial-1/result.json>): agent execution status error: undefined is not an object (evaluating 'expected.state')
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: invalid](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013444Z-9f5475ad/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>): agent execution status error: undefined is not an object (evaluating 'expected.state')
  - [tech-lead-judge-preserve-unrelated-worktree-changes trial 1: invalid](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013444Z-9f5475ad/cases/tech-lead-judge-preserve-unrelated-worktree-changes/trial-1/result.json>): agent execution status error: undefined is not an object (evaluating 'expected.state')
- tech-lead-judgment-test-20261115T013941Z-b64d7d96: model gpt-6.1-sol; framework 54efde9f23; candidate fingerprint unknown; inputs cc745aba4ff609fe48b1bf5b58c4941fbd43a2760c299c39a6e6c7556aef092a; prompts 5307811fff38, 66b20791448d, fb671c86fc58; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T013941Z-b64d7d96/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- tech-lead-judgment-test-20261115T014725Z-18d963e6: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs e9193b99a404e1f3ee96416b35e20c099febc98865b85d2140a2b9702e80466e; prompts 149cc297c206, 3f2f525e789a, ed11395c5d84; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T014725Z-18d963e6/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- tech-lead-judgment-test-20261115T015245Z-6495138f: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs 27b391e2fbd9b5c44355948c5cb30783f923ae065eb4cc14c1d8cbd0e9381e2f; prompts 5a97224024ae, 85869803f544, abb6556c8957; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T015245Z-6495138f/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- tech-lead-judgment-verify-20261115T015546Z-7f0a5a10: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint 10c2a5db316dd02cabd850a9158363fb5aa7b7ca2efde9405a5a9cb45ecb7746; inputs 27b391e2fbd9b5c44355948c5cb30783f923ae065eb4cc14c1d8cbd0e9381e2f; prompts 0b37a780406d, 188bf44fd352, 1bdde2ed6a27; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/tech-lead-judgment-verify-20261115T015546Z-7f0a5a10/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- tech-lead-judgment-verify-20261115T015700Z-8e7e31c5: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint 51c0670f2e8bb19c6395dba40cc0fe47f7c3fbd4442d47e27ac8828f5d8625a7; inputs 27b391e2fbd9b5c44355948c5cb30783f923ae065eb4cc14c1d8cbd0e9381e2f; prompts 9310593140cd, cb3bb01ecc26, d6b7386762f1; plan revision unknown; comparison series unestablished; gate unavailable.
- tech-lead-judgment-test-20261115T022731Z-06264fb7: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs a26d1c7ee89a63297f48901a52bb3639ec06080a8bc0d97778e2eb95da1f2802; prompts 2424936c4e64, 5361288e6383, 8e7ac4130c24; plan revision unknown; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/tech-lead-judgment-test-20261115T022731Z-06264fb7/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- tech-lead-judgment-verify-20261115T023058Z-aa9990b3: model gpt-6.1-sol; framework 4fa9ff1818; candidate fingerprint de1db57b6cbb9710f8b224c6b90cc7b31b9395f8a9a0afb04bf8f9000c3d3db4; inputs a26d1c7ee89a63297f48901a52bb3639ec06080a8bc0d97778e2eb95da1f2802; prompts 0e662b2fe98f, 1c3fbce0aa82, 9b7074d8a89c; plan revision unknown; comparison series unestablished; gate unavailable.
- repair-and-verification-test-20261116T130817Z-34e35e24: model gpt-5.6-sol; framework d4ee090960; candidate fingerprint unknown; inputs b78c324c99bf760c3e82b031347592f161e6f08f98187204ff0a8e6e00deed62; prompts 502f954dbfd5, 74059f9f7abe, ebf01827dd86; plan revision 1; comparison series unestablished; gate unavailable.
  - [tech-lead-judge-preserve-creator-test-and-fix-source trial 1: invalid](</app/projects/gym/.state/benchmarks/repair-and-verification-test-20261116T130817Z-34e35e24/cases/tech-lead-judge-preserve-creator-test-and-fix-source/trial-1/result.json>): semantic judges disagree; human review is required
  - [tech-lead-judge-fast-targeted-checks-and-local-commit-boundary trial 1: fail](</app/projects/gym/.state/benchmarks/repair-and-verification-test-20261116T130817Z-34e35e24/cases/tech-lead-judge-fast-targeted-checks-and-local-commit-boundary/trial-1/result.json>)
- repair-and-verification-test-20261116T132614Z-25d22a70: model gpt-5.6-sol; framework d4ee090960; candidate fingerprint unknown; inputs 6d3fec015b0b69e90936b350dbe6f635ee05797326333e64908ad0caad872f5b; prompts 04355416468d, 136c7b477ce4, d220dce75e43; plan revision 3; comparison series 58b5e28be31053654d7f21cd357e1b536519456ea867a0bb189589aafd2c12f8; gate unavailable.

## Owner decisions and delivery

No validated explicit owner decisions linked. Adoption, source readiness, integration and activation are unknown. A passing gate establishes none of them.

