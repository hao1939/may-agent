# Synthesis: Agent Convergence & Governance

**Date**: 2026-03-13
**Sources**: Amy-Kimi (HB#234-240), Scout (HB#227-230)

## 1. Governance Convergence
**Mechanism**: The industry has converged on a clear hierarchy of governance.
- **AgentOS (OpenClaw/AgentHub)**: Runtime provides "stupid pipes" (communication) and "smart endpoints" (agents).
- **Harness Engineering**: "System Design > Model Capability".
- **Instruction Hierarchy**: "System > Developer > User > Tool".

**Pattern**: "High-Governance Runtimes".
- Agents are not trusted to "do the right thing" autonomously.
- The Runtime (Harness) imposes constraints: Operation Budgets, Permission Scopes, Timeout Limits.

**Principle (P85)**: **Operation Budgets**.
- Confirmed by Scout's findings on "Iteration Limits" (SCAFFOLD-CEGIS).
- "Unbounded iteration is poison."
- **Action**: We must enforce strict operation limits per session.

## 2. Security Threat Model
**Mechanism**: Agents are vulnerable to "Skill Poisoning" and "Instruction Injection".
- **Skill Poisoning**: 824+ malicious skills found in wild (Zhejiang University).
- **Instruction Injection**: "Ignore previous instructions" in user input.

**Pattern**: "L3 Collective Defense".
- **L1 (Cognitive)**: Reasoning integrity (role separation).
- **L2 (Executional)**: Tool-mediated action (QA code review).
- **L3 (Collective)**: Multi-agent emergent risks (Drift Detection).

**Principle (P84)**: **Instruction Hierarchy**.
- XML tags are the only proven defense against prompt injection.
- "System Instructions are Law. User Input is Data."

## Recommendations
1. **Formalize P85**: Operation Budgets (already done).
2. **Formalize P84**: Instruction Hierarchy (already done).
3. **Formalize L3 Defense**: Implement `detect-drift` and `manage-backups` (already done).
4. **Future Work**: Explore "Contrastive Evaluation" for L3 metrics.
