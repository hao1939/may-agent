# DD#910: Complete Cyclic Subtask Graphs — When Multi-Agent Flexibility Helps vs. Hurts

**Paper:** arXiv:2604.22820 (Gharzeddine & Saab — Apr 2026)
**Relevance:** ★★★☆ MEDIUM-HIGH
**Tags:** #workflow #multi-agent #coordination-cost #bottleneck-analysis

## Core Problem

More flexible multi-agent workflows (where any agent can revisit any subtask) should improve recovery and exploration. But does the coordination overhead outweigh the benefits?

## Approach

Build **complete cyclic subtask graphs** — maximally flexible architectures where all subtask nodes are fully connected, with a unified router agent selecting transitions. This makes the cost of flexibility directly measurable.

## Key Findings (Three Regimes)

1. **Recovery-dominant (ALFWorld):** Explicit revisitation helps. Agents that can loop back to earlier subtasks recover from errors better. Flexibility pays off.

2. **Prerequisite-chain (TextCraft):** Simpler forward execution often wins. When tasks are mostly sequential prerequisites, the overhead of flexible routing exceeds the recovery benefit.

3. **External-bottleneck (Finance-Agent):** Neither flexibility nor simplicity matters much — performance is dominated by retrieval, grounding, and evidence synthesis quality. Workflow architecture is not the binding constraint.

**Critical insight:** Shared-win token comparisons show flexible multi-agent workflows can be **substantially more expensive** than a single ReAct agent for the same outcomes.

## Relevance to Our System

### Direct Mapping
Our system has a fixed topology (architect dispatches to specialized agents). This paper suggests that's often the right call:

- **Most of our tasks are prerequisite-chain** (understand → code → test → verify). Adding flexible revisitation would likely increase cost without proportional benefit.
- **Our actual bottlenecks are likely external** — context quality, knowledge retrieval, verification accuracy — not workflow flexibility. This validates focusing on knowledge delivery (bob's experiments) rather than workflow restructuring.
- **Recovery via retry** (our current approach: agent fails → architect re-dispatches) may be near-optimal for our task mix, since it's a controlled form of revisitation without full graph overhead.

### Actionable Implications

1. **Don't over-engineer workflow flexibility.** The paper provides empirical evidence that simpler topologies win for sequential tasks.
2. **Identify which regime each task type falls into.** If we ever add more complex task types (exploration-heavy), flexible revisitation could help there.
3. **Focus optimization on the external bottleneck regime** — improve retrieval/grounding/evidence quality rather than agent coordination patterns.

### Connection to DD#909 (Pythia)
Pythia optimizes serving for known workflow topologies. This paper shows that *keeping topologies simple and predictable* is itself a valid optimization — supporting Pythia's assumption that agent workflows have exploitable structure.

## Limitations
- Benchmarks are synthetic; real-world agent systems may show different regime distributions
- Token cost comparisons use "shared-win" subset — not all tasks
- Router quality heavily influences results; better routers might shift the flexibility/cost tradeoff
