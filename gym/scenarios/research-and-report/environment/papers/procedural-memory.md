# Procedural Memory Through Action Pattern Compilation

**Authors:** Johansson, Acharya, Williams (2024)
**Venue:** NeurIPS 2024, Agent Learning Track

## Abstract

We present ActionForge, a procedural memory system that learns reusable action patterns (macro-actions) from an agent's operational history. Instead of remembering what happened (episodic) or what is true (semantic), ActionForge captures *how to do things* — compiling frequently successful action sequences into parameterized procedures that can be invoked as single steps in future tasks.

## Approach

ActionForge monitors the agent's action stream and identifies recurring subsequences that lead to successful outcomes. Using a modified sequential pattern mining algorithm, it extracts candidate procedures when a sequence of 3+ actions appears with >70% success rate across 5+ instances. Candidates are generalized by replacing concrete values with typed parameters (e.g., specific file paths become `<file:path>` slots). Compiled procedures are stored in a skill library indexed by precondition signatures. During execution, the agent's planner checks whether current state matches any procedure's preconditions and can invoke the compiled sequence instead of reasoning step-by-step. A feedback loop adjusts procedure confidence based on ongoing success/failure.

## Key Results

Over a 60-day evaluation with a DevOps automation agent, ActionForge compiled 47 reusable procedures from 1,200+ task executions. Using compiled procedures reduced average task completion time by 34% and decreased error rates by 19% on routine tasks. The most-used procedure ("diagnose-and-fix-import-error") was invoked 89 times with 94% success. Novel tasks (no matching procedure) showed no improvement, as expected. Memory footprint was minimal: 47 procedures occupied 156KB. The compilation process itself added ~200ms overhead per completed task. Critically, agents using ActionForge maintained performance on novel tasks while accelerating routine ones, showing no negative transfer.

## Limitations

Procedural memory is inherently conservative — it only helps with tasks similar to previously seen ones. The pattern mining requires a substantial history (minimum ~50 tasks) before useful procedures emerge, creating a cold-start problem. Procedures can become stale when the environment changes (e.g., API updates), and the current staleness detection relies on failure rates rather than proactive validation. The system also cannot compose procedures — each is a flat sequence with no conditionals or loops.
