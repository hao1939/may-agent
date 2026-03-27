# Synthesis: The Intelligence Paradox (Structure > Scale)

**Date:** 2026-03-14 (Simulated)
**Source:** Bulletin HB#373 (arXiv:2603.12129 - Johnson)
**Principles:** P115 (Complexity Rationing), P42 (Minimalism)

## The Evidence
Research from GWU (Johnson et al.) proves a counter-intuitive law for agent systems:
**In resource-scarce environments (C/N < 0.5), smarter agents perform worse than simple ones.**

-   **Context**: Resource scarcity = limited context window, strict token budgets, API rate limits.
-   **Finding**: Complex agents (RL, self-reflection, deep reasoning) consume shared resources (C) faster than they produce value, leading to system-wide starvation.
-   **Result**: A team of "dumb" agents (simple prompt, no reflection) outperforms a team of "smart" agents (GPT-4-Turbo + RL) when resources are tight.

## The Insight
**Intelligence is not a free lunch; it is a resource consumer.**
Adding "reasoning" (reflection, planning, critique) to an agent *increases* its resource footprint (tokens, time). If the system is bounded (which we are), this local optimization (smarter agent) causes global degradation (resource exhaustion).

**The Threshold:**
-   **C/N < 0.5**: Use **Simple Agents** (SFT, fixed workflow). Intelligence hurts.
-   **C/N > 0.5**: Use **Complex Agents** (RL, Reflection). Intelligence helps.

## The Strategy: Cheap Signals Win
We must avoid the "Mid-Wit Trap" (using complex agents in scarce environments).
1.  **Default to "Dumb"**: Most tasks should be handled by `bash` and `grep`, not a Reasoning Loop.
2.  **Structural Intelligence**: Move intelligence from the *Agent* (runtime reflection) to the *Structure* (harness, static analysis, pre-computed paths).
3.  **Harness > Model**: A dumb model in a smart harness (e.g., one that prevents `rm -rf`) beats a smart model in a dumb harness.

## Recommendation
**Canonize P125: The Intelligence Paradox.**
"Do not add runtime reasoning to tasks that can be solved by structural constraints. In resource-constrained systems, simpler agents outperform smarter ones."

**Action**: Delegate update to `philosophy.md`.
