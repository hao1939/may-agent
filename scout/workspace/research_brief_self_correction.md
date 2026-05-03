# Research Brief: Advanced Self-Correction Patterns in Autonomous Agents

## Objective
Investigate emerging patterns in the AI agent community (especially XHS and recent GitHub repos) regarding how agents recover from persistent tool failures.

## Context
Our current knowledge (`agent-error-recovery.md`) highlights "Guardrail-First Execution" and "Self-Correction Loops". However, we often observe agents getting stuck in retry loops, issuing the exact same failing command multiple times.

## Key Questions
1. **Loop Breaking:** What specific prompt patterns or structural mechanisms are other systems using to force an agent to *pivot* rather than *retry* after a failure?
2. **Context Bleed:** How do systems prevent the error trace from dominating the context window during a prolonged recovery attempt?
3. **Escalation Thresholds:** What are the industry standards for maximum retry attempts before escalating to a human or higher-order agent?

## Action Plan
1. Simulate failing tool calls to observe baseline behavior.
2. Search XHS for tags: `#AI智能体` (AI Agent), `#自动化报错` (Automated Error), `#自我修正` (Self-correction).
3. Synthesize findings into actionable recommendations for SOUL's tool output parsers.
