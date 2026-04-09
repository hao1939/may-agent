# DD#668: Where LLM Agents Fail — AgentErrorTaxonomy & AgentDebug

**Paper**: "Where LLM Agents Fail and How They Can Learn From Failures"
**Authors**: Kunlun Zhu, Zijia Liu, Bingxuan Li, Muxin Tian, Yingxuan Yang, et al. (James Zou, Jiaxuan You)
**arXiv**: [2509.25370](https://arxiv.org/abs/2509.25370) (Sep 2025)
**Rating**: ★★★★★ CRITICAL
**Connection**: First systematic taxonomy of cascading agent failures — directly maps to Bob's EXP-099 cascade archetypes

---

## Core Contribution

This paper addresses the fundamental gap we've been working on: **LLM agent architectures amplify vulnerability to cascading failures** where a single root-cause error propagates through subsequent decisions. They provide three contributions:

1. **AgentErrorTaxonomy**: Modular classification of failure modes
2. **AgentErrorBench**: First dataset of systematically annotated failure trajectories
3. **AgentDebug**: Framework for isolating root-cause failures and generating corrective feedback

## AgentErrorTaxonomy — The Failure Mode Map

Failure modes are classified across five agent modules:

### Memory Failures
- Retrieval errors (wrong context retrieved)
- Memory corruption (stale or contradictory stored information)
- Memory overflow (critical information pushed out of context)

### Reflection Failures
- Incorrect self-assessment (agent believes it's on track when it isn't)
- Missing reflection triggers (failure to recognize when reflection is needed)
- Reflection hallucination (reflecting on events that didn't happen)

### Planning Failures
- Goal decomposition errors (wrong sub-task breakdown)
- Dependency mismanagement (executing steps in wrong order)
- Over-planning / under-planning (too many or too few steps)

### Action Failures
- Tool selection errors (using wrong tool for the task)
- Parameter errors (right tool, wrong arguments)
- Output interpretation errors (misreading tool results)

### System-Level Failures
- **Cascading propagation** (single error → multi-step failure chain)
- Recovery loop failures (attempted recovery makes things worse)
- Architecture-induced failures (structural limitations causing systematic errors)

## AgentErrorBench — Grounding in Real Trajectories

Built from three real-world agent environments:
- **ALFWorld**: Embodied household tasks
- **GAIA**: General AI assistant tasks
- **WebShop**: E-commerce web navigation

Each trajectory is annotated with:
- Root-cause error identification
- Propagation chain tracing
- Module attribution (which module failed first)

## AgentDebug — Root-Cause Isolation & Recovery

The debugging framework:
1. **Isolates root causes** — traces back through the trajectory to find the originating error
2. **Generates corrective feedback** — targeted suggestions for the specific failure mode
3. **Enables iterative recovery** — agents can retry with corrective context

Results:
- **+24% all-correct accuracy** vs strongest baseline
- **+17% step accuracy** improvement
- **Up to 26% relative improvement** in task success across all three environments

## Deep Connection to Bob's EXP-099 Findings

### Cascade Archetypes Mapping

Bob identified three cascade archetypes in 999 FM errors across 384 sessions:

| Bob's Archetype | AgentErrorTaxonomy Module | Specific Failure Mode |
|---|---|---|
| **Tool Spiral** | Action → System | Tool selection error → cascading propagation |
| **Comprehension Cascade** | Memory/Reflection → Planning | Memory overflow → incorrect reflection → goal decomposition error |
| **Drift-to-Decay** | Reflection → System | Missing reflection triggers → architecture-induced failure |

### Verification Gravity Well (FM-3.3)
Bob found FM-3.3 as a terminal attractor (20.3% of errors). In the AgentErrorTaxonomy framework, this maps to **System-Level: Recovery loop failures** — the agent attempts verification, fails, and the recovery attempt itself becomes the new error, creating a recursive attractor.

### "Complexity-Induced Verification Collapse"
Bob recharacterized Deep Decay as "Complexity-Induced Verification Collapse." The taxonomy provides the mechanistic decomposition:
1. Reflection failures (agent doesn't recognize increasing complexity)
2. → Planning failures (keeps adding steps instead of simplifying)
3. → System-level cascading propagation
4. → Recovery loop failure (verification attempts compound the problem)

## Borrowable Ideas for Our System

### HIGH Priority
1. **Module-attributed error logging**: Tag every failure in our system with the module that originated it (dispatcher, specialist, reviewer, etc.). Bob's FM codes partially do this but the taxonomy provides a more granular framework.
2. **Root-cause traceback**: Implement AgentDebug-style backward tracing through our session trajectories. Currently we classify errors at point of observation, not point of origination.

### MEDIUM Priority
3. **AgentErrorBench-style dataset**: Systematically annotate our 384 analyzed sessions with root causes and propagation chains. Bob has the raw data from EXP-099.
4. **Corrective feedback generation**: When errors are detected, generate module-specific corrective feedback rather than generic retry instructions.

### LOW Priority
5. **Cross-environment generalization**: Test if failure patterns in our system match the distributions seen across ALFWorld/GAIA/WebShop.

## Limitations
- Taxonomy developed primarily from GPT-based agents — may not fully capture failure modes in other model families
- AgentErrorBench environments are simplified compared to production MAS
- Root-cause isolation assumes relatively clean trajectories — may struggle with highly interleaved multi-agent execution
- Corrective feedback quality depends on the model's ability to understand its own failure modes

---

**RECOMMEND Bob**: The AgentErrorTaxonomy provides a validated external framework for classifying the 999 FM errors from EXP-099. Consider re-coding a sample using this taxonomy to see if it reveals patterns the current FM coding misses.

**RECOMMEND Tech-lead**: AgentDebug's root-cause isolation technique (backward tracing through trajectory) could be implemented as a post-session analysis tool. This would help identify which agent/module is the true source of cascading failures.

**Tags**: #error-taxonomy #cascading-failures #agent-debugging #root-cause-analysis #verification-collapse #failure-modes
