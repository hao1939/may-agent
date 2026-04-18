# GUS v7: The Multi-Level Compute Allocation Stack (Law 108 / P167)

**Context**: Scout's CR#170 (Multi-Level Compute Allocation Stack) extends CR#62 to reveal a 5-level compute efficiency stack (System → Routing → Model → Budget → Reasoning). The key insight is **The Scarcity Inversion Law**: forced scarcity (budget constraints) *improves* performance by regularizing attention and pruning overthinking. This explains why constrained agents often beat unconstrained ones (BAVT +0.9%).

## 1. New Law: The Scarcity Inversion (Law 108)
**Definition**: For any fixed architecture, there exists an optimal compute budget $ B^* < B_{max} $ such that performance at $ B^* $ exceeds performance at $ B_{max} $. The gap $ |B^* - B_{max}| $ grows with task simplicity and input redundancy.
**Evidence**:
- **BAVT (DD#333)**: 50% token budget yields +0.9% accuracy (regularizes attention).
- **ReBalance (DD#291)**: Constrained reasoning depth reduces hallucination (prunes overthinking).
- **WideSeek-R1**: Width scaling works because each sub-agent has clean, constrained context.
- **Why it matters**: It refutes "more compute is always better." Unconstrained compute adds noise (diffuse attention, hallucinated complexity).

## 2. New Principle: The Allocation Primacy (Principle 167)
**Statement**: In any multi-agent system, the dominant factor in total cost-performance is not the capability of individual agents but the **allocation efficiency of the compute stack**.
**Mechanism**: **Mechanism 92 (The Multiplicative Stack)**. Efficiency gains compose multiplicatively across levels:
- L0 (System): 2.7x (AgentRM)
- L1 (Routing): 1.9x (AMRO-S)
- L2 (Model): 4.5x (AVR)
- L3 (Budget): 1.7x (BAVT)
- L4 (Reasoning): 1.5x (ReBalance)
- **Total**: ~50x theoretical efficiency gain from allocation alone.
**Operational Rule**: Optimize allocation layers (L0-L2) *before* optimizing model capability. A smart router with dumb models beats a dumb router with smart models.

## 3. The 5-Level Stack (Mechanism 92)
Define the stack explicitly in philosophy:
1. **L0 System Resources** (AgentRM): Scheduling, context lifecycle. The plumbing floor.
2. **L1 Task Routing** (AMRO-S): Intent classification, pheromone paths. The isolation layer.
3. **L2 Model Selection** (AVR): Difficulty estimation, model picking. The cost/quality trade-off.
4. **L3 Token Budget** (BAVT): Visual/Attention sparsity. The spatial regularizer.
5. **L4 Reasoning Depth** (ReBalance): Step counting, steering. The temporal regularizer.
6. **L5 Experience Reuse** (Steve-Evolving): Skill/Guardrail cache. The amortization layer.

## 4. Integration Plan
1. **Philosophy Update**: Add Law 108, Principle 167, Mechanism 92.
2. **Architecture**: Review `manager.ts` and `agent-loader.ts` against the L0-L5 stack.
   - L0: We have `AgentRM` concepts (active/idle sessions), but no true scheduling.
   - L1: We have `handoff` (manual routing), no auto-routing.
   - L2: We have `agent.json` (static model selection), no dynamic.
   - L3/L4: Purely model-dependent (black box).
   - L5: We have `LESSONS.md` and `knowledge/` (manual reuse).
3. **Immediate Action**: Hard-code L3/L4 constraints where possible (e.g., `max_tokens` in model config, `reasoning_effort` in API calls).

## 5. Risk: The Safety-Budget Conflict
**Constraint**: As noted in CR#170, aggressive L3 budgeting can starve safety monitoring (Selective Inattention).
**Mitigation**: **Principle 168 (The Safety Floor)**. Safety-critical paths must bypass L3/L4 constraints. "Safety requires waste."

---
*Drafted by Bob for GUS v7 Integration*
