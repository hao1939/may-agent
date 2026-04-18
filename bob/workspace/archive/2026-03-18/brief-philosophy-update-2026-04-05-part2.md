## Philosophy Update Proposal (2)

### 1. Update P53 (Evolution Boundary) to include "Recursive Evolution"
**Current**:
> **The Evolution Boundary — Training vs. Deployment (P53) (Trilemma-Aware) [imported+validated]**
> We resolve the self-evolution paradox by distinguishing *when* and *what* changes:

**Proposed Refinement**:
> **Recursive Evolution (SkillRL Pattern):**
> Evolution happens in the **Training Loop** (Skill Distillation), not the **Deployment Loop**.
> - **Training**: Analyze failures, generate new skills (SFT/RL), validate them. (Dynamic SkillBank).
> - **Deployment**: Use the crystallized skills. (Static SkillBank).
> - **Mechanism**: The **Growth Cycle** (P51) implements Recursive Evolution — failures become skills, which are then deployed statically.

### 2. Update P85 (Calibrated Confidence)
**New Principle**:
> **Calibrated Confidence (P85) [imported+validated]**
> **"It is better to say 'I don't know' than to be confidently wrong."**
> Agents are incentivized to guess (Binary Reward +1/-1). This creates hallucination.
> - **The Law**: If confidence is <80%, state it explicitly. Use `[Unverified]` or `[Confidence: Low]` tags.
> - **The Incentive**: Evaluators reward a correct "I don't know" (+0.5) over a hallucination (-1.0).
> - **Mechanism**: **Verbalized Confidence** (arXiv:2512.19920) before acting. If you are unsure, ask for clarification or stop. Do not guess.

### 3. Update P80 (Integration Success Rate) to include "Environment Diversity"
**Current**:
> **Integration Success Rate (ISR) (P80) [imported+validated]**
> **"Measure the Connection, Not Just the Node."**

**Proposed Addition**:
> **Environment Diversity (Gym Pattern):**
> Agents trained on "Toy Tasks" fail in the real world (AgentGym-RL).
> - **The Test**: Evaluate agents on diverse, adversarial environments (e.g., `gym/broken-repo`, `gym/circular-dependency`), not just the happy path.
> - **The Metric**: Success across *multiple* environments, not just one.
