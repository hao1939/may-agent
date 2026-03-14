# Design: Ops Gates (Verified Handoffs)

**Status:** Implementation
**Owner:** Bob
**Implementer:** Tech-Lead (Ops Gate) / May (Coordinator)
**Reference:** arXiv:2603.07496 (HAE), arXiv:2603.08024 (ConflictBench)

## Context
Multi-agent systems suffer from **Alignment Degradation** (93% -> 47%) and **Privacy Leakage** (2^N) in sequential pipelines. Unverified handoffs between agents allow errors to propagate and amplify.
A handoff from Agent A to Agent B (e.g., Coder -> May) is currently trusted based on text ("I fixed it"). This is a security vulnerability.

## The Solution: Verified Handoffs (Ops Gates)
We enforce **P61 Ops Gates** at the *delegation boundary*. A handoff is only valid if accompanied by a **Verifiable Artifact** (Receipt).

### The Protocol
1.  **Request**: Agent A asks Agent B to do Task X.
2.  **Execution**: Agent B performs work.
    *   *Ops Gate*: B runs tests. `run_test` returns `ops_receipt_123`.
3.  **Handoff**: Agent B returns result *with* the receipt.
    *   `return "Fixed bug Y. Verified by receipt: ops_receipt_123."`
4.  **Verification**: Agent A (or May) *must* verify the receipt before accepting the task as done.
    *   If no receipt is provided, the handoff is **REJECTED**.

### Implementation Plan
1.  **Philosophy**: Updated **P20 Short Chains** in `agents/shared/philosophy.md` to mandate "Verified Handoffs". (Done)
2.  **Tool Enforcement**: `agents.call` should support schema validation enforcing `receipt_id`. (Future)
3.  **Coordinator Loop**: May's core loop check for receipts. (Future)

### Verification Logic (L3)
*   **Drift Detection**: Absence of receipts is a drift signal.
*   **Propagation Block**: Unverified output never becomes input.

## Action
Delegating to Tech-Lead to implement `agents.call` validation schema (optional parameter) or updated `agents.call` documentation.
