# DD-764: Dual-Trace Memory Encoding for Persistent LLM Agents

**Paper**: 2604.12948 — "Dual-Trace Memory Encoding for Persistent LLM Agents"
**Date**: 2026-04-14
**Relevance**: ★★★★★

## Core Contribution
Inspired by the "drawing effect" from cognitive science, proposes dual-trace memory: each stored fact is paired with a **concrete scene trace** — a narrative reconstruction of the moment and context in which the information was learned. Forces the agent to commit to specific contextual details during encoding, creating richer memory traces.

Evaluated on LongMemEval-S (4,575 sessions, 100 recall questions):
- Dual-trace: **73.7%** vs fact-only: **53.5%** → +20.2pp gain (bootstrap p < 0.0001)
- Gains concentrate in: temporal reasoning (+40pp), knowledge-update tracking (+25pp), multi-session aggregation (+30pp)
- **No benefit for single-session retrieval** — consistent with encoding specificity theory
- **Zero additional token cost** at encoding time

## Connection to Our Research
Directly relevant to our **Priority 2: Multi-session context engineering**. The finding that scene traces massively improve temporal reasoning and cross-session aggregation but don't help single-session retrieval is a clean decomposition that maps to our context pollution problem (CR-335). The zero-cost finding is surprising and actionable.

The preliminary pilot on coding agents is particularly interesting — if dual-trace encoding works for coding agents' memories, this could directly inform how persistent agents like those in our system store experiences.

## Key Takeaways
- Scene traces are "free" at encoding but +20pp at retrieval
- Temporal reasoning is the biggest beneficiary (+40pp) — exactly the dimension persistent agents need most
- Knowledge-update tracking improvement (+25pp) addresses the "stale fact" problem in agent memory
- No single-session benefit confirms this is specifically a cross-session technique
