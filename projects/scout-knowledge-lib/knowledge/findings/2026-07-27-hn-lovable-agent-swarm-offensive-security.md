# Lovable: AI Agent Swarms for Offensive Security via Capture-the-Flag

**Date**: 2026-07-27
**Source**: https://lovable.dev/blog/how-we-run-swarms-of-ai-hacking-agents-against-ourselves
**HN**: https://news.ycombinator.com/item?id=49070224
**Type**: Finding
**Tags**: agent-security, offensive-security, red-teaming, agent-swarm, verification

## Summary

Lovable (AI app builder) published a detailed account of their internal offensive security program where swarms of AI agents play capture-the-flag against their own production infrastructure. Unlike traditional AI security scanners that produce "low severity slop," their approach requires agents to retrieve planted flags as deterministic proof of exploitability — ground truth, not model hunches.

## Key Design Patterns

1. **Flag-based verification**: Flags scattered across infrastructure and privileged product surfaces. No intentional vulnerabilities planted. A captured flag = proof of a real vulnerability. This eliminates false positives entirely.

2. **Maximize attack surface, minimize attack distance**: Give agents access to every product surface (including internal tool APIs normally behind LLM machinery). Invite attacker as collaborator on synthetic project. Hard paths subsume easy paths.

3. **Prompt engineering for persistence**: "Never ask an agent to check whether a vulnerability exists" — instead tell it the vulnerability is real and its job is to find it. Asking to "check" lets agents treat clean passes as success and quit early.

4. **Cost-aware orchestration**: Different bug classes warrant different strategies. Cheap models with hundreds of subagents can scan for specific behaviors, with exploitation reserved for promising vectors. Human knowledge guides where not to look.

5. **Agents don't replace humans**: Human offensive researchers still needed for coordination, architectural understanding, and cost-effectiveness. The swarm handles grunt work of finding footholds.

## Relevance to AI Agents

- **Verification-first agent design**: The CTF pattern — requiring agents to produce deterministic proof artifacts — is generalizable beyond security. Any agentic workflow benefits from ground-truth verification rather than model self-assessment.
- **Swarm economics**: Cost/efficiency tradeoffs in multi-agent orchestration are central. Token burn vs. coverage is the key tension.
- **Agent persistence via goal framing**: The prompt trick (assert the bug exists, never ask "does it exist?") reveals how goal framing dramatically affects agent persistence and thoroughness.
- **In-house necessity**: Can't be commoditized easily — requires deep architectural knowledge, making it a pattern that favors teams building their own agent infrastructure.

## Connections

- Relates to [Kimi K3 Redis exploit incident](2026-07-25-hn-coding-agent-exploits-infrastructure.md): Lovable's program is the defensive counterpart — using agent capability offensively but intentionally, rather than discovering it accidentally.
- Agent verification patterns connect to broader theme of grounding agent outputs in observable evidence.
