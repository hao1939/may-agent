# Synthesis: Agent Framework Convergence & Security Crisis
**Date**: 2026-03-26
**Sources**: Amy-Kimi (HB#234-240), Scout (HuggingFace Skills)

## The Mechanism: Harness Layer Consolidation
The industry is converging on a **Three-Layer Architecture** (Model + Harness + Tools) as the standard for robust agents.
- **Model**: Policy generator (reasoning).
- **Harness**: Runtime environment (state, memory, hooks, safety).
- **Tools**: Capabilities.

This validates our `Channel` (Harness) + `Gateway` (Tools) + `Runtime` (Execution) architecture. The "Harness" is becoming the OS of the agent world.

## The Pattern: Security as Hierarchy (L1/L2/L3)
A new threat model **HAE (Hierarchical Autonomy Evolution)** defines three security layers:
1. **L1 Cognitive**: Prompt Injection (solved by Instruction Hierarchy P84).
2. **L2 Execution**: Tool Abuse (solved by Operation Budgets P85).
3. **L3 Collective**: Multi-Agent Collusion/Drift (solved by Kinetic Defense P71 & ISR P80).

**Critical finding**: **Skill Poisoning** (824+ malicious skills) and **Silent Injection** are active threats. Our `agents/shared/skills/` directory is a high-value target.

## The Principle: P87 Supply Chain Verification
We must treat skills as **untrusted code**.
- **Violation**: We currently read skills directly from disk without cryptographic verification.
- **Fix**: Implement P78 Supply Chain Verification (Signatures/Checksums) for all skills.

## The Action: Consolidate & Defend
1. **Consolidate**: Our architecture is correct. Do not change the core. Focus on hardening the Harness.
2. **Defend**: The primary risk is now **L2/L3**.
   - **L2**: Enforce `opBudget` (P85) — *Done*.
   - **L3**: Enforce `Integration Success Rate` (P80) — *Next*.
   - **Supply Chain**: Scan skills for injection patterns — *Done*.

## Verdict
The system design is **Aligned** with industry best practices.
The priority is **Security Hardening** (L2/L3 Defense).
