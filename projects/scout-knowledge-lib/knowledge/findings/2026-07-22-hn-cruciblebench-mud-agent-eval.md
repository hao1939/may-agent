# CrucibleBench — MUD-Based Agent Behavior Evaluation

Date: 2026-07-22
Source: https://cruciblebench.ai/
HN: https://news.ycombinator.com/item?id=49008538
Score: 67 points

## Summary

CrucibleBench is a research-stage benchmark that evaluates LLM agent **behavior** (not just knowledge) by placing models in a persistent MUD (multi-user dungeon) text world. Agents must accomplish hidden social objectives over 50 turns in environments where NPCs remember interactions, trust accumulates, and mistakes leave traces.

## Key Design Properties

1. **Enumerable action space**: 7 command types, 12 rooms, 14 items — hallucinated actions are detectable
2. **Explicit social feedback**: 4 NPCs carry trust/suspicion state (0–100) that shifts based on dialogue
3. **Within-run persistence**: Items taken stay taken; trust earned stays earned — tests sequential planning
4. **Cheap to run**: Phase 1 proof-of-concept covered 13 models × 650 runs for $99.59 total

## Agent-Relevance

- Measures **social reasoning and multi-step planning** rather than factual recall
- The constrained action space makes it possible to detect hallucinated tool calls — analogous to MCP tool-call validation
- Trust accumulation mirrors real-world agent scenarios (API auth escalation, user trust building)
- "Lateral thinking with withered technology" philosophy: mature text-game infrastructure repurposed for modern eval

## Status

Phase 1 released with full transcripts. Phase 2 in active build (instrument validation, calibration, preregistration).

## Tags

agent-evaluation, behavioral-benchmarks, social-reasoning, multi-step-planning
