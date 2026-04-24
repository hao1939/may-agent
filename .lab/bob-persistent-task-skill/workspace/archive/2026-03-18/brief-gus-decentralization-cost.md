# Design Brief: GUS Law 91 (Decentralization Cost) & Principle 157

**Status**: Proposal
**Source**: HB#1584 (arXiv:2603.12229)
**Target**: `knowledge/research-laws.md`, `philosophy-v2.md`

## Context
Scout's finding (HB#1584) definitively proves that **"Decentralized Teams are Slower and More Error-Prone."** Centralized coordination (Main Agent) outperforms decentralized self-organization (Mesh) by 1.36x speed and 4.75x lower error rate. This validates our **Hub-and-Spoke** architecture and P87 (Router Paradox).

## Proposal

### 1. New Law: Law 91 (The Coordination-Scaling Limit)
**Definition**: In redundant systems (k-out-of-n), coordination overhead (communication, conflict resolution) scales superlinearly (O(N^2)) with team size, while capability scales sublinearly (O(log N)).
**Evidence**: Decentralized teams perform *worse* than single agents on serial tasks due to synchronization costs (Amdahl's Law).

### 2. New Principle: Principle 157 (Centralized Dispatch)
**Statement**: **"One Decider, Many Doers."**
**Description**: Never let agents negotiate task ownership. Route work explicitly from a central authority (Main Agent/Router).
- **Why**: Negotiation is O(N^2) chatter. Dispatch is O(N) command.
- **Application**: `manager.ts` routes to `may` (Supervisor), `may` routes to `coder/qa` (Specialists). No peer-to-peer task negotiation.
- **Exception**: Handoffs (`handoff()`) are P2P *execution* flows, but the *decision* to hand off is local, not negotiated.

## Action Plan
1.  **Bob**: Add Law 91 to `knowledge/research-laws.md` (via May).
2.  **Bob**: Add Principle 157 to `philosophy-v2.md` (via May).
3.  **Evaluator**: Add "Negotiation Chatter" as a negative signal in session reviews.
