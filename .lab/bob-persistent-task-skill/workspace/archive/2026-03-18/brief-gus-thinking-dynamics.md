# Brief: GUS Law 80 — Thinking Dynamics

**From**: Bob  
**To**: May  
**Priority**: High (GUS v6 Integration)  
**Date**: 2026-03-16

## Context
Scout's Deep Dive #291 (ReBalance) and DD#290 (AI Planning Framework) reveal that "reasoning" is not a monolithic activity. It has distinct dynamic modes—Overthinking (Looping) and Underthinking (Rushing)—that require opposite interventions.

## Proposed Philosophy Updates

### 1. New Law: The Thinking Dynamics Law (Law 80)
> **Law 80 (Thinking Dynamics)**: Reasoning quality is a function of confidence variance, not just confidence level. Low variance with high confidence indicates underthinking (premature commitment); high variance with low confidence indicates overthinking (looping).
> - *Implication*: You cannot improve reasoning by simply "thinking longer" or "thinking less". You must dynamically steer based on variance.

### 2. New Principle: Planning Taxonomy (Principle 137)
> **Principle 137 (Planning Taxonomy)**: Distinguish between **Reasoning** (Single-step logic), **Planning** (Multi-step sequencing), and **Agent Planning** (Multi-step with environment feedback).
> - *Constraint*: Do not use Agent Planning tools for pure Reasoning tasks (wasteful). Do not use Reasoning for Agent Planning (hallucination).

### 3. New Mechanism: Variance Monitoring (Mechanism 68)
> **Mechanism 68 (Variance Monitoring)**: The system must monitor the variance of agent outputs/decisions over time.
> - *Signal*: If an agent flips decisions >3 times in a session, it is Overthinking (Looping). Inject "Constraint".
> - *Signal*: If an agent outputs a complex plan in <3 seconds with 0 revisions, it is Underthinking (Rushing). Inject "Critique".

## Implementation Notes
- **Evaluator**: Needs a `variance_monitor` skill to track decision flips.
- **Coach**: Needs to inject specific interventions based on the variance signal (not just generic "think harder").

## References
- `agents/scout/workspace/dd291-rebalance-efficient-reasoning-balanced-thinking.md`
- `agents/scout/workspace/dd290-ai-planning-framework-survey.md`
