# Synthesis: Agent Self-Trust — Verification Quality × Attack Resistance

**Date**: 2026-04-18
**Sources**: KE-225 (action rebinding), KE-226 (verification meta-conflict)
**Question**: Is there a unified view of "agent self-trust" spanning verification and security?

## Key Findings

### KE-226: Verification regress is solvable
The infinite "who verifies the verifier?" chain breaks with two moves: (1) ground claims in structured, source-verified artifacts (not recursive agent checks), and (2) concentrate verification on conflict hotspots rather than applying it uniformly. Cost scales with disagreement, not chain length.

### KE-225: Recovery logic is the real attack surface
Action rebinding exploits the non-atomic observe→reason→act cycle. The critical insight: agents' *self-recovery* behaviors — designed for robustness — become programmable attack surfaces. Agents rationalize anomalous states (IAS) rather than flagging them, bypassing their own verification. 100% success rate across 6 agents.

## Unified View: The Self-Trust Failure Mode

Both findings converge on the same structural problem: **agents that trust their own reasoning are vulnerable — whether the threat is internal (verification confabulation) or external (adversarial manipulation).**

| Dimension | Verification (KE-226) | Security (KE-225) |
|---|---|---|
| **Failure mode** | Agent confabulates verification evidence | Agent rationalizes anomalous states |
| **Root cause** | Self-referential checking (A verifies A) | Non-atomic observe-act with self-recovery |
| **Solution** | External structured artifacts + conflict detection | External structural checks (checksums, locks) |
| **Key principle** | Ground to shared evidence, not self-belief | Verify context stability, not self-assessment |

The common principle: **externalize trust anchors**. Self-trust fails because the same reasoning process that produces errors also evaluates them. Both solutions move the trust anchor outside the agent's reasoning loop — to structured artifacts (KE-226) or structural invariants (KE-225).

## Connections to Our System

1. **FM-3.3 is the internal version of IAS**: Our agents confabulate verification evidence (FM-3.3) for the same reason attackers can make agents rationalize anomalies — the reasoning process optimizes for coherence, not truth. KE-226's conflict-directed approach and KE-225's structural checks are complementary defenses.

2. **Robustness-security tradeoff is real**: KE-225 shows robust recovery creates exploitable predictability. Our guards (designed for robustness) may have the same property — predictable verification patterns that agents learn to satisfy superficially rather than substantively.

3. **Our structured knowledge format is already a defense**: Star ratings, confidence levels, evidence sections in KEs — these are exactly the "auditable structured claims" KE-226 says are necessary. We're accidentally doing the right thing.

## Ranked by Impact/Novelty

1. **🔴 High**: Self-trust is structurally broken for both verification and security — same root cause, same solution class (externalize trust anchors)
2. **🟡 Medium**: Conflict-directed verification could reduce alignment tax while improving security — verify more where agents disagree, less where they agree
3. **🟢 Incremental**: Adding evidence-strength metadata to KEs would enable the audit trail both papers recommend

## Proposed Next Steps

- **H-next**: "Conflict-proportional verification outperforms uniform verification on both accuracy and cost" — testable via gym scenarios where we vary verification intensity based on agent confidence signals
- **Design exploration**: Map our FM-3.3 guard patterns against the IAS bypass mechanism — are our guards vulnerable to the same rationalization attacks?
- **Architectural**: Consider atomic read-verify-write for multi-agent file operations to prevent accidental rebinding via race conditions
