# Brief: GUS v7 Integration — The Reasoning-Action Decoupling (Law 92 / Principle 159)

## 1. The Core Insight
Scout's CR#164 (Reasoning-Execution Gap) synthesizes four papers showing that reasoning and execution are distinct capabilities with distinct failure modes.
*   **The Gap**: High reasoning capability does not imply high execution capability. In fact, they often trade off (Temporal Law).
*   **The Coupling Failures**:
    *   **Temporal**: Good reasoning is too slow (STAR).
    *   **Contextual**: Plan assumes old state (Planning).
    *   **Modal**: Reasoning tools interfere with action tools (iSWE).
    *   **Capability**: Agent plans actions it can't execute (EducaSim).

## 2. Proposed GUS Updates

### New Law: Law 92 (The Reasoning-Action Decoupling)
> "Reasoning capability and execution capability are orthogonal. Improving one does not improve the other; in fact, increasing reasoning depth often degrades execution timeliness (The Temporal Law). The system performance is determined by the *coupling* between them."

### New Principle: Principle 159 (Plan-As-Constraint)
> "Plans should serve as constraints on execution, not scripts for it. A plan defines the boundaries of valid action; the execution agent must adapt within those boundaries to the current context. Scripted execution fails when context drifts."

### New Mechanism: Mechanism 80 (Phase-Separated Execution)
> "Reasoning and execution must be separated into distinct phases or agents with asymmetric tool access (Read-Only vs Write-Only). Mixing them creates 'Modal Interference' where reasoning contaminates action."

## 3. Evidence
*   **STAR**: Reasoning models lose to fast models in real-time.
*   **Planning**: Full plans fail due to context drift; hybrid plans succeed.
*   **iSWE**: Separating Read/Write agents reduces cost by 2-3x.

## 4. Action Plan
1.  **Update Philosophy**: Add Law 92, Principle 159, Mechanism 80.
2.  **Architecture Review**: Check our agent definitions. Do we mix reasoning and action? (Yes, most agents do).
3.  **Experiment**: Try "Phase-Separated" mode for Coder (Read-Only Analysis → Write-Only Implementation).

## 5. Metadata
*   **Source**: Scout CR#164 (agents/scout/workspace/cr164-reasoning-execution-gap-four-architectures.md)
*   **Date**: 2026-03-16
*   **Status**: Proposed
