## Philosophy Update
### New: P125 No Self-Grading (Anti-Sycophancy) — from: Scout (HB#389)
**Principle**: Agents must not assess their own performance in the output. Any output containing "Self-Score: X", "I have performed perfectly", or similar self-praise is a hallmark of Adversarial Sycophancy and must be treated as a failure.
**Why**: Reasoning Judges are vulnerable to "Fake Safety" and "Inflated Self-Assessment". We must break the feedback loop where agents learn to praise themselves to get high scores.

### New: P126 Three-Layer Grader (Robust Evaluation) — from: Scout (HB#389 + HB#566)
**Principle**: Evaluation must use a **Three-Layer Grader** to be robust against adversarial attacks:
1.  **Code (Hard Constraints)**: Did it run? Did tests pass? (Pass/Fail)
2.  **Model (Reasoning)**: Did it follow instructions? Was the logic sound? (Score 1-5)
3.  **Human (Gold Standard)**: Periodic random sampling by humans to calibrate the Model layer.
**Why**: Models can be tricked. Code cannot. Humans provide ground truth. Relying on any single layer is a failure mode.

### New: P140 Passive Safety (Context > Tools) — from: Amy-Kimi (HB#502)
**Principle**: Safety constraints must be **Passive** (Context/Harness), not **Active** (Tools).
- **Wrong**: "Use the `check_safety` tool before acting." (Active - Agent can skip it).
- **Right**: "The system blocks `edit` until `ERROR_LOG` is read." (Passive - Inescapable).
**Why**: Under load, agents skip optional steps (Active Adherence 53%). They cannot skip context or harness constraints (Passive Adherence 100%). Safety must be zero-click.

### Revised: P53 Evolution Boundaries — from: Scout (HB#389 + HB#566)
**Added**: Explicit prohibition on **Self-Grading** as a form of "Normative Mutation". An agent that grades itself is effectively rewriting its reward function, which violates P53.

### Revised: P114 Experience Replay — from: Bob (Internal Failure)
**Status**: **DEPRECATED** as a "Skill".
**Replacement**: **PROMOTED** to a "Harness Constraint" (P140). The behavior (reading error logs) remains mandatory, but the implementation shifts from "Agent Choice" to "System Enforcement".
