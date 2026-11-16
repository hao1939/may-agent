# scout: evaluation plan and evidence

Plan revision 2; owner: alex; fingerprint: `f3ba7f073bfd2503958e4a8c521d426446ab43f550136b6a5c1bb972ed17aab1`.
Generated 2026-11-16T13:16:10.705Z; 12 retained runs for this agent.

North star: correct useful delivery, fewer operator corrections, acceptable total time/cost.

- Assess the requested source and report conclusions only within the available evidence and required coverage.
- Preserve reusable knowledge and links, distinguish research candidates from reference context, and return source-grounded recommendations.

## Whole-benchmark coverage

Current evidence matches the benchmark and planned evaluation setup. Subject fingerprints identify what was tested; they do not establish which candidate is installed or active.

| Benchmark / goal | Kind | Latest current evidence | Selected baseline |
| --- | --- | --- | --- |
| research-evidence v1 (4 cases): Distinguish required unread evidence from a completed bounded check, maintain authoritative knowledge and classify source leads proportionately. | judgment | [research-evidence-test-20261116T131014Z-829fb5e0](</app/projects/gym/.state/benchmarks/research-evidence-test-20261116T131014Z-829fb5e0/manifest.json>): 4 pass / 0 fail / 0 invalid; draft/missing truth; diagnostic only | unmeasured |

## Current improvement

The first commissioned research-evidence v1 trial passed all four draft judgment cases, including incomplete disposition for missing required sections and completion when the requested evidence was supplied. Live research, publication and adoption usefulness remain unmeasured; the trial does not justify a Scout prompt change.

Hypothesis: The first trial supports using complete evidence-focused benchmarks to distinguish missing source coverage from a complete bounded assessment. A real research delivery problem should determine the next experiment.

Expected benefit: Make current research judgment observable before selecting any improvement to Scout or its surrounding workflow.

Unchanged alternative: Keep Scout's production sources and knowledge library unchanged and retain unsupported coverage as unknown.

Stop when: The manual first pass is complete: retain its four draft passes and receipts without further runs. Start another cycle only for a concrete real-work problem or an explicitly chosen coverage question.

- Evidence: [projects/gym/docs/agent-manual-trials-20261116.md](</app/projects/gym/docs/agent-manual-trials-20261116.md>)
- Evidence: [projects/scout-knowledge-lib.app/agents/scout/AGENTS.md](</app/projects/scout-knowledge-lib.app/agents/scout/AGENTS.md>)
- Evidence: [projects/gym/docs/agent-reports/agent-manual-trials-20261116.json](</app/projects/gym/docs/agent-reports/agent-manual-trials-20261116.json>)

**Next action:** Reuse the four-case research-evidence v1 result and keep Scout production guidance and the knowledge library unchanged. On the next concrete research delivery problem, inspect actual source coverage, retained record, publication evidence and correction effort; do not infer a live retrieval or publication failure from this decision-only benchmark.

## Coverage gaps

- Research-evidence v1 has one complete commissioned four-case draft judgment pass. The blocked-source case correctly returned incomplete, while the supported bounded check converged. Earlier Scout collections and production source assessments retain their original scope; these judgments are not live workflow proof.
- This decision-only fixture does not establish live retrieval, durable archive publication, link preservation during real edits or useful research adoption.
- One trial per case leaves variance and production reliability unmeasured; draft truth and absent approved baselines prevent promotion comparisons.

## Evaluation allowance

Target scout; configured model gpt-5.6-sol; 1 trial(s) per case; 4 minutes per trial; at most 2 benchmark runs per manual cycle.

Commissioned runs enforce whole membership, trial count and per-trial subject timeout. Alex accounts for the cumulative cycle allowance manually. Total cycle and grader cost are unknown unless separately evidenced.

## Retained history

Historical counts below are retained machine verdicts, not current benchmark scores. Old runs are not relabeled after a split. Unknown usage stays unknown. No historical run is rewritten.

