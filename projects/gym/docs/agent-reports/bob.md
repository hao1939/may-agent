# bob: evaluation plan and evidence

Plan revision 2; owner: alex; fingerprint: `0c9a507a2c1e7cfe2e49a56ce2fc58896e5ee74e2945da32e1cb882941ddf2cc`.
Generated 2026-11-16T13:16:10.678Z; 11 retained runs for this agent.

North star: correct useful delivery, fewer operator corrections, acceptable total time/cost.

- Judge designs and research-adoption options by demonstrated benefit, evidence, simpler alternatives and total maintenance cost.
- Keep workflow responsibility with its accountable owner and return bounded recommendations without claiming implementation or adoption.

## Whole-benchmark coverage

Current evidence matches the benchmark and planned evaluation setup. Subject fingerprints identify what was tested; they do not establish which candidate is installed or active.

| Benchmark / goal | Kind | Latest current evidence | Selected baseline |
| --- | --- | --- | --- |
| adoption-and-simplicity v2 (3 cases): Reject unjustified mechanisms while supporting a bounded comparison for a demonstrated worthwhile gap. | judgment | [adoption-and-simplicity-test-20261116T130641Z-3d62f920](</app/projects/gym/.state/benchmarks/adoption-and-simplicity-test-20261116T130641Z-3d62f920/manifest.json>): 3 pass / 0 fail / 0 invalid; draft/missing truth; diagnostic only | unmeasured |
| workflow-ownership v1 (1 case): Keep discoverable workflows under the accountable App owner with bounded specialist contributions. | judgment | unmeasured | unmeasured |

## Current improvement

The first commissioned adoption-and-simplicity v2 trial passed all three draft judgment cases. Workflow-ownership remains unmeasured, and these fixture decisions do not establish real design/adoption quality or justify a Bob prompt change.

Hypothesis: The first trial supports using existing whole benchmarks to observe both unnecessary-mechanism rejection and a justified bounded comparison. A future real-work question should determine whether more evaluation or a candidate is worthwhile.

Expected benefit: Establish reproducible decision evidence and select a justified next question rather than tuning Bob without a measured failure.

Unchanged alternative: Keep Bob's production guidance unchanged and preserve unknown coverage where the diagnostic is insufficient.

Stop when: The manual first pass is complete: retain its three draft passes and receipts without further runs. Start another cycle only for a concrete real-work problem or an explicitly chosen coverage question.

- Evidence: [projects/gym/docs/agent-manual-trials-20261116.md](</app/projects/gym/docs/agent-manual-trials-20261116.md>)
- Evidence: [projects/alex.app/agents/bob/AGENTS.md](</app/projects/alex.app/agents/bob/AGENTS.md>)
- Evidence: [projects/gym/docs/agent-reports/agent-manual-trials-20261116.json](</app/projects/gym/docs/agent-reports/agent-manual-trials-20261116.json>)

**Next action:** Reuse the three-case adoption-and-simplicity v2 result and leave Bob production guidance unchanged. When real work warrants another cycle, choose either a demonstrated design/adoption problem or the still-unmeasured complete workflow-ownership benchmark; do not rerun merely to fill the cadence.

## Coverage gaps

- Adoption-and-simplicity v2 has one complete commissioned three-case draft judgment pass; workflow-ownership remains unmeasured. Historical agent-named collections retain their original definitions and models.
- One trial per case cannot establish variance, actual implementation quality, real-world research adoption benefit or production reliability.
- Draft expectations and missing approved baselines prevent a promotion comparison; owner recommendation does not authorize application.

## Evaluation allowance

Target bob; configured model gpt-6-astra; 1 trial(s) per case; 4 minutes per trial; at most 2 benchmark runs per manual cycle.

Commissioned runs enforce whole membership, trial count and per-trial subject timeout. Alex accounts for the cumulative cycle allowance manually. Total cycle and grader cost are unknown unless separately evidenced.

## Retained history

Historical counts below are retained machine verdicts, not current benchmark scores. Old runs are not relabeled after a split. Unknown usage stays unknown. No historical run is rewritten.

