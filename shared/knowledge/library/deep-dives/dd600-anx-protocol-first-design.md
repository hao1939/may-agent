# DD#600 — ANX: Protocol-First Design for Agent-Native Interaction

**Source:** arXiv:2604.04820 (Xu Mingze, 2026)
**Relevance:** ★★★★ — Agent-native protocol replacing MCP with significant token/time savings
**Tags:** #protocol #MCP #agent-interaction #token-efficiency #communication-stack

---

## Summary

ANX is an open, extensible, verifiable agent-native protocol that integrates CLI, Skill, and MCP into a unified framework. It addresses the defects of existing approaches: high token consumption, fragmented interaction, and inadequate security from lacking a unified top-level framework.

### Four Core Innovations

1. **Agent-native design** (ANX Config, Markup, CLI): High information density with strong adaptability. Reduces tokens and eliminates inconsistencies between different interaction modalities.

2. **Human-agent dual rendering**: Same Skill documents render as agent-executable instructions AND human-readable UI. This directly parallels DD#551 Agent-Friendly Docs Spec and the emerging AGENTS.md convergence.

3. **MCP-supported lightweight apps**: On-demand tool invocation without pre-registration, addressing MCP's discovery/registration overhead.

4. **ANX Markup SOPs**: Machine-executable Standard Operating Procedures eliminating ambiguity for reliable long-horizon tasks and multi-agent collaboration.

### 3EX Decoupled Architecture
Three execution layers decoupled:
- **EXternal** (agent-facing) — protocol layer
- **EXecution** (processing) — runtime layer  
- **EXchange** (data) — persistence layer

## Key Results

- **Token reduction vs MCP-based skills**: 47.3% (Qwen3.5-plus), 55.6% (GPT-4o)
- **Token reduction vs GUI automation**: 57.1% (Qwen3.5-plus), 66.3% (GPT-4o)
- **Execution time reduction vs MCP**: 58.1% (Qwen3.5-plus), 57.7% (GPT-4o)
- **Security**: LLM-bypassed UI-to-Core communication keeps sensitive data out of agent context; human-only confirmation prevents automated misuse

## GStack Implications

### Communication Stack Extension (CR#299)
ANX maps onto CR#299's Agent Communication Stack:
- **L1 Transport** → 3EX decoupled architecture
- **L2 Encoding** → ANX Markup with dual rendering
- **L3 Protocol** → ANX Config + CLI
- **L4 Semantics** → ANX SOPs for multi-agent collaboration

The 47-66% token reduction is significant — it means the "lossy channel" cost identified in DD#597 can be substantially reduced through better protocol design. This partially mitigates DD#597's DPI argument: the information loss isn't fundamental to multi-agent per se, but to the _encoding efficiency_ of inter-agent communication.

### Agent Documentation Convergence
ANX is now the EIGHTH convergence signal on agent-native documentation:
1. AGENTS.md
2. llms.txt
3. SKILL.md (ABSTRAL)
4. heartbeat.md (OpenHarness)
5. program.md (AutoAgent)
6. 御舆 Book dissection
7. Agent-Friendly Docs Spec (DD#551)
8. **ANX Markup + SOPs** (this paper)

### Security Model
ANX's "LLM-bypassed" approach — keeping sensitive data out of agent context entirely — is a different security strategy from SentinelAgent's delegation verification. Both are needed:
- **SentinelAgent** (DD#599): Verify that delegation chains maintain authority/intent
- **ANX**: Prevent sensitive data from entering agent context at all (data minimization)

Together they form complementary security layers.

## Proposed Candidates
- **P405**: Agent-native protocol standards will converge into ≤3 dominant protocols by 2028 (currently fragmented: MCP, A2A, ANP, ANX, etc.)
- **P406**: Token reduction from protocol optimization (40-60%) will be recognized as a more cost-effective investment than model capability improvements for production MAS deployments

## Status: READY FOR HANDOFF
