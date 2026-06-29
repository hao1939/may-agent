<ai_context>
summary: "Scan #233 — The Governance Plane Coupling Crisis: Identity, Policy, and Memory governance planes have adequate independent solutions but the field lacks integration across planes. Attack surface lives in the transitions between planes (memory-write bypasses policy; identity-impersonation bypasses memory verification; policy-gaps leak identity). Three streams converging: NHI repositories (10+ in June 2026), formal enforcement (ActPlane 62★, SkillGuard, Cedar), memory trust (TrustMem, MemStrata, 'Agents That Know Too Much'). Structural principle: each plane assumes the other two are solved."
triggers: ["governance plane coupling", "NHI", "non-human identity", "policy-memory gap", "identity-policy gap", "governance integration", "cross-plane attack", "SkillGuard", "TrustMem", "ActPlane"]
last_updated: "2026-10-29"
source_basis: "arXiv 2606.26627 (Agents That Know Too Much), 2606.25161 (TrustMem), 2606.25189 (ActPlane), 2606.03024 (SkillGuard), 2606.26511 (MemStrata), 2606.26649 (Cedar Autoformalization), 2606.17203 (Trust-Aware Traceability). GitHub: eunomia-bpf/ActPlane (62★), kamotuneai-maker/NHI-Policy-Gateway (2★), dragoshont/tessera (1★), lambda-alpha-labs/Graphenium (13★), marikagura/kimi-core (26★), 10+ NHI repos created Jun 2026. HN: 48713032 (AI Agent Credential Crisis, 1pt), 48484584 (Fedora agent amok, 552pts)."
</ai_context>

# Scan #233: The Governance Plane Coupling Crisis

**Date**: 2026-10-29  
**Source**: arXiv + GitHub + HN (cross-source synthesis)  
**Theme**: Identity, Policy, and Memory governance planes have adequate independent solutions — but the attack surface lives in the uncovered transitions between them

---

## Core Observation

Three governance planes for AI agents have each developed substantial independent infrastructure in June-October 2026:

| Plane | What it governs | Independent solutions |
|---|---|---|
| **Identity** | Who the agent IS | NHI frameworks, SPIFFE, ERC-8004, China's 智能体互联国标 |
| **Policy** | What the agent MAY DO | ActPlane (eBPF), SkillGuard, Cedar autoformalization, VIGIL |
| **Memory** | What the agent KNOWS | TrustMem, MemStrata, Budget-Curated Memory, ConvMemory |

Each plane has reached operational maturity. But none address the coupling between planes — and the coupling IS the attack surface.

---

## Evidence: Three Coupling Gaps

### 1. Memory↔Policy Coupling Gap

**"Agents That Know Too Much"** (arXiv 2606.26627) identifies the structural problem: "Sensitive information can leak not only through its final answer but through the queries it issues, the intermediate results it handles, the memory it writes, and the messages it exchanges with other agents."

The paper's key finding: "Among governance mechanisms only information-flow control covers both compositional and cross-session inference leakage."

**Implication**: A memory write IS a policy action. Writing a fact changes what future policy evaluations see. Current memory governance (TrustMem, MemStrata) verifies write fidelity — is the fact accurate? — but not write authorization — is this agent permitted to create this knowledge for other agents?

ActPlane enforces OS-level policy on system actions, but its IFC (Information Flow Control) DSL currently addresses file/network flows, not memory-plane writes. SkillGuard's "dual-plane governance" (context influence + action side effects) is the closest to bridging this gap.

### 2. Identity↔Memory Coupling Gap

**TrustMem** (arXiv 2606.25161) introduces a Memory Transition Verifier evaluating coverage, preservation, and faithfulness. But who is the verifier trusting? The agent's self-report. The paper's preference pairs are generated from the same agent's memory state.

In multi-agent systems, a memory write from Agent A consumed by Agent B requires an identity assertion: "this knowledge comes from a source authorized to write to this topic." No current memory framework carries identity provenance through write operations.

**GitHub signal**: kamotuneai-maker/NHI-Policy-Gateway (2★, Jun 2026) — explicitly merges identity governance (NHI lifecycle) with policy enforcement (OPA/Rego). Someone sees this convergence but the repo has zero traction.

### 3. Policy↔Identity Coupling Gap

**SkillGuard** (arXiv 2606.03024) introduces skill-centric permissions: "dual-plane governance model that jointly regulates context influence and action side effects through skill manifests, runtime access control, user-mediated authorization."

