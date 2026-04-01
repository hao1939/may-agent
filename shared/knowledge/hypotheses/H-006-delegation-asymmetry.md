# H001: Delegation Quality is Asymmetric — Some Agent Pairs Consistently Underperform

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Proposed
**Domain:** Multi-agent collaboration, delegation design

## Hypothesis

Delegation quality in our system is not uniform — it varies dramatically by (sender, receiver) pair, and the asymmetry is systematic rather than random. Specifically:

1. **Some pairs produce consistently high-quality work** (e.g., bob→tech-lead: 106 good, 27 acceptable, 7 NI out of 140 evaluated = 76% good)
2. **Some pairs consistently underperform** (e.g., optimizer→tech-lead: 29 good, 38 acceptable, 2 NI = 42% good — nearly half the good rate of bob→tech-lead)
3. **The sender matters more than the receiver** — the same receiver (tech-lead) produces very different quality depending on who delegates to them

## Prediction

If we analyze delegation by sender-receiver pair, we will find:
- The **task specification quality** (how well the sender frames the task) explains >60% of the variance in delegation outcomes
- Pairs where the sender has deep domain context (bob→tech-lead on architecture) outperform pairs where the sender is relaying a task (optimizer→tech-lead on implementation)
- The "Rule of Two" (stop retrying after 2 failures) is triggered mostly on pairs with low specification quality, not on inherently hard tasks

## Evidence From Our System

| Pair | Total Eval'd | Good Rate | Notes |
|------|-------------|-----------|-------|
| bob→tech-lead | 140 | 76% | Bob provides detailed briefs with codebase context |
| bob→coach | 53 | 89% | Narrow, well-defined experiment requests |
| bob→may | 92 | 66% | Mixed — some are complex multi-step |
| may→tech-lead | 87 | 72% | May relays from upstream requests |
| optimizer→tech-lead | 69 | 42% | Optimizer often delegates implementation of optimizations |
| optimizer→coach | 12 | 25% | Coach struggles with optimizer's efficiency-focused framing |
| coach→may | 31 | 61% | Coach delegates behavioral changes — inherently harder |

## What This Means

The literature on multi-agent delegation (Anthropic "Building Effective Agents", HB#2154) identifies five patterns: Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer. Our system primarily uses **Orchestrator-Workers** (bob/may delegate to tech-lead/coach/optimizer), but the Anthropic guide emphasizes that the orchestrator must provide "precise task decomposition" — not just delegation.

The IBM AgentFixer research (HB-2315) found that **38% of task failures are parsing errors** — meaning the specification format matters as much as content. In our system, the equivalent failure mode is "vague delegation" — sending a task without sufficient context for the receiver to succeed.

## Testable Claims

1. **Quantitative**: For the same task type (e.g., "implement feature X"), bob→tech-lead will produce higher evaluation scores than optimizer→tech-lead, controlling for task difficulty
2. **Structural**: Delegations that include (a) exact file paths to modify, (b) current state of those files, and (c) acceptance criteria will have >80% good rate regardless of the sender-receiver pair
3. **Intervention**: Adding a "delegation template" (what, where, why, acceptance criteria) to the sender's context should improve the lowest-performing pairs by ≥15 percentage points

## Suggested Verification Approach

- Pull all evaluated delegated sessions, annotate task specification quality (structured vs unstructured), and correlate with evaluation verdict
- A/B test: Have optimizer use a structured delegation template for 20 tasks, compare against 20 unstructured delegations
- Check if "Rule of Two" failures correlate with specification quality

## Related Work

- Anthropic "Building Effective Agents" (HB#2154): Five agent workflow patterns
- IBM AgentFixer (HB-2315): 38% parsing failures in agent tasks
- Structured Intent paper (HB-2309): 5W3H structuring improves weak model performance by +1.006
- Alignment Diversity synthesis (P126): Sender-receiver cognitive alignment affects handoff quality
