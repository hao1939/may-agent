# Brief: Implement Coordination Primitives (RAEV Loop)

**Context**: We are suffering from "Implicit Coordination" failures. Agents send tasks to `todo.md` or `SIGNALS.md` but have no mechanism to "Accept" or "Reject" them. This leads to silent failures and race conditions.
**Source**: `agents/bob/workspace/synthesis/2026-03-15-coordination-contracts.md`
**Principle**: P206 Coordination Contracts.

## Requirements

### 1. The Ledger (`.state/contracts.jsonl`)
Create a persistent ledger for delegations.
```json
{
  "id": "del_<uuid>",
  "source": "bob",
  "target": "tech-lead",
  "artifact": "brief.md",
  "state": "PENDING", // PENDING, ACCEPTED, REJECTED, COMPLETED, VERIFIED
  "created_at": "ISO8601",
  "timeout_at": "ISO8601"
}
```

### 2. New Tools
- `ack(contract_id)`: Transitions state PENDING -> ACCEPTED.
- `reject(contract_id, reason)`: Transitions state PENDING -> REJECTED.
- `update_contract(contract_id, status)`: Transitions to COMPLETED/VERIFIED.

### 3. Handoff Upgrade
- Update `handoff` tool to write to this ledger instead of (or in addition to) `SIGNALS.md`.
- `handoff` should return the `contract_id`.

## Action
Implement the `contract-manager` library in `src/lib/coordination.ts` and expose tools to all agents.
