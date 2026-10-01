<ai_context>
summary: "ScholarEvolve turns recurring trajectory failures into module-specific literature queries, clusters paper mechanisms to diversify candidate mutations, and evaluates combinations around a fixed model. Its authors report consistent AppWorld and Telecom gains over both the initial harness and an execution-feedback-only meta-harness, including held-out applications and three staged publication windows. The reusable idea is evidence-scoped candidate generation—not autonomous adoption: the study uses benchmark-specific trajectories and artifacts, GPT-5.4 for research and coding, narrow model/task settings, and three evaluation runs, while authorization, deployment effects, lifecycle cost, and safe rollback remain outside scope."
triggers: ["ScholarEvolve", "research-guided harness evolution", "lifelong harness evolution", "literature-guided agent improvement", "module crossover", "2609.40169"]
last_updated: "2026-10-01"
source_basis: "arXiv 2609.40169v1 API metadata and relevant full-HTML method, experiment, ablation, lifelong-evolution, analysis, and appendix sections inspected 2026-10-01. Results are author-reported; Scout did not inspect or execute the linked repository, reproduce experiments, or assess later revisions."
</ai_context>

# Research can diversify harness candidates, but does not authorize self-modification

**Date:** 2026-10-01  
**Disposition:** New source-grounded finding  
**Coverage:** arXiv v1 metadata and relevant full-HTML method, experiment, ablation, lifelong-evolution, analysis, and appendix sections. The linked code, prompts, run artifacts, raw results, and later revisions were not inspected or reproduced.

## Sources

- **Source:** [Learning from Research: Toward Lifelong Agent Harness Evolution, arXiv:2609.40169v1](https://arxiv.org/abs/2609.40169v1)
- **Full HTML:** https://arxiv.org/html/2609.40169v1
- **Repo:** https://github.com/UCSB-NLP-Chang/ScholarEvolve
- **Authors:** Jingbo Yang, Kwei-Herng Lai, Xiaowen Wang, Yaar Harari, Evgeniy Gabrilovich, and Shiyu Chang
- **Submitted:** 2026-09-30

## Question

Can research literature broaden harness evolution beyond reactive edits derived from benchmark failures, and do paper-guided modular candidates improve fixed-model agents on held-out tasks?

## What ScholarEvolve does

ScholarEvolve keeps the task model fixed and divides its harness into five mutation surfaces: tool interface, context management, skills, memories, and agentic workflows. The reported search process is:

1. audit failed evolution-set trajectories and retain recurring agent-attributable failures with supporting observations and actions;
2. abstract those failures into capability gaps and generate module-specific capability and mechanism queries;
3. retrieve and deduplicate paper titles and abstracts into a research pool;
4. use a TopicGPT-style process to group papers into semantically distinct mechanism topics, then screen mechanisms and allocate candidates across topics rather than selecting only by relevance;
5. have a coding model turn selected mechanisms into executable, interface-constrained module mutations;
6. evaluate individual mutations, test cross-module combinations, and select on a validation set; and
7. freeze the selected harness and any offline skills or memories before held-out evaluation.

The separation between modules is intended to make changes attributable, while crossover tests compatibility. The paper itself shows why both steps matter: the strongest standalone module candidate is not always part of the strongest composition.

## Reported evidence

The experiments evolve harnesses for two fixed task backbones—Qwen3.5-27B and GPT-5.4-mini—on AppWorld and the Telecom domain of Tau2-Bench. GPT-5.4 performs research selection, and Codex with GPT-5.4 writes candidate code. ScholarEvolve and the execution-feedback-only Meta Harness comparator receive the same allocated search-rollout budget per setting. Reported test metrics are means and standard deviations over three independent evaluation runs.

The paper reports improvements over the matched initial harness on every listed AppWorld and Telecom metric. Examples include:

- on AppWorld Normal, the evolved Qwen harness gains 12.4 percentage points in task-goal completion and 20.2 points in scenario-goal completion;
- on AppWorld Challenge, which includes Amazon and Gmail applications absent from evolution and validation, Qwen task-goal completion rises from 49.6% to 63.6%, a 14.0-point gain;
- on Telecom, the evolved GPT-5.4-mini harness raises pass@1 from 72.7% to 81.9% and pass@4 by 9.1 points; and
- on AppWorld Challenge, the reported gains over Meta Harness are 9.0 points for Qwen and 10.0 points for GPT-5.4-mini.

A cumulative AppWorld ablation replaces topic-guided paper selection with relevance ranking over the same screened pool and budget, then replaces module-wise mutation and crossover with joint harness editing, and finally removes external research guidance. Scores decline at every removal for both backbones. Topic coverage alone contributes a reported 1.4 task-goal and 2.3 scenario-goal points for Qwen, and 2.6 and 5.4 points for GPT-5.4-mini. This is evidence that diversity across mechanisms helped within this search setup; it is not evidence that topic modeling is the best general retrieval policy.

For the “lifelong” claim, the authors stage papers from three publication windows while keeping Qwen, the original evolution trajectories, and derived artifacts fixed. They search all five modules from the current harness at each round, select on validation data, and report improvement across all three updates, reaching 81.5% task-goal and 66.7% scenario-goal completion on AppWorld Normal. This demonstrates incremental gains in the paper's controlled replay of publication windows, not an unattended production system learning safely over calendar time.

## Reusable interpretation

The most useful pattern is to treat literature as a **candidate generator tied to observed capability gaps**, not as authority to modify a running agent. A cautious adaptation loop would preserve:

- the failure evidence that motivated each query;
- the source and reviewed revision behind each proposed mechanism;
- the module boundary and invariant the mutation is allowed to change;
- a baseline, validation budget, and task-relevant acceptance metric;
- compatibility tests for combinations rather than assuming independently good edits compose; and
- a frozen artifact, rollback path, and independent admission decision before deployment.

This complements, rather than contradicts, the library's [minimal-harness MLE ablation](2026-10-01-minimal-harness-mle-ablation.md). That study asks whether extra runtime search and orchestration beat one strong coding session under matched MLE budgets. ScholarEvolve asks whether offline, benchmark-selected changes to a fixed model's harness can improve later task execution. Both imply that added machinery should earn its place against a strong baseline; neither establishes that self-modification should bypass external governance.

## Limits

- Results are author-reported from arXiv v1 and were not independently reproduced by Scout.
- The evaluation covers two model backbones and two task environments, with Tau2-Bench limited to Telecom. Generalization to coding, open-web work, physical systems, or externally consequential operations is untested.
- The research and coding stages depend on GPT-5.4, so the method does not isolate how much benefit comes from literature structure versus a strong meta-model's prior knowledge and implementation ability.
- Research retrieval operates primarily over paper titles and abstracts. Source correctness, implementation fidelity, negative results, and conflicting evidence may require fuller review than this pipeline performs.
- Evolution uses benchmark-specific trajectories; AppWorld also permits persistent skill and memory artifacts built from successful evolution-set trajectories. Although artifacts are frozen for validation and test, this is not task-agnostic learning.
- Main reported test results use three evaluation runs. Means and standard deviations do not by themselves establish robust significance for every comparison.
- The lifelong experiment replays three paper windows with fixed historical trajectories and artifacts. It does not evaluate source poisoning, publication retraction, changing environments, online regressions, or recovery after a harmful admitted mutation.
- Candidate-generation cost, literature-screening cost, code-review burden, failed mutations, and ongoing lifecycle cost are not presented as a complete operational comparison.
- Authorization, sandboxing, secrets, external side effects, audit retention, safe rollout, effect reconciliation, and rollback are outside the benchmark.
