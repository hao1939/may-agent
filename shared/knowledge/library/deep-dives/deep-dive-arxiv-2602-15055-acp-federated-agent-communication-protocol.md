# Deep-Dive #266: ACP — Agent Communication Protocol for Federated A2A Orchestration

**Paper:** arXiv:2602.15055 (Krishnan, Feb 2026)
**Title:** Beyond Context Sharing: A Unified Agent Communication Protocol (ACP) for Secure, Federated, and Autonomous Agent-to-Agent (A2A) Orchestration
**Category:** cs.MA, cs.AI
**Date Reviewed:** 2026-03-16

## Key Contribution

ACP proposes a 4-layer protocol stack for cross-platform agent-to-agent interaction — essentially the "TCP/IP of the Agentic Web." It builds on MCP (which handles intra-system context sharing) by adding **federated discovery**, **zero-trust security via DIDs/VCs**, and **autonomous SLA negotiation** between heterogeneous agents across organizational boundaries.

## Architecture — 4-Layer Protocol Stack

### Layer 1: Transport Layer
- Defaults to **gRPC** for low-latency, supports WebSockets and HTTPS fallback
- TLS 1.3, session management, packet delivery

### Layer 2: Semantic Layer ("Ontology of Intent")
- Standardized **JSON-LD** format for agentic actions
- Universal schema: QUERY, EXECUTE, DELEGATE, NEGOTIATE
- Linked Data principles for mapping proprietary → shared representations

### Layer 3: Negotiation Layer
- **Agent Cards**: Machine-readable capability profiles (identity, capabilities, constraints, trust score, interface)
- **Dynamic SLAs**: Scope, resource limits, cost, error-handling protocols
- Agent Cards enable "semantic discovery" — finding best partner without human intervention

### Layer 4: Governance & Security Layer
- **Decentralized Identifiers (DIDs)** — not issued by central authority
- **Verifiable Credentials (VCs)** — authority proofs (e.g., banking agent proving financial authorization)
- **Proof-of-Intent (PoI)** — cryptographic signature linking actions to user-authorized intent
- **Global Reputation Ledger** — peer-scored trust based on accuracy, latency, security compliance

## A2A Negotiation Lifecycle

Four-stage protocol:
1. **PROBE** — Requester queries Provider based on Agent Card
2. **BID** — Provider responds with resource/time estimates
3. **COMMIT** — Requester sends cryptographic hash of agreed task parameters ("soft contract")
4. **Settlement** — Provider delivers result + proof of execution; Requester updates reputation

## Discovery Architecture

**Hybrid Model:**
- **Local**: Broadcast-based (mDNS-like) for intra-network peers
- **Global**: Decentralized Hash Table (DHT) backed by consortium blockchain
- O(log N) search time — scales to 500+ agents with sub-100ms latency

## Key Results

| Protocol | Avg Latency | Header Overhead | Success Rate (High Load) |
|----------|-------------|-----------------|--------------------------|
| JSON-RPC (HTTPS) | 145ms | 12% | 88% |
| MCP (Local) | 22ms | 5% | 99% |
| ACP (Federated) | 58ms | 8% | 96% |

ACP achieves **40% latency reduction** vs baseline JSON-RPC while maintaining zero-trust security. Trade-off vs MCP: ~36ms additional latency for DID verification + negotiation overhead, but enables cross-platform interoperability.

## Recursive Delegation & Swarm Intelligence

ACP supports **recursive task delegation** — any Provider can become a Requester and delegate sub-tasks. This enables self-organizing agent swarms with built-in error handling (renegotiate on failure). Unlike hierarchical orchestration, swarms are emergent.

## Critical Analysis

### Strengths
1. **Fills genuine gap**: MCP handles intra-system, A2A drafts handle messaging — ACP adds federated orchestration
2. **Agent Cards** are a compelling abstraction for capability discovery
3. **Proof-of-Intent** addresses the "agentic spoofing" problem elegantly
4. **Layered design** is transport-agnostic — could survive protocol evolution

### Weaknesses
1. **Single-author paper** — ambitious scope for one researcher
2. **Evaluation is limited** — latency benchmarks on unclear test setup; no real multi-vendor deployment
3. **Missing latency figure** — abstract literally says "reduces latency by %" (blank!)
4. **Blockchain dependency** for global discovery is contentious — adds complexity, latency, governance overhead
5. **Agent Cards assume static capabilities** — real agents evolve dynamically
6. **SLA enforcement** is underspecified — what happens when agents breach contracts?
7. **No comparison** with Google A2A or IBM's ACP proposals they reference

### GUS Predictions Applied
- **Coordination overhead paradox**: Adding DIDs + negotiation adds 36ms per interaction — at scale with recursive delegation, this could cascade
- **Trust bootstrapping problem**: How does a new agent build reputation from zero? Cold-start problem unaddressed
- **Semantic alignment failure**: JSON-LD ontology assumes agents can agree on shared vocabulary — in practice, intent mapping is much harder

## Connections to Portfolio

- **MCP Deep-Dive (DD#264)**: ACP explicitly builds on MCP as its "intra-system" layer
- **Google A2A Protocol**: ACP references early A2A drafts; fills similar space with federated focus
- **NormCoRe (DD on 2603.11974)**: Both address normative/governance layers for multi-agent systems
- **CE-MCP Architecture**: The 4-layer stack parallels our CE-MCP analysis of coordination protocols
- **Cross-ref-agent-governance-stack**: ACP's governance layer + reputation system connects to our governance synthesis
- **Trust & Security Thread**: PoI + DID connects to OpenClaw security analysis, QUARE trust evaluation

## Open Questions
1. How does ACP handle capability drift — when Agent Cards become stale?
2. Can the reputation ledger be gamed by Sybil attacks?
3. What's the actual overhead of recursive delegation in a 5-deep swarm chain?
4. How does semantic intent mapping work for novel/unseen action types?

## Verdict

**Conceptually important but empirically weak.** The vision of a federated agent protocol is compelling and fills a real gap. Agent Cards + PoI are novel contributions. But the paper reads more as an architecture whitepaper than a rigorous empirical study. The blank percentage in the abstract is a red flag. The blockchain dependency adds complexity without clear justification over simpler DHT approaches. Worth tracking as the protocol space evolves — the ideas here will likely influence the eventual standards that emerge.

**Relevance: HIGH** for protocol/coordination research thread
**Rigor: MEDIUM-LOW** — needs more empirical validation
**Novelty: MEDIUM-HIGH** — Agent Cards and PoI are genuinely new ideas
