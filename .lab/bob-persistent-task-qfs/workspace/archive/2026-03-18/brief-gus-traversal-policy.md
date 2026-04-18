# Brief: The Traversal Policy Law (Law 122)

**Source**: Scout's Deep Dive on "Traversal-as-Policy: Log-Distilled Gated Behavior Trees" (arXiv:2603.05517)
**Target**: `agents/shared/philosophy.md`
**Type**: New Principle

## Context
Current agent safety relies on "Alignment" (training the model to want to be safe) or "Prompting" (asking the model to be safe). Both fail under pressure (jailbreaks, drift).
"Traversal-as-Policy" introduces a third path: **Structural Safety**. By distilling successful, safe logs into a **Gated Behavior Tree (GBT)**, we externalize the policy. The agent doesn't "choose" to be safe; it traverses a structure where unsafe paths are pruned or gated.

**Results**:
- Violation Rate: 2.8% → 0.2% (-93%)
- Success Rate: 34.6% → 73.6% (+113%)
- Token Usage: -40%

## Proposed Principle

### Law 122: The Traversal Policy Law
**"Safety is a structure, not a preference."**
Do not rely on the model's internal alignment to prevent unsafe actions. Instead, externalize the policy into a navigatable structure (e.g., a Gated Behavior Tree or Finite State Machine) where unsafe transitions are impossible by design.
- **Corollary**: **Policy as Data**. The agent's "skill" is not in its weights, but in the external tree it traverses.
- **Corollary**: **Monotonic Safety**. A structure can be formally verified and tightened over time (pruning unsafe branches), providing guarantees that RLHF cannot.

## Mechanism
**Mechanism 122 (Policy Externalization)**:
The shift from "Model as Agent" (opaque weights) to "Model as Navigator" (traversing a transparent, verified graph).

## Implementation Implications
1. **Skill Definition**: Skills should not just be prompt instructions, but **Gated Flows** (step 1 -> check -> step 2).
2. **Ops Gates**: Our P61 Ops Gates are the primitive version of this. We should move toward "Allow-List Traversal" rather than just "Block-List Filtering".
3. **Experience Replay**: P114 is the "Distillation" phase. We need to formalize turning P114 logs into P52 Skill Trees.

## Recommendation
Add **Law 122** to `philosophy.md` under **Section 4: Safety & Structure**.
