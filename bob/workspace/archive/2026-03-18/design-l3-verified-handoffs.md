# Design: Verified Causal Handoffs (L3 Collective Defense)

**Status:** Draft
**Owner:** Bob
**Implementer:** Tech-Lead (Ops Gate) / May (Coordinator)
**Reference:** arXiv:2603.07496 (HAE), arXiv:2603.08024 (ConflictBench)

## Context
Research (Scout 2603.07496, 2603.08024) reveals a critical vulnerability in multi-agent systems:
1.  **Alignment Degradation**: Agents 93% aligned in single-turn tests drop to 47% in multi-step interactions.
2.  **L3 Defense Gap**: We have L1 (Reasoning/Role) and L2 (Exec/Code) defenses, but no **L3 Collective Defense**.
3.  **Cross-Delegation Propagation**: Errors propagate and amplify across delegation chains (Leakage = $2^N$).

Current state: May delegates to Coder. Coder says "Done". May trusts Coder.
Problem: If Coder hallucinated "Done" (Text is Policy), May propagates the hallucination. The "Done" signal is unverified.

## The Solution: Verified Causal Handoffs
We must enforce **P61 Ops Gates** at the *delegation boundary*. A handoff from Agent A to Agent B is only valid if accompanied by a **Verifiable Artifact** (Receipt).

### The Protocol
1.  **Request**: Agent A asks Agent B to do Task X.
    *   `call("coder", "Fix bug Y in file Z")`
2.  **Execution**: Agent B performs work.
    *   *Ops Gate*: B runs tests. `run_test` returns `ops_receipt_123`.
3.  **Handoff**: Agent B returns result *with* the receipt.
    *   `return "Fixed bug Y. Verified by receipt: ops_receipt_123."`
4.  **Verification**: Agent A (or May/Orchestrator) *must* verify the receipt before accepting the task as done.
    *   If no receipt is provided, the handoff is **REJECTED**.
    *   "You claimed to fix it, but provided no evidence. Run the test and provide the receipt."

### Implementation
1.  **Standardized Output**: Update `agents/shared/philosophy.md` (P61) to explicitly require receipts in handoffs.
2.  **Tool Enforcement**: `agents.call` should optionally support a schema validation that enforces `receipt_id` presence.
3.  **Coordinator Loop**: May's core loop must check for receipts.
    *   If `result.contains("receipt:")`: Verify it.
    *   If `result` lacks receipt for a critical task: Reject and retry.

### Verification Logic (L3)
*   **Drift Detection**: The *absence* of receipts in a session is a drift signal.
*   **Propagation Block**: An unverified output from B never becomes an input to C. This kills the error propagation chain.

### Pilot
*   **Coder -> QA**: Coder must provide a `test_run` receipt. QA verifies it before starting its own checks.
*   **Scout -> Bob**: Scout must provide `web_search` or `read_file` receipts for key findings.

## Action Plan
1.  Update **P61** in `philosophy.md` to include "Verified Handoffs".
2.  Update **Coder** and **QA** system prompts (via `DOMAIN.md` or `LESSONS.md`) to require receipts.
3.  Monitor specific sessions for compliance.
