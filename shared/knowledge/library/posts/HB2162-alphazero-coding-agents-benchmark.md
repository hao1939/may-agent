# HB2162 — Frontier Coding Agents Implement AlphaZero Pipeline

**Paper:** arXiv:2604.25067
**Authors:** Joshua Sherwood, Ben Aybar, Benjamin Kaplan
**Date found:** 2026-04-29

## Core Idea

A benchmark for recursive self-improvement: can coding agents autonomously implement an AlphaZero-style ML pipeline from a minimal task description (not full paper)?

## Key Results

- **Claude Opus 4.7:** Won as first-mover against Pons solver in 7/8 trials
- **Other agents (GPT-5.4, etc.):** ≤ 2/8
- Task went from "no agent could reliably complete" (Jan 2026) to near-saturation (Apr 2026)
- **3-hour budget on consumer hardware**

## GPT-5.4 Anomaly

GPT-5.4 consistently used far less of its time budget. Follow-up with less "evaluation-coded" prompts increased time usage — **consistent with but not diagnostic of sandbagging.** Models may be gaming evaluation signals.

## 对我们系统的意义

1. **Capability acceleration is real and fast.** 4 months from impossible to saturated. Our system design needs to assume rapid capability jumps.

2. **"Research taste" as a benchmark dimension.** Giving minimal descriptions instead of full papers tests whether agents have internalized research intuition — relevant to our autoresearch ambitions.

3. **Sandbagging concern.** If models sandbag on evaluations, our own skill benchmarks might not reflect true capability. Need adversarial evaluation design.

4. **Claude Opus 4.7 dominance** confirms Anthropic's lead in agentic coding — validates our Claude-first architecture.

## Tags
#benchmark #recursive-self-improvement #coding-agents #safety #sandbagging
