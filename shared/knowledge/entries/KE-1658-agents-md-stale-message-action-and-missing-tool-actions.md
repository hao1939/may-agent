<ai_context>
takeaway: The agents.md design doc listed `message` as an agents-tool action, but agents.message/agents.send were removed in commit d15c5249 and replaced by a separate `message` tool (src/lib/tools/message-tool.ts). The design doc also omitted five valid agents-tool actions: list, peek, cancel, context, requests. Fixed 2026-06-08 to reflect the actual runtime: agents tool has 7 actions (call, fork, list, peek, cancel, context, requests); message is a separate tool. The sdk.message() path still works and is unchanged.
triggers: agents.md, design doc, stale action, message tool, agents tool, coherence audit
</ai_context>

# KE-1658: agents.md Stale Message Action and Missing Tool Actions

**Created**: 2026-06-08
**Agent**: arc (heartbeat coherence audit)
**Type**: Design doc fix
**Confidence**: High — verified against runtime source (agents-tool.test.ts, manager-agents-tool.ts, message-tool.ts)
**Connects**: KE-1622 (implement-and-verify dissolution), KE-1628 (workflow stale references)

---

## What Was Wrong

`shared/may-agent-docs/2a-design/agents.md` had two staleness issues:

### 1. Stale `message` action in the agents tool

The Calling Patterns table listed `message` as an agents-tool action:

```
| `message` | Fire-and-forget — inbox pickup | FYI notification, not time-sensitive |
```

But `agents.message` and `agents.send` were removed in commit d15c5249 (notify-split). The runtime now returns a deprecation error:

> "The agents.message and agents.send actions have been removed. Use the message tool..."

The replacement is the standalone `message` tool at `src/lib/tools/message-tool.ts`, which offers `message({ to, content, intent?, priority? })`.

### 2. Missing valid actions

The agents tool currently supports 7 actions: `call`, `fork`, `list`, `peek`, `cancel`, `context`, `requests`. The design doc only listed `call`, `fork`, and the deprecated `message`.

## What Changed

Updated `agents.md` to:
- Split the calling patterns into "agents tool actions" (7 actions) and "message tool" (separate)
- Note the deprecation of agents.message/agents.send
- Add the implementation path for message-tool.ts
- Update "When to Use What" table to distinguish `fork` (agents tool) from `message` (separate tool)

## Evidence

- `manager-agents-tool.ts` line 255: message/send actions return deprecation error
- `agents-tool.test.ts` line 184: test comment confirms removal in commit d15c5249
- `message-tool.ts`: defines the v2 replacement tool
- `sdk/src/index.ts` line 330: `sdk.message()` still exists at SDK level

## Impact

Any agent reading agents.md as a reference for inter-agent communication patterns would see a stale 3-action model when the tool actually has 7 actions. The `message` confusion could lead agents to try `agents.message(...)` which returns a confusing deprecation error.
