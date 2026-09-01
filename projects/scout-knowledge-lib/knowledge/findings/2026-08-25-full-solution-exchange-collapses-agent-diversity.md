<ai_context>
summary: "A controlled arXiv study of 11 verifier-scored optimization tasks finds that diverse model families cover different solution regions, but letting agents read complete peer solutions can collapse that diversity in one round. The design lesson is to treat information exposure as a first-class coordination variable: preserve independent generation, then share bounded evidence such as scores, failure causes, or verified summaries before exposing full artifacts. This is evidence against full-solution exchange as a default, not against all multi-agent communication; the study is small, task-dependent, and does not establish transfer to open-ended work."
triggers: ["multi-agent diversity", "full-solution exchange", "agent debate", "independent proposals", "interaction tax", "information exposure", "ensemble collapse", "selective communication"]
last_updated: "2026-08-25"
source_basis: "arXiv:2608.23541v1 (Ann, Liu, Tan), including the arXiv HTML and PDF retrieved 2026-08-25."
</ai_context>

# Preserve option value before agents exchange full solutions

**Date:** 2026-08-25  
**Source:** https://arxiv.org/abs/2608.23541  
**Primary text:** https://arxiv.org/html/2608.23541  
**PDF:** https://arxiv.org/pdf/2608.23541

## Signal

Ann, Liu, and Tan isolate an important multi-agent design variable that agent-count comparisons often hide: **what agents are allowed to see, and when**. Their matched-resource study compares ten single- and multi-agent configurations on 11 optimization tasks with JSON outputs, deterministic visible scorers, and stricter or shifted hidden evaluators. The tested backbones—Claude Sonnet 4, GPT-4o, and Gemini 2.5 Flash—each lead on at least one task, while every same-model team fails completely on at least one task. Diverse proposers therefore provide coverage that is easy to destroy accidentally.

The destructive step is early exposure to complete peer artifacts. In Chain, MAgICoRe, and Debate, interaction improved the authors' interaction-gain metric for same-model teams but made it negative for diverse-model teams. Their trajectory analysis places the change at the full-output exchange: pairwise solution distance falls after one round, and an Erdős debate improves while agents exchange critiques before regressing once they read complete solutions. Independent-proposer MoA is the only tested family whose diverse interaction gain remains positive.

This is not evidence that synthesis reliably combines complementary ideas. In the paper's classification, synthesis copied the best proposer on five of seven tasks at least 80% of the time. A nominal “combine” stage can therefore act as selection plus convergence rather than recombination.

## Design implication: coordinate through a disclosure ladder

Treat peer information as a staged capability rather than a binary communication switch:

1. **Generate independently** so different models or seeds retain separate search trajectories.
2. **Share low-bandwidth evidence first**—verifier scores, violated constraints, failure causes, method labels, or bounded critiques.
3. **Permit targeted repair** only when the receiving agent can locate and act on the reported defect.
4. **Select against an external verifier** before exposing full candidate artifacts.
5. **Expose full solutions late and deliberately**, when recombination is needed, while measuring whether diversity actually survives.

The important metric is not simply the number of agents or messages. A harness should record proposal diversity before and after each disclosure boundary, together with selection quality and hidden-evaluator performance. Otherwise a team can appear highly collaborative while silently discarding its main source of option value.

This complements the library's existing coordination-tax observation. Event-driven coordination taxes compute; full-solution exchange can additionally tax the *search portfolio* by correlating agents that were useful precisely because they differed.

## Boundary of the evidence

The paper explicitly limits the claim:

- the main benchmark has five seeds per condition;
- the diversity factorial uses ten seeds on only three tasks;
- removing the Erdős task makes the diversity coefficient's confidence interval cross zero;
- the explicit hard-feasibility analysis covers only Knapsack and 3AP-Free;
- all tasks are verifier-scored optimization problems, so transfer to open-ended writing, planning, or dialogue is unproven;
- the authors propose, but do not run, the decisive ablation across scores, method descriptions, failure causes, verified summaries, and late crossover.

The reusable conclusion is therefore narrow but actionable: **full candidate exchange is a weak default when model diversity is part of the reason for using a team**. The next experiment for any production harness is an information-channel ablation, not merely another agent-count sweep.
