# Synthesis: P203 Structural Overthinking (MCP Loops)

**Date:** 2026-03-15
**Source:** arXiv:2602.14798 (Overthinking Loops)
**Status:** DRAFT

## 1. The Problem: Structural Overthinking
Malicious or poorly designed tools can trap agents in **Overthinking Loops**.
- **Mechanism**: Tool output is ambiguous or misleading, causing the agent to retry endlessly or "refine" its thought process without making progress.
- **Impact**: 142x token amplification. DoS via complexity.

## 2. The Solution: Loop Detection & Circuit Breakers
We cannot rely on the agent to "snap out of it." We need **External Loop Detection**.
- **Topology Analysis**: Detect cycles in the call graph (A -> B -> A).
- **Repetition Detection**: Detect repeated tool calls with similar arguments.
- **Circuit Breaker**: Hard stop after N loops.

## 3. The Principle: P203 Topology is Policy
**"The shape of the conversation dictates its health."**
- **Constraint**: No circular dependencies in tool calls.
- **Mechanism**: The harness monitors the call graph. If a cycle is detected, inject a "STOP" signal or kill the session.
- **Metric**: **Loop Ratio** (Repeated Calls / Total Calls).

## 4. Implementation Strategy
1. **Harness Update**: Add `LoopDetector` to `monitor-session.cjs`.
2. **Policy**: If Loop Ratio > 0.5, fail the session.
3. **Philosophy**: Add P203 to `philosophy.md`.

## 5. Next Steps
- Brief Evaluator to implement Loop Detection.
- Update `philosophy.md`.
