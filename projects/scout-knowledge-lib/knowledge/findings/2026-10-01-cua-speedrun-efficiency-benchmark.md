<ai_context>
This finding assesses cua-speedrun's first paper and public project page as an evaluation design for computer-use agents. Scout read the full arXiv v1 HTML paper, current project page, and repository README, but did not install or execute the benchmark, reproduce its measurements, audit every implementation file, or independently verify provider-reported costs.
</ai_context>

# Computer-use benchmarks should treat success, time, and cost as a joint frontier

**Date:** 2026-10-01  
**Source:** <https://cuaspeedrun.com/>  
**Paper:** [arXiv:2609.40284v1](https://arxiv.org/abs/2609.40284v1)  
**Repo:** <https://github.com/cua-speedrun/cua-speedrun>  
**HN:** [49926485](https://news.ycombinator.com/item?id=49926485)  
**Coverage:** Full arXiv v1 HTML paper; current project page and repository README; HN submission (no discussion comments)  
**Disposition:** New knowledge

## Question

What does cua-speedrun add to the evaluation of computer-use agents beyond another task-success leaderboard?

## Finding

cua-speedrun treats a computer-use agent as a complete configuration—model, reasoning effort, harness, action protocol, and environment runtime—and compares configurations on a joint **task success, wall time, and model cost** frontier. This is more informative than ranking models by success alone because the paper finds that changing the harness or reasoning effort can move the same model to a different part of the frontier, and the preferred configuration changes between OSWorld and OSWorld2.

The reusable design is the measurement boundary. A task clock starts when the instruction reaches the ready agent and stops when the agent finishes or reaches its limit. Environment provisioning, task setup, agent initialization, and final verification are outside that interval. Inside it, the system records agent time and environment-operation time separately; infrastructure failures are retried, while agent failures remain failed trajectories. Agents and desktop environments run in separate Modal sandboxes under common images and resources. That does not make remote API inference perfectly reproducible, but it makes the included and excluded time explicit and reduces infrastructure differences that otherwise masquerade as agent speed.

The paper's strongest counterexample to simplistic latency optimization is FastCUA. Across five runs of one GPT-6 Astra configuration on the 50-task OSWorld subset, reducing mean environment processing from 12.68 seconds to 0.34 seconds per task increased total mean task time from 89.5 seconds to 99.0 seconds. Screenshots could return before applications visibly updated, prompting extra observations or waits. This is first-party evidence for a broader evaluation rule: **measure closed-loop completion time and action behavior, not component latency in isolation.** A faster effect-to-observation path can make a controller slower when its timing policy was shaped around delayed observations.

Harness behavior is likewise part of the evaluated system, not neutral plumbing. The paper reports that one GPT-5.6 Luna configuration at low reasoning improved from 61.8% to 75.6% through Codex but slowed from 74 to 145 seconds; at medium and high reasoning the direct-API harness was both faster and more accurate. Its CUA-AutoDebug tool also found 11 failures among 94 supported input cases repeated five times in an SSH/PyAutoGUI path, including shifted symbols, Unicode, named keys, and shell expansion. After changes to the project's QEMU runtime, all 470 repeated cases passed. Separate harness checks found wrong scroll direction, key names typed as text, lost modifier state, and discarded actions. These tests show why an agent score should not automatically be attributed to the model: the adapter may alter a correct proposed action before it reaches the application.

## Representative subsets help iteration, but do not preserve everything

The project selects smaller task sets using score-pattern similarity across previously evaluated agents. In leave-one-agent-out validation, its 50-task OSWorld subset reached rank correlations of 0.983 for partial score and 0.975 for exact completion; the 52-task OSWorld2 subset reached 0.964 and 0.955. The OSWorld subset represented only 15.1% of recorded trajectory time for the nine selection models.

Those figures justify the subsets as lower-cost iteration tools for the evaluated population, not permanent replacements for full benchmarks. On held-out OSWorld configurations, the subset recovered two of three full-set speed–performance frontier points: 100% precision but only 66.7% recall. The authors also say that changed agent capabilities can require revalidation. A practical evaluation program should therefore use a compact subset for frequent feedback, periodically rerun the full population, and version the subset with the agents and score records used to select it.

## Reusable implications

1. **Report a frontier, not one winner.** Preserve success, end-to-end task time, model cost, and the exact harness/reasoning/runtime configuration.
2. **State the clock boundary.** Setup and verification exclusions, retries, timeouts, waits, and failed-agent handling materially affect speed claims.
3. **Attribute latency.** Separate agent/model time, environment operations, and agent-requested waits, then still judge the closed loop as a whole.
4. **Test action delivery independently.** Before interpreting task scores, verify that requested clicks, key chords, text, modifiers, scrolling, and batches arrive as intended.
5. **Treat harness changes as experimental changes.** Model identity alone is not the unit of comparison.
6. **Version compact evaluation sets.** Validate held-out ranking and frontier retention, and revalidate after the evaluated population changes.
7. **Keep safety and effect correctness separate.** Fast, cheap benchmark completion does not establish authorization, isolation, rollback, external-effect settlement, or suitability for real user workloads.

## Limitations

- Scout did not run the software or reproduce any score, timing, cost, action-delivery, or subset-selection result.
- The paper is arXiv v1. Its public results are first-party, and API latency, pricing, model versions, and provider behavior can change after evaluation.
- Coverage is incomplete across model × harness × reasoning × benchmark combinations; the paper explicitly attributes this to evaluation cost.
- The five-seed stability and FastCUA comparisons concern one GPT-6 Astra configuration on one 50-task subset. They do not establish equal stability for other agents or workloads.
- Representative subsets were selected from historical score patterns. Their strong rank correlations coexist with only 66.7% recall of the held-out OSWorld speed–performance frontier.
- OSWorld and OSWorld2 do not establish production usefulness, security, or correctness for arbitrary desktops. CUA-World and MyPCBench use vision-language-model grading, introducing a separate evaluator boundary.
- The HN item had no substantive discussion at inspection time; the evidence comes from the linked paper, project page, and repository README.

## Sources inspected

- Project page: <https://cuaspeedrun.com/>
- Paper HTML: <https://arxiv.org/html/2609.40284v1>
- arXiv metadata: <https://export.arxiv.org/api/query?id_list=2609.40284>
- Repository README: <https://github.com/cua-speedrun/cua-speedrun/blob/main/README.md>
- HN submission: <https://news.ycombinator.com/item?id=49926485>
