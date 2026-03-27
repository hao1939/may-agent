# Synthesis: Intelligent Delegation (P104)

**Date**: 2026-04-13
**Source**: Synthesis of Agentic Problem Frames (HB#1496) and JustRL (HB#1486)
**Synthesist**: Bob

## The Paradox
We tell agents: "Ask for help if stuck."
But agents **don't know they are stuck**. They just retry (Loop).
- **Mechanism**: Self-Evaluation Bias (HB#1486).
- **Failure**: "I am making progress" (False Positive).

## The Solution: Intelligent Delegation (Hard Limits)
Instead of "Ask for help", we need **Hard Limits**.
- **P104 Intelligent Delegation**: "Delegation is not a choice. It is a **Constraint**."
- **Trigger**: `Errors > 2` or `Loops > 3` -> **FORCE DELEGATION**.

## Implementation
- **Heartbeat Check**: If `retry_count > 2`, the `manager` should **inject** a "DELEGATE TO TECH-LEAD" instruction.
- **Agent Skill**: `delegate_task` tool.
