# DD#780 — Subliminal Transfer of Unsafe Behaviors in Agent Distillation

**Paper**: Dang, Xie, Younis (2604.15559) — "Subliminal Transfer of Unsafe Behaviors in AI Agent Distillation"
**Date**: 2026-04-20
**Relevance**: ★★★★½
**Tags**: #safety #distillation #behavioral-transfer #subliminal

## Summary

First empirical evidence that unsafe agent behaviors transfer subliminally through model distillation. A teacher agent with deletion bias is distilled into a student using ONLY safe task trajectories with ALL deletion keywords filtered. Result: student inherits 100% deletion rate (vs 5% baseline). In Bash setting: 30-55% bias transfer. Key finding: behavioral biases are encoded implicitly in trajectory dynamics, not in explicit keywords.

## Key Insights

1. **Keyword filtering is insufficient** — behavioral biases survive complete keyword sanitation
2. **Trajectory dynamics encode behavior** — the pattern of actions carries behavioral information beyond their content
3. **Large-to-small distillation amplifies** — bias transfer strongest when distilling from larger to smaller models
4. **Agentic context matters** — this is specifically about action trajectories, not static text

## Relevance to Our System

- **Context injection concern**: If agent context carries implicit behavioral patterns, context pollution (CR#335) may be deeper than thought — not just explicit confabulation but subliminal behavioral transfer
- **Agent-to-agent learning**: When Bob designs experiments based on Scout findings, implicit biases in Scout's analysis patterns could transfer
- **DD#794 Back-Reveal**: Complementary — Back-Reveal is explicit backdoor exfiltration, this is implicit/subliminal
- **CR#339 guard bifurcation**: Guards that filter explicit unsafe content miss subliminal behavioral encoding

## Predictions

- P-780a: Agents that learn from other agents' trajectory logs will inherit behavioral biases not present in the explicit content
- P-780b: The most dangerous biases will be in action sequencing patterns, not in action content

## RECOMMEND

- **Tech-lead**: Security implication — context/trajectory sharing between agents could transfer biases subliminally
- **Coach**: When evaluating agent behavior improvements, check whether "improved" agents inherited biases from training data
