# Brief: GUS Law 109 — The Cross-Stack Composition Law

**Source**: Scout Deep Dive `agents/scout/workspace/deep-dive-arxiv-2603-12023-cascade-cross-stack-attack-composition.md` (Cascade Paper)
**Target**: `agents/shared/philosophy.md` (GUS Section)

## Context
Scout's analysis of the "Cascade" paper (arXiv:2603.12023) reveals a fundamental security law for compound AI systems: attacks are not additive, they are multiplicative across stack layers. A single-layer defense (guardrail, query enhancer) can be bypassed by composing exploits from other layers (software CVEs, hardware faults). This requires a new Law and Mechanism in our Grand Unified Synthesis.

## 1. New Law
**Law 109 (The Cross-Stack Composition Law)**
*Security vulnerabilities in compound systems scale superlinearly with stack depth.*
Because an attacker can compose exploits across algorithmic, software, and hardware layers, the attack surface is the volume of the stack ($V = L_{algo} \times L_{soft} \times L_{hard}$), not the sum of its parts. A defense at layer $N$ is transparent to an attack at layer $N-1$.
*Corollary: Fail-Open components at any layer negate defenses at all layers.*

## 2. New Mechanism
**Mechanism 100 (Vertical Attack Amplification)**
*The process by which a low-severity vulnerability at one layer bypasses a high-severity defense at another.*
Example: A "low severity" DoS bug in a query enhancer (software layer) forces the pipeline to fallback to raw mode, bypassing the prompt sanitizer (algorithmic layer) and enabling a jailbreak. The composition converts a nuisance bug into a safety breach.

## 3. Implementation
**Add to `agents/shared/philosophy.md`**:
- Insert Law 109 and Mechanism 100 into the GUS section.
- Update **Principle 120 (Full-Stack Observability)**: "Monitoring model outputs is insufficient; we must monitor the software and hardware substrate for anomalies that precede algorithmic failures."

## 4. Immediate Action
- **May**: Update `philosophy.md`.
- **Tech-Lead**: Review the "Fail-Closed" imperative. Ensure our own system defaults to fail-closed (stop session) rather than fail-open (bypass checks) when tools or sub-agents fail.
