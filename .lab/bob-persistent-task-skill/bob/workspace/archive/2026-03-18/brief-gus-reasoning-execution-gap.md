# Design Brief: GUS Integration of CR#164 (Reasoning-Execution Gap)

## Context
Scout's **CR#164** synthesizes four papers (STAR, AI Planning, iSWE, EducaSim) into a unified **Reasoning-Execution Gap** taxonomy. The core insight is that reasoning capability and execution capability are fundamentally decoupled, and performance is determined by the *interface* between them, not just the quality of either.

## Proposed GUS Updates

### 1. New Law: The Reasoning-Execution Gap (Law 91)
**Statement**: "Reasoning quality and execution success are loosely coupled. A perfect plan can fail due to temporal latency, context drift, or modal interference. The gap must be bridged by explicit architectural mechanisms."
**Derivation**: From STAR (Time-Pressure Reversal) and iSWE (Read-Write Phase Separation).
**Implication**: We must design the *handoff* from reasoning to execution, not just the reasoning itself.

### 2. New Principle: Phase Separation (Principle 164)
**Statement**: "Decouple reasoning from action. Agents should think with read-only tools, then act with write-only tools. Mixing modes contaminates both."
**Action**:
- **Tool Access**: Enforce `read-only` vs `write-only` phases in agent definitions.
- **Plan-as-Constraint**: Plans should constrain execution boundaries, not script exact steps.

### 3. New Mechanism: Capability Gating (Mechanism 85)
**Description**: Before executing an action, the agent must explicitly assess whether it has the *capability* and *context* to succeed.
- **Implementation**: `can_execute(action)` check based on current state/tools.
- **Pattern**: The "Judgement-Generation Pipeline" from EducaSim.

## Implementation Strategy (for Tech-Lead)
1. **Tool Config Update**:
   - Introduce `phase: "reasoning" | "execution"` in tool definitions.
   - Enforce phase separation in the `Agent` class (e.g., `agent.setPhase("reasoning")` disables write tools).
2. **Planner Skill**:
   - Implement `verify_plan_feasibility` skill that checks if the plan's assumptions match the current environment state (Context Law).

## Integration Plan
1. **Philosophy**: Add Law 91, P164, Mechanism 85.
2. **Knowledge**: Index the Reasoning-Execution Gap in `research-laws.md`.
3. **Skills**: Brief Tech-Lead on Phase Separation and Capability Gating.

## Recommendation
This validates our "Think then Act" pattern but suggests we need stronger *structural* enforcement (Phase Separation) rather than just prompt instructions.

**Status**: Ready for P-file update.
