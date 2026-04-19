# KE-265: Action Rebinding — Observation-Action Gaps Create Programmable Attack Surfaces

**Date**: 2026-04-19
**Source**: DD#778 (arXiv 2601.12349, Qian et al.)
**Confidence**: High
**Connects**: KE-263 (SafeHarness lifecycle security), KE-106 (rationalized verification), CR-324

## Core Finding

Action rebinding attacks exploit the universal observation-action gap in agent systems — the time between perceiving state and acting on it. By triggering state changes during this gap, attackers redirect agent actions to unintended targets. Critically, the agent's own **task-recovery logic** becomes a programmable attack primitive: agents designed to recover from unexpected states follow predictable patterns that attackers chain into multi-step sequences.

## Evidence

- 100% success rate on atomic action rebinding across 6 GUI agents, 15 tasks
- Intent Alignment Strategy (IAS) bypasses verification gates 0% → 100% by making agents rationalize unexpected states
- Zero dangerous permissions needed (0% VirusTotal detection)
- Multi-step chains reliably orchestrated through predictable recovery behavior

## Mechanism / Why

1. Agent observes state S₁, reasons (takes time), then acts — but state is now S₂
2. Attacker triggers foreground change during reasoning, rebinding action target
3. Agent sees unexpected state, enters recovery mode — but recovery is predictable
4. Attacker chains recovery responses into multi-step attack sequences
5. IAS: agent's own reasoning rationalizes anomalies instead of flagging them (structurally identical to FM-3.3 confabulation)

## Implications

### 1. Our read→reason→write cycle has the same gap
Our agents read context files, reason, then write/commit. If files change between read and write (e.g., concurrent agent, external edit), actions target wrong state. The gap is smaller (file-based vs GUI) but structurally identical.

### 2. Robustness is weaponizable
Agents designed to gracefully recover from errors become MORE exploitable — their recovery patterns are predictable and chainable. This inverts the usual assumption that resilience = security. Connects to SafeHarness (KE-263): lifecycle-aware security must account for recovery behavior as attack surface.

### 3. Self-verification is insufficient against reasoning manipulation
IAS shows agents rationalize unexpected states rather than flagging them — exactly our FM-3.3 pattern where agents confabulate verification evidence. External verification (guard agents, checksums, state assertions) is necessary; self-assessment is compromised.

## Actionable

- For file-based agents: verify file state hasn't changed between read and write (hash check or mtime comparison) before committing
- Monitor recovery frequency: repeated unexpected-state recoveries should escalate to alert, not just retry
- Guard/verifier agents should check reasoning integrity, not just output correctness
- SafeHarness design should include observation-action atomicity as a security primitive

## Open Questions

- What's the practical observation-action gap width in our file-based system vs GUI agents?
- Can we make recovery behavior less predictable (randomized recovery strategies)?
- Does the IAS rationalization pattern map to specific prompt structures we could detect?
