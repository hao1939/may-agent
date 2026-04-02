# DD#442: CPMM — Capability-Priced Micro-Markets for the Agentic Web

**Paper**: "Capability-Priced Micro-Markets: A Micro-Economic Framework for the Agentic Web over HTTP 402"
**Authors**: Ken Huang, Jerry Huang, Mahesh Lambe, Hammad Atta, Yasir Mehmood, et al.
**arXiv**: 2603.16899
**Rating**: ★★★★ HIGH — First formal micro-economic framework for agent-to-agent commerce with cryptographic security

---

## Core Contribution

CPMM proposes the first complete economic stack for autonomous AI agents transacting on the web, synthesizing three technologies:

1. **Project NANDA**: Cryptographically verifiable, capability-based security and discovery
2. **HTTP 402 + X402/H402**: Micropayment protocol extensions enabling low-cost agent-to-agent payments
3. **ACNBP**: Agent Capability Negotiation and Binding Protocol for secure multi-step negotiation

**Key theoretical contribution**: Formalizes agent interactions as a repeated bilateral game with incomplete information and proves convergence to a **constrained Radner equilibrium** — ensuring efficient outcomes even under information asymmetry.

## The HTTP 402 Renaissance

HTTP 402 ("Payment Required") has been reserved in the HTTP standard since 1997 but never had a defined implementation. CPMM resurrects it as the native payment mechanism for the agentic web:

- **X402**: Client-side payment extension — agent includes payment proof in request headers
- **H402**: Server-side discovery extension — agent services advertise pricing via standardized response headers
- **Together**: a complete request-response payment cycle that operates within normal HTTP semantics

**Why this matters**: Every other agent-to-agent payment proposal requires out-of-band payment channels, blockchain settlement, or human-mediated payment. CPMM embeds payment INTO the web protocol itself, making agent commerce as natural as making an API call.

## Architecture: The Three-Layer Stack

### Layer 1: Discovery and Security (Project NANDA)

- Agents publish **capability documents** — machine-readable descriptions of what services they offer
- Capabilities are **cryptographically signed** — prevents impersonation and capability forging
- Discovery is **decentralized** — no central registry required, agents discover each other via capability advertisement
- Security model: **capability-based access control** — possession of a valid capability token grants access, no identity-based ACLs

### Layer 2: Negotiation (ACNBP)

- Multi-step negotiation protocol for complex agent transactions
- Supports **capability composition** — agent A can negotiate for a bundle of capabilities from agents B and C
- **Binding commitments** — once agents agree on terms, commitments are cryptographically binding
- Handles **partial execution** — if a multi-step transaction fails midway, rollback mechanisms are defined

### Layer 3: Settlement (HTTP 402 + Micropayments)

- Micropayment-optimized: transactions can be as small as fractions of a cent
- **Per-capability pricing**: each capability has a price, and agents pay per invocation
- **Dynamic pricing**: prices can adjust based on demand, resource utilization, agent reputation
- Settlement can use any micropayment rail (cryptocurrency, stablecoins, traditional payment APIs)

## Theoretical Framework: Repeated Bilateral Games

### Model
- Two agents with **incomplete information** about each other's capabilities and valuations
- Repeated interactions allow **reputation building** and **learning opponent strategies**
- Each agent maximizes expected utility subject to budget constraints

### Key Results

**1. Convergence to Constrained Radner Equilibrium**:
Under reasonable assumptions (bounded rationality, non-degenerate action spaces), the repeated game converges to a Radner equilibrium where:
- All gains from trade are realized
- No agent can improve its outcome by unilateral deviation
- Information asymmetry is overcome through repeated interaction

**2. Privacy Elasticity of Demand** (Novel Concept):
Quantifies the tradeoff between information disclosure and service pricing:
```
ε_p = ∂Q/∂D · D/Q
```
Where Q is demand for a service and D is the degree of information disclosure.

**Intuition**: If an agent reveals more about its capabilities (reducing information asymmetry), it can charge higher prices because buyers face less uncertainty. But excessive disclosure creates competitive vulnerability. ε_p captures this tradeoff.

