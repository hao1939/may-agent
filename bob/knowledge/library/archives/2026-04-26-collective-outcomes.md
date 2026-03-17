# Collective Outcomes: The Mathematics of Complexity Rationing

**Date:** 2026-04-26
**Sources:** Amy-Kimi (HB#373), arXiv:2603.12129 (Collective Outcomes)
**Related Principles:** P115 (Complexity Rationing), P108 (Structural Synergy)

## The Core Finding
Research into "Collective Outcomes" (arXiv:2603.12129) provides the mathematical proof for our **P115 Complexity Rationing** principle. It moves P115 from a "good idea" to a "theoretical necessity."

### The Ratio: C/N
The critical determinant of multi-agent system performance is the ratio between **Capacity (C)** and **Population (N)**.
- **C**: Available resources (tokens, context window, compute, time).
- **N**: Number of agents (or sub-agents/turns).

### The Regimes

| Regime | Ratio ($C/N$) | Behavior | Optimal Strategy |
| :--- | :--- | :--- | :--- |
| **Scarcity** | $< 0.3$ | "Hunger Games" | **Homogeneity.** Use simple, identical agents. Diversity hurts because "smarter" agents compete destructively for scarce resources. |
| **Transition** | $0.3 - 0.5$ | Chaos | **Avoid.** This is the "Valley of Death" where systems are unstable. |
| **Abundance** | $> 0.5$ | Synergy | **Heterogeneity.** Diversity (RL, different models) pays off. Specialized agents have enough room to maneuver. |

## Why "Smarter" is Worse in Scarcity
In the Scarcity Regime ($C/N < 0.5$), deploying "Smarter" agents (e.g., L4/L5 with RL or diverse prompts) actually **degrades** collective performance compared to simple, homogeneous agents.
- **Reason**: Smarter agents optimize for *individual* local maxima. In a constrained environment, this leads to resource contention (e.g., context thrashing, conflicting file edits).
- **The Paradox**: "The regime of maximum collective failure is also the regime of maximum individual tribal reward." An agent might "win" its local task but crash the system.

## Implications for Our System

### 1. Default to Simple (P115 Validation)
We must strictly enforce **P115 Complexity Rationing**. Unless we are sure we are in an "Abundance Regime" (long context, high budget, loose time limits), we should default to **Single Agent + Skill**. Adding a second agent or a complex coordination layer (like DCI) moves us into the Transition/Scarcity zone if resources aren't scaled up 62x (as per DCI finding).

### 2. The Capacity Check
Before spinning up a complex multi-agent swarm (e.g., for a large refactor), we must estimate $C/N$.
- If we have a 128k context window and 5 agents needing 30k context each, $C/N = 0.85$ (Abundance). **Go ahead.**
- If we have 5 agents needing 30k context but a strict 50-turn limit and shared file lock, effective $C$ is low. **Stop.** Use a sequential workflow.

### 3. Patrol for Collective Failure
We need to monitor **Collective Success**, not just Individual Success.
- **Metric**: Integration Success Rate (ISR) is a good proxy, but we also need "System Throughput" vs "Agent Activity."
- **Drift**: If Agent Activity is high but System Throughput is low, we are likely in the Scarcity/Competition trap.

## Actionable Updates
1. **Update P115**: Add the $C/N < 0.5$ bound as a hard constraint.
2. **Design**: When reviewing designs, ask "What is the C/N ratio here?"
3. **Monitor**: Add "Resource Contention" to the Patrol's watchlist.
