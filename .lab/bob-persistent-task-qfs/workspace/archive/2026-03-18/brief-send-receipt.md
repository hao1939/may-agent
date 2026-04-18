# Design Brief: Common Sense Infra — Send Receipt

**Status**: PROPOSED
**Owner**: Tech-Lead
**Architect**: Bob

## Context
Common Sense item 5.2 (Use the right channel) and 1.1 (Acknowledge) state that agents should reliably coordinate.
Currently, `agents.send()` is fire-and-forget. The sender has no confirmation that the message was received or that the target agent is alive, other than the tool returning "Message sent".
If the target agent crashes or the message is lost (e.g., file write error), the sender assumes success but the task is dropped.

## Problem
- **Silent Failure**: Sender thinks "I delegated X", but X never happens.
- **No Feedback**: Sender cannot distinguish "Target busy" from "Target dead".
- **Blind Handoff**: Sender has to manually check `agents/target/workspace/todo.md` to verify receipt (an extra step often skipped).

## Solution
Implement a **Receipt Mechanism** for `agents.send()`.
When `agents.send()` is called, it should return a **Receipt ID** (e.g., `msg_123`) and a status indicating the message was successfully written to the target's queue.
Crucially, the *target agent* should automatically acknowledge receipt when it processes the message (future state).
For now, the **infrastructure** should guarantee that `send()` only returns success if the message is durably persisted in the target's `todo.md`.

## Mechanism
1.  **Tool Update**: `agents.send(agent, message)` currently appends to `todo.md`.
2.  **Verification**: The tool implementation must *read back* the `todo.md` to verify the append before returning success.
3.  **Return Value**:
    -   Current: `Message sent to [agent].`
    -   New: `Message sent to [agent]. Receipt: [id]. Verified in todo.md.`
4.  **Failure Mode**: If the write fails or verification fails, `send()` must throw an error, forcing the sender to retry or escalate.

## Implementation Specs
1.  **Modify `src/lib/tools/agents.ts`**:
    -   In the `send` function:
    -   Generate a unique ID (or timestamp).
    -   Read target `todo.md`.
    -   Append message.
    -   *Read target `todo.md` again* to verify the message exists.
    -   If verified, return success with ID.
    -   If not, throw "Delivery failed".
2.  **Timeout**: Ensure verification doesn't hang.

## Success Criteria
- **Zero Silent Drops**: If `send()` returns success, the message is guaranteed to be in the file.
- **Explicit Failure**: Agents catch delivery failures immediately.

## Action
- Tech-Lead to implement read-after-write verification in `agents.send()`.
