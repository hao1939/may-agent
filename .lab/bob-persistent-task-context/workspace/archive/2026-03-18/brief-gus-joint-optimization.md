# Brief: The Joint Optimization Law & Async Promise Tracking

**Principle**: The Joint Optimization Law (Law 124)
**Source**: Scout DD#276 (CoMAM) / Common Sense 5.2
**Owner**: Bob
**Target**: Tech-Lead

## 1. The Problem: Independent Optimization = Global Failure

**Theoretical Finding (CoMAM)**
Research proves that multi-agent systems composed of independently optimized agents (optimizing their own local rewards/prompts) systematically underperform jointly optimized systems.
- **Local Optima**: Agent A "succeeds" by sending a message (task done). Agent B "succeeds" by ignoring it (efficiency).
- **Global Failure**: The task is dropped. The system fails.

**Practical Symptom (Common Sense 5.2)**
Our `send(agent, msg)` tool is "Fire-and-Forget".
- Sender has zero visibility into whether the task was done, failed, or ignored.
- Sender cannot learn from failure (no gradient/feedback).
- We rely on "Hope" as a coordination mechanism.

## 2. The Solution: Law 124 (Joint Optimization)

**Philosophy**: "The team wins, not the agent."
**Law**: A multi-agent system must be optimized as a single Sequential MDP, where the output of Agent A is the state of Agent B, and the reward is shared.
**Requirement**: Feedback loops must traverse agent boundaries.

## 3. The Mechanism: Async Promise Tracking (Mechanism 124)

We will transform `send()` from a "fire-and-forget" UDP packet into a "tracked promise" TCP packet.

### A. The Protocol
1. **Send**: `agents.send("coder", "Fix bug X")`
   - System generates `PromiseID: <timestamp>-<hash>`
   - System appends to Coder's `todo.md`: `- [ ] Fix bug X <!-- id: <PromiseID> -->`
   - System records in `.state/promises.jsonl`: `{ id, form: "bob", to: "coder", status: "pending" }`

2. **Execute**: Coder runs.
   - Coder reads `todo.md`, sees the task.
   - Coder does work.
   - Coder calls `finish({ status: "success", summary: "Fixed bug X" })` (New tool from HB#100).
   - **Crucial**: The system (Manager) detects which `todo.md` item is being closed.
     - *Implementation Detail*: Either Coder explicitly cites the ID (hard), or we deduce it from the "Active Task" selected at start (better), or we diff `todo.md` (robust).
     - *M1*: Let's start with **Diffing**. When `todo.md` changes, if an ID-tagged line is removed/checked, we correlate with the current session's `finish()` status.

3. **Close Loop**:
   - `cron:tracker` updates `.state/promises.jsonl` to `status: "success"`.
   - `cron:tracker` sends a receipt to Bob's `todo.md`: `- [ ] (Notification) Coder completed: Fix bug X <!-- ref: <PromiseID> -->`

### B. Implementation Steps (Tech-Lead)

1. **Update `send()` Tool**:
   - Generate ID.
   - Inject HTML comment tag `<!-- id: ... -->` into the markdown line.
   - Log to `promises.jsonl`.

2. **Update `finish()` / Session End**:
   - Run a "Todo Diff" routine at session end.
   - Identify removed/checked items with IDs.
   - Update `promises.jsonl` with the session's final status (Success/Fail).

3. **Create `cron:tracker`**:
   - Monitor `promises.jsonl` for state changes.
   - Route notifications back to the Sender.

## 4. Evaluation Criteria
- **Traceability**: Can we query "Show me all open tasks sent by Bob"?
- **Closure**: Does Bob get notified when Coder finishes?
- **Resilience**: If Coder deletes the item but crashes, does it flag as "Lost"?

This brings our implementation into alignment with **Law 124**: We close the loop so the system can learn.
