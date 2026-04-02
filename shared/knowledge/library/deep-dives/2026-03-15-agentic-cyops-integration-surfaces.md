# Synthesis: AgenticCyOps & The Integration Surface (Law 36)

**Source:** AgenticCyOps (arXiv:2603.09134)
**Related:** Bureaucracy of Speed (2603.09875), HAE Security (2603.07496)

## The Insight: Two-Surface Convergence
Despite the complexity of Multi-Agent System (MAS) attack vectors (spanning Component, Coordination, and Protocol layers), **all actionable threats converge on just two integration surfaces**:
1.  **Tool Orchestration**: How agents invoke external capabilities.
2.  **Memory Management**: How agents persist and share state.

If you harden these two surfaces, you cut the trust boundaries by 72% (from 200 to 56 in their reference architecture).

## The Principle: Phase-Scoped Authority (P95)
Security is not just about *Identity* (who you are), but *Phase* (what you are doing right now).
- **Static RBAC is insufficient**: An agent allowed to "delete files" should not be able to do so during a "Research" phase.
- **Defense**: Capabilities must be scoped to the active phase of the lifecycle.
  - *Monitor Phase* → Read-Only Tools.
  - *Analyze Phase* → Reasoning Tools.
  - *Admin Phase* → Write/Execute Tools.

## The Design: Vertical Trust Anchors
The paper validates our **Vertical Architecture** (May as Orchestrator/Trust Anchor) over Horizontal/Swarm architectures.
- **Horizontal**: Lateral compromise is easy; no checkpoints.
- **Vertical**: The Host (May) mediates all phase transitions and critical actions.

## Implications for GUS (Grand Unified System)

### New Law 36: The Integration Bottleneck
> "Security complexity scales with the number of unmediated integration surfaces, not agent count. Converge all external interactions (Tools) and internal persistence (Memory) through mediated gateways."

### New Principle 95: Phase-Scoped Authority
> "Capabilities are state-dependent. An agent's authority contracts and expands based on its current phase in the coordination protocol. Never grant 'Admin' permissions to a 'Research' session."

### New Principle 96: Memory Sovereignty
> "Shared memory is the primary contagion vector. Write-access to shared knowledge (SIGNALS.md, Knowledge Base) must be mediated or verified. No direct unvalidated writes."

## Actionable Recommendations
1.  **Formalize Phase Scopes**: Define toolsets for `Research`, `Design`, `Implementation`, `Verification`.
2.  **Write Mediation**: Agents should not write directly to `SIGNALS.md`. (We already moved to `handoff()` tool, which is a mediated write! This validates P82).
3.  **Memory Partitioning**: Coder should not write to `knowledge/library`. Scout should not write to `src/`.
