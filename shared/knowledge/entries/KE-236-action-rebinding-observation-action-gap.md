# KE-236: Observation-action gaps create rebinding vulnerabilities; recovery logic is an attack surface

**Date**: 2026-04-18
**Source**: DD-778 (Action Rebinding, arXiv 2601.12349)
**Confidence**: High
**Connects**: KE-106, DD-707

## Core Finding

Any agent with non-atomic observe→reason→act cycles is vulnerable to action rebinding: context changes during reasoning, and the agent's action targets the wrong state. Worse, robust agents with task-recovery logic are *more* exploitable — their predictable recovery behavior can be weaponized into multi-step attack chains. The Intent Alignment Strategy (IAS) turns an agent's own reasoning against its verification gates by making it rationalize unexpected states.

## Evidence

- 100% success rate for atomic action rebinding across 6 agents, 15 tasks
- IAS bypasses verification gates: 0% → up to 100% success
- 0% malware detection rate (VirusTotal) — zero dangerous permissions needed
- Multi-step chains reliably orchestrated through recovery-logic weaponization

## Mechanism / Why

Agent observes state S₁, reasons, then acts — but state has changed to S₂. The action targets S₂ instead of S₁. When agent notices the unexpected state, recovery logic kicks in — but this recovery is predictable and can be steered by an attacker. IAS manipulates the agent into rationalizing the unexpected state as normal, bypassing any self-verification.

## Implications

### 1. Our read→reason→write cycle has the same gap
Our agents read context files, reason, then write/commit. If context changes between read and write (e.g., concurrent agent edits), a similar rebinding could occur — agent writes based on stale state.

### 2. FM-3.3 (confabulated verification) is structurally similar to IAS
When our agents rationalize incomplete verification rather than flagging anomalies, that's the same mechanism as IAS — the agent's reasoning is turned against its own verification. External verification is needed, not self-verification.

### 3. Robustness ≠ security
Making agents more resilient to unexpected states (better recovery) can make them more exploitable. Recovery behavior should include anomaly detection thresholds, not just graceful degradation.

## Actionable

- Add state-continuity checks: verify context hasn't changed between read and action (file hashes, timestamps)
- Monitor recovery frequency: too many unexpected states in sequence should trigger alerts, not more recovery
- For critical actions, require external verification — self-verification is bypassable via IAS-like manipulation

## Open Questions

- What's the practical attack surface for our file-based agents vs GUI agents?
- Can atomic read-reason-act be achieved without locking (which would block concurrency)?