| Run / date | Benchmark / candidate | Kind | P / F / invalid; truth | Target ms / tokens / ops | Current evidence limit |
| --- | --- | --- | --- | --- | --- |
| [scout-judgment-test-20261115T013515Z-d1503aec](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T013515Z-d1503aec/manifest.json>) / 2026-11-15T01:35:15.549Z | scout-judgment v1 / baseline | unclassified | 0 / 0 / 2; approved | 0 / unknown / unknown | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T014014Z-addf8d3c](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T014014Z-addf8d3c/manifest.json>) / 2026-11-15T01:40:14.508Z | scout-judgment v1 / baseline | unclassified | 2 / 0 / 0; approved | 31855 / 61072 / 7 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T014758Z-081141db](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T014758Z-081141db/manifest.json>) / 2026-11-15T01:47:58.215Z | scout-judgment v1 / baseline | unclassified | 1 / 1 / 0; approved | 32911 / 62403 / 8 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T015319Z-a08a0f16](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T015319Z-a08a0f16/manifest.json>) / 2026-11-15T01:53:19.704Z | scout-judgment v1 / baseline | unclassified | 2 / 0 / 0; approved | 34658 / 62399 / 8 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T015755Z-ab1ba86c](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T015755Z-ab1ba86c/manifest.json>) / 2026-11-15T01:57:55.736Z | scout-judgment v1 / baseline | unclassified | 2 / 0 / 0; approved | 33601 / 62447 / 8 | historical benchmark/version; fresh baseline required |
| [scout-judgment-verify-20261115T015848Z-329d1e24](</app/projects/gym/.state/benchmarks/scout-judgment-verify-20261115T015848Z-329d1e24/manifest.json>) / 2026-11-15T01:58:55.585Z | scout-judgment v1 / scout-tuned | unclassified | 2 / 0 / 0; approved | 26888 / 43396 / 4 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T022800Z-74cf49e4](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T022800Z-74cf49e4/manifest.json>) / 2026-11-15T02:28:00.810Z | scout-judgment v1 / baseline | unclassified | 2 / 0 / 0; approved | 37056 / 66585 / 9 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T022850Z-b7087d7b](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T022850Z-b7087d7b/manifest.json>) / 2026-11-15T02:28:50.608Z | scout-judgment v1 / baseline | unclassified | 2 / 0 / 0; approved | 25363 / 32766 / 3 | historical benchmark/version; fresh baseline required |
| [scout-judgment-verify-20261115T023158Z-a8be190d](</app/projects/gym/.state/benchmarks/scout-judgment-verify-20261115T023158Z-a8be190d/manifest.json>) / 2026-11-15T02:32:06.094Z | scout-judgment v1 / scout-tuned | unclassified | 2 / 0 / 0; approved | 25704 / 32987 / 3 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T023342Z-bbeaf62f](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T023342Z-bbeaf62f/manifest.json>) / 2026-11-15T02:33:42.931Z | scout-judgment v1 / baseline | unclassified | 2 / 1 / 0; approved | 59216 / 163636 / 15 | historical benchmark/version; fresh baseline required |
| [scout-judgment-test-20261115T023522Z-98337511](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T023522Z-98337511/manifest.json>) / 2026-11-15T02:35:22.617Z | scout-judgment v1 / baseline | unclassified | 3 / 0 / 0; approved | 67081 / 186545 / 18 | historical benchmark/version; fresh baseline required |
| [research-evidence-test-20261116T131014Z-829fb5e0](</app/projects/gym/.state/benchmarks/research-evidence-test-20261116T131014Z-829fb5e0/manifest.json>) / 2026-11-16T13:10:14.142Z | research-evidence v1 / baseline | judgment | 4 / 0 / 0; draft | 136198 / 248113 / 25 | complete current evidence |

## Execution identity and failures

- scout-judgment-test-20261115T013515Z-d1503aec: model unknown; framework 54efde9f23; candidate fingerprint unknown; inputs 86b45ab27959db07998ba95e8621a5515a970357bff0991fdc543fa34c276cd3; prompts unknown; plan revision unknown; comparison series unestablished; gate unavailable.
  - [scout-judge-honest-partial-coverage-on-blocked-source trial 1: invalid](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T013515Z-d1503aec/cases/scout-judge-honest-partial-coverage-on-blocked-source/trial-1/result.json>): agent execution status error: undefined is not an object (evaluating 'expected.state')
  - [scout-judge-update-in-place-and-forwarding-link trial 1: invalid](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T013515Z-d1503aec/cases/scout-judge-update-in-place-and-forwarding-link/trial-1/result.json>): agent execution status error: undefined is not an object (evaluating 'expected.state')