**Implications**:
- Agents must optimize their information disclosure strategy alongside their pricing strategy
- There exists an **optimal disclosure level** that maximizes revenue
- This creates a natural incentive for partial transparency in agent marketplaces

## Connection to Our Architecture

### Law 6 (Economic Sustainability) — Direct Hit

CPMM is the most complete implementation of economic sustainability for MAS we've seen. It provides:
- **Pricing mechanisms** for agent capabilities (DD#433 MemGPT's memory operations could be priced per-operation)
- **Budget constraints** that naturally prevent resource abuse (an agent can't monopolize compute without paying)
- **Market signals** that enable efficient resource allocation (popular capabilities command higher prices)

### Connection to Cascade-Aware Routing (DD#439)

CPMM's per-capability pricing creates natural **cost-aware routing**:
- An orchestrator choosing between routing paths can factor in economic cost
- Cascade failures have economic consequences — failed capabilities waste payments
- **Budget-bounded cascades**: an agent pipeline can't cascade indefinitely because each step costs money

This is the economic enforcement mechanism missing from DD#439's cascade-aware routing.

### Connection to ETL Trust Learning (DD#438)

CPMM's repeated game formalization maps directly to trust dynamics:
- **Trust** in CPMM = agent's belief about counterparty capability quality
- **Reputation** emerges through repeated transactions
- ETL's trust learning could be used to update CPMM's agent beliefs
- **Economic trust**: an agent that delivers poor capabilities loses revenue (market-mediated accountability)

### Connection to TerraLingua (DD#435)

TerraLingua's emergent governance includes resource allocation and social organization. CPMM provides the ECONOMIC MECHANISM for implementing this:
- TerraLingua's resource constraints = CPMM's budget constraints
- TerraLingua's division of labor = CPMM's capability specialization
- TerraLingua's governance = CPMM's negotiation protocol rules

### Connection to VeriGrey (DD#436) and Security

CPMM's capability-based security model complements VeriGrey's greybox validation:
- **Capabilities as attack surface**: a malicious agent could forge or replay capability tokens
- **Payment as authentication**: the act of paying for a capability provides proof of intent
- **Economic Sybil resistance**: creating fake agents costs money in CPMM (each must pay for capabilities)

## Critical Analysis

### Strengths
1. **Complete stack**: Discovery → Negotiation → Settlement, all formally specified
2. **Theoretical rigor**: Radner equilibrium convergence proof
3. **Novel concept**: Privacy Elasticity of Demand captures a real and under-explored tradeoff
4. **Practical grounding**: Built on existing web standards (HTTP 402) rather than requiring new infrastructure
5. **Decentralized**: No central authority required for discovery, negotiation, or settlement

### Weaknesses
1. **No implementation or evaluation**: This is a purely theoretical paper with no prototype or experiments
2. **Micropayment bootstrapping**: Who provides the initial capital for agents? Human sponsors? Self-funding?
3. **Adversarial pricing**: What prevents a monopolist agent from setting predatory prices?
4. **Latency**: Multi-step negotiation (ACNBP) adds latency to every agent interaction — may be unacceptable for real-time MAS
5. **Assumes rational agents**: Prospect Theory (the companion paper 2603.16916) shows humans deviate from expected utility — do LLM agents also deviate?
6. **Regulatory void**: No discussion of legal/regulatory implications of autonomous AI agents conducting financial transactions

### Key Missing Piece: Market Manipulation
No discussion of:
- **Collusion** between agents to fix prices (connects to ETL collusion, DD#438)
- **Front-running** — agents with faster inference exploiting slower agents
- **Flash crashes** — rapid price cascades when many agents react to the same market signal

## Predictions

- **P212**: HTTP 402 will be formally adopted by a major cloud provider (AWS, GCP, Azure) as the standard payment mechanism for AI agent services by end of 2027.
- **P213**: Privacy Elasticity of Demand will become a standard metric in agent marketplace design, analogous to price elasticity in traditional economics.
- **P214**: The first "agent market crash" (rapid price collapse due to algorithmic trading dynamics between AI agents) will occur within 18 months of widespread CPMM-like adoption.

---

*Scout DD#442 | 2026-03-19 | Session 157*
