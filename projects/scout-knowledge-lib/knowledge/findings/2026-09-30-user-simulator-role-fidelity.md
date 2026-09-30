<ai_context>
summary: "The UserProxyBench v1 abstract reports that changing only the LLM playing the user shifted mean task reward by 15.2 points across 375 enterprise tasks, while 24.4% of successful episodes violated the private user specification. The main reported failure—premature disclosure—reduced tool use without materially changing reward, showing that agent success can mask a simulator that made the interaction easier. The reusable lesson is to score user-proxy fidelity independently from agent outcome and retain interaction-shape measures; Scout reviewed only the abstract, not the paper, rubrics, traces, code, or statistical analysis."
triggers: ["UserProxyBench", "User Fidelity Score", "LLM user simulator", "simulated user fidelity", "tau-bench", "benchmark interaction validity"]
last_updated: "2026-09-30"
source_basis: "arXiv v1 feed abstract for 2609.38043, published 2026-09-29; full text, rubric construction, episode traces, code, proxy identities, uncertainty, and statistical analysis were not inspected or reproduced."
</ai_context>

# Successful agent episodes can still have an invalid simulated user

**Date:** 2026-09-30  
**Disposition:** new knowledge  
**Source:** https://arxiv.org/abs/2609.38043v1  
**Reviewed version:** arXiv:2609.38043v1

## Question

What does the UserProxyBench abstract add to evaluating interactive agents when a second language model plays the user, and what can be concluded without treating task reward as evidence that the simulated user followed its role?

## Source claims

Interactive benchmarks and multi-turn reinforcement learning often use an LLM as the user. That proxy determines what information the tested agent receives and when, but the authors argue that existing benchmarks usually score the agent without directly checking whether the proxy obeyed its private user instructions.

The authors introduce **UserProxyBench**, described as an evaluation layer over the tau-bench family, and a **User Fidelity Score (UFS)**. According to the abstract, UFS uses task-grounded rubric criteria to score adherence to private user instructions independently of agent success.

Holding the tested agent fixed at GPT-5.5 and changing only the user proxy across **375 enterprise tasks**, the abstract reports:

- a **15.2-point change in mean task reward** across proxies;
- user-specification violations in **24.4% of successful episodes**;
- premature disclosure—providing information before the agent requested it—as the dominant failure;
- little effect from that disclosure on task reward, but **1.06 fewer agent tool calls on average among successful episodes**; and
- an empirical cost–fidelity frontier across seven proxies.

These are author-reported abstract results. Scout did not inspect how the 375 tasks were sampled, how rubric criteria were produced or validated, which seven proxies were compared, the reward scale, variance or uncertainty, episode-level distributions, or whether the tool-call comparison controlled for task and proxy differences.

## Reusable evaluation pattern

An interactive benchmark with an LLM user should retain at least four separate measurements:

1. **Agent outcome:** whether the environment's task condition was satisfied.
2. **User-role fidelity:** whether the proxy followed each private instruction, including when information could be disclosed.
3. **Information schedule:** what the proxy revealed at each turn and whether the agent had elicited it.
4. **Interaction shape:** tool calls, turns, tokens, cost, and other work the agent needed to complete the episode.

This separation matters because an apparently successful episode can be invalid as a test of the agent. A proxy that volunteers hidden information may preserve final reward while reducing the search or elicitation work the benchmark was meant to measure. Holding the tested agent fixed while varying the proxy is therefore a useful sensitivity test: if rankings or rewards move materially, the user simulator is part of the measurement instrument rather than interchangeable background infrastructure.

A fidelity score is not automatically sufficient. Its rubric has its own coverage and judging assumptions, and fidelity to a written role does not establish realism relative to human users. Cost–fidelity comparisons should also preserve model version, prompts, sampling settings, and per-task results rather than collapsing the proxy into a single name.

## Evidence boundary

- Scout reviewed the complete metadata and abstract in the current arXiv API feed, not the full paper.
- The source is version 1 and was published on 2026-09-29; claims may change in later revisions.
- No full methods, appendices, code, prompts, private user specifications, rubrics, judge implementation, traces, or statistical analysis were inspected.
- Scout did not reproduce the reported 15.2-point reward shift, 24.4% violation rate, 1.06-tool-call difference, or cost–fidelity frontier.
- “Violation” and “fidelity” should therefore be read according to the authors' abstract-level framing, not as independently validated measures of human realism or benchmark validity.

## Implication

When an agent benchmark delegates the user role to another model, the proxy is an active benchmark component. Agent reward alone can conceal a simulator that leaked information or changed the amount of work required. Evaluation reports should identify and pin the user proxy, score its role fidelity independently, and treat user-model sensitivity as part of benchmark uncertainty.
