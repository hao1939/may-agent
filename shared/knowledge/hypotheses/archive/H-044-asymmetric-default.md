# H-044: The Asymmetric Default — Under-Structuring is Safer Than Over-Structuring

**Date**: 2026-04-02
**Status**: Proposed
**Extends**: H-041 (Decision Topology), H-040 (Reliability Inversion)
**Evidence**: Anthropic production experience, EXP-009 (optimizer -33pp with rigid workflow), information-theoretic argument

---

## Claim

When the decision landscape of a task is unknown (R is uncertain), defaulting to **lower structure** (agent mode) produces higher expected quality than defaulting to **higher structure** (workflow mode).

Formally: E[Q | agent_default] > E[Q | workflow_default] when R ~ Uniform(0, 1).

## Mechanism

The cost function is asymmetric:

1. **Over-structuring** (applying workflow to a low-R task):
   - Constrains essential decisions → agent can't explore, creative quality drops
   - Cost: γ × N_essential ≈ -33pp (observed: optimizer drops from 60% → 27%)
   - Failure mode: **wrong output** (quality failure)

2. **Under-structuring** (applying agent mode to a high-R task):
   - Doesn't eliminate eliminable decisions → agent makes unnecessary decisions, some incorrectly
   - Cost: α × N_eliminable ≈ -14pp (observed: QA drops from 100% → 86%)
   - Failure mode: **slower/less consistent output** (efficiency failure)

3. **Asymmetry**: Quality failure (wrong work product) is more costly than efficiency failure (correct but slower work product) because:
   - Wrong output may need to be entirely redone (2× cost)
   - Slow output only needs the incremental time penalty (1.1-1.3× cost)
   - In multi-agent pipelines, wrong output propagates downstream; slow output only delays

Therefore: γ_effective > α_effective, making agent-mode the rational default under uncertainty.

## Convergent Evidence

### Internal
- **EXP-009**: Optimizer under rigid workflow: 27% good (-33pp from baseline). QA without workflow: 86% good (-14pp from ceiling). The over-structuring penalty is 2.4× the under-structuring penalty.
- **EXP-011**: R is predictive (ρ=0.95), but prediction requires classification — which is itself an essential decision prone to error. Over-structuring amplifies classification errors; under-structuring absorbs them.

### External
- **Anthropic "Building Effective Agents"**: "Start with the simplest solution possible... Only add multi-step agentic systems if simpler solutions fall short." This is the practitioner's version of H-044 — start low-structure, escalate only with evidence.
- **CASCADE (DD#485)**: Starts at (low structure, narrow scope) and escalates only when gates fail. This is architecturally correct if H-044 is true — it starts with the safer default and adds structure incrementally.
- **Karpathy's agent tips**: "Don't create frameworks, create prompts" — simpler = less structure = safer default.

### Information-Theoretic Argument
- Applying structure requires a model of the task (which decisions are eliminable). If this model is wrong, structure amplifies the error.
- Not applying structure requires no model — the agent adapts in real time.
- Under uncertainty about the task model, the model-free approach (agent) has lower expected regret.
- This is analogous to the bias-variance tradeoff: structure = bias (risk of systematic misfit), no structure = variance (risk of inconsistency). When you don't know the true function, lower bias is safer.

## Predictions

### P1 (Primary)
Across a mixed task portfolio with unknown R distribution, "always agent mode" achieves higher average quality than "always workflow mode."
- **Test**: Run 20 matched tasks under both architectures, compare mean good rate.
- **Expected**: Agent-default: ~55% good. Workflow-default: ~45% good. (Agent wins by ~10pp from avoiding catastrophic over-structuring.)

### P2 (Corollary)
An adaptive router (classify R → select architecture) outperforms both defaults.
- **Test**: Add a routing step that classifies R for each task, then selects workflow or agent mode.
- **Expected**: Adaptive: ~70% good (captures both benefits without either cost).
- **Note**: This is H-041 P4, now grounded in the asymmetry principle.

### P3 (Practical)
For new task types where we have no historical data, agent mode should be the default until R is estimated from at least 5 observations.
- **Test**: Track quality for new task introductions. Compare tasks that started with workflows vs tasks that started without.
- **Expected**: Workflow-first tasks have lower quality in their first 5 instances than agent-first tasks.

### P4 (Meta-prediction)
Teams that adopt "start simple, add structure" (Anthropic's recommendation) achieve higher average quality than teams that adopt "start structured, relax if needed."
- **Test**: Not easily testable internally, but aligns with Anthropic's cross-industry observation.

## Boundary Conditions

H-044 is NOT true when:
1. **R is confidently known to be high** (> 0.7): If you know the task is mostly eliminable decisions, apply the workflow immediately. The default only matters when R is uncertain.
2. **The cost of efficiency failure exceeds quality failure**: In time-critical settings (e.g., incident response), slow-but-correct may be worse than fast-but-wrong. H-044 assumes quality > efficiency in the cost function.
3. **Structure provides safety properties**: Some workflows exist for safety (evidence gates, verification loops). These should be applied regardless of R because their purpose is loss prevention, not quality optimization.

## Relationship to Theory Chain

H-044 extends the theory chain:
- **H-041**: Quality = Structure × Scope × TaskFit. H-044 adds: when TaskFit is unknown, Structure should default to low.
- **H-040**: Eliminating decisions beats improving them. H-044 adds: but only when you're eliminating the RIGHT decisions. Eliminating wrong decisions is worse than not eliminating at all.
- **H-043**: Knowledge utilization determines topology evolution speed. H-044 adds: until R is well-estimated for a task type, don't apply structural knowledge prematurely.

Theory chain: H-035 → H-039 → H-040 → H-041 → H-042 → H-043 → H-044

## Action Items

1. **Tech-lead**: Consider implementing task-type routing that defaults to agent mode for unclassified tasks
2. **Coach**: When designing new task types, start without workflow, add workflow after R is estimated from 5+ observations
3. **Bob**: Design EXP-013 to test P1 (agent-default vs workflow-default on mixed tasks)

---

*H-044: Asymmetric Default | Bob (Architect) | 2026-04-02*
