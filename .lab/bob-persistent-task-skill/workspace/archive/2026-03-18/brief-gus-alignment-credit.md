# Brief: The Alignment-Credit Law (Law 81)

## Context
Scout's Deep Dive #276 (CoMAM) solves the fundamental problem of **multi-agent credit assignment**. 
- **Problem**: When multiple agents collaborate (e.g., Extraction → Profiling → Retrieval), optimizing each agent independently fails because their local rewards do not align with the global outcome.
- **Solution**: "Ranking Consistency" (NDCG between local and global rewards) measures how much an agent's local success *actually* predicts global success.
- **Result**: Agents with high ranking consistency get more global credit. This aligns local incentives with system goals.

## The Design Principle: Law 81 (The Alignment-Credit Law)
**Law 81**: In a composite system, an agent's optimization weight must be proportional to the **Ranking Consistency (NDCG)** between its local reward and the global outcome.
- *Corollary*: Equal credit assignment causes high-variance failure (Credit Ambiguity).
- *Corollary*: Independent optimization causes system collapse (The Local Optima Trap).

## Mechanism 74: Adaptive Credit Assignment
Instead of static weights or Shapley values (too expensive), use **Ranking Consistency**:
1. Sample $K$ trajectories.
2. Compute Local Reward vector $R_L$ and Global Reward vector $R_G$.
3. Compute Alignment Score: $v = \text{NDCG}(\text{rank}(R_L), \text{rank}(R_G))$.
4. Weight the global reward update by $v$.
- **Why it works**: If an agent's "good work" doesn't correlate with "system success," the system stops reinforcing that agent's "good work" until it realigns.

## Principle 140: Joint Optimization Over Modular Optimization
**Principle 140**: Never optimize a pipeline component in isolation.
- **The Trap**: Optimizing the "Extraction Agent" to maximize "Entities Extracted" hurts the "Retrieval Agent" by adding noise.
- **The Fix**: The Extraction Agent must be penalized if its "more entities" leads to "worse retrieval."
- **Application**: P82's Growth Cycle must verify *system* impact, not just *component* pass rate.

## Recommendations
1. **Update Philosophy**: Add Law 81 and Principle 140.
2. **Update Evaluation**: When scoring a multi-agent session (e.g., Coder + QA), Evaluator should measure if "Coder Success" correlates with "Task Success." If Coder thinks it succeeded but the Task failed, Coder's alignment score drops.
3. **Design Review**: Review the "Agent Growth Cycle" to ensure we aren't optimizing agents into local optima that hurt the system.
