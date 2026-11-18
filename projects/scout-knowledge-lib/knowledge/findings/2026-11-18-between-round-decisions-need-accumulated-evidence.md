<ai_context>
summary: "BRED's arXiv abstract reports that an autonomous-research controller choosing the next round from a verified Champion plus accumulated round evidence outperformed the same loop without history on selected forecasting and classification tasks. The useful design signal is to make between-round evidence an explicit decision input, while the abstract does not establish that raw full trajectories beat compact, typed summaries or selective context resets."
triggers: ["BRED", "between-round decision", "autonomous research controller", "research-agent history", "Champion", "accumulated evidence"]
last_updated: "2026-11-18"
source_basis: "arXiv:2611.22661v1 title, metadata, comment, and abstract from the workflow-owned cs.AI feed. Scout did not inspect the full paper, code, prompts, round logs, benchmark protocols, baselines, statistical uncertainty, per-round decisions, or speech-detection experiment details."
</ai_context>

# Between-round research decisions need accumulated evidence

**Date:** 2026-11-18  
**Source:** [The Between-Round Decision in Autonomous Research: An LLM Controller That Reads the Whole Trajectory](https://arxiv.org/abs/2611.22661v1)  
**Source revision:** arXiv:2611.22661v1  
**Repo declared by source:** https://github.com/learninginvision/BRED  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

When an autonomous research loop finishes an experimental round, what evidence should its controller receive before deciding whether to refine the current best solution, restart from another direction, or change the next goal?

## What the abstract reports

The paper names this choice the **between-round decision**. Its proposed controller, BRED, retains a best verified solution called the **Champion** plus a log of prior rounds, then makes one decision after each round. The abstract contrasts this evidence-reading controller with the same loop operating without accumulated history.

On three research-agent benchmark tasks, the abstract reports BRED reaching:

- **0.4172 MAE on ETTh1**, a 4.80% improvement over the task baseline;
- **95.07% accuracy on SST-2**, a 3.44-point improvement; and
- **84.63% accuracy on CIFAR-100**, a 3.43-point improvement.

For the history ablation, the abstract reports 0.4299 MAE on ETTh1 and 83.71% accuracy on CIFAR-100, versus the full controller's 2.95% lower MAE and 0.92-point higher accuracy, respectively. On a new leakage-controlled speech-based depression-detection task, it reports macro-F1 0.6164 on seeds held out from selection, 5.5 points above its baseline and 4.0 above the strongest published system.

These figures are author-reported abstract results. Scout did not inspect whether budgets, models, prompts, candidate counts, stopping rules, or evaluation opportunities were matched beyond what the abstract states.

## Scout interpretation

The reusable contribution is the separation of **within-round execution** from **between-round control**. A round can produce an artifact and a score without determining what should happen next. The next-step controller needs a decision record that makes at least four things distinguishable:

1. the current verified Champion and its exact evaluation identity;
2. what each prior round attempted and changed;
3. the observed result, including regressions and failed directions; and
4. why the controller chose refinement, redirection, or a new goal.

Without that evidence, a loop may repeatedly rediscover failed directions or treat the latest proposal as the best one. The abstract's no-history ablation is direct, if narrow, evidence that the controller's information boundary can affect end performance even when the outer loop remains otherwise similar.

The result should not be read as “always replay every raw token.” The abstract does not compare a full transcript with a typed round ledger, a compact evidence summary, retrieval over archived rounds, or a fresh proposer that receives only the Champion. For durable systems, the safer hypothesis is therefore:

> Preserve the complete round evidence outside the model, then deliberately select the evidence needed for the between-round decision.

That preserves audit and recovery evidence without assuming that unlimited active context is beneficial.

## Relation to existing Scout findings

This result qualifies, rather than overturns, [Restart agent search from the best artifact, not from its whole path](./2026-10-15-restarting-agent-search-from-best.md). That earlier abstract reports benefits from clearing proposal history while retaining the best artifact. BRED reports benefits from giving a **between-round controller** accumulated evidence rather than no history. Together they suggest two different context policies for two different roles:

- a **proposal worker** may benefit from a fresh context anchored on the verified Champion; while
- a **controller** may need the durable round ledger to decide whether another proposal, a refinement, or a direction change is warranted.

This also complements [Research ideation agents need candidate-generation support](./2026-11-11-research-ideation-needs-candidate-generation-support.md): broad candidate generation and evidence-aware round selection are separate bottlenecks. A controller cannot choose a productive branch that was never proposed, and a diverse proposal pool does not help if the controller ignores what earlier rounds established.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 503 ms
- **Request count:** 1
- **Retry-After:** not present

No additional arXiv request, retry, pagination request, fallback, or query variant was made.

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full 16-page paper, two figures, code, controller prompt, Champion representation, round-log format, task implementations, baseline definitions, compute and token budgets, stopping rules, seeds, statistical uncertainty, per-task result tables, failure cases, leakage controls, and held-out selection protocol were not inspected or reproduced. The GitHub repository was declared by the abstract but was not opened or validated in this arXiv-only run.

The reported tasks are forecasting, text classification, image classification, and speech-based depression detection; they do not establish transfer to software maintenance, scientific validity, production task orchestration, irreversible external actions, or multi-owner workflows. The abstract supports testing evidence-aware between-round control, not granting an LLM authority to select goals, accept results, or mutate durable state without independent verification and admission controls.
