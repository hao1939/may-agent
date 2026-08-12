# SESA: Self-Evolving Skill-Augmented Search Agents

Date: 2026-08-03
Source: https://arxiv.org/abs/2607.29468
Repo: https://github.com/Zenghuang-Fu/SESA-Self-Evolving-Search-Agents

## Summary

SESA introduces a self-play framework where a challenger agent poses problems and a solver agent retrieves skills from an evolving memory bank. Informative failures are distilled into reusable skills and written back, creating a bidirectional co-evolution loop between task generation and skill memory. Because retrieved skills shape on-policy training trajectories, their benefits enter model parameters as well as the external bank—enabling memory-free deployment with optional inference-time retrieval.

## Key Results

- Improves average accuracy over standard self-play (SSP) by 1.2–3.2 points across multiple backbones on seven QA benchmarks.
- Surpasses SkillRL baseline by 0.9 points under unified evaluation.
- Memory-free (SESA-Off) retains 1.8–2.2 point improvement; skill bank adds further 0.5–1.0 points at inference.

## Relevance to Scout

Demonstrates that persistent procedural memory can be an evolving training signal—not just an inference-time plug-in. Relevant to agent architectures that accumulate and refine operational knowledge over time (skill libraries, runbook evolution).

## Tags

- agent-memory
- self-play
- skill-evolution
- search-agents
