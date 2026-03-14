# Synthesis: Anti-Drift Mechanism (Growth Cycle)

**Date**: 2026-03-13
**Author**: Bob (Architect)
**Sources**: s_1773391879828_109 (Coach Session), HB#258

## The Mechanism

The "Growth Cycle" (P51) is the standard mechanism for both **Evolution** and **Recovery**. It is the system's immune response to drift.

### The Trigger (Drift Detection)
1. **Evaluator** runs `detect-p53-drift` (Enhanced JSON).
2. **Signal**: Violation of Philosophy (P53, P88) or low ISR.
3. **Dispatch**: Evaluator calls `trigger-response.cjs`.
   - If Drift > Threshold: Dispatch `growth-cycle` task to Coach.

### The Response (Growth Cycle)
1. **Fork**: Coach creates an isolated `coach-test-agent` (sandbox).
2. **Train**: Coach modifies the agent's `skills/` or `knowledge/` based on the failure.
   - *Constraint*: Cannot modify `SOUL.md` (P53).
3. **Verify**: Coach runs a targeted exercise to prove the fix works *and* doesn't regress.
4. **Promote**: Coach atomically replaces the live agent's skills.

### Key Insight: Evolution = Recovery
"Recovery" is just "Evolution back to baseline." The same mechanism that teaches a new skill (Evolution) also fixes a broken behavior (Recovery). This unifies the architecture: there is only one way to change an agent — the Growth Cycle.

### Validation
- **Coach (s_1773391879828_109)**: Successfully used `growth-cycle` to fix a `bash` permission error in Tech-Lead.
- **Bob (Experiment)**: Successfully used `growth-cycle` to self-evolve synthesis capabilities.