- scout-judgment-test-20261115T014014Z-addf8d3c: model gpt-5.6-sol; framework 54efde9f23; candidate fingerprint unknown; inputs 149ca53d89048b7f490180a325810988e6dd26d50f7dd529f3e97068952dd434; prompts 19e5208b376a, 2b1055433d54; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-test-20261115T014758Z-081141db: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs f6851875e3d8883f0776ca4db51fcfe0c1bcbdedd13be081042b902b58c880e4; prompts bb63e494175d, d52a2aa3f8c6; plan revision unknown; comparison series unestablished; gate unavailable.
  - [scout-judge-update-in-place-and-forwarding-link trial 1: fail](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T014758Z-081141db/cases/scout-judge-update-in-place-and-forwarding-link/trial-1/result.json>)
- scout-judgment-test-20261115T015319Z-a08a0f16: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs 4f8fe8b9fb4a43d029c0353c1e85f460a3eec563c62e14815eee4cffb86f6874; prompts 372471204835, 95f4995f61de; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-test-20261115T015755Z-ab1ba86c: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs 7401d90a854f10a9693b026381d4ef626e05672f5465628bed238d7876e1117f; prompts 35a5702d9e29, 5da4f4f4e924; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-verify-20261115T015848Z-329d1e24: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint f99a9ca86b051b787a0f89596f13a944deb0666050d6d9b4ab106367d5dca3ee; inputs 7401d90a854f10a9693b026381d4ef626e05672f5465628bed238d7876e1117f; prompts 4166ba90eeae, cac9af4f3866; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-test-20261115T022800Z-74cf49e4: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs bea1b2c8bda39ca26fb1d12341973adcefd5117c382b166fcdc0bd76b78deb90; prompts 0e5f5f42fa08, 3b48d2450897; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-test-20261115T022850Z-b7087d7b: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs 007bdb4b903a1372cf7b382aeb6ff6e4c37e74c83d46d8a52661e04f00863301; prompts 1c4916ede983, b3d724b84601; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-verify-20261115T023158Z-a8be190d: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint 13b74643bae09967bbff8e0e3d13e927024441a70e7b5165ae826f50c2e733ec; inputs 007bdb4b903a1372cf7b382aeb6ff6e4c37e74c83d46d8a52661e04f00863301; prompts 3402e63a5415, 3afa01d60338; plan revision unknown; comparison series unestablished; gate unavailable.
- scout-judgment-test-20261115T023342Z-bbeaf62f: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs d4de880d9ae0acafbf5c64f0ad1393f553841d9b856a97abf31d6238456f0384; prompts 7229edeb4542, 9621ed34a044, c890260ce861; plan revision unknown; comparison series unestablished; gate unavailable.
  - [scout-judge-retire-obsolete-note-with-forwarding-link trial 1: fail](</app/projects/gym/.state/benchmarks/scout-judgment-test-20261115T023342Z-bbeaf62f/cases/scout-judge-retire-obsolete-note-with-forwarding-link/trial-1/result.json>)
- scout-judgment-test-20261115T023522Z-98337511: model gpt-5.6-sol; framework 4fa9ff1818; candidate fingerprint unknown; inputs 10a9123622062b737f9a0459075528471b3be8efdce25154439d4f8e1d89aa15; prompts 5823dd974af2, 66c3b6fb0b30, cec129679ebb; plan revision unknown; comparison series unestablished; gate unavailable.
- research-evidence-test-20261116T131014Z-829fb5e0: model gpt-5.6-sol; framework d4ee090960; candidate fingerprint unknown; inputs 6e845d14a84af68f787e167f63858cab4c47b924c86e6eef5a2c1ef48e556a8f; prompts 82e310a1c4b4, 90f9a3548dd3, bc511805afe7, e20a95dc685c; plan revision 1; comparison series 99a4b767d41ff0fb296309f4e696b6473244308352bdc4433d57e61e608bd738; gate unavailable.

## Owner decisions and delivery

No validated explicit owner decisions linked. Adoption, source readiness, integration and activation are unknown. A passing gate establishes none of them.

