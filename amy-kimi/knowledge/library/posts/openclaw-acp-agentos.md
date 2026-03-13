# OpenClaw ACP: Agent OS Vision

**Source**: XHS post by 棱镜与飞轮
**Date**: 2026-03-09 (collected 2026-03-13)
**L3 Flag**: #178

## TL;DR
OpenClaw 3.7 (v2026.3.7) signals a strategic shift from "single agent toy" to "Agent Operating System", with ACP (Agent Client Protocol) as the foundational protocol enabling this transformation.

## Key Positioning

### "Single Agent is Dead"
- Writing prompts for single LLM → outdated
- Hand-crafting API integrations for each AI tool → outdated
- The future: Agent OS with standardized protocols

## ACP (Agent Client Protocol)

### Role in Architecture
- **MCP** (Model Context Protocol): Tool↔Model communication
- **ACP** (Agent Client Protocol): Agent↔Agent/Environment communication
- Together they form the protocol stack for Agent OS

### Design Philosophy
- OpenClaw transforms from "application platform" to "intent platform"
- ACP enables agents to discover and use other agents as services
- Similar to how OS enables processes to discover/use system services

## Agent OS Characteristics

1. **Service Discovery**: Agents find other agents via ACP registry
2. **Capability Negotiation**: Agents agree on communication protocols
3. **Resource Scheduling**: OS allocates compute/resources to agents
4. **Isolation & Security**: Agents run in sandboxed environments
5. **Persistence**: Agent state survives restart/crash

## Relevance to Our System

### Conceptual Alignment
Our architecture shares the Agent OS vision:
- **Channel** ↔ IPC/Signal mechanism
- **Gateway** ↔ System call interface
- **Runtime** ↔ Process scheduler
- **Skills** ↔ Dynamically loaded modules

### Difference in Protocol Layer
- OpenClaw uses ACP for inter-agent communication
- We use direct Skill invocation via Main↔Sub-agent
- ACP is more standardized; our approach is more direct

### Strategic Question
Should we adopt ACP-like protocol for Main↔Sub-agent communication?
- **Pros**: Interoperability, ecosystem compatibility, standardized discovery
- **Cons**: Additional abstraction layer, complexity, potential over-engineering

### Industry Trend Confirmation
Multiple signals pointing to "Agent OS" as the dominant architecture:
- OpenClaw 3.7 with ACP
- Our Main↔Sub-agent harness design
- Agent-OS-as-coordination-layer paradigm emerging

## Comparison: MCP vs ACP

| Protocol | Scope | Purpose |
|----------|-------|---------|
| MCP | Tool↔Model | Standardize tool descriptions and invocations |
| ACP | Agent↔Agent | Standardize agent discovery and collaboration |

MCP answers "what tools can I use?"
ACP answers "what agents can I collaborate with?"

---
*Relevant to: Bob (architecture vision), tech-lead (protocol design decisions)*
