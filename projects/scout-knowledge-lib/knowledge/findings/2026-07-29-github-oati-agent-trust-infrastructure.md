---
title: "OATI — Open Agent Trust Infrastructure for Verifiable Agent Identity and Delegated Authority"
Date: 2026-07-29
last_updated: 2026-09-14
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

## HN update — withhold human authority from the agent interface (2026-09-14)

HN surfaced [Kepil](https://news.ycombinator.com/item?id=49692366), an alpha local control layer that independently converges on OATI's passport-and-mandate vocabulary. Its useful addition is an **interface-topology rule**: an MCP client can inspect pending confirmations and verify the journal, but the server deliberately exposes neither confirmation nor rollback as an MCP tool. Repository tests assert both omissions. Approval therefore does not depend on asking the model to obey a prompt; the model-facing capability is absent, while an operator uses a separate panel or Telegram path.

This suggests a concrete refinement to portable delegated-authority designs: represent not only who may authorize an action, but also which interface is physically capable of exercising that authority. “Human required” is weak if the agent-facing protocol still exposes the approval mutation; capability omission makes the separation testable.

Kepil also usefully demonstrates the boundary between an accountability record and an external effect. At inspected revision `1a0014973f21f353dc74d0fb99e2f5b60b539de2`, `ActionGateway.check()` explicitly returns a decision without executing anything. The rollback path looks up a declared compensation, appends an operator-attributed journal entry, and marks the step rolled back, but the inspected function does not invoke an external adapter or observe the compensating effect. The hash-linked journal can therefore evidence what this local control layer recorded; it does not by itself prove that either the original action or its compensation happened in the outside system.

Treat this as implementation-pattern evidence, not production validation: the repository was created four days before inspection, reported one star and 115 project-authored tests, and had no HN discussion beyond the submission at check time.

- **HN:** https://news.ycombinator.com/item?id=49692366
- **Repo:** https://github.com/oleg-vdv/kepil
- **Inspected revision:** https://github.com/oleg-vdv/kepil/commit/1a0014973f21f353dc74d0fb99e2f5b60b539de2
- **Primary sources:** [MCP tool surface and handlers](https://github.com/oleg-vdv/kepil/blob/1a0014973f21f353dc74d0fb99e2f5b60b539de2/src/kepil/mcp/server.py), [MCP authority-separation tests](https://github.com/oleg-vdv/kepil/blob/1a0014973f21f353dc74d0fb99e2f5b60b539de2/tests/test_mcp.py), [gateway decision boundary](https://github.com/oleg-vdv/kepil/blob/1a0014973f21f353dc74d0fb99e2f5b60b539de2/src/kepil/gateway/action_gateway.py), and [operator confirmation and rollback bookkeeping](https://github.com/oleg-vdv/kepil/blob/1a0014973f21f353dc74d0fb99e2f5b60b539de2/src/kepil/orders/service.py)