| Run / date | Benchmark / candidate | Kind | P / F / invalid; truth | Target ms / tokens / ops | Current evidence limit |
| --- | --- | --- | --- | --- | --- |
| [bob-judgment-test-20261114T231508Z-54f3688c](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261114T231508Z-54f3688c/manifest.json>) / 2026-11-14T23:15:08.102Z | bob-judgment v1 / baseline | unclassified | 0 / 0 / 3; approved | 11 / unknown / unknown | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T013439Z-d5155ade](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013439Z-d5155ade/manifest.json>) / 2026-11-15T01:34:39.621Z | bob-judgment v1 / baseline | unclassified | 0 / 0 / 3; approved | 2972 / 0 / 0 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T013900Z-16bc9c06](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013900Z-16bc9c06/manifest.json>) / 2026-11-15T01:39:00.686Z | bob-judgment v1 / baseline | unclassified | 0 / 0 / 3; approved | 37840 / 0 / 0 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T014206Z-1a20a06f](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014206Z-1a20a06f/manifest.json>) / 2026-11-15T01:42:06.851Z | bob-judgment v1 / baseline | unclassified | 0 / 0 / 3; approved | 2941 / 0 / 0 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T014327Z-a627dfff](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014327Z-a627dfff/manifest.json>) / 2026-11-15T01:43:27.045Z | bob-judgment v1 / baseline | unclassified | 0 / 3 / 0; approved | 51660 / 93164 / 8 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T014625Z-037eb2dd](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014625Z-037eb2dd/manifest.json>) / 2026-11-15T01:46:25.101Z | bob-judgment v1 / baseline | unclassified | 0 / 3 / 0; approved | 57025 / 113038 / 9 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T015150Z-1b140f82](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T015150Z-1b140f82/manifest.json>) / 2026-11-15T01:51:50.718Z | bob-judgment v1 / baseline | unclassified | 0 / 3 / 0; approved | 51746 / 96109 / 9 | historical benchmark/version; fresh baseline required |
| [bob-judgment-verify-20261115T015502Z-c1b3da67](</app/projects/gym/.state/benchmarks/bob-judgment-verify-20261115T015502Z-c1b3da67/manifest.json>) / 2026-11-15T01:55:02.643Z | bob-judgment v1 / bob-tuned | unclassified | 3 / 0 / 0; approved | 25390 / 56186 / 6 | historical benchmark/version; fresh baseline required |
| [bob-judgment-test-20261115T022604Z-3e25778e](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T022604Z-3e25778e/manifest.json>) / 2026-11-15T02:26:04.831Z | bob-judgment v1 / baseline | unclassified | 0 / 3 / 0; approved | 82923 / 198010 / 15 | historical benchmark/version; fresh baseline required |
| [bob-judgment-verify-20261115T023014Z-3b1dcc94](</app/projects/gym/.state/benchmarks/bob-judgment-verify-20261115T023014Z-3b1dcc94/manifest.json>) / 2026-11-15T02:30:14.629Z | bob-judgment v1 / bob-tuned | unclassified | 3 / 0 / 0; approved | 25437 / 47117 / 5 | historical benchmark/version; fresh baseline required |
| [adoption-and-simplicity-test-20261116T130641Z-3d62f920](</app/projects/gym/.state/benchmarks/adoption-and-simplicity-test-20261116T130641Z-3d62f920/manifest.json>) / 2026-11-16T13:06:41.754Z | adoption-and-simplicity v2 / baseline | judgment | 3 / 0 / 0; draft | 35524 / 44169 / 5 | complete current evidence |

## Execution identity and failures

- bob-judgment-test-20261114T231508Z-54f3688c: model unknown; framework 54efde9f23; candidate fingerprint unknown; inputs 9d38a3e7166eddf1d7316fb712a30a73fcefd50e46af3cb79e10f5318bc44f5b; prompts unknown; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261114T231508Z-54f3688c/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>): agent execution status error: Invalid agent bob: model: Unknown model "gemini-4-argon"
  - [bob-judge-reject-unproven-research-adoption trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261114T231508Z-54f3688c/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>): agent execution status error: Invalid agent bob: model: Unknown model "gemini-4-argon"
  - [bob-judge-app-owner-workflow-ownership trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261114T231508Z-54f3688c/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>): agent execution status error: Invalid agent bob: model: Unknown model "gemini-4-argon"
