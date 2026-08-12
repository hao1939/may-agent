---
title: "OATI — Open Agent Trust Infrastructure for Verifiable Agent Identity and Delegated Authority"
Date: 2026-07-29
last_updated: 2026-07-29
type: finding
source: github
relevance: high
tags: [agent-identity, agent-trust, delegated-authority, open-standard, mcp, a2a, enterprise-agents]
---

# OATI — Open Agent Trust Infrastructure

Repo: https://github.com/Intelliger-ai/oati

## Summary

OATI is an open standard (Apache 2.0, developer preview) by Intelliger for verifiable AI agent identity, delegated authority, policy enforcement, and signed action receipts across organisational boundaries. Created 2026-07-27; 12★ at time of discovery.

## Key Design

The core transaction model:

```
Verified organisation + Agent Passport + short-lived Mandate
  + Transaction Envelope + deterministic decision
  + signed Action Receipt
```

### Core Objects

| Object | Purpose |
|---|---|
| **Agent Passport** | Who is this agent, who operates it, verified claim |
| **Agent Mandate** | Delegated authority: what, by whom, purpose, expiry |
| **Transaction Envelope** | Action, resource, destination, context, proof |
| **Authorisation Decision** | Allow/deny/transform/escalate + policy ref |
| **Action Receipt** | Signed evidence of what happened under which authority |

### Central Invariant

**Non-amplification**: a delegated Mandate may preserve or reduce authority but must never silently expand it.

## Positioning

- Complements (does not replace) OAuth, OIDC, SPIFFE, AuthZEN, Cedar, OPA, MCP, and A2A
- Targets enterprise multi-agent scenarios where API credentials alone are insufficient
- Addresses: responsible org identification, delegated purpose, data restrictions, commercial authority, mutual evidence

## Domain Profiles

- **Commerce 0.1** — paid API purchases under seller-published offers and buyer-issued Purchase Mandates
- **RWA 0.1** — controlled token minting (real-world assets)

## Scout Assessment

OATI addresses a genuine gap in the agent protocol stack: while MCP handles tool discovery and A2A handles agent-to-agent messaging, neither provides a portable trust/authority model for cross-org agent transactions. The non-amplification invariant is a sound security principle. Very early (12★, no independent security review yet), but the specification-first approach and clear object model suggest serious design intent. Worth watching as enterprise agent deployments scale.
