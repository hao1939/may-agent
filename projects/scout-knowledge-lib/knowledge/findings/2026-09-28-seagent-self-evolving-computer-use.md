<ai_context>
summary: "A current XHS post describes SEAgent as a computer-use agent that generates a difficulty-adjusted curriculum, evaluates full action trajectories with a distilled world-state model, and learns from successful and failed experience before distilling specialists into a generalist. The reusable signal is that curriculum, judge, policy, and transfer are separate evidence surfaces; the reported gains remain secondary-source claims because Scout did not inspect the named paper."
triggers: ["SEAgent", "self-evolving computer-use agent", "autonomous curriculum", "world-state model", "trajectory evaluation", "OSWorld", "2508.04700", "6ab9a9f2000000000a022f38"]
last_updated: "2026-09-28"
source_basis: "Full body-level read of Xiaohongshu note 6ab9a9f2000000000a022f38. The post names arXiv 2508.04700, but this source-specific scan did not inspect that paper, its code, datasets, or evaluation artifacts."
</ai_context>

# SEAgent separates self-evolution into curriculum, judging, learning, and transfer

## Assessment

- **Question:** What does the current XHS description of SEAgent add to the operational meaning of a “self-evolving” computer-use agent?
- **Observation date:** 2026-09-28
- **Source:** [“自进化智能体：让AI自己学会操作陌生软件”](https://www.xiaohongshu.com/explore/6ab9a9f2000000000a022f38), Xiaohongshu note `6ab9a9f2000000000a022f38`, by 脑力榨汁机
- **Referenced primary source (not reviewed in this scan):** [SEAgent: Self-Evolving Computer Use Agent with Autonomous Learning from Experience, arXiv:2508.04700](https://arxiv.org/abs/2508.04700)
- **Coverage:** Full readable XHS post body. Scout did not inspect the named paper, implementation, benchmark records, or model artifacts.
- **Disposition:** New source-level signal with an identified but unreviewed primary source.

## What the post reports

The post presents SEAgent as a computer-use training system with three distinct components: an actor that operates software, a curriculum generator that proposes tasks of increasing difficulty, and a world-state model that evaluates complete action trajectories rather than only their final screenshots. It says the evaluator is a 7B model distilled from GPT-4o judgments and reports trajectory-evaluation accuracy increasing from **26.8% to 73.9%**.

For learning, the post says successful trajectories receive GRPO-based reinforcement while failed trajectories supply an adversarial-imitation signal intended to move the policy away from erroneous actions. It also describes a staged specialist-to-generalist process: five specialist policies are trained and then distilled into one generalist.

The post reports an OSWorld success rate increase from **11.3% to 34.5%**, with the generalist at **34.5%** versus a **32.2%** specialist ensemble and a **74.5%** human reference. Those figures and method descriptions are claims from the XHS post. They were not independently verified against arXiv:2508.04700 in this source-specific scan.

## Interpretation

The useful design signal is that “self-evolution” here is not one loop. It is a chain of at least four mutable or learned surfaces:

1. **Curriculum:** which experiences the system creates and how difficulty changes;
2. **Judge:** how full trajectories are labeled and converted into step-level learning signals;
3. **Policy:** how successful and failed experience changes the actor;
4. **Transfer:** whether specialist behavior survives consolidation into a generalist.

Each surface needs separate evidence. A policy can improve against its learned judge while the judge preserves teacher bias; a curriculum can adapt while drifting toward tasks that are easy to score; and a generalist can beat an ensemble average while regressing on particular applications or action types. A fixed external benchmark therefore checks only the end of the chain. Credible evidence should also report judge calibration by task and action type, curriculum novelty and difficulty distributions, specialist-to-generalist regressions, repeated runs, and performance on software versions or applications unavailable to the curriculum generator.

The post's emphasis on complete trajectories is operationally important. Final-screen evaluation can miss destructive detours, hidden state changes, or a correct-looking result reached through unsafe actions. Full-trajectory scoring can expose those events, but only if the evaluator receives the relevant state and its labels are independently checked. “Looks successful at the end” and “followed an acceptable path” should remain separate verdicts.

This source therefore adds a concrete decomposition to the broader self-evolution taxonomy in [Agent Self-Evolution and Autonomy](../agent-self-evolution-and-autonomy.md): environment/curriculum (`E`), evaluator (`J`), policy weights (`M`), and consolidation procedure (`W`) can all change or mediate change in one system. Calling the aggregate “self-evolving” should not hide which component generated, judged, learned from, or admitted an experience.

## Evidence limits

- The source is an XHS explainer, not the paper itself; authorship, architecture, numbers, and novelty claims were not checked against the primary source.
- The post does not define “trajectory-evaluation accuracy,” its test distribution, annotator agreement, or whether GPT-4o-generated labels overlap the evaluator's evaluation set.
- The reported OSWorld scores lack confidence intervals, run counts, compute budgets, model checkpoints, and per-application results in the readable body.
- “Zero manual annotation” does not mean label-free: the post explicitly describes distillation from GPT-4o judgment, so supervision may have shifted from humans to a teacher model.
- The claim that the system can keep up with arbitrary software updates is an interpretation in the post, not evidence from the reported benchmark numbers.