- bob-judgment-test-20261115T013439Z-d5155ade: model gemini-4-argon; framework 54efde9f23; candidate fingerprint unknown; inputs 81078c3a10f4639ab26fb1c80a93a4aac3a30f406b01bc57ace5ffa8bb4e48f5; prompts 6e431be5e9fc, 796c0684f89f, c5c53141a461; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013439Z-d5155ade/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
  - [bob-judge-reject-unproven-research-adoption trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013439Z-d5155ade/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
  - [bob-judge-app-owner-workflow-ownership trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013439Z-d5155ade/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
- bob-judgment-test-20261115T013900Z-16bc9c06: model gemini-4-argon; framework 54efde9f23; candidate fingerprint unknown; inputs 1a95549fdb0a2fe5b5756218767d9a1ee8beb5a92643032c05f46756723b8543; prompts 08ba923779c2, 8fca2d84fc8e, f68adc448350; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013900Z-16bc9c06/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>): agent execution status error: litellm.MidStreamFallbackError: litellm.APIConnectionError: APIConnectionError: OpenAIException - openai raised a streaming error - finish_reason: error, no content string given. Received Chunk={'text': '', … (see linked evidence)
  - [bob-judge-reject-unproven-research-adoption trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013900Z-16bc9c06/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>): agent execution status error: litellm.MidStreamFallbackError: litellm.APIConnectionError: APIConnectionError: OpenAIException - openai raised a streaming error - finish_reason: error, no content string given. Received Chunk={'text': '', … (see linked evidence)
  - [bob-judge-app-owner-workflow-ownership trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T013900Z-16bc9c06/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>): agent execution status error: litellm.MidStreamFallbackError: litellm.APIConnectionError: APIConnectionError: OpenAIException - openai raised a streaming error - finish_reason: error, no content string given. Received Chunk={'text': '', … (see linked evidence)
- bob-judgment-test-20261115T014206Z-1a20a06f: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint unknown; inputs eef89deb17cbe4cc35d68308cc46ed9e87fcf7d737389d1f4cb9ca5005e0cc1e; prompts 75dd93d76db9, a9a99c82dde3, ad1af7b5aef3; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014206Z-1a20a06f/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
  - [bob-judge-reject-unproven-research-adoption trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014206Z-1a20a06f/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
  - [bob-judge-app-owner-workflow-ownership trial 1: invalid](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014206Z-1a20a06f/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>): agent execution status error: 400: {"message":"litellm.BadRequestError: Github_copilotException - invalid request body. Received Model Group=gemini-4-argon\nAvailable Model Group Fallbacks=None","type":null,"param":null,"code":"400"}
- bob-judgment-test-20261115T014327Z-a627dfff: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint unknown; inputs 75d9db0f8e893361b8f8fefe3fba46c8edac1dcf8d02ea9e85795cbf09281b75; prompts 3c3f95b6a109, 5a87018cae57, 99e16ab561f3; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014327Z-a627dfff/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>)
  - [bob-judge-reject-unproven-research-adoption trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014327Z-a627dfff/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>)
  - [bob-judge-app-owner-workflow-ownership trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014327Z-a627dfff/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>)
- bob-judgment-test-20261115T014625Z-037eb2dd: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint unknown; inputs 9dc87fc10ca069154c4812e6e5b5243a5c31a19ad686e8ff7c9bbed7aa0de1fe; prompts 4c74c221a713, 5887fa0a60d1, 895dbad62c8d; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014625Z-037eb2dd/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>)
  - [bob-judge-reject-unproven-research-adoption trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014625Z-037eb2dd/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>)
  - [bob-judge-app-owner-workflow-ownership trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T014625Z-037eb2dd/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>)
- bob-judgment-test-20261115T015150Z-1b140f82: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint unknown; inputs 05f4529c9c3517679bbcfd51ba129cb38c5053964337ddf4bada370d826e1dc2; prompts a017b1129f36, c6b48ef69cd3, ddca8aba8506; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T015150Z-1b140f82/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>)
  - [bob-judge-reject-unproven-research-adoption trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T015150Z-1b140f82/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>)
  - [bob-judge-app-owner-workflow-ownership trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T015150Z-1b140f82/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>)
- bob-judgment-verify-20261115T015502Z-c1b3da67: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint f395df0dd43b6005a8928d633f60bb7f030d8682fa134ff0c5dcc44a65dbfdc3; inputs 05f4529c9c3517679bbcfd51ba129cb38c5053964337ddf4bada370d826e1dc2; prompts 840242570669, a2411e7177dd, ceaa61f24bfb; plan revision unknown; comparison series unestablished; gate unavailable.
- bob-judgment-test-20261115T022604Z-3e25778e: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint unknown; inputs ef3f44d8ab1d7ecc9a98371ccefaff4b6ac625467eb3df3156618413ecdee142; prompts 17396f4ffea9, 8a3ff5799ebe, 964e703e99d8; plan revision unknown; comparison series unestablished; gate unavailable.
  - [bob-judge-converge-duplicate-entry-points trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T022604Z-3e25778e/cases/bob-judge-converge-duplicate-entry-points/trial-1/result.json>)
  - [bob-judge-reject-unproven-research-adoption trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T022604Z-3e25778e/cases/bob-judge-reject-unproven-research-adoption/trial-1/result.json>)
  - [bob-judge-app-owner-workflow-ownership trial 1: fail](</app/projects/gym/.state/benchmarks/bob-judgment-test-20261115T022604Z-3e25778e/cases/bob-judge-app-owner-workflow-ownership/trial-1/result.json>)
- bob-judgment-verify-20261115T023014Z-3b1dcc94: model gemini-4-argon; framework 4fa9ff1818; candidate fingerprint 618e0c7c8b46a249b3d021a77cc258b9a162f3057698b9d1ab82420640604e9e; inputs ef3f44d8ab1d7ecc9a98371ccefaff4b6ac625467eb3df3156618413ecdee142; prompts 1997a95efc5d, 46f57eab28ee, dbc987171200; plan revision unknown; comparison series unestablished; gate unavailable.
- adoption-and-simplicity-test-20261116T130641Z-3d62f920: model gpt-6-astra; framework d4ee090960; candidate fingerprint unknown; inputs 58cfccf7b85fcbc455ccb2ee13ce99baf7f378bb160c876c272f2bba06216e73; prompts 2bc95d8a5d66, 8ae9d57ab49b, bef59bbfa250; plan revision 1; comparison series 18ed6b864bbd2b36dedae205d3d30e5dedaee26e35cce9395ef70efa37f26159; gate unavailable.

## Owner decisions and delivery

No validated explicit owner decisions linked. Adoption, source readiness, integration and activation are unknown. A passing gate establishes none of them.

