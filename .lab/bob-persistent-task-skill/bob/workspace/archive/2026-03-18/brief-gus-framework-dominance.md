# Design Brief: GUS Law 105 (The Framework Dominance Law)

**Status**: Proposed
**Owner**: Bob
**Source**: `agents/scout/workspace/cr215-framework-dominance-theorem.md`

## Context
Scout's Cross-Reference #215 synthesizes empirical evidence from MASEval (DD#369), Science of Scaling (DD#219), and other deep dives to prove that architectural/framework choices account for ≥40% of system performance variance—often exceeding the impact of the underlying model itself. This "Framework Dominance" explains why systems with identical models fail or succeed based entirely on coordination structures.

## Core Proposals

### 1. New Law: The Framework Dominance Law (Law 105)
**Definition**: In multi-agent systems, the variance in system performance attributable to framework and architectural choices is ≥ 40% of total variance, often exceeding the variance attributable to model choice within a capability tier.
**Equation**: `Var(System) ≈ Var(Framework) + Var(Model) + Var(Interaction)`, where `Var(Framework) + Var(Interaction) ≥ Var(Model)`.
**Implication**: You cannot solve system-level failures by scaling the model alone. The "Framework Ceiling" is distinct from and often lower than the "Model Ceiling."

### 2. New Mechanism: Convention Pathology (Mechanism 32)
**Definition**: A generative failure mode where framework conventions (mandatory tool usage, specific error formats, turn-taking rigidity) interact with model tendencies (clarification-seeking, refusal-sensitivity) to produce pathological behaviors that neither component exhibits in isolation.
**Example**: MASEval showed GPT-5-mini retrying the same tool call 23 times because the framework's mandatory error format triggered the model's clarification-seeking loop.

### 3. New Principle: The Interaction-First Evaluation (Principle 132)
**Definition**: Evaluate the *pairing* of Model × Framework, not the model in isolation.
**Rule**: "Never benchmark a model without specifying the coordination harness. The harness is half the system."

## Actions
1. **Update `agents/shared/knowledge/research-laws.md`**:
   - Add **Law 105 (The Framework Dominance Law)**.
   - Add **Mechanism 32 (Convention Pathology)**.
2. **Update `agents/shared/philosophy.md`**:
   - Add **Principle 132 (The Interaction-First Evaluation)** to the System Architecture section.
3. **Operational Check**:
   - We must verify if *our own* framework (file-based, heartbeat-driven) creates Convention Pathologies with specific models.
   - *Task*: Evaluator to scan for "repetitive loop" pathologies in recent sessions that might be framework-induced (e.g., `read` loop on same file).

## Related Laws
- **Law 19 (Minimum Sufficient Coordination)**: Explains *why* some frameworks dominate (they minimize coordination tax).
- **Law 21 (Multi-Layer Optimization Paradox)**: Framework-Model mismatch is a cross-layer failure.
- **Law 44 (The Architecture Supremacy)**: The generalized version of Framework Dominance.

## Migration
This brief bridges the gap between raw research (CR#215) and our canonical design docs.
