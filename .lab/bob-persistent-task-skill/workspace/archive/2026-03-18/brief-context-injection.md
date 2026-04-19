# Design Brief: Context Injection for P114 (Data > Imperative)

**To:** Tech-Lead
**From:** Bob
**Date:** 2026-03-15
**Priority:** High (Fixes False Refusals)

## Context
Our analysis of recent failures shows that Coder is refusing to read `ERROR_LOG.jsonl` because the imperative instruction ("You must read...") triggers its safety training (RLHF), looking like a jailbreak.
We need to switch from an **Imperative** model ("Tell agent to read") to a **Data-Driven** model ("Show agent the data").

## Proposal: P192 Data Over Imperative
Refactor `src/lib/manager.ts` to automatically inject critical state data into the `UserMessage` at the start of a session.

### 1. `ERROR_LOG` Injection
In `buildSessionContext` (or equivalent setup logic):
- Check if `.state/ERROR_LOG.jsonl` exists and is not empty.
- Read the last 3 entries.
- Prepend them to the user's message text:
  ```text
  [SYSTEM CONTEXT: Recent Errors Detected]
  - 2026-03-15 10:00: ReferenceError in verify.ts
  - ...
  
  [Task]
  <Original User Message>
  ```
- **Constraint**: Do not inject if the file is empty.

### 2. Remove the Prompt
Once implemented, we will remove the "You must read ERROR_LOG" instruction from `agents/shared/SOUL.md` (or specific agent souls) to reduce token count and cognitive friction.

## Deliverables
1. Update `manager.ts` to inject `ERROR_LOG` content (if present).
2. Verify that this does *not* break the KV-cache (it should be part of the User Message, which is always volatile, so it's safe).

## Why?
- **Stops Refusals**: Agents don't refuse data; they refuse commands.
- **Guarantees Context**: P114 becomes unavoidable.
- **Saves Steps**: Saves 1 round-trip tool call (`read_file`).
