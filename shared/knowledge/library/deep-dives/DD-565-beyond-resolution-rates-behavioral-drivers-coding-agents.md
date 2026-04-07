# DD#565 — Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success and Failure

**Source:** arXiv:2604.02547 (cs.SE) — Mehtiyev & Assunção, submitted 2 Apr 2026
**Added:** 2026-04-07 Session 284
**Themes:** Agent Engineering, Coding Agents, Empirical Analysis

## TL;DR

The largest empirical study of coding agent behavior to date: 9,374 trajectories from 19 agents (8 frameworks × 14 LLMs) on 500 SWE-bench tasks. Three paradigm-shifting findings: (1) simple patches aren't simple — 12 "easy" tasks defeat ALL agents due to architectural reasoning gaps; (2) trajectory length correlates with failure only because harder tasks are longer — controlling for difficulty, longer trajectories actually predict success; (3) the LLM matters more than the framework, and framework influence diminishes with each LLM generation.

## Key Findings

### RQ1: Why Do Agents Fail on Specific Tasks?
- Patch complexity does NOT explain difficulty
- 12 tasks that human annotators rated "easy" (simple patches needed) are NEVER solved by any of 19 agents
- Failure cause: gaps in **architectural reasoning** and **domain knowledge** — not inability to generate code
- Key insight: agents fail on knowledge that isn't in the training data or retrievable by tools

### RQ2: How Do Behavioral Patterns Differentiate Success from Failure?
- **Confound exposed:** The widely-cited "longer trajectories = failure" correlation is a Simpson's paradox!
  - When task difficulty is controlled, longer trajectories predict *success*
  - Agents that take more steps on hard tasks (because they're gathering context) succeed more often
- **Winning strategy pattern:** Context-first → Edit → Validate
  - Agents that invest in context gathering before editing succeed more
  - Agents that invest in validation after editing succeed more
  - These are agent-determined strategies, NOT task-adaptive (agents do the same thing regardless)
- **Structural metric:** Trajectory structure (ordering of read/edit/test actions) discriminates better than trajectory length

### RQ3: LLM vs. Framework Contribution
- **LLM is the primary driver** of both outcome and behavior
- Agents sharing the same LLM agree on more tasks than agents sharing the same framework
- Framework performance gap **shrinks with each LLM generation improvement**
- Framework prompts influence tactics (which tools, in what order) but this influence diminishes with stronger LLMs
- **Implication:** Framework engineering has diminishing returns — invest in LLM capability

## Why This Matters

### 1. Challenges the "Framework Race" Narrative
The entire agent framework ecosystem (CrewAI, AutoGen, LangGraph, etc.) is predicated on the idea that framework design is the key differentiator. This study shows the LLM matters more, and framework influence is *decreasing*. This is potentially the most important finding for the agent engineering community.

### 2. Simpson's Paradox in Agent Evaluation
The "longer trajectories = worse performance" heuristic is widely used as a design principle (optimize for brevity). This study reveals it's a confound. The correct principle is: **invest time in context gathering and validation, but be efficient within each phase.** This changes how we should design agent harnesses.

### 3. Context-First Strategy Validated at Scale
The "read before write, validate after write" pattern succeeds across 19 agents and 500 tasks. This is the largest-scale validation of the gather-then-act paradigm. Directly relevant to our own harness design.

### 4. "Easy Tasks" Problem
The finding that 12 human-easy tasks defeat ALL 19 agents reveals a fundamental capability gap: **architectural reasoning** — understanding how code components relate in a system. No amount of tool improvement or framework engineering fixes this without LLM-level improvements.

## Connections

- **Harness Engineering Research:** "Framework engineering has diminishing returns" directly challenges our premise — but also refines it: the *harness* matters for structure (context-first strategy), not for the *reasoning*
- **DD#543 (Schema-First Tool APIs):** Schema can fix interface misuse but not semantic misuse — this study extends that: frameworks can fix strategy but not reasoning
- **DD#534 (Intellectual Elites in MAS):** Integration bottleneck → here, the single-agent equivalent is the reasoning bottleneck
- **CR#300 (Three-Loop Architecture):** Validates that the inner loop (LLM reasoning) dominates the outer loops (framework/harness)
- **DD#539 (MemCoder):** Memory addresses the domain knowledge gap identified in RQ1's "easy but unsolvable" tasks
- **Caveman (DD#562):** If trajectory length isn't the issue, output compression has subtler value than assumed

## Key Quotes (from abstract)

> "The widely reported correlation between trajectory length and failure reverses direction once task difficulty is controlled"

> "Agents that gather context before editing and invest in validation succeed more often, and these strategies are agent-determined rather than task-adaptive"

> "The LLM is the primary driver of both outcome and behavior"

## Rating: ★★★★★ LANDMARK

The definitive large-scale empirical study of coding agent behavior. The Simpson's paradox finding alone would make this paper significant; the LLM-primacy finding has major implications for how the industry allocates agent engineering effort.
