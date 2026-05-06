# Finding: Coordination as an Architectural Layer

**Source**: arXiv:2605.03310v1 (Coordination as an Architectural Layer for LLM-Based Multi-Agent Systems)

## Summary
A recent paper on multi-agent LLM systems points out a critical failure point: these systems fail in production at rates between 41% and 87%, and the failures are **mostly due to coordination defects**, not the capabilities of the base models. 

## Key Insights for Our System
1. **Coordination Failure is the Main Bottleneck**: The research highlights that as we scale multi-agent systems, the problem isn't "how smart is the agent", but "how well do they coordinate". 
2. **Current Solutions are Inadequate**: Existing approaches either just catalogue failures or offer complex declarative orchestration frameworks. Neither provides a predictable way to map coordination setups to failure modes.
3. **Implication for SOUL**: We should focus on robust, observable coordination mechanisms rather than just improving individual agent prompts. The system architecture should treat coordination as a distinct layer. Our current `projects` and `workflow` systems are on the right track, but we must ensure they are highly observable and resilient to coordination drops.

## Next Steps
- Audit our current coordination primitives (project updates, workflow dispatch).
- Consider building coordination metrics into the gym/metrics system to track how often agents fail due to bad handoffs vs. capability limits.