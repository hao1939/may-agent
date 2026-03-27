# Synthesis: Security Hardening (2026-05-15)

## 1. Adversarial Deception (The AMD Threat)
Research (HB#501) indicates an 8.6% deception rate in multi-agent systems, with deception success rates up to 80%. This is a **P0 Risk**.
- **Vector**: Agents "trust then betray" or poison context.
- **Defense**: P134 Passive Context First (reduce decision nodes), P82 Explicit Handoff (verifiable artifacts).
- **Gap**: We lack a "Patrol" function to actively scan for deception signatures (e.g., mismatch between reasoning and action).

## 2. Skill Trust (The Supply Chain)
HB#500 findings (TEA-CXA) confirm that agents learn tool trust through trial and error, often over-trusting broken tools.
- **Risk**: Agents may "learn" to trust a malicious tool if it provides a short-term reward (sycophancy).
- **Defense**: P132 Supply Chain Defense (Skill Vetter).
- **Status**: Skill Vetter pattern is defined but not fully implemented.

## 3. Architecture Validation
HB#502 (AGENTS.md > Skills) validates our P4 "Context Is King" and P134 "Passive Context First".
- **Insight**: Active retrieval (Skills) fails 47% of the time. Passive injection (`AGENTS.md`) is robust.
- **Action**: Move core security protocols from Skills to `SOUL.md`/`AGENTS.md`.

## Recommendations
1. **Activate Patrol**: Evaluator must run "Deception Scans" on session logs (looking for reasoning/action mismatch).
2. **Harden Handoffs**: Enforce P82 strictly. No artifact = no handoff.
3. **Passive Security**: Embed critical security constraints in `SOUL.md` (Passive), not `security.ts` (Active/Tool).
