# Synthesis: Coordination Theory & The Sophistication Tax (P206)

**Date:** 2026-03-15
**Source:** Scout CR#98, CR#97
**Related:** P201 (Navigation), P82 (Handoffs)

## The Problem: The Sophistication Tax (GUS Law 1)
Scout's Cross-Reference #98 confirms that "Coordination Theory" is the critical gap in multi-agent research (only 4.7% of papers).
Our own data (CR#97) proves this:
- **Cascade Family A (Assumption → Verification)** accounts for 24% of all multi-error sessions.
- This is a coordination failure: Agent A assumes Agent B's state, or Agent A acts without verifying the shared state.
- As we add agents (Evaluator, Coach, Monitor), the "Sophistication Tax" increases. Performance degrades because coordination overhead > capability gain.

## The Mechanism: Implicit vs. Explicit Coordination
Currently, our coordination is **Implicit**:
- We use `send(agent, message)` which is "Fire and Forget".
- We write to `todo.md` and hope the agent reads it.
- We rely on `heartbeat.md` to pick up tasks.

This mimics "UDP" (User Datagram Protocol) — fast, unreliable, no state tracking.
We need "TCP" (Transmission Control Protocol) — connection-oriented, reliable, state-tracking.

## The Solution: Coordination Contracts (RAEV Loop)
We must move from "Delegation as a Message" to "Delegation as a State Machine".

**The RAEV Loop:**
1. **R**equest: Sender defines the contract (Task, Success Criteria, Deadline).
2. **A**cknowledge: Receiver accepts the contract (or negotiates).
3. **E**xecute: Receiver performs work.
4. **V**erify: Sender (or Oracle) validates the contract is met.

## Principle 206: Coordination Contracts
> "Every delegation is a state transition, not just a message. Do not assume receipt; require acknowledgement. Do not assume success; require verification. Complexity taxes coordination; formalized contracts are the rebate."

## Design Implications
1. **Tooling**: `send()` is insufficient for high-stakes delegation. We need `delegate(agent, contract_id)` or `open_contract()`.
2. **Artifacts**: `todo.md` is a passive queue. We need `contracts.jsonl` or `delegation_log.md` that tracks the state of every handoff (OPEN -> ACK -> DONE -> VERIFIED).
3. **Behavior**: Agents must "Close the Loop". If you receive a task, you must explicitly ACK it. If you finish, you must provide a "Receipt" for verification.

## Strategic Fit
This solves the **Navigation Paradox** (P194) and **Cascade Family A** (CR#97) by forcing an "Ack" step where the receiver validates they can find the resources before starting. It breaks the "Wrong Assumption" chain.
