# Deep Dive: Agent2Agent Threats in Safety-Critical LLM Assistants: A Human-Centric Taxonomy

## Metadata
- **Paper**: arXiv:2602.05877
- **Title**: Agent2Agent Threats in Safety-Critical LLM Assistants: A Human-Centric Taxonomy
- **Date**: February 2026
- **Deep-dive date**: 2026-04-02

## TL;DR
Proposes a human-centric taxonomy for threats that emerge specifically from agent-to-agent interactions in safety-critical LLM assistant deployments (healthcare, finance, autonomous systems). Focuses on how inter-agent communication channels create novel attack surfaces beyond single-agent vulnerabilities.

## Key Contributions
1. **Human-Centric Threat Taxonomy**: Classifies agent-to-agent threats through the lens of human impact — distinguishing threats by severity of downstream consequences to end users in safety-critical domains
2. **Inter-Agent Attack Surface Analysis**: Maps how agent-to-agent communication protocols (message passing, shared memory, tool delegation) create exploitable channels
3. **Safety-Critical Domain Focus**: Specifically analyzes healthcare, finance, and autonomous systems where agent-to-agent failures have catastrophic consequences
4. **Threat Categories**:
   - **Impersonation attacks**: One agent mimics another's identity/authority
   - **Delegation poisoning**: Malicious task delegation chains
   - **Consensus manipulation**: Corrupting multi-agent voting/agreement mechanisms
   - **Information laundering**: Passing untrusted information through trusted agents to bypass safety filters
   - **Cascading failure induction**: Triggering chain reactions across agent networks

## Architecture & Methodology
- Survey-based taxonomy construction drawing from security literature, incident reports, and red-teaming exercises
- Human-in-the-loop evaluation of threat severity
- Maps threats to existing defense mechanisms and identifies coverage gaps

## Relevance to Our Research (★★★★★)
**Extremely high relevance**. This paper directly addresses the agent-to-agent threat landscape that our multi-agent safety research focuses on. Key connections:
- **Information laundering** maps directly to our "trust laundering" concept from the trust verification work
- **Cascading failure** connects to our 4D attack surface model's temporal dimension
- **Delegation poisoning** is a specific instance of the authority confusion attacks we've been tracking
- Complements our existing deep-dives on TrustBench, MAST, and the attack/defense landscape papers

## Limitations
- Taxonomy is conceptual — limited empirical validation of specific attack success rates
- Safety-critical domain focus may miss threats in less critical but more common deployment scenarios
- Human-centric framing, while valuable, may underweight systemic/infrastructure-level threats

## Key Quotes & Findings
- Agent-to-agent communication channels are fundamentally more exploitable than human-to-agent channels because agents lack the contextual skepticism humans naturally apply
- Information laundering (passing malicious content through trusted agent intermediaries) is identified as the highest-impact novel threat category
- Current multi-agent frameworks have essentially zero defenses against impersonation attacks between agents

## Connections to Other Papers
- Extends the attack taxonomy from "The Attack and Defense Landscape of Agentic AI" (2603.11088) to the multi-agent case
- Complements TrustBench (2603.09157) — provides the threat model that trust verification systems need to defend against
- Related to MAST (2603.09485) — both address multi-agent safety but from different angles (threats vs. testing)
- Connects to our delegation safety work (CoDeSA, safe delegation patterns)
