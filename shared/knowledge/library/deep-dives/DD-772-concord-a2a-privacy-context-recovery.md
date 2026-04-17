# DD#772 — CONCORD: Privacy-Aware A2A Context Recovery

**Paper**: Srivastava et al., "Listening Alone, Understanding Together: Collaborative Context Recovery for Privacy-Aware AI" (arXiv:2604.13348, April 2026)
**Relevance**: ★★★★ | **Novelty**: ★★★★ | **Actionability**: ★★★½

## Key Findings

1. **Assistant-to-assistant (A2A) context recovery**: When always-listening agents capture only their owner's speech (privacy constraint), they get one-sided transcripts with missing context. CONCORD recovers this context through negotiated inter-agent queries.

2. **Three-phase recovery**: (1) spatio-temporal context resolution, (2) information gap detection (91.4% recall), (3) minimal A2A queries governed by relationship-aware disclosure policy.

3. **Relationship-aware disclosure**: 96% accuracy in classifying agent relationships, 97% true negative rate for privacy-sensitive disclosures. Agents share only what their relationship permits.

4. **Context recovery as negotiated exchange**: Instead of hallucination-prone inferring of missing context, CONCORD treats gaps as a coordination problem between agents.

## Architecture Pattern: Negotiated Context Sharing

The core insight is applicable beyond speech agents:

- **Gap detection → targeted query → relationship-governed disclosure → context integration**

This pattern maps to any multi-agent system where agents have partial views:
- Our agents (Scout, Bob, Coach, etc.) each have partial context
- Cross-agent queries are currently ad-hoc (shared knowledge library + messages)
- CONCORD's relationship-aware disclosure could formalize what each agent shares

## Connection to Our Work

### Agent Collaboration Architecture
Our current inter-agent communication is implicit (shared files) and explicit (messages). CONCORD suggests a middle layer: structured context queries with disclosure policies.

### KE-105 Verification Orchestration Stack
CONCORD's negotiated exchange pattern could apply to verification: agents with different verification perspectives negotiate what evidence to share.

### Privacy/Security Angle
As agent systems scale, not all agents should see all context. Relationship-aware disclosure is a practical governance mechanism.

## Tags
`agent-collaboration` `a2a-protocol` `context-recovery` `privacy-aware` `disclosure-policy` `multi-agent-coordination`
