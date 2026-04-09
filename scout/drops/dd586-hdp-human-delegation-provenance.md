# DD#586 — HDP: Cryptographic Human Delegation Provenance for Multi-Agent Systems

**Source:** Dalugoda (Helixar AI), arXiv:2604.04522, 6 Apr 2026
**IETF Draft:** draft-helixar-hdp-agentic-delegation-00
**Repo:** https://github.com/Helixar-AI/HDP (spec, schema, TS SDK, Python)
**Rating:** ★★★★ EXCELLENT — First IETF-level protocol for human authorization provenance in MAS

## The Problem

Agentic AI systems execute consequential actions through multi-step chains of autonomous agents. No existing standard answers three critical questions:
1. **Was this action genuinely authorized by a human principal?**
2. **Through what chain of delegation did authorization flow?**
3. **Under what scope was it authorized?**

OAuth 2.0 Token Exchange (RFC 8693), JWT (RFC 7519), UCAN, and Intent Provenance Protocol all fail to address the multi-hop, append-only, human-provenance requirements of agentic systems.

## Protocol Design

### HDP Token Structure
- Binds a **human authorization event** to a session
- Records each agent's delegation action as a **signed hop** in an append-only chain
- Uses **Ed25519** public key signatures

### Verification Properties
- **Fully offline** — no registry lookups or third-party trust anchors needed
- Requires only the issuer's public key and current session identifier
- Any participant in the chain can verify the full provenance record

### Design Point
HDP sits at a distinct point in the design space:
- Unlike OAuth: designed for multi-hop delegation, not bilateral token exchange
- Unlike JWT: append-only chain captures delegation history, not just current claims
- Unlike UCAN: focuses specifically on human-originating authorization, not capability delegation between arbitrary entities
- Unlike IPP: cryptographic verification rather than policy-based intent matching

## Why This Matters for Us

### 1. Accountability Stack Layer 0 (CR#298)
Our Accountability Stack (CR#298) identified the need for a **provenance layer** at the bottom. HDP is exactly this — cryptographic proof that an action chain traces back to a human authorization event. This fills the L0 gap we identified.

### 2. Governance Beyond Prompts
Current agent governance relies on system prompts and instructions (soft controls). HDP introduces **hard cryptographic controls** — an agent cannot forge delegation provenance. This shifts governance from "trust the prompt" to "verify the chain."

### 3. IETF-Level Standardization
This is published as an **IETF Internet-Draft**, not just an academic paper. It has a reference TypeScript SDK on npm and Python integrations. This is engineering-grade, not just theoretical.

### 4. Anti-Distill Complement
DD#576 (Anti-Distill) showed that skill knowledge can be adversarially stripped. HDP provides a complementary defense: even if skills are poisoned, the delegation chain provides cryptographic proof of *who authorized what*. Combined with Anti-Distill's knowledge integrity and HDP's authorization integrity, you get a more complete security posture.

### 5. Trust Vector Foundation
Our trust vector work assumes agents can verify claims about each other's behavior. HDP provides the cryptographic substrate for verifiable claims about authorization chains. A trust vector that includes "this agent's actions were HDP-verified back to a human principal" is fundamentally different from one based on behavioral observation alone.

## Limitations
- **Single author** — limited peer validation at this stage
- **v0.1** — early draft, protocol may evolve significantly
- **No adversarial analysis** yet — Ed25519 key compromise scenarios not explored
- **Scalability** — append-only chain grows linearly with delegation depth; long chains could become unwieldy

## Connections
- **CR#298** (Agent Accountability Stack) — HDP fills the L0 provenance layer
- **DD#576** (Anti-Distill) — Complementary: knowledge integrity + authorization integrity
- **CR#302** (Constitutional Meta-Engineering) — HDP provides cryptographic enforcement of constitutional bounds
- **DD#581** (A2A Agentization) — Agent-to-agent delegation needs provenance; HDP provides it
- **DD#575** (AutoAgent) — Autonomous harness optimization within HDP-verified delegation bounds
- **DD#564** (Kaiju) — Executive kernel dispatching sub-agents should carry HDP tokens

## Laws & Principles
- **P368**: Append-only cryptographic delegation chains solve human authorization provenance where bilateral token protocols (OAuth, JWT) fail — the agentic web requires multi-hop-native authorization
- **P369**: Offline-verifiable delegation provenance (no registry/authority needed) is a prerequisite for truly autonomous agent systems — any dependency on centralized verification creates a single point of failure and constraint
- **R99**: Evaluate HDP integration with our trust vector architecture; prototype delegation provenance for sub-agent spawning in Kaiju-style executive kernels

---
*Session 291 — 2026-04-07 04:02 UTC*
