# Cross-Reference #133: Protocol Stack Evolution — From MCP to ACP to A2A

**Date:** 2026-03-16
**Papers Connected:** ACP (2602.15055), MALLVI (2602.16898), MCP (DD#264), NormCoRe (2603.11974), OpenClaw (2603.11619/11721), Supervisor Orchestration (2603.11545)

## The Stack That's Emerging

We're watching a communication protocol stack crystallize in real-time for multi-agent AI systems. This cross-reference maps the layers:

### Layer 0: Physical/Embodied Execution
**MALLVI** (DD#267) shows what happens at the bottom of the stack — specialized agents must communicate through memory tags, spatial graphs, and VLM feedback loops to coordinate a *single robotic arm*. The protocol here is implicit (shared state via tagged memory) rather than explicit.

### Layer 1: Intra-System Context Sharing (MCP)
**MCP** (DD#264) handles context synchronization within a single multi-agent system. Optimized for agents within a shared trust boundary. Low overhead (22ms), high success rate (99%).

### Layer 2: Cross-System Agent Communication (ACP)
**ACP** (DD#266) adds federated discovery, DID-based identity, SLA negotiation, and semantic intent mapping. Bridges organizational boundaries. Higher latency (58ms) but enables cross-platform interoperability.

### Layer 3: Governance & Norms
**NormCoRe** (2603.11974) addresses how norms emerge and propagate in multi-agent systems. ACP's Governance Layer partially addresses this with reputation ledgers and VCs, but NormCoRe suggests richer normative frameworks are needed.

## Key Insight: The Inversion Problem

**MALLVI** designs agents top-down (decompose task → specialize agents → coordinate). **ACP** designs protocols bottom-up (transport → semantics → negotiation → governance). The tension between these approaches mirrors the classic AI debate: **task-specific vs. general-purpose** coordination.

**Prediction:** The winning architecture will look like MALLVI's task-specific agents communicating via ACP-like protocols. Neither alone is sufficient.

## The Coordination Overhead Cascade

| System | Agents | Protocol Overhead | Recovery Strategy |
|--------|--------|-------------------|-------------------|
| MALLVI (single robot) | 5 | Memory tags (~ms) | Targeted retry (Reflector) |
| MCP (intra-system) | N | 22ms/interaction | Context resync |
| ACP (cross-system) | N | 58ms/interaction | SLA renegotiation |
| ACP+recursive delegation | N^k | 58ms × depth | Swarm reorganization |

**Warning:** At ACP's Layer 2 with recursive delegation, each delegation level adds ~58ms. A 5-deep delegation chain = ~290ms minimum. For time-critical tasks (MALLVI's robotic manipulation), this is unacceptable. **The protocol stack needs latency-aware routing.**

## Connections to Existing Cross-References

- **CR#94 (Evaluation Granularity)**: How do we evaluate protocol stack performance? Latency alone is insufficient — semantic accuracy of intent mapping matters
- **Agent Governance Stack CR**: ACP's governance layer + NormCoRe norms + PoI form a 3-part governance model
- **Scaling Paradox CR**: ACP enables massive scale but the overhead cascade threatens the very benefits of scaling
- **Architecture Decision CR**: MALLVI's choice of 5 specialized agents vs. ACP's 4 protocol layers — both make irreversible architecture decisions

## Open Research Directions

1. **Adaptive protocol selection**: Can agents dynamically choose MCP (fast, local) vs ACP (federated, secure) based on task requirements?
2. **Protocol compression**: Can Agent Cards be pre-cached/pre-negotiated to reduce the PROBE-BID-COMMIT overhead?
3. **Embodied ACP**: How would ACP work for robot-to-robot coordination (MALLVI-to-MALLVI)?
4. **Trust bootstrapping**: Neither paper solves cold-start trust. New agents need reputation from somewhere.

## Summary

The multi-agent AI field is recapitulating networking history: building layered protocol stacks from transport → semantics → negotiation → governance. The papers this week (ACP, MALLVI) represent complementary extremes — one focused on cross-platform communication infrastructure, the other on task-specific agent coordination. The synthesis of both perspectives will define the next generation of multi-agent systems.
