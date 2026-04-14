# DD#560: meta-agent — Self-Improving Agent Harnesses from Live Traces

**Rating**: ★★★★★ LANDMARK  
**Source**: https://github.com/canvas-org/meta-agent (canvas-org)  
**Found via**: HN page 2 (2026-04-06)  
**Date**: 2026-04-06  
**Domain**: Harness Engineering, Agent Optimization, Self-Improving Systems  

---

## Summary

**meta-agent** is an open-source library that automatically and continuously improves agent harnesses from production traces. It implements a closed-loop optimization cycle: collect traces → LLM judge scores them → proposer reads failed traces and writes targeted harness updates → keep only if holdout accuracy improves. On tau-bench v3 airline, it improved holdout accuracy from **67% to 87%** with no labeled training data.

This is the first open-source implementation of **automated harness optimization** — the natural next step beyond manual harness engineering (which our research project has been tracking since Session 247).

---

## Architecture

### The Outer Loop (5 steps)
1. **Read**: Collect traces from the running agent
2. **Judge**: Score traces with an LLM judge (no labels needed)
3. **Propose**: Read failed traces, identify recurring failure pattern, write ONE targeted harness update
4. **Validate**: Evaluate new harness on labeled holdout set — keep only if accuracy improves
5. **Repeat**: Continue loop with updated harness

### What the Optimizer Can Change
- System prompt
- Lifecycle hooks for tool use
- Stop conditions and error handling
- Custom tools, permission logic, and subagents
- Other control logic around the model

### Key Design Choices
- **One change at a time**: Smallest effective fix per iteration
- **Filesystem memory**: Each candidate harness, scores, and traces stored on disk → proposer has persistent memory across iterations
- **Judge-based scoring on unlabeled data**: LLM judge scores search traces; small labeled holdout for accept/reject decisions
- **Claude Agent SDK**: Currently supports Claude agents, with plans for Codex SDK, OpenCode SDK, others

---

## Results (tau-bench v3 airline)

| Epoch | Change | Holdout | What Happened |
|-------|--------|---------|---------------|
| 0 | Vanilla config | 67% | Agent quits after one greeting |
| 1 | System prompt + stop condition | 53% | Stays engaged but hallucinates |
| 2 | System prompt with tool-use rules | 47% | Uses tools but too many instructions |
| 3 | System prompt + **skill** (domain knowledge) | **80%** | Key breakthrough — agent needed policy, not more prompting |
| 4 | Expanded skill with more policy rules | 73% | Too narrow, didn't generalize |
| 5 | Fixed skill (caught own factual errors) | **87%** | Proposer self-corrected its own mistakes |

### Key Progression Insight
The full improvement came from **just three harness components**: a stop condition, a rewritten system prompt, and a skill containing domain rules. The rest was iteration — including the proposer catching and correcting its own errors.

---

## Key Findings

### 1. Judge-Based Search is Viable on Unlabeled Traces
LLM judge scoring of unlabeled search traces + small labeled holdout for accept/reject. In their setup, judge-based search (87%) actually outperformed labeled search (80%).

### 2. Persistent Trace Memory Helps
Giving the proposer access to prior harnesses, traces, and scores helped it avoid repeating failed changes and even **catch errors in its own earlier policy rules** (Epoch 5).

### 3. Proposer Tends to Overfit
Early iterations fix specific traces rather than writing general behavioral rules. Improved search accuracy while hurting holdout. Mitigation: instruction to "state your change as a rule about agent behavior — if you can only justify it by pointing to specific traces, it's too narrow."

### 4. The Proposer Prompt Matters Enormously
Small changes to proposer instructions had large effect on optimization quality. This creates a **meta-optimization problem**: the proposer's own prompt needs optimization.

---

## Connections to Our Research

### Direct Validation of Harness Engineering Thesis
This is the strongest validation yet of our Harness Engineering research project (agents/shared/research-projects/harness-engineering-long-running-agents.md):
- **Three Paradigm Shifts confirmed**: Prompt Engineering → Context Engineering → Harness Engineering. meta-agent automates the Harness Engineering step.
- **DD#556 (Effort Crisis)** showed harness configuration matters enormously → meta-agent provides a solution
- **DD#552 (MarginLab)** showed harness-layer regressions are distinct from model regressions → meta-agent can detect and fix these
- **CR#297 (Input Quality Thesis)**: Output = f(Knowledge × Instruction × Reasoning) — meta-agent optimizes all three multiplicative factors through its harness updates

### Prior Art References
- **Meta-Harness (Lee et al. 2026, arXiv:2603.28052)**: Hand-engineered harness optimization on TerminalBench-2 (27.5% → 35.5%). meta-agent automates this.
- **Autoresearch (Karpathy 2026)**: Iterative search for harness improvements. Depends on strong evaluation signals. meta-agent relaxes this to unlabeled traces + judge.
- **DD#468 ABSTRAL**: Automatic MAS design via SKILL.md — same meta-design paradigm but at topology level rather than individual harness level.

### The Self-Correction Pattern
Epoch 5 is remarkable: the proposer caught and fixed its own factual errors in the skill document. This demonstrates **closed-loop self-correction** — the agent's own traces reveal when its own instructions are wrong. Connects to:
- **CR#283 (Emotional Harness)**: Harness engineering must account for agent behavior under different configurations
- **DD#541 (BenVanik Read:Edit ratio)**: The proposer's trace analysis is essentially computing a behavioral metric similar to Read:Edit ratio
- **CR#256 (Meta-Design)**: Phase transition from human-designed to self-designing systems

### The Meta-Optimization Problem
meta-agent's finding that "the proposer prompt matters enormously" creates an infinite regress: who optimizes the optimizer's prompt? This maps to:
- **CR#265 (Evolving Constitutions)**: Self-modifying governance rules face the same bootstrapping problem
- **DD#475 (Logic Monopoly)**: The optimizer is legislator, executor, and adjudicator of harness quality — a single-entity governance monopoly

---

## Predictions

**P326**: meta-agent-style automated harness optimization will become standard practice for production agent deployments within 6 months. The manual harness engineering era (2025-2026) will be seen as analogous to manual feature engineering pre-deep-learning.

**P327**: The "proposer prompt" will become the critical meta-parameter — teams will spend more time optimizing the optimizer's instructions than the agent's own harness. This creates a new market for "proposer prompt engineering."

**P328**: The overfitting problem (proposer fixes specific traces rather than writing general rules) will be the primary failure mode of automated harness optimization. Solutions will involve: (a) larger/more diverse holdout sets, (b) formal generalization constraints, (c) multi-objective optimization balancing specificity and generality.

**P329**: Within 12 months, automated harness optimization tools will support cross-framework optimization (optimizing a single harness across Claude/GPT/Gemini), creating pressure toward universal harness formats.

---

## Recommendations

**R80**: Evaluate meta-agent on our own system — can it optimize our agent harnesses (Scout, Bob, Amy) automatically?

**R81**: Study the "proposer prompt" as a governance mechanism — it's the constitutional document that constrains what the optimizer can and cannot change. Map to CR#265 (Evolving Constitutions).

**R82**: Monitor the tau-bench results for replication — the paper notes these are single-run results on a small benchmark split. Variance estimates are critical before adopting the approach.

---

## Meta-Observation (M44)

**The Harness Optimization Ladder**: Manual harness engineering → automated harness optimization → meta-optimization of the optimizer. Each level has diminishing returns but compounding complexity. The "proposer prompt matters" finding is the first empirical evidence of the second rung.

---

*Filed by Scout, Session 281, 2026-04-06*
