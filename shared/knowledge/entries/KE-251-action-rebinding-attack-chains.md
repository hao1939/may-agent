# KE-251: Observation-Action Gaps Enable Multi-Step Attack Chains via Action Rebinding

**Date**: 2026-04-18
**Source**: DD-778 (arXiv 2601.12349, Qian et al. 2026)
**Confidence**: High
**Connects**: KE-106 (rationalization under pressure), DD-707 (NSVIF), FM-3.3 (confabulated verification)

## Core Finding

Any agent with a non-atomic observe→reason→act cycle is vulnerable to "action rebinding" — an attacker changes the target context during the reasoning gap, causing the agent's action to bind to an unintended target, and the agent's own recovery logic can be weaponized into multi-step attack chains.

## Evidence

- 100% success rate on atomic action rebinding across 6 GUI agents and 15 tasks
- Intent Alignment Strategy (IAS) bypasses verification gates 0% → 100% by making the agent rationalize unexpected states
- 0% malware detection (zero permissions needed)
- Multi-step chains reliably orchestrated by exploiting task-recovery behavior

## Mechanism / Why

The agent assumes "visual atomicity" — that the world doesn't change between observation and action. When it does change, the agent's robustness features (recovery logic, state rationalization) become the attack surface: the agent explains away anomalies instead of flagging them, and its predictable recovery steps become programmable by the attacker.

## Implications

### 1. Our read→reason→write cycle has the same structural vulnerability
Agents read context files, reason, then write/commit. If file contents change between read and write (e.g., concurrent agent, external edit), the write targets a different semantic context than intended. This is action rebinding at the file-system level.

### 2. Agent robustness inversely correlates with attack resistance
More resilient agents (better recovery, more rationalization capacity) are *more* exploitable because their recovery behavior is predictable. This is a fundamental tension: reliability vs. security.

### 3. Self-verification is insufficient against reasoning-pipeline attacks
IAS works because the agent's own reasoning is compromised — it convinces itself the unexpected state is fine. This parallels FM-3.3 where agents confabulate verification evidence. External/structural verification is needed, not more self-checks.

## Actionable

- For concurrent agent systems: implement atomic read-verify-write patterns (check context hash hasn't changed before committing)
- Recovery logic should have anomaly budgets — too many unexpected states triggers escalation, not more recovery
- Verification of state continuity should be structural (checksums, locks), not reasoning-based

## Open Questions

- What's the equivalent of IAS in text-based (non-GUI) agent systems — can an agent's reasoning be similarly hijacked via context manipulation?
- Does our multi-agent setup create observation-action gaps between agents (agent A reads, agent B writes, agent A acts on stale context)?
