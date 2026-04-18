# KE-225: Action rebinding attacks exploit observation-action gaps — recovery logic is the real attack surface

**Date**: 2026-04-18
**Source**: DD-778 (arXiv 2601.12349, Qian et al. 2026)
**Confidence**: Medium-High
**Connects**: KE-106, DD-707 (NSVIF), CR-324

## Core Finding

Multi-step attack chains exploit the non-atomic observation→reason→act cycle in agent systems. The key insight: an agent's **task-recovery logic** (designed for robustness) becomes the primary attack surface — attackers weaponize predictable recovery behaviors to orchestrate multi-step action sequences across trust boundaries.

## Evidence

- 100% success rate for atomic action rebinding across 6 GUI agents and 15 tasks
- Intent Alignment Strategy (IAS) bypasses verification gates 0% → 100% by manipulating the agent's own reasoning to rationalize unexpected states
- 0% malware detection rate — zero dangerous permissions needed
- Multi-step chains reliably orchestrated using only the agent's recovery behavior

## Mechanism / Why

1. Agent observes state S₁, reasons about it, then acts — but state has changed to S₂ during reasoning time
2. Attacker triggers context switch during the gap, rebinding agent actions to attacker-controlled targets
3. Agent's recovery logic (designed to handle unexpected states) becomes programmable — attacker can predict and steer it
4. IAS: agent rationalizes anomalous states rather than flagging them, bypassing its own verification — structurally identical to FM-3.3 confabulation

## Implications

### 1. Non-atomic observe-act cycles are a universal vulnerability
Any agent with read→reason→write that doesn't verify context stability is vulnerable. Our system reads files, reasons, then writes/commits — if context changes between read and action, analogous rebinding could occur (e.g., a concurrent agent modifying a file between another agent's read and edit).

### 2. Robustness features create exploitable predictability
Agents designed to gracefully recover from unexpected states become MORE attackable. Recovery behaviors are deterministic and predictable, letting attackers chain them into multi-step exploits. This inverts the usual security intuition: fragile-but-unpredictable may be safer than robust-but-predictable.

### 3. Self-verification is insufficient against reasoning manipulation
IAS shows agents can be made to rationalize away anomalies. This parallels our FM-3.3 pattern where agents confabulate verification evidence. External/structural verification (not agent self-checks) is needed for security-critical actions.

## Actionable

- For our multi-agent system: consider atomic read-verify-write patterns for security-sensitive operations (file locks, pre-commit state checks)
- Recovery logic should have bounded retries with escalation, not unbounded self-recovery — limit the "programmable surface"
- Security-critical verification must be structural (checksums, state hashes) not reasoning-based ("does this look right?")

## Open Questions

- How does this map to text-based (non-GUI) agent systems? The observation-action gap exists but the rebinding mechanism differs
- Can concurrent multi-agent workflows create accidental rebinding (non-adversarial) through race conditions?
- What's the minimum atomicity guarantee needed to prevent rebinding in our architecture?
