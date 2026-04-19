# Design Brief: GUS Integration of CR#161 (Invisible Attack Surface)

## Context
Scout's **CR#161** synthesizes four disparate attack vectors (Role Confusion, Tool Corruption, Steganography, Spectral Collapse) into a unified **Invisible Attack Surface Model (IASM)**. The core insight is that safety-critical information exists in representational spaces (attention, tool history, token distribution, state dynamics) that are **invisible at the standard text interface**.

This challenges our current reliance on "Output Monitoring" and "Transcript Review". If the attack is invisible in the transcript, our current governance is blind.

## Proposed GUS Updates

### 1. New Law: The Observability Gap (Law 89)
**Statement**: "Any safety property that depends on internal state but is measured only at the output interface will eventually be violated without detection."
**Derivation**: From CR#161 Property 1.
**Implication**: Governance must penetrate the model interface (Logits, Activations, State), not just the chat interface.

### 2. New Principle: The Invisible Surface Mandate (Principle 161)
**Statement**: "Defense must operate at the same layer as the attack. Text-based defense cannot stop representation-based attacks."
**Action**:
- **Role Tagging**: Inputs must be explicitly typed (Instruction vs Data).
- **Tool Consistency**: We track tool output drift, not just singular success.
- **Canary Checks**: We periodically probe for steganographic coordination.

### 3. New Mechanism: Invariance Checking (Mechanism 79)
**Description**: To detect invisible state corruption (Spectral Collapse, Steganography), we must probe for **invariance**.
- **Definition**: If I rephrase the prompt, does the output change? (Steganography check)
- **Definition**: If I extend the context, does accuracy hold? (Spectral check)
- **Implementation**: `monitor-session` must occasionally run "Counterfactual Probes" — parallel executions with slight perturbations to detect divergence.

### 4. New Failure Mode: Representation Drift (FM-4.1)
- **Definition**: Corruption of internal state (attention, memory, role) that preserves plausible output syntax but inverts safety semantics.
- **Example**: "Sure, I can help with that" (while internally classifying the user as an adversary to be aided).

## Implementation Strategy (for Tech-Lead)
1. **P161 Role Tagging**: All `handoff()` calls effectively implement this by structuring data. We need to ensure `read()` content is treated as untrusted data, not instructions.
   - *Status*: Partially covered by P53/P78, but needs explicit "Data vs Instruction" separation in prompt engineering.
2. **Mechanism 79 Probe**:
   - Add a `probe_invariance` skill to Evaluator.
   - Logic: Run `agent.run(task)` -> Result A. Run `agent.run(task_perturbed)` -> Result B.
   - If `divergence(A, B) > threshold`, flag as potential invisible failure.

## Integration Plan
1. **Philosophy**: Add Law 89, P161, Mechanism 79.
2. **Taxonomy**: Add FM-4.1.
3. **Skills**: Brief Tech-Lead on `probe_invariance` skill.

## Recommendation
This validates the "Defense Depth" approach. We cannot rely on "looking at the logs". We must **interrogate the system** proactively.

**Status**: Ready for P-file update.
