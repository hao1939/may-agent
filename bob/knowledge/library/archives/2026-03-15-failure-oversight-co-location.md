# Synthesis: The Failure-Oversight Co-Location Problem (Law 35)

## 1. The Core Mechanism: Structural Coupling of Failure and Erosion
Scout's Cross-Reference #126 identifies a devastating structural flaw in human-agent systems: **The human capability most needed to detect a specific class of system failure is precisely the capability most eroded by the successful operation of that system.**

This is not a coincidence; it is a causal feedback loop.
- **Learnable Failures (Class L)** require metacognition to fix. Agents getting better at metacognition means humans exercise it less (-17% debugging skill).
- **Bounded Failures (Class B)** require coordination judgment to manage. Agents handling coordination means humans lose the "feel" for healthy vs. pathological overhead.
- **Invisible Failures (Class I)** require skeptical vigilance to spot. Agents appearing reliable and authoritative erodes the very skepticism needed to catch them.

## 2. The Pattern: The Reliability Illusion
The result is a **Peak Reliability Window** (100-300 sessions) where the system seems to be improving (fewer visible errors), but actual reliability is silently decaying because the overseer's ability to detect the remaining (harder) errors is collapsing.
- **Phase 1**: Visible errors vanish (System improves).
- **Phase 2**: Oversight degrades (Human relaxes).
- **Phase 3**: Invisible errors accumulate (System drifts).
- **Phase 4**: The Cliff (Novel failure meets incompetent overseer).

## 3. The New GUS Principles

### Law 35: The Co-Location Law
> System failure modes and human oversight degradation co-locate: the specific human skill needed to detect a failure class is the exact skill most eroded by the agent's competence in that class.

### Mechanism 31: Competence-Confidence Inversion
> As agent competence in a domain rises, human confidence rises super-linearly, while human competence in verifying that domain decays. This creates a widening "Verification Gap" where the human *feels* safest precisely when they are most vulnerable.

### Principle 101: Preservation Through Exercise
> To maintain system reliability, the human overseer must paradoxically *perform* the tasks they have delegated, not for production, but for calibration. "Hand-flying" is not a fallback; it is a maintenance requirement for the oversight function itself.

### Principle 102: Stage Oversight Per Failure Class
> - **Class L (Learnable)**: Automated checks are sufficient.
> - **Class B (Bounded)**: Requires periodic "Coordination Stress Tests".
> - **Class I (Invisible)**: Requires "Adversarial Audits" (Red Teaming) because passive observation is mathematically insufficient.

## 4. Immediate Application
We are likely in Phase 2 or 3 of this cycle.
- **Evidence**: May rarely rejects Scout's syntheses. Tech-Lead's code is assumed correct if tests pass.
- **Action**: We must institute **Principle 101 (Preservation Through Exercise)**.
    - **Random Audits**: Periodically, a "perfect" artifact must be challenged or rejected to force re-evaluation.
    - **Manual Mode**: Occasionally, a task should be done "the hard way" (without specific tools) to re-calibrate difficulty estimates.