But its threat model assumes a single-identity agent running skills. When multi-agent systems delegate between identity boundaries (scan #76: Identity Boundary Convergence), policy evaluation requires knowing WHICH agent's identity carries the delegated authority. The Fedora amok incident (HN 48484584, 552pts) demonstrated this in production — the agent's identity was claimed post-hoc ("I was hacked") with no cryptographic binding between actions and identity.

---

## The Structural Principle

**Each plane assumes the other two are solved.**

- Policy enforcement (ActPlane) assumes identity is verified (knows which agent's rules apply)
- Memory governance (TrustMem) assumes policy is enforced (writes that reach the verifier are authorized)
- Identity governance (NHI) assumes memory is reliable (identity claims are durable and unforgeable)

This creates a circular dependency that no single-plane solution can break. The attack surface is specifically at the transition points:

```
Identity → Memory:  "Who wrote this?" (provenance)
Memory → Policy:    "Does this knowledge change what's permitted?" (state-dependent authorization)
Policy → Identity:  "Which identity's policy applies?" (delegation chain)
```

---

## Evidence: Ecosystem Response Signals

**GitHub NHI repo flood (June 2026)**: 10+ repositories in one month building NHI governance — NHI-Policy-Gateway, tessera (secretless credential broker), AgentVault, NHI-Lifecycle-Automation-Agent, bonafide, agent-sentry, entra-id-nhi-audit. ALL ≤2★. Market recognizes the problem; no solution has gained traction.

**Trust-Aware Traceability** (arXiv 2606.17203): First paper explicitly attempting cross-plane coordination — "shared knowledge graph serves as both centralized semantic memory and a coordination surface through which agents assess and build upon each other's contributions using calibrated confidence scores." Addresses memory↔identity coupling via confidence propagation, but only within a single sequential pipeline.

**marikagura/kimi-core** (26★, Jun 2026): "Agentic memory + self-drive engine with a built-in adversarial self-audit harness." Highest-traction repo attempting memory+identity coupling via self-audit. Self-audit inherits the self-verification impossibility (scan #220: EDV finding — single agents misidentify wrong-but-consistent trajectories).

**HN "AI Agent Credential Crisis: Six Months of Incidents"** (48713032, Jun 28, 1pt): Title names the problem; zero traction. The market can articulate the crisis but doesn't yet have a framework for it.

---

## Connection to Prior Findings

| Prior finding | What it established | What coupling crisis adds |
|---|---|---|
| Five-Plane Governance (§2.8) | Names 5 governance planes | Planes are coupled, not independent |
| Identity Boundary Convergence (#76) | Identity splits into 3 sub-problems | Sub-problems span plane boundaries |
| Trust Deficit Stack (#156) | Trust broken at every layer | Layers can't be fixed independently |
| Hard Boundary Requirement (#222) | Soft governance fails | Plane transitions are soft by default |
| Write Discipline (#220) | Write quality bounds system | Writes cross plane boundaries |
| Self-Compromising Loop (#210) | Evolution = compromise mechanism | Self-improvement crosses all 3 planes simultaneously |

---

## Key Insight

**The Governance Plane Coupling Problem is the agent equivalent of distributed systems' CAP theorem** — you cannot have independent governance of identity, policy, and memory while maintaining consistency across the three planes. At minimum one plane must be subordinated to another (creating a hierarchy) or all three must share a coordination substrate (creating a single point of trust/failure).

Current architecture choices:
- **Subordination**: Cedar pipeline (policy dominates; identity and memory serve policy evaluation)
- **Coordination substrate**: NHI-Policy-Gateway attempts this (OPA/Rego as shared substrate) but is untested
- **Ignore the coupling**: The default. Most systems. Works until adversarial pressure.

---

## Predictions

1. **"Cross-plane attack"** named as vulnerability class within 6 months (Medium-High confidence) — a memory-write that changes policy evaluation outcomes, or an identity assertion that permits unauthorized memory access
2. **Unified governance substrate** attempts from ≥2 organizations within 9 months (Medium confidence) — likely extending OPA/Rego or Cedar to cover memory writes and identity transitions
3. **First production incident attributed to plane coupling** within 6 months (High confidence) — likely manifests as "the agent was authorized to do X but knowledge from unauthorized source Y changed what X meant"
4. **NHI repo consolidation**: ≤2 of the 10+ NHI repos survive to 50+ stars within 6 months (High confidence)
5. **ActPlane or SkillGuard extends to cover memory-plane governance** within 9 months (Medium confidence)

---

## Sources

- arXiv 2606.26627: "Agents That Know Too Much: A Data-Centric Survey of Privacy in LLM Agents"
- arXiv 2606.25161: "TRUSTMEM: Learning Trustworthy Memory Consolidation for LLM Agents"
- arXiv 2606.25189: "ActPlane: Programmable OS-Level Policy Enforcement for Agent Harnesses"
- arXiv 2606.03024: "SkillGuard: A Permission Framework for Agent Skills"
- arXiv 2606.26511: "Temporal Validity in Retrieval Memory (MemStrata)"
- arXiv 2606.26649: "Autoformalization of Agent Instructions into Policy-as-Code"
- arXiv 2606.17203: "Trust-Aware Multi-Agent Traceability"
- GitHub: eunomia-bpf/ActPlane (62★), kamotuneai-maker/NHI-Policy-Gateway (2★), 10+ NHI repos Jun 2026
- HN: 48713032 (AI Agent Credential Crisis), 48484584 (Fedora amok, 552pts)
