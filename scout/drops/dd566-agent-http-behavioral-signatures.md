# DD#566 — Developer Experience with AI Coding Agents: HTTP Behavioral Signatures

**Date**: 2026-04-07 (Session 284)
**Source**: [arXiv 2604.02544](https://arxiv.org/abs/2604.02544) — Yadav et al. (cs.SE, April 2026)
**Rating**: ★★★★ — First empirical study of agent documentation consumption behavior

---

## Summary

First empirical analysis of how **9 coding agents** (Copilot, Cursor, Windsurf, Devin, etc.) consume developer documentation. Key findings:

### Behavioral Signatures
- Each agent has an **identifiable HTTP fingerprint** (request patterns, timing, headers, navigation depth)
- Agents compress multi-page navigation into **1-2 requests** (vs humans who browse 5-15 pages)
- Traditional engagement metrics (page views, session duration, bounce rate) are meaningless for agent traffic

### Emerging Standards
- **AGENTS.md**: Agent-specific instructions file (analogous to robots.txt but with guidance)
- **llms.txt**: Machine-readable documentation format gaining adoption
- **skill.md**: Task-specific capability descriptions for agents
- **agent-permissions.json**: Structured permission declarations

### Documentation Impact
- Agent-optimized documentation shows measurably better agent performance
- The "documentation quality → agent quality" pipeline is empirically validated
- Agent-unfriendly documentation is a direct contributor to agent failures

---

## Why This Matters

Extends the Input Quality Thesis (CR#297): **Output = f(Knowledge × Instruction × Reasoning)**. This paper provides empirical evidence that the Knowledge input to agents is shaped by documentation infrastructure that was designed for humans, not agents.

The emerging standards (AGENTS.md, llms.txt, skill.md) represent the beginning of a **dual-audience documentation infrastructure** — content designed to serve both human readers and agent consumers.

---

## Connections

- **CR#297** (Input Quality Thesis): Empirically validates that input quality is the cheapest lever — documentation infrastructure investment has direct agent performance returns
- **DD#551** (Agent-Friendly Docs Spec): Extends the 22-check spec with empirical behavioral data from real agents
- **DD#565** (Beyond Resolution Rates): Agent context-gathering behavior (documented here at HTTP level) predicts success (documented there at trajectory level)
- **DD#468** (ABSTRAL): The SKILL.md concept in ABSTRAL is now an emerging community standard
- **DD#556** (Effort Crisis): Agent-unfriendly documentation amplifies the quality regression — agents can't compensate for bad inputs regardless of effort level

---

## Novel Concepts

- **HTTP Behavioral Fingerprinting**: Identifying agents by their documentation access patterns
- **Engagement Metric Invalidity**: Traditional web analytics are meaningless for agent traffic
- **Dual-Audience Documentation**: Content designed for both human and agent consumers
- **Agent Documentation Standards**: AGENTS.md, llms.txt, skill.md, agent-permissions.json

---

## Deep Dive

→ [DD-566-agent-http-behavioral-signatures-documentation.md](../knowledge/library/deep-dives/DD-566-agent-http-behavioral-signatures-documentation.md)
